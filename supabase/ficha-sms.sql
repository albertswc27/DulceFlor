-- =====================================================================
--  Dulce Flor — aviso por SMS y ficha de pedido consultable por enlace
--
--  Pegar ENTERO en Supabase → SQL Editor → New query → Run, DESPUÉS de
--  schema.sql y de equipo-y-permisos.sql. Es idempotente.
--
--  Qué resuelve: cuando Dulce Flor marca un pedido como «Tramitado», al
--  cliente le llega un SMS con un enlace. Ese enlace tiene que enseñarle SU
--  pedido sin pedirle que se registre, y sin abrir la puerta a los pedidos
--  de los demás.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Columnas del aviso
--
--  Van en COLUMNAS y no dentro de `payload` por un motivo muy concreto: el
--  panel sube el pedido con `update(fila_completa)`, así que reemplaza el
--  payload entero con la copia local del dispositivo desde el que se pulsa.
--  Con dos propietarias trabajando a la vez, una tablet con una copia de
--  hace diez minutos borraría la marca de «ya avisado» y el sistema mandaría
--  —y cobraría— un segundo SMS al mismo cliente. En columnas propias eso no
--  puede pasar: el panel no las toca nunca.
--
--  Del token se guarda el HASH, nunca el token en claro. El token solo existe
--  en el SMS que recibe el cliente y en la memoria del servidor durante el
--  envío. Aunque alguien se llevara la tabla entera, no podría fabricar
--  enlaces válidos. Consecuencia asumida: reenviar el aviso genera un enlace
--  nuevo y el anterior deja de funcionar.
-- ---------------------------------------------------------------------

alter table public.orders
  add column if not exists card_token_hash text,
  add column if not exists card_expires_at timestamptz,
  add column if not exists customer_notified_at timestamptz,
  add column if not exists customer_notified_by text,
  add column if not exists sms_opt_out boolean not null default false,
  add column if not exists sms_sent_count integer not null default 0;

comment on column public.orders.card_token_hash is
  'SHA-256 en hexadecimal del token del enlace enviado por SMS. Nunca el token en claro.';
comment on column public.orders.card_expires_at is
  'Momento a partir del cual el enlace deja de servir datos (minimización, art. 5.1.e RGPD).';
comment on column public.orders.customer_notified_at is
  'Cuándo se avisó al cliente. Lo escribe el servidor, no el navegador: es el freno anti-duplicado.';
comment on column public.orders.sms_opt_out is
  'El cliente ha pedido que no se le avise por SMS.';
comment on column public.orders.sms_sent_count is
  'SMS enviados de este pedido. Tope de seguridad contra bucles y sesiones robadas.';

-- Búsqueda por token: es la consulta que hace cada cliente que abre el SMS.
-- Único además de indexado: dos pedidos no pueden compartir enlace.
create unique index if not exists orders_card_token_hash_idx
  on public.orders (card_token_hash)
  where card_token_hash is not null;

-- ---------------------------------------------------------------------
--  2. Que el formulario público no pueda escribir estas columnas
--
--  `grant insert on public.orders to anon` da permiso sobre TODAS las
--  columnas, también sobre las que acabamos de crear. Un cliente anónimo
--  podría registrar un pedido fijando él mismo el hash del enlace, el
--  contador de envíos o la fecha de aviso. Se acota el permiso a las
--  columnas que el formulario escribe de verdad.
-- ---------------------------------------------------------------------

revoke insert on public.orders from anon;
grant insert (
  id, public_id, created_at, status,
  customer_type, fulfillment_type,
  requested_date, requested_time,
  customer_name, customer_phone, customer_email,
  payload
) on public.orders to anon;

-- ---------------------------------------------------------------------
--  3. La función que sirve la ficha
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

