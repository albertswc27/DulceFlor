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
node scripts/admin-credentials.cjs  # genera las credenciales del panel (ver más abajo)
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

## Acceso al panel de administración

Acceso: `/admin` (en producción, `dulceflorbcn.es/admin`).

**Las contraseñas no están en este repositorio, y no deben volver a estarlo.**
Las cuentas se leen de la variable de entorno `VITE_ADMIN_ACCOUNTS`, que se
configura en Vercel y en un `.env` local (ignorado por git).

### Crear o rotar las credenciales

```bash
node scripts/admin-credentials.cjs
```

Genera contraseñas de **10 caracteres** (longitud pedida por Dulce Flor el
26/08/2026) e imprime por pantalla, una sola vez:

1. Las contraseñas en claro, para repartirlas por un canal privado.
2. El valor completo de `VITE_ADMIN_ACCOUNTS`.

El script **no escribe ningún fichero** a propósito, para que una contraseña no
acabe commiteada por descuido. Con `--keep-passwords` pide las contraseñas
actuales en lugar de generar otras nuevas (útil para regenerar solo las sales).

### Dónde se pega

- **Vercel** → Settings → Environment Variables → `VITE_ADMIN_ACCOUNTS`,
  marcando Production, Preview y Development. Después, redeploy.
- **Local** → un fichero `.env` en la raíz con
  `VITE_ADMIN_ACCOUNTS=...`. Está en `.gitignore`.

Sin esa variable, en `npm run dev` queda una cuenta obvia de desarrollo
(`dev` / `dev`), que **solo existe en el build de desarrollo**. En producción,
si falta la variable, el panel avisa de que no hay cuentas y no deja entrar a
nadie.

### Cómo se guardan

`PBKDF2-SHA256`, sal aleatoria propia por cuenta y 210.000 iteraciones. Ni la
contraseña ni nada reversible viaja al navegador: aunque alguien extraiga el
valor derivado del bundle, no puede volver atrás por diccionario.

Además, tras 5 intentos fallidos empieza un bloqueo que se dobla con cada
fallo (30 s, 1 min, 2 min… hasta 15 min), tanto en el login como al salir del
modo kiosk. Un acierto lo reinicia.

### Lo que esto NO resuelve

La comprobación sigue ocurriendo en el navegador, porque la POC no tiene
backend. Alguien con conocimientos técnicos puede saltársela editando el
código que se ejecuta en su propio equipo.

Eso importa menos de lo que parece: **los pedidos viven en el localStorage de
cada dispositivo**, no en un servidor. Quien abra `/admin` desde su casa se
encuentra un panel vacío — no hay nada que robar. El riesgo real está en los
dispositivos de la tienda, y ahí es donde actúan el bloqueo de kiosk y el
límite de intentos.

Si algún día se quiere cerrar del todo, hay dos caminos, de menor a mayor
esfuerzo:

1. **Vercel → Settings → Deployment Protection**, que pone una barrera de
   servidor delante de toda la web. Dos clics, sin tocar código.
2. Mover la verificación y los pedidos a un backend o proveedor de identidad
   (ver `architecture.md`).

## Configuración pendiente de Dulce Flor

Casi todo está confirmado (horario 10:00–22:00 todos los días, antelación 3 días, zonas de entrega, dirección, toppings y extras). Queda pendiente:

- Nombre completo del titular (autónomo) para el aviso legal — el NIF ya se recibió por WhatsApp y, por privacidad, no se guarda en este repositorio público.
- Días de cierre semanales, si los hubiera (`BUSINESS_HOURS` en `src/config/business.ts`).

## Nota sobre datos

Los pedidos y la sesión admin se guardan en el navegador (localStorage/sessionStorage)
en esta POC. Ver `architecture.md` para el plan de backend real.
