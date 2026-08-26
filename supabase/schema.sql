-- =====================================================================
--  Dulce Flor — esquema de pedidos compartidos
--
--  Pegar ENTERO en Supabase → SQL Editor → New query → Run.
--  Es idempotente: se puede volver a ejecutar sin romper nada.
--
--  Qué resuelve: hasta ahora cada pedido vivía en el navegador donde se
--  hacía, así que un pedido hecho desde el móvil de un cliente nunca
--  llegaba al panel de Dulce Flor. Con esta tabla, todos los pedidos van
--  al mismo sitio y el panel los ve desde cualquier dispositivo.
-- =====================================================================

create table if not exists public.orders (
  -- El id lo genera el navegador (UUID), para que un pedido creado sin
  -- conexión conserve su identidad cuando después se suba.
  id uuid primary key,
  public_id text not null unique,
  created_at timestamptz not null default now(),
  status text not null,

  customer_type text not null,
  fulfillment_type text not null,
  requested_date date not null,
  requested_time text not null,

  -- Datos personales del cliente. Van aparte del resto para poder
  -- localizarlos y borrarlos con facilidad si alguien ejerce su derecho
  -- de supresión.
  customer_name text not null,
  customer_phone text not null,
  customer_email text,

  -- El resto del pedido tal cual lo construye el dominio. Guardarlo como
  -- JSON evita tener que migrar la base de datos cada vez que cambia una
  -- opción del catálogo (velas, bengalas, discos…).
  payload jsonb not null
);

comment on table public.orders is
  'Pedidos de Dulce Flor. Contiene datos personales de clientes: ver aviso legal.';

-- Búsquedas del panel: lo primero que se mira es lo más reciente.
create index if not exists orders_created_at_idx
  on public.orders (created_at desc);

-- Filtro por día de recogida/entrega.
create index if not exists orders_requested_date_idx
  on public.orders (requested_date);

-- =====================================================================
--  Seguridad a nivel de fila
--
--  La clave "anon" viaja dentro del JavaScript de la web, así que es
--  pública por definición. Lo que impide que cualquiera se descargue la
--  agenda de clientes son ESTAS reglas, no la clave.
--
--   - Cualquiera puede CREAR un pedido (es un formulario público).
--   - Solo una sesión iniciada puede LEER o MODIFICAR.
--   - Nadie puede BORRAR desde la web.
-- =====================================================================

alter table public.orders enable row level security;

drop policy if exists "cualquiera puede crear un pedido" on public.orders;
create policy "cualquiera puede crear un pedido"
  on public.orders for insert
  to anon, authenticated
  with check (true);

drop policy if exists "solo el equipo lee los pedidos" on public.orders;
create policy "solo el equipo lee los pedidos"
  on public.orders for select
  to authenticated
  using (true);

drop policy if exists "solo el equipo actualiza los pedidos" on public.orders;
create policy "solo el equipo actualiza los pedidos"
  on public.orders for update
  to authenticated
  using (true)
  with check (true);

-- Sin política de DELETE: nadie borra pedidos desde la web. Para borrar
-- de verdad (p. ej. una solicitud de supresión de datos), hacerlo desde
-- el panel de Supabase.

-- =====================================================================
--  Comprobación rápida
--
--  Después de ejecutar, esto debe devolver cuatro filas: rowsecurity = true
--  y las tres políticas.
-- =====================================================================
-- select relrowsecurity from pg_class where relname = 'orders';
-- select policyname, cmd, roles from pg_policies where tablename = 'orders';
