/**
 * Comprueba contra la base de datos REAL que los topes de gasto del generador
 * de imágenes funcionan, y —lo más importante— que **la clave pública no puede
 * tocarlos**.
 *
 *   node scripts/comprobar-ia.cjs
 *
 * Por qué existe: este endpoint está abierto a gente anónima y cada llamada
 * cuesta dinero. Los tres contadores son lo único que separa «un mes de
 * imágenes por dos euros» de «alguien encuentra la URL y la deja en bucle».
 * Que el SQL esté aplicado no demuestra que los permisos estén bien puestos;
 * esto sí, porque lo intenta de verdad.
 *
 * No gasta nada: no llama a Gemini. Usa claves de contador inventadas con
 * prefijo `prueba:` y las borra al terminar.
 *
 * Lee del .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y
 * SUPABASE_SERVICE_ROLE_KEY.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

function leerEnvLocal() {
  const valores = {};
  const ruta = path.join(RAIZ, ".env");
  if (!fs.existsSync(ruta)) return valores;
  for (const linea of fs.readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const corte = limpia.indexOf("=");
    if (corte === -1) continue;
    valores[limpia.slice(0, corte).trim()] = limpia.slice(corte + 1).trim();
  }
  return valores;
}

/** Llama a una función RPC de Supabase con la clave que se le pase. */
async function rpc(url, clave, nombre, args) {
  const respuesta = await fetch(`${url}/rest/v1/rpc/${nombre}`, {
    method: "POST",
    headers: {
      apikey: clave,
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  let cuerpo;
  try {
    cuerpo = await respuesta.json();
  } catch {
    cuerpo = null;
  }
  return { status: respuesta.status, cuerpo };
}

let fallos = 0;
function comprobar(descripcion, condicion, detalle) {
  if (condicion) {
    console.log(`  ✓ ${descripcion}`);
  } else {
    fallos++;
    console.error(`  ✗ ${descripcion}${detalle ? `\n      ${detalle}` : ""}`);
  }
}

async function main() {
  const local = leerEnvLocal();
  const url = local.VITE_SUPABASE_URL;
  const anon = local.VITE_SUPABASE_ANON_KEY;
  const secreta = local.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon || !secreta) {
    console.error(
      "\nFaltan variables en el .env: hacen falta VITE_SUPABASE_URL,\n" +
        "VITE_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.\n"
    );
    process.exit(1);
  }

  // Sufijo distinto en cada ejecución: así dos pasadas no se estorban.
  const marca = `prueba:${crypto.randomBytes(6).toString("hex")}`;
  const sesion = `${marca}:sesion`;
  const cliente = `${marca}:cliente`;
  const tienda = `${marca}:tienda`;
  const limites = { p_session_limit: 2, p_ip_limit: 6, p_day_limit: 40 };
  const puerta = (extra = {}) =>
    rpc(url, secreta, "ai_quota_gate", {
      p_session_key: sesion,
      p_ip_key: cliente,
      p_day_key: tienda,
      ...limites,
      ...extra,
    });

  console.log("\n1. La clave pública NO puede tocar los contadores\n");

  const intruso = await rpc(url, anon, "ai_quota_gate", {
    p_session_key: sesion,
    p_ip_key: cliente,
    p_day_key: tienda,
    ...limites,
  });
  comprobar(
    "ai_quota_gate está cerrada a la clave pública",
    intruso.status === 401 || intruso.status === 403 || intruso.status === 404,
    `ha respondido ${intruso.status}: ${JSON.stringify(intruso.cuerpo)?.slice(0, 200)}`
  );

  const leer = await fetch(`${url}/rest/v1/ai_image_quota?select=*&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const cuerpoLeer = await leer.text();
  comprobar(
    "la tabla de contadores no se puede leer con la clave pública",
    leer.status !== 200 || cuerpoLeer.trim() === "[]",
    `ha respondido ${leer.status}: ${cuerpoLeer.slice(0, 200)}`
  );

  console.log("\n2. Los topes cuentan y cortan\n");

  const primera = await puerta();
  const fila = Array.isArray(primera.cuerpo) ? primera.cuerpo[0] : primera.cuerpo;
  comprobar(
    "la primera generación se permite",
    fila?.allowed === true,
    `ha devuelto ${JSON.stringify(primera.cuerpo)?.slice(0, 200)}`
  );
  comprobar("y cuenta 1 usada", fila?.session_used === 1, `session_used = ${fila?.session_used}`);

  const segunda = await puerta();
  const fila2 = Array.isArray(segunda.cuerpo) ? segunda.cuerpo[0] : segunda.cuerpo;
  comprobar("la segunda también, que el tope de sesión es 2", fila2?.allowed === true);

  const tercera = await puerta();
  const fila3 = Array.isArray(tercera.cuerpo) ? tercera.cuerpo[0] : tercera.cuerpo;
  comprobar("la tercera se corta", fila3?.allowed === false);
  comprobar(
    "y dice por qué, para poder darle un mensaje distinto a cada caso",
    fila3?.reason === "limite_sesion",
    `reason = ${fila3?.reason}`
  );

  comprobar(
    "un intento rechazado TAMBIÉN cuenta, y por eso el contador se pasa del tope",
    fila3?.session_used === 3,
    `session_used = ${fila3?.session_used}`
  );
  // No es un descuido: `ai_quota_consume` incrementa y después mira si se ha
  // pasado, en una sola sentencia atómica. Comprobar antes de incrementar
  // abriría una carrera entre dos peticiones simultáneas, que es justo lo que
  // no puede pasar cuando cada una cuesta dinero. El tope nunca se supera; lo
  // único que se infla es el número que se enseña.

  console.log("\n3. Si la generación falla, el cupo se devuelve\n");

  // Con una sesión nueva, que es como ocurre de verdad: la devolución va
  // inmediatamente después de una puerta que SÍ dejó pasar, no después de
  // varios rechazos.
  const sesionLimpia = `${marca}:sesion-limpia`;
  const conSesionLimpia = (extra = {}) =>
    rpc(url, secreta, "ai_quota_gate", {
      p_session_key: sesionLimpia,
      p_ip_key: `${marca}:cliente-limpio`,
      p_day_key: `${marca}:tienda-limpia`,
      ...limites,
      ...extra,
    });

  await conSesionLimpia(); // usa 1 de 2, y "falla la generación"
  await rpc(url, secreta, "ai_quota_refund", { p_key: sesionLimpia });
  const despues = await conSesionLimpia();
  const fila4 = Array.isArray(despues.cuerpo) ? despues.cuerpo[0] : despues.cuerpo;
  comprobar(
    "tras devolver el cupo, la clienta no pierde la generación que no ha tenido",
    fila4?.allowed === true && fila4?.session_used === 1,
    `ha devuelto ${JSON.stringify(despues.cuerpo)?.slice(0, 200)}`
  );

  console.log("\n4. El tope de la tienda manda sobre todo lo demás\n");

  const tope = await rpc(url, secreta, "ai_quota_gate", {
    p_session_key: `${marca}:s2`,
    p_ip_key: `${marca}:c2`,
    p_day_key: tienda,
    p_session_limit: 2,
    p_ip_limit: 6,
    // El de la tienda ya se ha consumido tres veces arriba.
    p_day_limit: 1,
  });
  const fila5 = Array.isArray(tope.cuerpo) ? tope.cuerpo[0] : tope.cuerpo;
  comprobar(
    "con el tope de tienda agotado no se genera, aunque la sesión esté limpia",
    fila5?.allowed === false && fila5?.reason === "limite_tienda",
    `ha devuelto ${JSON.stringify(tope.cuerpo)?.slice(0, 200)}`
  );

  console.log("\n5. La sesión recuerda la interacción, que es lo que permite EDITAR\n");

  const hash = crypto.createHash("sha256").update(marca).digest("hex");
  await rpc(url, secreta, "ai_session_remember", {
    p_token_hash: hash,
    p_interaction_id: "interactions/prueba",
  });
  const recordada = await rpc(url, secreta, "ai_session_previous", { p_token_hash: hash });
  comprobar(
    "se guarda y se recupera el identificador de la interacción",
    recordada.cuerpo === "interactions/prueba",
    `ha devuelto ${JSON.stringify(recordada.cuerpo)}`
  );

  // ----------------------------------------------------------------- limpieza
  const borrar = async (tabla, filtro) =>
    fetch(`${url}/rest/v1/${tabla}?${filtro}`, {
      method: "DELETE",
      headers: { apikey: secreta, Authorization: `Bearer ${secreta}` },
    });
  await borrar("ai_image_quota", `quota_key=like.${encodeURIComponent(`${marca}%`)}`);
  await borrar("ai_image_sessions", `token_hash=eq.${hash}`);
  console.log("\n  (filas de prueba borradas)");

  console.log(
    fallos === 0
      ? "\nTodo correcto: los topes funcionan y la clave pública no llega a ellos.\n"
      : `\n${fallos} comprobaciones han fallado.\n`
  );
  process.exitCode = fallos === 0 ? 0 : 1;
}

main();
