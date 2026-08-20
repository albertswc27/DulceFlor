# Inventario de assets — Dulce Flor Repostería

Fecha de catalogación: 2026-08-17.
Todos los assets originales se han renombrado y movido a `src/assets/`.
Ninguna imagen ha sido eliminada.

## Tabla de correspondencias

| Nombre original | Nuevo nombre | Contenido |
| --- | --- | --- |
| `LOGO.jpeg` | `src/assets/logo-dulce-flor.jpeg` | Logo oficial: insignia circular con ilustración de la repostera, cinta "DULCE FLOR" y subtítulo "Repostería Casera". Paleta rosa/crema/burdeos/dorado. |
| `2.jpeg` | `src/assets/carta-pasteles-buttercream-precios-particulares.jpeg` | Carta "Tamaño de porciones de pasteles con Buttercream" (fondo oscuro). Matriz de precios 4 rangos de personas × 1/2/3 discos (8/13/20 cm). Lista de 9 sabores de bizcocho. |
| `WhatsApp Image 2026-08-17 at 13.20.18.jpeg` | `src/assets/carta-cheesecake-precios-particulares.jpeg` | Carta "Cheesecake — tamaño de porciones" (fondo oscuro, particulares). 13 sabores × 3 tamaños (4-6 / 10-12 / 14-16 porciones). Nota: dedicatoria o mensaje especial +2 €. |
| `WhatsApp Image 2026-08-17 at 13.20.183.jpeg` | `src/assets/carta-tres-leches-precios-particulares.jpeg` | Carta "Tres Leches — tamaños y precios" (fondo oscuro). 4 tamaños (5-6 / 8-10 / 12-14 / 28-30 porciones). Dedicatoria 2 €, suplemento 2 € (6 € en tamaño 28-30), papel comestible 7 €. |
| `WhatsApp Image 2026-08-17 at 13.20.184.jpeg` | `src/assets/carta-pasteles-clasicos-precios-particulares.jpeg` | Carta "Tamaño de porciones de pasteles" (fondo oscuro, sin buttercream). Matriz de precios 4 rangos × 1/2/3 discos. Lista de 9 sabores de bizcocho ("biscochos"). |
| `WhatsApp Image 2026-08-17 at 13.20.185.jpeg` | `src/assets/carta-rellenos-pasteles.jpeg` | Carta "Rellenos de pasteles": 9 rellenos con descripción (dulce de leche, nata con frutas, dulce de leche con chocolate, chocolate, mus Oreo, Nutella, fresa, mus de Lotus, mus de café). Sin precios (incluidos en la tarta). |
| `WhatsApp Image 2026-08-17 at 13.20.196.jpeg` | `src/assets/carta-tres-leches-y-tortas-precios-empresas.jpeg` | Carta "Cheesecake — tamaño de porciones" (fondo claro, estilo empresas). Sección Tres Leches (8 / 10-12 / 14-16 porciones), Pudín casero, Torta de chocolate y Torta helada. Dedicatoria +2 €. |
| `WhatsApp Image 2026-08-17 at 13.20.197.jpeg` | `src/assets/carta-cheesecake-precios-empresas.jpeg` | Carta "Cheesecake — precio pensado en empresas y restaurantes" (fondo claro). 13 sabores × 3 tamaños (8 / 10-12 / 14-16 porciones). "Consulta por envíos a tu zona". |

## Fotografías reales de tartas (añadidas 19/08/2026)

Facilitadas por Dulce Flor. Renombradas por contenido y optimizadas a WebP
(máx. 1000 px de ancho, calidad 82 → −32 % de peso). Se sirven desde
`src/assets/cakePhotos.ts`, que separa el acabado clásico de las decoraciones a
medida.

| Original | Nuevo nombre | Contenido |
| --- | --- | --- |
| `2.jpeg` | `tarta-clasica-buttercream-rosa-lotus.webp` | Tarta con buttercream rosa, cenefa de manga y galletas Lotus. Acabado clásico. |
| `3.jpeg` | `tarta-clasica-chocolate-drip-dedicatoria.webp` | Tarta de chocolate con drip, cenefa y dedicatoria escrita + topper. Acabado clásico. |
| `5.jpeg` | `tarta-clasica-nata-drip-chocolate.webp` | Nata montada con drip de chocolate y corona de picos. Acabado clásico. |
| `6.jpeg` | `tarta-clasica-merengue-tostado-dedicatoria.webp` | Merengue italiano tostado con dedicatoria escrita en chocolate. Acabado clásico. |
| `7.jpeg` | `tarta-clasica-chocolate-trufa-drip.webp` | Chocolate con trufa, conchas de manga, drip y virutas. Acabado clásico. |
| `8.jpeg` | `tarta-clasica-chocolate-crema-cafe.webp` | Bizcocho de chocolate con crema de café, rosetones y pepitas. Acabado clásico. |
| `WhatsApp Image 2026-08-19 at 13.11.12.jpeg` | `tarta-clasica-chocolate-dulce-de-leche.webp` | Chocolate con dulce de leche y fideos (foto de obrador). Acabado clásico. |
| `WhatsApp Image 2026-08-19 at 13.11.124.jpeg` | `tarta-personalizada-decoracion-vintage.webp` | Decoración vintage a manga en turquesa con guirnaldas y perlas. Ejemplo de tarta personalizada. |

**Pendiente de Dulce Flor:** ejemplos reales de fondant, figuras modeladas,
personajes o formas no redondas — en este lote no hay ninguno y la sección de
tartas personalizadas se apoya de momento en una sola fotografía.

## Observaciones

- Las cartas de **fondo oscuro** corresponden a la oferta para **particulares**; las de **fondo claro** indican explícitamente (o comparten diseño con la que lo indica) precios para **empresas y restaurantes**. La asignación de `...196.jpeg` a empresas es una **inferencia por estilo visual** — pendiente de confirmar con Dulce Flor.
- No existen fotografías reales de producto individuales (solo las cartas y el logo). Las tarjetas de producto de la web usan estilos de marca como placeholder hasta disponer de fotos reales.
- Los datos extraídos de estas cartas alimentan `src/domain/catalog.ts` (fuente de verdad del catálogo).
