# Setup — Web Dulce Flor

## Requisitos

- Node.js 18+ (probado con el Node instalado en esta máquina).

## Comandos

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo (Vite)
npm run build      # build de producción (dist/)
npm run preview    # servir el build
npm run typecheck  # TypeScript sin emitir
npm run lint       # ESLint
npm test           # tests de lógica de negocio (vitest)
```

## Rutas

| Ruta | Contenido |
| --- | --- |
| `/` | Home pública |
| `/carta` | Carta con precios (particulares/empresas) |
| `/pedido` | Configurador y wizard de pedido |
| `/pedido/confirmacion/:id` | Confirmación + WhatsApp |
| `/admin` | Login administración |
| `/admin/panel` | Dashboard |
| `/admin/pedidos` | Lista de pedidos con filtros |
| `/admin/pedidos/:id` | Detalle de pedido y cambio de estado |
| `/admin/kiosk` | Interfaz táctil para tablet (requiere sesión) |

## Credenciales de DESARROLLO (solo POC)

Acceso: `/admin` (en producción, `dulceflor.es/admin`).

| Usuario | Persona | Contraseña |
| --- | --- | --- |
| `dulceflor1` | Propietaria 1 | `Flor2026.Rosa!` |
| `dulceflor2` | Propietaria 2 | `Flor2026.Crema!` |
| `albert` | Albert (AstroLanding) | `Astro2026.Admin!` |

⚠️ Son credenciales de desarrollo para la demo. La autenticación de la POC es
client-side y **no es segura para producción** (ver `architecture.md`). Cambiarlas
cuando exista backend/proveedor de identidad real.

## Configuración pendiente de Dulce Flor

Editar **solo** [`src/config/business.ts`](../src/config/business.ts) cuando lleguen los datos definitivos:

- `DELIVERY_ZONES` (zonas/tarifas definitivas de entrega).
- Días de cierre semanales, si los hubiera (`BUSINESS_HOURS`; hoy 10:00–22:00 todos los días).

Confirmado el 17/08/2026 por WhatsApp: horario 10:00–22:00, antelación mínima 3 días, lista de toppings, extras disponibles en todos los productos y cartas claras = empresas.

## Nota sobre datos

Los pedidos y la sesión admin se guardan en el navegador (localStorage/sessionStorage)
en esta POC. Ver `architecture.md` para el plan de backend real.
