-- =====================================================================
--  Dulce Flor — quién es «el equipo», de verdad
--
--  Pegar ENTERO en Supabase → SQL Editor → New query → Run, DESPUÉS de
--  schema.sql. Es idempotente.
--
--  ⚠️ EJECUTAR ESTO ANTES DE ACTIVAR LOS SMS.
--
--  QUÉ PROBLEMA ARREGLA
--
--  Las políticas de schema.sql se llaman «solo el equipo lee los pedidos»,
--  pero dicen `to authenticated using (true)`: cualquiera que consiga ser un
--  usuario autenticado del proyecto lo puede leer TODO. Y la clave anon viaja
--  dentro del JavaScript de la web —es pública por diseño—, así que con el
--  alta libre activada (que es como viene Supabase de fábrica) bastaba con:
--
--    1. copiar la clave anon del navegador,
--    2. registrarse con un correo cualquiera en /auth/v1/signup,
--    3. leerse la agenda entera: nombre, teléfono, email, dirección,
--       dedicatorias y notas de cada cliente.
--
--  Con los SMS eso se agrava: ese mismo usuario podría pedir el envío de un
--  aviso por cada pedido y vaciar el saldo de la tienda.
--
--  A partir de aquí, «el equipo» deja de ser «cualquiera que haya iniciado
--  sesión» y pasa a ser una lista explícita.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. La lista del equipo
-- ---------------------------------------------------------------------

create table if not exists public.team_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  added_at timestamptz not null default now()
);

comment on table public.team_members is
  'Cuentas autorizadas a gestionar pedidos. Estar autenticado NO basta: hay que estar aquí.';

alter table public.team_members enable row level security;

-- Nadie la lee ni la escribe desde la web: se administra desde este editor.
-- Las políticas de abajo sí la consultan, pero lo hacen con los permisos del
-- propietario a través de la función, no con los de quien llama.
revoke all on public.team_members from anon, authenticated;

-- ---------------------------------------------------------------------
--  2. Alta automática de quien YA tiene cuenta
--
--  Se da de alta a los usuarios que existen AHORA MISMO, que son las cuentas
--  que creó Dulce Flor a mano. Hacerlo así evita el peor final posible de
--  esta migración: aplicar las políticas nuevas, dejar la lista vacía y que
--  las propietarias se queden fuera del panel un sábado por la mañana.
--
--  A partir de este momento, un registro nuevo NO entra en el equipo.
-- ---------------------------------------------------------------------

insert into public.team_members (user_id, email)
select u.id, coalesce(u.email, '(sin correo)')
from auth.users as u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------
--  3. La comprobación
--
--  `security definer` porque quien pregunta («¿soy del equipo?») no tiene
--  permiso para leer la tabla donde está la respuesta, y así debe seguir.
-- ---------------------------------------------------------------------

create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members as t where t.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_team_member() from public;
grant execute on function public.is_team_member() to authenticated;

comment on function public.is_team_member() is
  'true si la sesión actual pertenece a una cuenta del equipo de Dulce Flor.';

-- ---------------------------------------------------------------------
--  4. Políticas nuevas: estar autenticado ya no es suficiente
-- ---------------------------------------------------------------------

drop policy if exists "solo el equipo lee los pedidos" on public.orders;
create policy "solo el equipo lee los pedidos"
  on public.orders for select
  to authenticated
  using (public.is_team_member());

drop policy if exists "solo el equipo actualiza los pedidos" on public.orders;
create policy "solo el equipo actualiza los pedidos"
  on public.orders for update
  to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());

-- Las imágenes de referencia son igual de sensibles que el pedido.
drop policy if exists "el equipo lee las imagenes de referencia" on storage.objects;
create policy "el equipo lee las imagenes de referencia"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'order-references' and public.is_team_member());

-- =====================================================================
--  Comprobación y mantenimiento
-- =====================================================================
--
-- ¿Quién está dado de alta?
--   select t.email, t.added_at from public.team_members as t order by t.added_at;
--
-- Dar de alta a alguien nuevo (después de crearle la cuenta en Authentication):
--   insert into public.team_members (user_id, email)
--   select id, email from auth.users where email = 'quien@dulceflorbcn.es'
--   on conflict (user_id) do nothing;
--
-- Dar de baja a alguien (deja de ver pedidos al instante):
--   delete from public.team_members where email = 'quien@dulceflorbcn.es';
--
-- Recordatorio: esto es la segunda cerradura, no la primera. Sigue haciendo
-- falta desactivar el alta libre en Authentication → Sign In / Providers →
-- Email → «Allow new users to sign up».
