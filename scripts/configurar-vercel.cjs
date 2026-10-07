/**
 * Deja las variables del servidor puestas en Vercel, en los tres entornos.
 *
 * Es el paso que no se puede automatizar del todo desde aquí: hace falta una
 * sesión de Vercel. Una vez iniciada, esto evita tener que pegar diez valores
 * a mano en el panel y equivocarse en uno.
 *
 *   npx vercel login      (una vez)
 *   npx vercel link       (una vez, para asociar la carpeta al proyecto)
 *   node scripts/configurar-vercel.cjs
 *
 * Qué pone:
 *   - SUPABASE_URL y SUPABASE_ANON_KEY, copiadas del .env local (son las
 *     mismas que usa el navegador, pero SIN el prefijo VITE_, porque las lee
 *     la función serverless y no el bundle).
 *   - PUBLIC_SITE_URL, SMS_PROVIDER=pruebas, SMS_SENDER e IA_PROVEEDOR=pruebas.
 *
 * Y al final relee de Vercel lo que ha quedado guardado y lo compara, porque
 * un «✓» que nadie comprueba es como no tener nada.
 *
 * Qué NO pone, a propósito:
 *   - Las credenciales de LabsMobile y GEMINI_API_KEY: cuestan dinero y las
 *     pone quien las tenga delante.
 *   - AI_IMAGE_IP_SALT: cambiarla reinicia los contadores de gasto del día.
 *
 * Con SMS_PROVIDER=pruebas el circuito completo funciona —permisos, enlace,
 * ficha— sin enviar ni pagar un solo SMS. Ver docs/sms.md.
 */
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const ENTORNOS = ["production", "preview", "development"];

/** Lee el .env local sin dependencias: solo NOMBRE=valor, ignorando comentarios. */
function leerEnvLocal() {
  const ruta = path.join(RAIZ, ".env");
  if (!fs.existsSync(ruta)) return {};
  const valores = {};
  for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const corte = limpia.indexOf("=");
    if (corte === -1) continue;
    valores[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim();
  }
  return valores;
}

/**
 * `shell: true` es obligatorio en Windows: desde Node 20.12 no se pueden
 * lanzar ficheros .cmd (y `npx` lo es) sin pasar por el intérprete, y el
 * intento falla con EINVAL, que es indistinguible de «no hay sesión».
 *
 * Los argumentos que se le pasan son fijos y sin espacios; el único dato
 * variable —el valor de la variable— viaja por la entrada estándar, así que
 * no hay nada que citar ni que se pueda colar como comando.
 */
function vercel(args, entrada) {
  return execFileSync("npx", ["--yes", "vercel", ...args], {
    cwd: RAIZ,
    input: entrada,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
  });
}

function comprobarSesion() {
  try {
    const quien = vercel(["whoami"]).trim();
    console.log(`Sesión de Vercel: ${quien}`);
  } catch {
    console.error(
      "\nNo hay sesión de Vercel en este equipo.\n\n" +
        "  npx vercel login\n" +
        "  npx vercel link\n\n" +
        "y vuelve a ejecutar este script."
    );
    process.exit(1);
  }
  if (!fs.existsSync(path.join(RAIZ, ".vercel", "project.json"))) {
    console.error(
      "\nLa carpeta no está asociada a ningún proyecto de Vercel.\n\n  npx vercel link\n"
    );
    process.exit(1);
  }
}

/**
 * Pone una variable en los tres entornos. Si ya existía, se elimina primero:
 * `vercel env add` no reemplaza, y quedarse con el valor viejo sin enterarse
 * es peor que fallar.
 *
 * Ese borrar-antes-de-escribir tiene un filo: entre el `rm` y el `add` la
 * variable NO EXISTE. Si el `add` falla —la red, la sesión que caduca a mitad,
 * un límite de la API— la variable se queda borrada, y el siguiente despliegue
 * arranca sin ella: /api/avisar-pedido devolvería 500 y la tienda no podría
 * avisar a nadie. Por eso se reintenta una vez y, si tampoco, se ABORTA aquí
 * mismo nombrando la variable y el entorno, en vez de seguir y enterrar el
 * problema entre veinticuatro líneas de «✓».
 */
