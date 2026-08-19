# Arquitectura — Web Dulce Flor

## Stack

- **Vite 5 + React 18 + TypeScript estricto** (SPA con `react-router-dom` v6).
- **Tailwind CSS 3** con design tokens propios (paleta extraída del logo) + utilidades ornamentales vintage en `src/index.css`.
- **framer-motion** (animaciones, con soporte `prefers-reduced-motion`), **zod** (validación), **sonner** (toasts), **date-fns** (fechas, locale `es`), **lucide-react** (iconos), primitivas propias estilo shadcn sobre Radix (dialog, label, slot).
- Tests de lógica de negocio con **vitest** (`npm test`).

Elegido por coherencia con el resto de proyectos de AstroLanding (plantilla `vite_react_shadcn_ts`).

## Estructura

```text
src/
  assets/            Imágenes renombradas (cartas + logo). Fuente de verdad visual.
  config/business.ts Configuración central de reglas cambiantes (única fuente).
  domain/            Lógica de negocio PURA, sin dependencia de UI:
    types.ts         Modelo (Order, OrderItem, estados, labels)
    catalog.ts       Catálogo/precios transcritos de las cartas
    pricing.ts       Motor de cálculo (única fuente de precios)
    delivery.ts      Resolución de zona por CP/municipio
    schedule.ts      Slots según horario + antelación
    whatsapp.ts      Mensaje y enlace wa.me
    orderId.ts       DF-AAAA-NNNN + UUID
    validation.ts    Esquemas zod compartidos
    *.test.ts        Tests de negocio
  services/
    orderRepository.ts  Persistencia tras interfaz (POC: localStorage)
    auth.ts             Autenticación admin (POC: client-side, ver límites)
  components/
    ui/              Primitivas (button, card, input, dialog…)
    layout/          PublicLayout (navbar + footer)
  features/
    marketing/       Home, carta, 404
    order/           Estado del borrador, configurador, wizard, confirmación
    admin/           Auth context, panel, pedidos, detalle, kiosk
```

Principio rector: **la UI nunca calcula precios ni disponibilidad**; siempre llama al dominio. El configurador público y el kiosk comparten estado (`OrderDraftContext`), componentes (`ProductConfigurator`, `OrderSummary`, `SlotPicker`) y registro (`submitOrder`).

## Imágenes de referencia (POC)

`services/imageStore.ts`: las fotos de referencia del cliente se redimensionan y
comprimen en el navegador (máx. 1280 px, JPEG) y se guardan bajo claves propias
de localStorage; el pedido solo referencia el `referenceImageId` (nunca base64
incrustado en el objeto del pedido). Al quitar un artículo del carrito se borra
su imagen, y al arrancar se limpian huérfanas. Con backend real, esta interfaz
se sustituye por subida a storage (Supabase Storage/S3) conservando los ids.
Limitación (igual que los pedidos): las imágenes viven en el navegador donde se
creó el pedido.

## Persistencia (POC) y camino a producción

`OrderRepository` es una interfaz estrecha implementada hoy sobre `localStorage`:

- Los pedidos solo existen en el navegador donde se crean (el panel admin ve los pedidos creados en ese mismo dispositivo). Suficiente para validar el producto y para el kiosk en la tablet de tienda.
- `create()` es **idempotente** por `clientRequestId`: reintentos o dobles clics no duplican pedidos.
- El ID público `DF-AAAA-NNNN` usa un contador anual en el mismo almacenamiento.

**Para producción** basta sustituir `LocalStorageOrderRepository` por una implementación contra backend (Supabase/Firebase/API propia) manteniendo la interfaz. Pendiente de decidir/credenciales. En ese momento la validación zod y el recálculo de precios deben ejecutarse también en servidor (los esquemas de `domain/validation.ts` y el motor de `domain/pricing.ts` están escritos para poder reutilizarse).

## Autenticación admin (POC) — LÍMITES

- Todo ocurre en el navegador: usuarios definidos en `services/auth.ts` con hash SHA-256 de contraseñas de desarrollo, sesión de 8 h en `sessionStorage`, rutas protegidas con `RequireAdmin`.
- **NO es segura para producción**: sin servidor no hay forma de impedir que alguien inspeccione el código. Documentado también en el propio archivo.
- Para producción: mover verificación a backend o proveedor (Supabase Auth, Clerk, etc.), sesiones httpOnly, y entonces sí exigir autorización en cada operación del repositorio.

## Seguridad y privacidad

- Sin secretos en el repositorio ni en el bundle (no hay API keys).
- Inputs validados con zod (longitudes máximas, formatos tel/CP/email); React escapa el contenido por defecto (sin `dangerouslySetInnerHTML`).
- El precio final siempre se recalcula desde catálogo/config al registrar (`submitOrder`), nunca se confía en el importe que muestra la UI.
- Datos personales mínimos (nombre, teléfono, email opcional, dirección solo si hay entrega). Sin trackers.
- Pendiente para producción: textos legales (privacidad, cookies, aviso legal) — no se han inventado.

## Decisiones destacadas

- **Céntimos enteros** para todo importe (`formatEuros` para pintar). Sin floats.
- **Zona de entrega por CP/municipio** (sin APIs de pago ni geocoding externo).
- **WhatsApp por deep link** `wa.me` con mensaje URL-encoded: el pedido se guarda ANTES de abrir WhatsApp; la UI nunca afirma que el mensaje se envió. Migrable a WhatsApp Business API en el futuro.
- **Horario/zonas/antelación centralizados** en `config/business.ts` marcados PROVISIONAL.
