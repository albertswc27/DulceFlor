# Reglas de negocio — Dulce Flor Repostería

Fuente de verdad de configuración: [`src/config/business.ts`](../src/config/business.ts).
Fuente de verdad de catálogo y precios: [`src/domain/catalog.ts`](../src/domain/catalog.ts) (transcripción de las cartas fotografiadas, ver `assets-inventory.md`).

## Reglas CONFIRMADAS

| Regla | Valor | Constante |
| --- | --- | --- |
| Precio por topping | +2,50 € cada uno (actualizado en la 2ª revisión del cliente) | `TOPPING_PRICE_CENTS = 250` |
| Paga y señal | 30 % cuando el total **supera** 40 € (40,00 € exactos NO la requieren) | `DEPOSIT_THRESHOLD_CENTS = 4000`, `DEPOSIT_PERCENTAGE = 30` |
| Métodos de señal | Bizum, transferencia bancaria o pago presencial. **Sin pago online** | — |
| Pedidos ≤ 40 € | Se abonan al recoger/recibir | — |
| WhatsApp | +34 624 21 31 13 | `WHATSAPP_PHONE = "34624213113"` |
| Estado inicial del pedido | «Pendiente de confirmación por Dulce Flor» (la web nunca afirma que la tienda ha aceptado) | `status: "pending"` |

| Antelación mínima | 3 días («Mínimo 3 días», WhatsApp 17/08/2026) | `MIN_ORDER_LEAD_TIME_HOURS = 72` |
| Horario | 10:00–22:00 («de 10am hasta las 10pm», WhatsApp 17/08/2026). No indicaron días de cierre → abierto todos los días hasta nuevo aviso | `BUSINESS_HOURS` |
| Cartas claras = empresas | Confirmado 17/08/2026 | catálogo `availableFor` |
| Lista de toppings | Confirmada 17/08/2026 (derivada de las cartas) | `TOPPINGS` |
| Dedicatoria +2 € y papel comestible +7 € | Aplican a todos los productos (confirmado 17/08/2026) | `EXTRAS` |
| Dirección de la tienda | C. Ntra. Sra. de Montserrat, 13, bajos · 08922 Santa Coloma de Gramenet (confirmada 18/08/2026) | `BUSINESS_ADDRESS` |
| Zonas de entrega | Confirmadas 18/08/2026 tal como estaban; fuera de estas zonas, gastos de envío **según distancia** (se confirman por WhatsApp) | `DELIVERY_ZONES` |
| Instagram | @dulceflor.bcn | `INSTAGRAM_URL` |

| Topping fuera de catálogo | El cliente puede solicitarlo por texto; Dulce Flor confirma disponibilidad y precio. NO se cobra automáticamente | `customToppingRequest` |
| Imagen de referencia | El cliente puede adjuntar una foto por tarta (comprimida, guardada aparte del pedido) | `referenceImageId` + `services/imageStore` |
| Tarta clásica | Acabado estándar de Dulce Flor (cobertura, cenefa de manga y toppings de catálogo) con precio automático. Las decoraciones especiales NO están incluidas | `pricingType: "fixed"` |
| Tarta personalizada y de fondant | Sin precio automático: solicitud de presupuesto con fotografía de referencia **obligatoria** (estado «Pendiente de presupuesto»); administración introduce después `quotedPriceCents` y el total/señal se recalculan. **Solo particulares** | `pricingType: "quote"`, `customCakeType`, `pending_quote` |
| Topping fuera de catálogo | NO suma importe automáticamente: «precio pendiente de confirmación» hasta que Dulce Flor lo confirme por WhatsApp | `customToppingRequest` |
| Notas con cambios especiales | Una petición escrita en notas (p. ej. dos sabores de bizcocho) no está incluida en el precio automático: el resumen muestra «TOTAL ACTUAL + modificaciones pendientes» | `hasPendingExtras` |
| Fuentes reutilizables (empresas) | Entrega opcional en fuente de cristal reutilizable; la anterior se recoge en la siguiente entrega. Sin depósitos ni condiciones económicas | `Order.reusableTray` |
| Cartas fotografiadas | Ya NO se muestran al público (retiradas de la web); siguen siendo la fuente de verdad interna del catálogo | `src/assets/carta-*.jpeg` |

