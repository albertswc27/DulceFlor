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
| `/mi-pedido#token` | Ficha privada del pedido, la que abre el cliente desde el SMS (sin login, excluida de buscadores) |
| `/admin` | Login administración |
| `/admin/panel` | Dashboard |
| `/admin/pedidos` | Lista de pedidos con filtros |
| `/admin/pedidos/:id` | Detalle de pedido y cambio de estado |
| `/admin/kiosk` | Interfaz táctil para tablet (requiere sesión) |

## Base de datos de pedidos (Supabase)

Sin esto, cada pedido se queda en el navegador donde se hace y **no llega al
panel**. Con esto, todos los pedidos aterrizan en el mismo sitio y el panel los
ve desde cualquier dispositivo.

Es gratis: el plan Free de Supabase da 500 MB, muy por encima de lo que ocupa
un obrador. Ojo con una cosa: **los proyectos gratuitos se pausan tras una
semana sin actividad**. Basta con que alguien abra el panel de vez en cuando
para mantenerlo despierto; si se pausa, se reactiva desde el panel de Supabase.

### 1. Crear el proyecto

1. Entrar en [supabase.com](https://supabase.com) y crear una cuenta.
2. **New project**, y rellenar así:

   | Campo | Valor |
   | --- | --- |
   | Organization | la que ya sale |
   | GitHub | **saltar**, no hace falta |
   | Project name | `dulce-flor` |
   | Database password | «Generate a password» y **guardarla en un gestor de contraseñas** |
   | Region | **Central EU (Frankfurt)** o West EU (Ireland) |

   La contraseña de la base de datos **no es la del panel**: es la del
   Postgres, y no se usa desde la web. Guardarla igualmente.

   La región importa: en la UE los datos de clientes no salen del espacio
   europeo y el aviso legal se sostiene sin cláusulas de transferencia
   internacional.

3. En **Security**, del mismo formulario:

   | Casilla | Cómo dejarla | Por qué |
   | --- | --- | --- |
   | Enable Data API | ✅ **marcada** | Es por donde habla la web. Sin esto no funciona nada. |
   | Automatically expose new tables | ❌ **desmarcada** | Lo recomienda la propia Supabase. El esquema da los permisos uno a uno: `anon` solo puede insertar. |
   | Enable automatic RLS | ✅ **marcada** | Red de seguridad: si algún día se crea una tabla y se olvida protegerla, nace protegida. |

### 2. Crear la tabla, el almacén de imágenes y los permisos

En el proyecto: **SQL Editor → New query**, pegar entero el contenido de
[`supabase/schema.sql`](../supabase/schema.sql) y pulsar **Run**.

Ese fichero crea:

- La **tabla de pedidos** y sus **políticas de seguridad por fila**, que son lo
  que impide que cualquiera se descargue la agenda de clientes: cualquiera
  puede crear un pedido (es un formulario público), pero solo una sesión
  iniciada puede leerlos.
- El **bucket privado `order-references`** para las fotos que adjunta el
  cliente, con la misma regla: cualquiera puede subir, solo el equipo (sesión
  iniciada) puede descargar. Así la foto llega al panel se haga el pedido donde
  se haga, en vez de quedarse en el móvil del cliente.

El fichero es idempotente: si ya lo ejecutaste antes (cuando solo estaba la
tabla), **vuelve a pegarlo y ejecutarlo** para añadir el bucket de imágenes; no
rompe nada de lo que ya había.

### 3. Crear las cuentas del equipo

**Authentication → Users → Add user → Create new user**, una por persona,
marcando **Auto Confirm User**:

| Email | Persona |
| --- | --- |
| `dulceflor1@dulceflorbcn.es` | Propietaria 1 |
| `dulceflor2@dulceflorbcn.es` | Propietaria 2 |
| `albert@dulceflorbcn.es` | Albert (AstroLanding) |

El correo no tiene que existir de verdad: es solo el identificador. En la web
se sigue escribiendo `dulceflor1`, y la aplicación le añade el dominio (se
puede cambiar con `VITE_ADMIN_EMAIL_DOMAIN`).

Conviene además desactivar el alta libre, para que nadie se cree una cuenta y
se lea los pedidos: **Authentication → Sign In / Providers → Email →
desactivar «Allow new users to sign up»**.

### 4. Conectar la web

**Settings → API Keys** (`/project/<ref>/settings/api-keys`), y copiar:

| Variable de entorno | De dónde sale |
| --- | --- |
| `VITE_SUPABASE_URL` | Settings → Data API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | `anon` (antigua) o `sb_publishable_...` (nueva) |

Se añaden en Vercel igual que `VITE_ADMIN_ACCOUNTS` (tipo **Config**, las tres
environments) y en el `.env` local. Después, **redeploy**.

⚠️ La clave pública es pública y no pasa nada porque viaje en el JavaScript;
lo que protege los datos son las políticas del paso 2. La **secreta** se salta
esas políticas y **nunca** debe ponerse aquí — la aplicación la detecta y se
niega a usarla, pero mejor no llegar a eso.

Hay **dos generaciones de claves** conviviendo, y la salvaguarda reconoce las
dos porque se detectan de forma distinta:

| | Pública | Secreta | Cómo se detecta la secreta |
| --- | --- | --- | --- |
| Antigua | `anon` (JWT `eyJ...`) | `service_role` (JWT `eyJ...`) | `"role": "service_role"` dentro del payload |
| Nueva | `sb_publishable_...` | `sb_secret_...` | solo por el prefijo: es opaca |

⏳ **Las antiguas se borran a finales de 2026** y entonces la web deja de
funcionar. Este proyecto todavía usa las antiguas. Migrar es crear las nuevas
en esa misma pantalla y cambiar el valor de las variables; las dos generaciones
funcionan a la vez, así que se puede hacer sin ventana de corte.

### Cómo saber que funciona

1. Hacer un pedido de prueba desde el móvil.
2. Abrir el panel desde el ordenador. El pedido tiene que aparecer.

Si el panel avisa de que «este listado es de este dispositivo», es que las
variables no han llegado al build: revisar el nombre y volver a desplegar.

### Qué pasa si Supabase se cae o no hay cobertura

El pedido se guarda primero en el dispositivo y se sube después. Si la subida
falla, queda marcado como pendiente y se reintenta en la siguiente
sincronización (al abrir el panel, o al volver la web al primer plano). El
cliente nunca pierde su pedido, y el mensaje de WhatsApp sigue siendo la vía
principal para avisar a Dulce Flor.

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

## Aplicar el SQL en Supabase

Hay cuatro ficheros en `supabase/` y **el orden importa**: `ficha-sms.sql`
reescribe permisos que crea `equipo-y-permisos.sql`.

```
schema.sql            tablas base (ya aplicado)
equipo-y-permisos.sql cierra los pedidos al equipo   <- obligatorio, ver abajo
ficha-sms.sql         columnas del aviso y ficha publica
imagen-ia.sql         contadores de gasto del generador de imagenes
```

Se pueden pegar a mano en el editor SQL de Supabase, o de una vez:

```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_..."   # supabase.com/dashboard/account/tokens
node scripts/aplicar-sql.cjs
```

Los tres son idempotentes (`if not exists`, `or replace`, `on conflict do
nothing`), así que volver a lanzarlo es seguro. Si uno falla, el script para
ahí en vez de seguir contra una base a medio migrar.

Para saber en cualquier momento qué falta, sin cambiar nada:
`supabase/comprobar.sql`. Devuelve una línea por objeto con OK o FALTA, y
además avisa si sigue presente el agujero de la política `using (true)`.

Dos notas sobre la CLI de Supabase, porque cuestan media hora de averiguar:

- **`supabase login` exige una terminal interactiva.** No se puede scriptar.
  El token personal o la cadena de conexión son la alternativa.
- **`supabase link` no hace falta**: `db query --project-ref <ref>` apunta al
  proyecto en cada llamada, y la referencia sale del `.env`.

## Avisos por SMS

El aviso automático al cliente cuando se tramita un pedido tiene su propio
documento: **[sms.md](sms.md)**. Léelo antes de activarlo — hay un trámite en la
CNMC que puede tardar un mes y sin el cual los SMS no llegan.

Resumen: `supabase/equipo-y-permisos.sql` y luego `supabase/ficha-sms.sql` en
Supabase, las variables `SMS_*`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
`PUBLIC_SITE_URL` en Vercel, y `SMS_PROVIDER=pruebas` mientras se tramita el
alias.

⚠️ `equipo-y-permisos.sql` no es opcional ni es solo para los SMS: arregla que
hoy **cualquier usuario autenticado del proyecto puede leer todos los pedidos**,
porque las políticas de `schema.sql` dicen `using (true)`. Ejecútalo aunque
decidas no activar los avisos.

## Sobre vercel.json

Dos cosas que conviene no tocar sin saber por qué están:

- El `rewrites` manda **todo** al `index.html`, porque el enrutado lo hace
  React. Eso NO se traga las funciones de `/api`: Vercel resuelve el sistema de
  ficheros —estáticos y funciones— *antes* de aplicar los rewrites. Se intentó
  además excluir `/api` explícitamente con un patrón de exclusión, pero Vercel
  lo rechaza al validar (`invalid source pattern`), y la alternativa con
  parámetro con nombre ensucia el destino con una cadena de consulta. Así que
  se deja el catch-all, que es lo correcto y lo que ya funcionaba.
- **Nunca** usar la propiedad antigua `routes` para el fallback del SPA: esa sí
  se evalúa antes del sistema de ficheros y dejaría las funciones sin
  responder.
- `api/generar-imagen.ts` tiene 60 segundos y el resto 15: generar una imagen
  tarda segundos, y con 15 Vercel cortaría la petición justo antes de recibir
  la imagen… que ya se habría pagado.

Nota: `vercel.json` valida contra un esquema y **rechaza propiedades que no
conozca**, así que no se le pueden meter comentarios en forma de clave extra.
El despliegue falla con «should NOT have additional property».

## Generador de imágenes con IA

Tiene su propio documento: **[ia-imagenes.md](ia-imagenes.md)**. Léelo antes de
activarlo: además de la clave y los topes de gasto, hay tres obligaciones
legales que están integradas en el diseño y que no se pueden quitar sin dejar la
funcionalidad desprotegida.

Resumen: `supabase/imagen-ia.sql`, las variables `IA_*`, `GEMINI_API_KEY`,
`AI_IMAGE_IP_SALT` y `SUPABASE_SERVICE_ROLE_KEY` en Vercel, y
`IA_PROVEEDOR=pruebas` para probarlo todo sin gastar.

## Configuración pendiente de Dulce Flor

Casi todo está confirmado (horario 10:00–22:00 todos los días, antelación estándar de 3 días — desde el 29/08/2026 los pedidos con menos margen se aceptan como URGENTES a confirmar por WhatsApp —, zonas de entrega, dirección, toppings y extras). Queda pendiente:

- Nombre completo del titular (autónomo) para el aviso legal — el NIF ya se recibió por WhatsApp y, por privacidad, no se guarda en este repositorio público.
- Días de cierre semanales, si los hubiera (`BUSINESS_HOURS` en `src/config/business.ts`).
- **Registro del alias «DulceFlor» en la CNMC** (ver [sms.md](sms.md)): hace
  falta el certificado digital de la titular y puede tardar un mes.

## Nota sobre datos

Los pedidos y la sesión admin se guardan en el navegador (localStorage/sessionStorage)
en esta POC. Ver `architecture.md` para el plan de backend real.
