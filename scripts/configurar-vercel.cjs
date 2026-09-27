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
 *   - PUBLIC_SITE_URL, SMS_PROVIDER=pruebas y SMS_SENDER.
 *
 * Qué NO pone, a propósito: las credenciales de LabsMobile. No existen aún y,
 * cuando existan, las pone quien las tenga delante.
 *
 * Con SMS_PROVIDER=pruebas el circuito completo funciona —permisos, enlace,
 * ficha— sin enviar ni pagar un solo SMS. Ver docs/sms.md.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
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

function vercel(args, entrada) {
  return execFileSync("npx", ["--yes", "vercel", ...args], {
    cwd: RAIZ,
    input: entrada,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
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
 */
function poner(nombre, valor) {
  for (const entorno of ENTORNOS) {
    try {
      vercel(["env", "rm", nombre, entorno, "--yes"]);
    } catch {
      // No existía: es lo normal la primera vez.
    }
    try {
      vercel(["env", "add", nombre, entorno], `${valor}\n`);
      console.log(`  ✓ ${nombre} → ${entorno}`);
    } catch (error) {
      console.error(`  ✗ ${nombre} → ${entorno}: ${String(error.message).trim()}`);
      process.exitCode = 1;
    }
  }
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
  // aquí ni por error; la función no la necesita para nada.
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

  const variables = {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: supabaseKey,
    PUBLIC_SITE_URL: "https://dulceflorbcn.es",
    SMS_PROVIDER: "pruebas",
    SMS_SENDER: "DulceFlor",
  };

  console.log("\nPoniendo variables del servidor:\n");
  for (const [nombre, valor] of Object.entries(variables)) poner(nombre, valor);

  console.log(
    "\nListo. Dos avisos:\n" +
      "  · Las variables solo se aplican a despliegues NUEVOS: lanza `npx vercel --prod`.\n" +
      "  · SMS_PROVIDER queda en «pruebas»: no se envía ni se paga nada hasta que\n" +
      "    la CNMC apruebe el alias y se pongan las credenciales de LabsMobile.\n"
  );
}

main();
