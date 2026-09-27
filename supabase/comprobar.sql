-- ---------------------------------------------------------------------
--  ¿Está la base al día?
--
--  No cambia nada: solo mira. Es lo que hay que ejecutar cuando algo no
--  funciona y no se sabe si el problema es el código o es que falta un
--  fichero por aplicar.
--
--  Cada línea que diga FALTA señala el fichero que hay que ejecutar:
--    team_members, is_team_member, políticas del equipo -> equipo-y-permisos.sql
--    columnas de orders, get_order_card                 -> ficha-sms.sql
--    ai_image_quota, ai_quota_gate, ai_image_sessions   -> imagen-ia.sql
-- ---------------------------------------------------------------------

with resultado as (

  -- Tablas y funciones. to_regclass/to_regprocedure devuelven null en vez de
  -- fallar cuando el objeto no existe, que es justo lo que hace falta aquí.
  select 1 as orden, 'tabla ' || nombre as objeto,
         case when presente then 'OK' else 'FALTA' end as estado
  from (values
    ('public.team_members',       to_regclass('public.team_members')       is not null),
    ('public.ai_image_quota',     to_regclass('public.ai_image_quota')     is not null),
    ('public.ai_image_sessions',  to_regclass('public.ai_image_sessions')  is not null)
  ) as t(nombre, presente)

  union all

  select 2, 'función ' || nombre,
         case when presente then 'OK' else 'FALTA' end
  from (values
    ('is_team_member()',      to_regprocedure('public.is_team_member()')                                  is not null),
    ('get_order_card(text)',  to_regprocedure('public.get_order_card(text)')                              is not null),
    ('ai_quota_gate(...)',    to_regprocedure('public.ai_quota_gate(text,text,text,integer,integer,integer)') is not null),
    ('ai_quota_refund(text)', to_regprocedure('public.ai_quota_refund(text)')                             is not null),
    ('ai_session_previous',   to_regprocedure('public.ai_session_previous(text)')                         is not null),
    ('ai_session_remember',   to_regprocedure('public.ai_session_remember(text,text)')                    is not null)
  ) as f(nombre, presente)

  union all

  -- Las columnas del aviso viven en la tabla, no en el payload, porque el
  -- panel reescribe el payload entero y borraría la marca de «ya avisado».
  select 3, 'columna orders.' || c.nombre,
         case when exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'orders'
             and column_name = c.nombre
         ) then 'OK' else 'FALTA' end
  from (values
    ('card_token_hash'), ('card_expires_at'), ('customer_notified_at'),
    ('customer_notified_by'), ('sms_opt_out'), ('sms_sent_count')
  ) as c(nombre)

  union all

  select 4, 'política «' || p.nombre || '»',
         case when exists (select 1 from pg_policies where policyname = p.nombre)
              then 'OK' else 'FALTA' end
  from (values
    ('solo el equipo lee los pedidos'),
    ('solo el equipo actualiza los pedidos'),
    ('el equipo lee las imagenes de referencia'),
    ('subir imagen de referencia')
  ) as p(nombre)

  union all

  -- Que la función exista no basta: hay que poder llamarla. El
  -- `revoke ... from public` de imagen-ia.sql deja sin permiso a TODOS los
  -- roles, service_role incluido, porque PUBLIC es un grupo al que pertenecen
  -- todos. Sin el grant explícito, el generador no produce ni una imagen.
  select 6, 'service_role puede ejecutar ' || g.nombre,
         case when g.existe and has_function_privilege('service_role', g.firma, 'execute')
              then 'OK' else 'FALTA' end
  from (values
    ('ai_quota_gate',      'public.ai_quota_gate(text,text,text,integer,integer,integer)'),
    ('ai_quota_refund',    'public.ai_quota_refund(text)'),
    ('ai_quota_prune',     'public.ai_quota_prune()'),
    ('ai_session_previous','public.ai_session_previous(text)'),
    ('ai_session_remember','public.ai_session_remember(text,text)')
  ) as f(nombre, firma)
  cross join lateral (
    select f.nombre, f.firma, to_regprocedure(f.firma) is not null as existe
  ) as g

  union all

  -- El agujero de verdad: la política original decía `using (true)`, así que
  -- cualquiera que se registrase en Supabase leía TODOS los pedidos con
  -- nombres, teléfonos y direcciones. Si esto sale PRESENTE, es urgente.
  select 5, 'AGUJERO: alguien ajeno al equipo puede leer los pedidos',
         case when exists (
           select 1 from pg_policies
           where schemaname = 'public' and tablename = 'orders'
             and cmd = 'SELECT' and coalesce(qual, 'true') = 'true'
         ) then 'PRESENTE -> ejecuta equipo-y-permisos.sql' else 'OK' end
)
select objeto, estado from resultado order by orden, objeto;