function poner(nombre, valor) {
  for (const entorno of ENTORNOS) {
    try {
      vercel(["env", "rm", nombre, entorno, "--yes"]);
    } catch {
      // No existía: es lo normal la primera vez.
    }
    try {
      // SIN salto de línea al final, y esto costó un rato de averiguar:
      // Vercel guarda el "\n" DENTRO del valor. Con él, PUBLIC_SITE_URL vale
      // "https://www.dulceflorbcn.es\n", y cualquier consumidor que no haga
      // trim() se lleva una URL con un salto dentro o —peor— un valor de
      // cabecera HTTP inválido, que hace que fetch lance una excepción.
      //
      // Sin el salto no se queda esperando: execFileSync cierra la entrada
      // estándar en cuanto acaba de escribir, y ese EOF le basta.
      vercel(["env", "add", nombre, entorno], valor);
      console.log(`  ✓ ${nombre} → ${entorno}`);
    } catch {
      try {
        vercel(["env", "add", nombre, entorno], valor);
        console.log(`  ✓ ${nombre} → ${entorno} (al segundo intento)`);
      } catch (error) {
        console.error(
          `\n  ✗ ${nombre} → ${entorno}: ${String(error.message).trim()}\n\n` +
            `  ATENCIÓN: ${nombre} se ha quedado BORRADA en ${entorno} y no he\n` +
            `  podido volver a escribirla. Ponla a mano en el panel de Vercel\n` +
            `  ANTES del próximo despliegue, o ese entorno arrancará sin ella.\n\n` +
            `  Paro aquí: las variables que faltan por poner conservan su valor\n` +
            `  anterior, así que no hay nada más roto que esta.\n`
        );
        process.exit(1);
      }
    }
  }
}

/**
 * Descodifica una línea del fichero que escribe `vercel env pull`. Viene en
 * formato dotenv: el valor entre comillas y los saltos de línea escapados,
 * que es justo lo que hay que deshacer para poder comparar de verdad.
 */
