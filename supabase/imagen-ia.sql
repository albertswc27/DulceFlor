-- =====================================================================
--  Dulce Flor — generador de imágenes orientativas con IA
--
--  Pegar ENTERO en Supabase → SQL Editor, DESPUÉS de schema.sql,
--  equipo-y-permisos.sql y ficha-sms.sql. Es idempotente.
--
--  QUÉ RESUELVE
--
--  Quien genera imágenes es un cliente ANÓNIMO en la web pública, y cada
--  generación cuesta dinero. Si el contador viviera en el navegador, bastaría
--  con borrar el almacenamiento local para generar sin límite; si viviera en
--  el pedido, no serviría, porque el pedido todavía no existe cuando la
--  clienta está configurando la tarta.
--
--  Así que el contador vive aquí, y lo incrementa el servidor ANTES de llamar
--  al proveedor. Tres puertas, de la más concreta a la más general:
--
--    1. por sesión de configuración → 2 generaciones (lo acordado con el negocio)
--    2. por cliente y día           → tope para que uno solo no acapare
--    3. por tienda y día            → TOPE DE GASTO DURO
--
--  La tercera es la que de verdad importa: pase lo que pase —un bot, un fallo
--  nuestro, un enlace compartido en un foro— el gasto del día está acotado.
--  Vercel publicó un incidente propio en el que un endpoint de IA abierto pasó
--  a 1.300 peticiones por minuto; sin este tope, eso serían decenas de miles
--  de euros.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Contadores genéricos con ventana temporal
-- ---------------------------------------------------------------------

create table if not exists public.ai_image_quota (
  quota_key   text primary key,
  used        integer not null default 0,
  window_ends timestamptz not null
);

comment on table public.ai_image_quota is
  'Contadores de uso del generador de imágenes. No guarda datos de contacto: la clave de cliente es un HMAC de la IP con sal de servidor.';

alter table public.ai_image_quota enable row level security;
-- Sin políticas y sin privilegios: la clave anon no puede tocarla. Solo la
-- función serverless, que va con service_role y no sale del servidor.
revoke all on table public.ai_image_quota from anon, authenticated;

create index if not exists ai_image_quota_window_ends_idx
  on public.ai_image_quota (window_ends);

/**
 * Consume una unidad, atómicamente.
 *
 * Es UNA sentencia a propósito: PostgreSQL toma el bloqueo de fila dentro del
 * propio INSERT ... ON CONFLICT, así que dos peticiones simultáneas se
 * serializan y el RETURNING devuelve el valor ya incrementado. El clásico
 * «leo, sumo uno y actualizo» deja pasar las dos, que es justo lo que busca
 * quien quiere saltarse el límite.
 */