-- `create or replace` falla si cambian las columnas devueltas, y este fichero
-- promete poder reejecutarse. Se borra primero para que cambiar la ficha sea
-- volver a ejecutar esto, no depurar un error de tipos.
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
  balance_due_cents integer,
  overpaid_cents integer,
  pending_extras boolean,
  delivery_fee_pending boolean
)
language sql
-- `volatile` (el valor por defecto) a propósito: PostgREST solo expone por
-- GET las funciones estables o inmutables, así que esto obliga a llamarla
-- por POST y el token viaja en el cuerpo, no en la URL.
volatile
security definer
set search_path = ''
as $$
  with pedido as (
    select
      o.*,
      -- Se calcula una sola vez y se reutiliza abajo: repetir estas
      -- expresiones en cinco columnas era la forma más fácil de que una de
      -- ellas se quedara desactualizada.
      coalesce((o.payload -> 'pricing' -> 'pendingQuote')::boolean, false) as es_presupuesto,
      case
        when jsonb_typeof(o.payload -> 'pricing' -> 'totalCents') = 'number'
          then (o.payload -> 'pricing' ->> 'totalCents')::int
      end as total,
      coalesce((o.payload ->> 'depositPaidCents')::int, 0) as senal
    from public.orders as o
    where
      -- La comparación se hace contra el hash, así que un token inventado no
      -- llega ni a tocar datos. Al ser una igualdad sobre un índice único de
      -- longitud fija, tampoco hay diferencia de tiempo que permita adivinar
      -- el token carácter a carácter.
      --
      -- sha256() es nativa de PostgreSQL 11+ y vive en pg_catalog, que se
      -- resuelve siempre aunque search_path esté vacío; se cualifica igual
      -- para dejar claro que no depende de pgcrypto ni de ninguna extensión.
      o.card_token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')),
        'hex'
      )
      and o.card_expires_at is not null
      and o.card_expires_at > now()
  )
  select
    p.public_id,
    p.status,
    -- Solo el nombre de pila: basta para que el cliente se reconozca y evita
    -- publicar el apellido en una página abierta. Se colapsan antes los
    -- espacios raros (duros, tabuladores) que llegan al pegar desde otra
    -- aplicación; si no, «Ana⍽Pérez García» publicaría «Ana Pérez».
    split_part(regexp_replace(btrim(p.customer_name), '\s+', ' ', 'g'), ' ', 1),
    p.created_at,
    p.requested_date,
    p.requested_time,
    p.fulfillment_type,
    coalesce((p.payload -> 'urgent')::boolean, false),
    -- Resumen de artículos construido campo a campo: tamaño, sabor y relleno.
    -- Deliberadamente NO se incluyen notas ni dedicatoria.
    --
    -- El `case` no es decorativo: jsonb_array_elements aborta la consulta si
    -- lo que recibe no es un array, y un `where` dentro de la subconsulta no
    -- serviría, porque el FROM se evalúa antes.
    case
      when jsonb_typeof(p.payload -> 'items') = 'array' then
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
            from jsonb_array_elements(p.payload -> 'items') as item
          ),
          '[]'::jsonb
        )
      else '[]'::jsonb
    end,
    -- Con tarta a presupuestar, o si el importe no está, el total no es
    -- firme: se devuelve null y la ficha lo explica en vez de enseñar una
    -- cifra falsa. El resto de importes acompañan a este null, para que la
    -- ficha no pueda decir «pendiente 0,00 €» de un pedido sin total.
    case when p.es_presupuesto then null else p.total end,
    p.senal,
    case when p.es_presupuesto or p.total is null then null
         else greatest(0, p.total - p.senal) end,
    -- Dinero a devolver: pasa cuando se cobró señal sobre una tarta a
    -- presupuestar y el presupuesto cerró por debajo. El aviso en papel sí lo
    -- decía; la ficha no puede perderlo por el camino.
    case when p.es_presupuesto or p.total is null then null
         else greatest(0, p.senal - p.total) end,
    -- El pedido lleva peticiones que Dulce Flor tiene que revisar (un topping
    -- fuera de lista, una nota, una imagen de referencia). El panel y el
    -- WhatsApp ya rotulan «TOTAL ACTUAL» en ese caso: la ficha del cliente
    -- tiene que decir lo mismo, o le estaríamos dando por cerrado un importe
    -- que el propio negocio considera provisional.
    coalesce((p.payload -> 'pricing' -> 'hasPendingExtras')::boolean, false)
      and not p.es_presupuesto,
    -- Entrega fuera de las zonas con tarifa: el total guardado NO incluye el
    -- transporte. Ojo, la clave existe con valor JSON null, así que hay que
    -- comparar el tipo, no usar `is null`.
    p.fulfillment_type = 'delivery'
      and jsonb_typeof(p.payload -> 'pricing' -> 'deliveryFeeCents') = 'null'
  from pedido as p;
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
--  2) anon NO puede leer la tabla directamente.
--  3) Las columnas del aviso existen.
-- =====================================================================
-- select * from public.get_order_card('token-que-no-existe');
-- select column_name from information_schema.columns
--   where table_name = 'orders' and column_name like '%notified%';