### Excepción documentada en carta

- Tres leches tamaño 28–30 porciones: el suplemento/topping cuesta **6 €** en lugar de 2 € (`toppingPriceOverridesBySizeId` en el catálogo).

## Pendiente de Dulce Flor

- **Nombre completo del titular (autónomo)** para el aviso legal. El NIF ya fue facilitado por WhatsApp; por privacidad no se guarda en este repositorio público.
- Días de cierre semanales, si los hubiera (hoy: abierto todos los días, 10:00–22:00).

### Zonas de entrega — `DELIVERY_ZONES`

| Zona | Municipios | CP | Tarifa |
| --- | --- | --- | --- |
| 1 | Santa Coloma de Gramenet | 08921–08924 | 0 € |
| 2 (provisional) | Badalona, Sant Adrià de Besòs, Montcada i Reixac | 08910–08918, 08930, 08110 | 5 € |
| 3 | Barcelona ciudad | 08001–08042 | 10 € |
| Resto | — | — | «Consultar disponibilidad de entrega» (sin tarifa automática) |

La zona se determina por **código postal con prioridad estricta**: si el CP es válido (5 dígitos) y no pertenece a ninguna zona, la dirección queda «a consultar» aunque el municipio tecleado coincida con una zona (un CP fuera de rango es evidencia más fiable que un municipio escrito a mano). Solo sin CP válido se usa el nombre de municipio normalizado (sin acentos/mayúsculas). Sin APIs externas de geocoding.



## Nuevas líneas de producto (21/08/2026)

### Aperitivos salados — tarifas CONFIRMADAS (WhatsApp 21–22/08/2026)

Precio **por unidad** según el tramo de cantidad. **Los tramos NO son iguales en todos los productos**: mini sándwiches y mini panes escalan en 15/25/50, los tequeños en 15/30/50 y las empanadas en 20/35/50. Definidos producto a producto en `SAVOURY_SNACKS` (`src/domain/catalog.ts`) y verificados por test uno a uno.

| Producto | Tramo 1 | Tramo 2 | Tramo 3 |
| --- | --- | --- | --- |
| Mini sándwich de cerdo caramelizado | 15 u · 1,45 € | 25 u · 1,25 € | 50+ u · 1,00 € |
| Mini sándwich Royal de pollo | 15 u · 1,30 € | 25 u · 1,15 € | 50+ u · 0,99 € |
| Mini sándwich de jamón dulce con tomate y queso | 15 u · 1,25 € | 25 u · 1,10 € | 50+ u · 0,90 € |
| Mini sándwich de huevo | 15 u · 1,20 € | 25 u · 1,10 € | 50+ u · 0,90 € |
| Mini sándwich de tocino crujiente (con queso y tomate) | 15 u · 1,45 € | 25 u · 1,25 € | 50+ u · 1,00 € |
| Mini sándwich de pollo, melocotón y jamón dulce | 15 u · 1,45 € | 25 u · 1,25 € | 50+ u · 1,05 € |
| Mini pan de bacon con espinaca | 15 u · 1,35 € | 25 u · 1,20 € | 50+ u · 1,00 € |
| Mini pan mixto de pollo y melocotón | 15 u · 1,35 € | 25 u · 1,20 € | 50+ u · 1,00 € |
| Mini pan de jamón dulce y queso | 15 u · 1,25 € | 25 u · 1,15 € | 50+ u · 0,99 € |
| Mini pan de jamón serrano | 15 u · 1,35 € | 25 u · 1,20 € | 50+ u · 1,00 € |
| Mini pan de pollo con mayonesa de la casa | 15 u · 1,25 € | 25 u · 1,15 € | 50+ u · 0,99 € |
| Mini pan de fuet | 15 u · 1,15 € | 25 u · 1,00 € | 50+ u · 0,90 € |
| Mini pan de cerdo y boniato | 15 u · 1,45 € | 25 u · 1,25 € | 50+ u · 1,00 € |
| Mini pan de cerdo caramelizado | 15 u · 1,35 € | 25 u · 1,20 € | 50+ u · 1,00 € |
| Mini tequeños de jamón y queso | 15 u · 1,20 € | 30 u · 1,00 € | 50+ u · 0,95 € |
| Mini tequeños de queso | 15 u · 1,10 € | 30 u · 0,99 € | 50+ u · 0,90 € |
| Mini hamburguesa de vacuno | 15 u · 1,50 € | 30 u · 1,25 € | 50+ u · 1,00 € |
| Mini hamburguesa de pollo | 15 u · 1,35 € | 30 u · 1,20 € | 50+ u · 0,99 € |
| Mini empanadas de carne | 20 u · 1,35 € | 35 u · 1,15 € | 50+ u · 1,00 € |
| Mini empanadas de pollo | 20 u · 1,25 € | 35 u · 1,05 € | 50+ u · 0,95 € |
| Mini empanadas de atún | 20 u · 1,20 € | 35 u · 1,05 € | 50+ u · 0,95 € |