function valorDeLinea(linea) {
  const corte = linea.indexOf("=");
  if (corte === -1) return undefined;
  let valor = linea.slice(corte + 1).trim();
  if (valor.startsWith('"') && valor.endsWith('"')) valor = valor.slice(1, -1);
  return valor
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/**
 * Lee de vuelta lo que se acaba de guardar y lo compara con lo que se quería
 * guardar.
 *
 * Existe por una razón concreta: el fallo del salto de línea sobrevivió
 * semanas porque el script imprimía «✓» y nadie miraba lo que había quedado
 * dentro. Decir «hecho» sin comprobarlo es lo que lo hizo posible.
 *
 * El fichero que descarga `vercel env pull` lleva las claves en claro, así que
 * va al directorio temporal del sistema —nunca al repositorio, que es
 * público— y se borra pase lo que pase.
 */
function comprobarLoGuardado(esperado) {
  console.log("\nComprobando lo que ha quedado guardado:\n");
  let todoBien = true;

  // Los tres entornos, no solo production: el fallo del salto de línea llegó a
  // estar en preview y development mientras production ya estaba bien, y
  // comprobar solo uno lo habría dado por arreglado.
  for (const entorno of ENTORNOS) {
    const guardado = descargarEntorno(entorno);
    if (!guardado) {
      todoBien = false;
      continue;
    }
    const problemas = [];
    for (const [nombre, valor] of Object.entries(esperado)) {
      const real = guardado[nombre];
      if (real === valor) continue;
      if (real === undefined) problemas.push(`${nombre} (no está)`);
      else if (real.trim() === valor) problemas.push(`${nombre} (espacios o salto de línea de más)`);
      else problemas.push(`${nombre} (${real.length} caracteres, esperaba ${valor.length})`);
    }
    if (problemas.length === 0) {
      console.log(`  ✓ ${entorno}: las ${Object.keys(esperado).length} coinciden exactamente`);
      continue;
    }
    todoBien = false;
    process.exitCode = 1;
    console.error(`  ✗ ${entorno}: ${problemas.join(", ")}`);
  }

  if (todoBien) console.log("\n  Todo bien, sin caracteres de más en ningún entorno.");
}

/**
 * Descarga las variables de un entorno y las devuelve descodificadas.
 *
 * El fichero que escribe `vercel env pull` lleva las claves en claro, así que
 * va al directorio temporal del sistema —nunca al repositorio, que es
 * público— y se borra pase lo que pase.
 */
function descargarEntorno(entorno) {
  const destino = path.join(
    os.tmpdir(),
    `dulce-flor-env-${process.pid}-${crypto.randomBytes(4).toString("hex")}.txt`
  );
  let contenido;
  try {
    vercel(["env", "pull", destino, `--environment=${entorno}`, "--yes"]);
    contenido = fs.readFileSync(destino, "utf8");
  } catch (error) {
    console.error(`  ✗ ${entorno}: no he podido releerlo (${String(error.message).trim()})`);
    process.exitCode = 1;
    return undefined;
  } finally {
    try {
      fs.rmSync(destino, { force: true });
    } catch {
      console.error(`\n⚠ Borra a mano este fichero, lleva claves dentro: ${destino}`);
    }
  }

  const guardado = {};
  for (const linea of contenido.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const nombre = limpia.slice(0, limpia.indexOf("="));
    if (nombre) guardado[nombre] = valorDeLinea(limpia);
  }
  return guardado;
}

function main() {
  comprobarSesion();

  const local = leerEnvLocal();
  const supabaseUrl = local.VITE_SUPABASE_URL;
  const supabaseKey = local.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "\nFalta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el .env local.\n" +
        "Sin eso la función no puede comprobar quién pide enviar un SMS."
    );
    process.exit(1);
  }

  // Salvaguarda: la service_role se salta la seguridad por fila. No debe estar
  // aquí ni por error; la función no la necesita para nada. Y esta misma
  // variable la lee Vite y la mete dentro del JavaScript público, así que
  // colarla aquí es publicarla.
  //
  // Dos formatos: la clave nueva (`sb_secret_...`) es opaca y solo la delata
  // el prefijo; la antigua es un JWT con el rol dentro.
  if (supabaseKey.startsWith("sb_secret_")) {
    console.error(
      "\nLa clave del .env empieza por sb_secret_: es una clave SECRETA.\n" +
        "Usa la publishable (sb_publishable_...) o la anon."
    );
    process.exit(1);
  }
  try {
    const payload = JSON.parse(
      Buffer.from(supabaseKey.split(".")[1] ?? "", "base64").toString("utf8")
    );
    if (payload?.role === "service_role") {
      console.error(
        "\nLa clave del .env parece una service_role. Usa la clave anon/publishable."
      );
      process.exit(1);
    }
  } catch {
    // No es un JWT legible: las claves nuevas de Supabase no lo son.
  }

  // AI_IMAGE_IP_SALT no está aquí a propósito: cambiarla reinicia los
  // contadores de gasto del día, así que no puede regenerarse en cada
  // ejecución. Se pone una vez a mano y se deja quieta. Ver docs/ia-imagenes.md.
  const variables = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseKey,
    PUBLIC_SITE_URL: "https://www.dulceflorbcn.es",
    SMS_PROVIDER: "pruebas",
    SMS_SENDER: "DulceFlor",
    // gemini de verdad desde el 06/10/2026: creditos comprados, clave con
    // facturacion y una generacion real comprobada.
    IA_PROVEEDOR: "gemini",
    // El interruptor de la interfaz. Sin esto el generador existe pero no
    // se le ensena a nadie. Ver AI_PREVIEW_ENABLED en src/config/business.ts.
    VITE_AI_PREVIEW: "1",
    // Las dos con prefijo VITE_ las lee el navegador, no el servidor, y son
    // las mismas de arriba. Están aquí porque tienen que existir en los TRES
    // entornos: sin ellas en preview, una preview se despliega sin base de
    // datos y parece que los pedidos no llegan.
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: supabaseKey,
  };

  // Las dos claves que cuestan dinero solo se ponen si están en el .env. Así
  // el script sirve igual antes y después de contratarlas, y nadie tiene que
  // acordarse de comentar una línea.
  // Los datos del titular son personales, asi que no se escriben aqui: salen
  // del .env, que esta fuera del repositorio. Sin ellos el aviso legal se
  // publica sin identificar a nadie, que incumple el art. 10 de la LSSI.
  for (const nombre of [
    "GEMINI_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "VITE_LEGAL_HOLDER",
    "VITE_LEGAL_TAX_ID",
  ]) {
    const valor = local[nombre];
    if (valor) variables[nombre] = valor;
    else console.log(`(${nombre} no está en el .env: no la toco)`);
  }

  // La service_role se salta la seguridad por fila. Que esté en el .env es
  // correcto —la lee la función del servidor—, pero si alguien la ha pegado
  // con el prefijo VITE_ acabaría dentro del JavaScript público.
  if (Object.keys(local).some((n) => n.startsWith("VITE_") && /SERVICE_ROLE|SECRET/i.test(n))) {
    console.error(
      "\nHay una variable VITE_ con pinta de clave secreta en el .env.\n" +
        "Vite mete todo lo que empieza por VITE_ dentro del JavaScript público.\n"
    );
    process.exit(1);
  }

  console.log("\nPoniendo variables del servidor:\n");
  for (const [nombre, valor] of Object.entries(variables)) poner(nombre, valor);

  comprobarLoGuardado(variables);

  console.log(
    "\nListo. Dos avisos:\n" +
      "  · Las variables solo se aplican a despliegues NUEVOS: lanza `npx vercel --prod`.\n" +
      "  · SMS_PROVIDER queda en «pruebas»: no se envía ni se paga nada hasta que\n" +
      "    la CNMC apruebe el alias y se pongan las credenciales de LabsMobile.\n"
  );
}

main();