create or replace function public.ai_quota_consume(
  p_key text, p_limit integer, p_window interval
) returns table (allowed boolean, used integer, resets_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_used integer; v_until timestamptz;
begin
  if p_key is null or p_key = '' or p_limit is null or p_limit < 1 then
    raise exception 'ai_quota_consume: parametros invalidos';
  end if;
  insert into public.ai_image_quota as q (quota_key, used, window_ends)
  values (p_key, 1, now() + p_window)
  on conflict (quota_key) do update
    set used        = case when q.window_ends <= now() then 1 else q.used + 1 end,
        window_ends = case when q.window_ends <= now() then now() + p_window else q.window_ends end
  returning q.used, q.window_ends into v_used, v_until;
  return query select (v_used <= p_limit), v_used, v_until;
end; $$;

/** Devuelve el cupo cuando la generación falla y no se ha pagado nada. */
create or replace function public.ai_quota_refund(p_key text)
returns void language sql security definer set search_path = '' as $$
  update public.ai_image_quota set used = greatest(0, used - 1)
   where quota_key = p_key and window_ends > now();
$$;

/**
 * Las tres puertas en UNA llamada: una transacción, un viaje.
 *
 * El orden importa. Primero la de la sesión, para poder decirle a la clienta
 * «ya has usado tus dos imágenes» en vez de un genérico. Si una puerta
 * posterior cierra, se devuelve lo ya consumido en las anteriores: sería
 * injusto gastarle una generación a alguien a quien al final no se le va a
 * generar nada.
 */
create or replace function public.ai_quota_gate(
  p_session_key text, p_ip_key text, p_day_key text,
  p_session_limit integer default 2,
  p_ip_limit integer default 6,
  p_day_limit integer default 40
) returns table (allowed boolean, reason text, session_used integer, resets_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare s record; i record; d record;
begin
  select * into s from public.ai_quota_consume(p_session_key, p_session_limit, interval '6 hours');
  if not s.allowed then
    return query select false, 'limite_sesion'::text, s.used, s.resets_at; return;
  end if;
  select * into i from public.ai_quota_consume(p_ip_key, p_ip_limit, interval '24 hours');
  if not i.allowed then
    perform public.ai_quota_refund(p_session_key);
    return query select false, 'limite_cliente'::text, s.used, i.resets_at; return;
  end if;
  select * into d from public.ai_quota_consume(p_day_key, p_day_limit, interval '24 hours');
  if not d.allowed then
    perform public.ai_quota_refund(p_session_key);
    perform public.ai_quota_refund(p_ip_key);
    return query select false, 'limite_tienda'::text, s.used, d.resets_at; return;
  end if;
  return query select true, 'ok'::text, s.used, s.resets_at;
end; $$;

/** Limpieza perezosa: la llama la función de vez en cuando. Sin cron. */
create or replace function public.ai_quota_prune()
returns integer language sql security definer set search_path = '' as $$
  with borradas as (
    delete from public.ai_image_quota where window_ends < now() - interval '2 days'
    returning 1
  ) select count(*)::int from borradas;
$$;

-- ---------------------------------------------------------------------
--  2. La sesión de generación
--
--  Guarda el identificador de la interacción anterior con el proveedor, que
--  es lo que permite REFINAR («ponle perlas blancas») editando la imagen en
--  vez de generar otra distinta. Con solo dos intentos, regenerar desde cero
--  y devolver una tarta que no se parece a la anterior es exactamente la
--  frustración que hay que evitar.
--
--  Del token solo se guarda el hash, igual que con el enlace del SMS.
-- ---------------------------------------------------------------------

create table if not exists public.ai_image_sessions (
  token_hash          text primary key,
  last_interaction_id text,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default now() + interval '6 hours'
);

comment on table public.ai_image_sessions is
  'Sesiones del generador de imágenes. Solo el hash del token y la referencia a la interacción anterior con el proveedor.';

alter table public.ai_image_sessions enable row level security;
revoke all on table public.ai_image_sessions from anon, authenticated;

create index if not exists ai_image_sessions_expires_at_idx
  on public.ai_image_sessions (expires_at);

/** Lee la interacción anterior de una sesión (null si caducó o no existe). */
create or replace function public.ai_session_previous(p_token_hash text)
returns text language sql security definer set search_path = '' as $$
  select s.last_interaction_id from public.ai_image_sessions as s
   where s.token_hash = p_token_hash and s.expires_at > now();
$$;

/** Recuerda la interacción para poder editar la imagen en el siguiente turno. */
create or replace function public.ai_session_remember(
  p_token_hash text, p_interaction_id text
) returns void language sql security definer set search_path = '' as $$
  insert into public.ai_image_sessions (token_hash, last_interaction_id)
  values (p_token_hash, p_interaction_id)
  on conflict (token_hash) do update set last_interaction_id = excluded.last_interaction_id;
  delete from public.ai_image_sessions where expires_at < now() - interval '1 day';
$$;

-- Ninguna de estas funciones se expone a la web: las llama la función
-- serverless con service_role, que nunca sale del servidor.
revoke all on function public.ai_quota_consume(text, integer, interval) from public, anon, authenticated;
revoke all on function public.ai_quota_refund(text) from public, anon, authenticated;
revoke all on function public.ai_quota_gate(text, text, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.ai_quota_prune() from public, anon, authenticated;
revoke all on function public.ai_session_previous(text) from public, anon, authenticated;
revoke all on function public.ai_session_remember(text, text) from public, anon, authenticated;

-- Y ahora hay que devolvérselo a service_role, que si no NO PUEDE LLAMARLAS.
--
-- Esto no es un detalle: `revoke ... from public` se lo lleva por delante
-- también. PUBLIC no es «los de fuera», es un grupo al que pertenecen TODOS
-- los roles, y de ahí venía el permiso de ejecución que trae por defecto
-- cualquier función. Sin un permiso explícito, la función serverless recibe
-- «permission denied for function ai_quota_gate» y no genera ni una imagen.
--
-- Solo las cinco que llama el endpoint. `ai_quota_consume` se queda fuera a
-- propósito: la llaman las otras por dentro, y como son `security definer`
-- se ejecutan con los permisos de quien las creó, no de quien las invoca.
grant execute on function public.ai_quota_gate(text, text, text, integer, integer, integer) to service_role;
grant execute on function public.ai_quota_refund(text) to service_role;
grant execute on function public.ai_quota_prune() to service_role;
grant execute on function public.ai_session_previous(text) to service_role;
grant execute on function public.ai_session_remember(text, text) to service_role;

-- ---------------------------------------------------------------------
--  3. Que el formulario público no pueda llenar el almacén
--
--  La política actual deja a `anon` subir CUALQUIER fichero de hasta 3 MB al
--  bucket, sin mirar la ruta ni cuántos. Las imágenes de la IA las escribe la
--  función serverless bajo el prefijo `ia/`, así que se le cierra a anon ese
--  prefijo: si no, cualquiera podría colocar ahí una imagen y hacerla pasar
--  por generada.
-- ---------------------------------------------------------------------

drop policy if exists "subir imagen de referencia" on storage.objects;
create policy "subir imagen de referencia"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'order-references'
    -- El prefijo ia/ queda reservado al servidor (service_role se salta RLS).
    and name not like 'ia/%'
  );

-- =====================================================================
--  Comprobación rápida
-- =====================================================================
-- select * from public.ai_quota_gate('sesion-prueba', 'ip-prueba', 'dia-prueba');
--   (repetir 3 veces: la tercera debe devolver allowed = false, 'limite_sesion')
-- delete from public.ai_image_quota where quota_key like '%-prueba';
