-- =====================================================================
--  Dulce Flor — ficha de pedido consultable por enlace (aviso por SMS)
--
--  Pegar ENTERO en Supabase → SQL Editor → New query → Run, DESPUÉS de
--  schema.sql. Es idempotente: se puede volver a ejecutar sin romper nada.
--
--  Qué resuelve: cuando Dulce Flor marca un pedido como «Tramitado», al
--  cliente le llega un SMS con un enlace. Ese enlace tiene que enseñarle SU
--  pedido sin pedirle que se registre, y sin abrir la puerta a los pedidos
--  de los demás.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Columnas del enlace
--
--  Se guarda el HASH del token, nunca el token en claro. El token solo
--  existe en dos sitios: el SMS que recibe el cliente y la memoria del
--  servidor durante el envío. Así, aunque algún día alguien se llevara la
--  tabla entera, no podría fabricar enlaces válidos.
--
--  Consecuencia asumida: reenviar el aviso genera un enlace NUEVO y el
--  anterior deja de funcionar. Es el precio de no almacenar la llave.
-- ---------------------------------------------------------------------

alter table public.orders
  add column if not exists card_token_hash text,
  add column if not exists card_expires_at timestamptz;

comment on column public.orders.card_token_hash is
  'SHA-256 en hexadecimal del token del enlace enviado por SMS. Nunca el token en claro.';
comment on column public.orders.card_expires_at is
  'Momento a partir del cual el enlace deja de servir datos (minimización, art. 5.1.e RGPD).';

-- Búsqueda por token: es la consulta que hace cada cliente que abre el SMS.
-- Único además de indexado: dos pedidos no pueden compartir enlace.
create unique index if not exists orders_card_token_hash_idx
  on public.orders (card_token_hash)
  where card_token_hash is not null;

-- ---------------------------------------------------------------------
--  2. La función que sirve la ficha
--
--  `security definer` para que se ejecute con los permisos del propietario
--  y no haga falta dar a `anon` ningún privilegio sobre public.orders: la
--  política de lectura sigue siendo solo para el equipo.
--
--  `set search_path = ''` es obligatorio en una función security definer:
--  sin eso, alguien que pudiera crear objetos en otro esquema podría
--  suplantar a `public.orders` y hacer que la función leyera su tabla. Por
--  eso todas las referencias van con esquema explícito.
--
--  Devuelve SOLO lo que el cliente necesita para recoger su pedido. Nunca
--  salen de aquí el teléfono, el email, la dirección, la dedicatoria ni las
--  notas: la dedicatoria en particular puede contener datos de salud o de
--  creencias («que te mejores», «tu primera comunión») y no pinta nada en
--  una página abierta con un enlace.
-- ---------------------------------------------------------------------

-- `create or replace` falla si algún día cambian las columnas devueltas, y este
-- fichero promete que se puede volver a ejecutar. Se borra primero para que
-- cambiar la ficha sea reejecutar esto, no depurar un error de tipos.
drop function if exists public.get_order_card(text);

create function public.get_order_card(p_token text)
returns table (
  public_id text,
  status text,
  customer_name text,
  created_at timestamptz,
  requested_date date,
  requested_time text,
  fulfillment_type text,
  urgent boolean,
  items jsonb,
  total_cents integer,
  deposit_paid_cents integer,
  balance_due_cents integer
)
language sql
-- `volatile` (el valor por defecto) a propósito: PostgREST solo expone por
-- GET las funciones estables o inmutables, así que esto obliga a llamarla
-- por POST y el token viaja en el cuerpo, no en la URL. Una URL acaba en
-- los registros del servidor y en la cabecera Referer; un cuerpo, no.
volatile
security definer
set search_path = ''
as $$
  select
    o.public_id,
    o.status,
    -- Solo el nombre de pila: basta para que el cliente se reconozca y
    -- evita publicar el apellido completo en una página abierta.
    split_part(btrim(o.customer_name), ' ', 1) as customer_name,
    o.created_at,
    o.requested_date,
    o.requested_time,
    o.fulfillment_type,
    coalesce((o.payload -> 'urgent')::boolean, false) as urgent,
    -- Resumen de artículos construido campo a campo: tamaño, sabor y
    -- relleno. Deliberadamente NO se incluyen notas ni dedicatoria.
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', item ->> 'productName',
            'quantity', coalesce((item ->> 'quantity')::int, 1),
            'detail', btrim(
              concat_ws(
                ' · ',
                nullif(item -> 'customization' -> 'size' ->> 'label', ''),
                nullif(item -> 'customization' -> 'flavor' ->> 'label', ''),
                nullif(item -> 'customization' -> 'filling' ->> 'label', '')
              )
            )
          )
        )
        from jsonb_array_elements(o.payload -> 'items') as item
      ),
      '[]'::jsonb
    ) as items,
    -- Con tarta a presupuestar el total todavía no es firme: se devuelve
    -- null y la ficha lo explica, en vez de enseñar un importe falso.
    case
      when coalesce((o.payload -> 'pricing' -> 'pendingQuote')::boolean, false) then null
      else (o.payload -> 'pricing' ->> 'totalCents')::int
    end as total_cents,
    coalesce((o.payload ->> 'depositPaidCents')::int, 0) as deposit_paid_cents,
    case
      when coalesce((o.payload -> 'pricing' -> 'pendingQuote')::boolean, false) then null
      else greatest(
        0,
        (o.payload -> 'pricing' ->> 'totalCents')::int
          - coalesce((o.payload ->> 'depositPaidCents')::int, 0)
      )
    end as balance_due_cents
  from public.orders as o
  where
    -- La comparación se hace contra el hash, así que un token inventado no
    -- llega ni a tocar datos. Como además es una igualdad sobre un índice
    -- único de longitud fija, no hay diferencia de tiempo que permita
    -- adivinar el token carácter a carácter.
    -- sha256() es nativa de PostgreSQL 11+ y vive en pg_catalog, que siempre
    -- se resuelve aunque search_path esté vacío; se cualifica igualmente para
    -- que quede claro que no depende de pgcrypto ni de ninguna extensión.
    o.card_token_hash = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')),
      'hex'
    )
    and o.card_expires_at is not null
    and o.card_expires_at > now();
$$;

-- `anon` es quien abre el enlace del SMS: nunca ha iniciado sesión.
-- Se le quita el permiso a todo el mundo y se le devuelve solo a los dos
-- roles que lo necesitan, para que un rol nuevo no lo herede por descuido.
revoke all on function public.get_order_card(text) from public;
grant execute on function public.get_order_card(text) to anon, authenticated;

comment on function public.get_order_card(text) is
  'Ficha reducida de un pedido a partir del token del enlace enviado por SMS. No devuelve datos de contacto ni textos libres.';

-- =====================================================================
--  Comprobación rápida
--
--  1) Un token inventado no devuelve nada (0 filas), ni error.
--  2) anon NO puede leer la tabla directamente: debe seguir dando 0 filas
--     o permiso denegado.
-- =====================================================================
-- select * from public.get_order_card('token-que-no-existe');
-- select count(*) from public.orders;  -- como anon: debe fallar
