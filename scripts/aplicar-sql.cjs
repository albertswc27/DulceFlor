/**
 * Aplica los ficheros de supabase/ a la base de datos real, en orden.
 *
 *   node scripts/aplicar-sql.cjs
 *
 * Hace falta una credencial, y solo una. Por orden de comodidad:
 *
 *   1) Un token personal de Supabase (Account -> Access Tokens):
 *        $env:SUPABASE_ACCESS_TOKEN="sbp_..."     (PowerShell)
 *      o bien  node scripts/aplicar-sql.cjs --token=sbp_...
 *
 *   2) La cadena de conexión de la base (Project Settings -> Database):
 *        $env:SUPABASE_DB_URL="postgresql://..."
 *      o bien  --db-url=postgresql://...
 *
 * `supabase login` NO sirve aquí: exige una terminal interactiva, así que no
 * se puede automatizar. `supabase link` tampoco hace falta: se le pasa la
 * referencia del proyecto en cada llamada, que sale del .env.
 *
 * Los tres ficheros son idempotentes (`if not exists`, `or replace`,
 * `on conflict do nothing`): ejecutarlos dos veces no rompe nada. Por eso el
 * script no lleva registro de lo aplicado; volver a lanzarlo es seguro.
 *
 * Lo que NO es idempotente es el ORDEN: ficha-sms.sql reescribe permisos que
 * equipo-y-permisos.sql crea. Si uno falla, se para ahí en vez de seguir
 * contra una base a medio migrar.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

/**
 * El orden importa y es este. schema.sql no está: ya estaba aplicado y crea
 * las tablas base; se incluye solo con --con-schema, para una base nueva.
 */
const FICHEROS = [
  ["equipo-y-permisos.sql", "cierra el acceso a los pedidos al equipo"],
  ["ficha-sms.sql", "columnas del aviso y ficha pública del pedido"],
  ["imagen-ia.sql", "contadores de gasto del generador de imágenes"],
];

const argumento = (nombre) => {
  const prefijo = `--${nombre}=`;
  const encontrado = process.argv.find((a) => a.startsWith(prefijo));
  return encontrado ? encontrado.slice(prefijo.length) : undefined;
};

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

/** La referencia del proyecto sale de la URL de Supabase del .env. */
function referenciaDelProyecto(local) {
  const url = (local.VITE_SUPABASE_URL ?? "").match(
    /^https:\/\/([a-z0-9]+)\.supabase\.co/
  );
  return url?.[1];
}

/**
 * `shell: true` es obligatorio en Windows: desde Node 20.12 no se puede
 * lanzar un .cmd (y `npx` lo es) sin pasar por el intérprete, y falla con
 * EINVAL, que es indistinguible de «no hay sesión».
 *
 * Por eso mismo, ningún dato variable viaja como argumento: el token va por
 * el entorno del proceso hijo y la ruta del fichero es fija y sin espacios.
 */
function supabase(args, entorno) {
  return execFileSync("npx", ["--yes", "supabase", ...args], {
    cwd: RAIZ,
    encoding: "utf8",
    env: { ...process.env, ...entorno },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
}

function main() {
  // El .env va el último: una variable puesta a mano en la terminal manda
  // sobre lo que haya en el fichero, que es lo que se espera al probar algo.
  const local = leerEnvLocal();
  const dbUrl = argumento("db-url") ?? process.env.SUPABASE_DB_URL ?? local.SUPABASE_DB_URL;
  const token =
    argumento("token") ?? process.env.SUPABASE_ACCESS_TOKEN ?? local.SUPABASE_ACCESS_TOKEN;
  const ref = referenciaDelProyecto(local);

  let destino;
  let entorno = {};

  if (dbUrl) {
    // Con la cadena de conexión no hace falta token ni sesión de ningún tipo.
    destino = ["--db-url", dbUrl];
    console.log("Conectando con la cadena de conexión de la base.");
  } else if (token) {
    if (!ref) {
      console.error(
        "\nNo se encuentra VITE_SUPABASE_URL en el .env, así que no sé a qué\n" +
          "proyecto aplicar esto. Pásalo a mano: --db-url=postgresql://...\n"
      );
      process.exit(1);
    }
    // `--linked` es obligatorio al lado de `--project-ref`: sin él la CLI
    // responde DbQueryMutuallyExclusiveFlagsError. Los dos juntos apuntan al
    // proyecto en cada llamada y evitan tener que hacer `supabase link`.
    destino = ["--linked", "--project-ref", ref];
    entorno = { SUPABASE_ACCESS_TOKEN: token };
    console.log(`Proyecto: ${ref}`);
  } else {
    console.error(
      "\nFalta la credencial. Una de las dos, y es cosa de un minuto:\n\n" +
        "  A) Token personal — https://supabase.com/dashboard/account/tokens\n" +
        '     $env:SUPABASE_ACCESS_TOKEN="sbp_..."; node scripts/aplicar-sql.cjs\n\n' +
        "  B) Cadena de conexión — Project Settings > Database > Connection string\n" +
        '     $env:SUPABASE_DB_URL="postgresql://..."; node scripts/aplicar-sql.cjs\n\n' +
        "El token es preferible: se revoca con un clic y no lleva la contraseña\n" +
        "de la base dentro.\n"
    );
    process.exit(1);
  }

  const pendientes = process.argv.includes("--con-schema")
    ? [["schema.sql", "tablas base (solo en una base nueva)"], ...FICHEROS]
    : FICHEROS;

  for (const [fichero, para_que] of pendientes) {
    const ruta = path.join("supabase", fichero);
    if (!fs.existsSync(path.join(RAIZ, ruta))) {
      console.error(`  ✗ ${fichero}: no existe`);
      process.exit(1);
    }
    process.stdout.write(`\n→ ${fichero} (${para_que})\n`);
    try {
      const salida = supabase(["db", "query", ...destino, "-f", ruta], entorno);
      console.log(`  ✓ aplicado${salida.trim() ? `\n${salida.trim()}` : ""}`);
    } catch (error) {
      const detalle = [error.stdout, error.stderr, error.message]
        .filter(Boolean)
        .join("\n")
        .trim();
      console.error(`  ✗ ha fallado, y paro aquí para no dejar la base a medias:\n\n${detalle}\n`);
      process.exit(1);
    }
  }

  console.log("\n→ comprobando el resultado\n");
  try {
    console.log(supabase(["db", "query", ...destino, "-f", "supabase/comprobar.sql"], entorno));
  } catch (error) {
    console.error(`No he podido comprobarlo: ${String(error.message).trim()}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    "Si todo dice OK, la base está lista. Lo que queda son dos variables en\n" +
      "Vercel: SUPABASE_SERVICE_ROLE_KEY y GEMINI_API_KEY. Ver docs/sms.md y\n" +
      "docs/ia-imagenes.md.\n"
  );
}

main();