Las cantidades intermedias aplican el tramo inferior (18 uds → tarifa de 15; 34 uds de empanadas → tarifa de 20) y por encima del último tramo se aplica siempre ese precio. **Por debajo del primer tramo no hay tarifa: el sistema devuelve «sin precio» en vez de inventar uno.** Disponibles para particulares y empresas (decisión a confirmar).

Los tramos varían según el producto: mini sándwiches y mini panes 15/25/50; tequeños y mini hamburguesas 15/30/50; empanadas 20/35/50. **Ya no queda ningún salado sin tarifa** (22/08/2026): los 21 productos fotografiados tienen precio y foto propia.

### Aperitivos dulces — PENDIENTE

Hay fotografías reales (vasitos individuales y cupcakes personalizados) pero **el catálogo y las tarifas están pendientes de confirmación**. En la web se muestran como muestra de trabajo con invitación a consultar por WhatsApp; no son pedibles con precio automático.

### Desayunos y regalos personalizados

Cajas de desayuno y copas personalizadas: **sin precio automático** (`pricingType: "quote"`, `giftType`). La solicitud recoge ocasión, descripción, **dedicatoria**, notas e imagen opcional, y genera una solicitud de presupuesto (estado «Pendiente de presupuesto») que Dulce Flor responde por WhatsApp. Solo particulares (a confirmar).

## Catálogo y precios (resumen)

- **Pasteles clásicos** (particulares): matriz 4 rangos de personas × 1/2/3 discos, 20–78 €.
- **Pasteles con buttercream** (particulares): misma matriz, 22–82 €.
- Ambos con 9 sabores de bizcocho y 9 rellenos incluidos.
- **Cheesecakes** (13 sabores): particulares 18–43 € según sabor y tamaño (4-6/10-12/14-16 porciones); empresas 19–45 € (8/10-12/14-16 porciones).
- **Tres leches**: particulares 19/25/30/59 € (5-6/8-10/12-14/28-30 porciones); empresas 18/26/33 € (8/10-12/14-16).
- **Solo empresas**: pudín casero 33 €, torta de chocolate 39 €, torta helada 38 €.

## Flujo del pedido

1. Tipo de cliente (particular/empresa) → catálogos y precios distintos.
2. Configuración de producto (tamaño, sabor, relleno, toppings, extras, dedicatoria, texto libre, cantidad).
3. Recogida (0 €) o entrega (tarifa por zona / consultar).
4. Fecha y hora dentro de horario y antelación.
5. Datos de contacto (+ empresa si procede).
6. Resumen con desglose (producto / toppings / extras / transporte / total / señal / pendiente).
7. **Se guarda el pedido primero** (idempotente vía `clientRequestId`), se genera `DF-AAAA-NNNN`, y después se abre WhatsApp con el mensaje preparado (deep link `wa.me`; el usuario lo envía manualmente — la web nunca afirma haber enviado el WhatsApp).

## Estados del pedido

`pending → confirmed → in_preparation → ready → completed` (+ `cancelled`). Etiquetas en español en `ORDER_STATUS_LABELS`. Cambio de estado desde el panel admin.
