# Reglas de negocio — Dulce Flor Repostería

Fuente de verdad de configuración: [`src/config/business.ts`](../src/config/business.ts).
Fuente de verdad de catálogo y precios: [`src/domain/catalog.ts`](../src/domain/catalog.ts) (transcripción de las cartas fotografiadas, ver `assets-inventory.md`).

## Reglas CONFIRMADAS

| Regla | Valor | Constante |
| --- | --- | --- |
| Precio por topping | +2 € cada uno | `TOPPING_PRICE_CENTS = 200` |
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
