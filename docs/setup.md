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

## Utilidades

```bash
node scripts/generate-icons.cjs     # regenera favicon, apple-touch-icon e iconos PWA desde el logo
node scripts/screenshots.cjs <dir>  # capturas de QA visual (requiere el dev server en el puerto 5300)
```

## Rutas

| Ruta | Contenido |
| --- | --- |
| `/` | Home pública |
| `/carta` | Carta con precios (particulares/empresas) |
| `/aviso-legal` | Aviso legal y política de privacidad |
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

Casi todo está confirmado (horario 10:00–22:00 todos los días, antelación 3 días, zonas de entrega, dirección, toppings y extras). Queda pendiente:

- Nombre completo del titular (autónomo) para el aviso legal — el NIF ya se recibió por WhatsApp y, por privacidad, no se guarda en este repositorio público.
- Días de cierre semanales, si los hubiera (`BUSINESS_HOURS` en `src/config/business.ts`).

## Nota sobre datos

Los pedidos y la sesión admin se guardan en el navegador (localStorage/sessionStorage)
en esta POC. Ver `architecture.md` para el plan de backend real.
