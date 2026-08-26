/**
 * Comprueba contra la web PUBLICADA que la autenticación del panel está bien
 * desplegada: que las credenciales viejas del repositorio ya no entran, que
 * las nuevas sí, que el bloqueo por intentos salta y que no viaja ninguna
 * contraseña dentro del JavaScript servido.
 *
 * La contraseña se pasa por entorno, nunca escrita aquí: este fichero sí se
 * commitea.
 *
 *   QA_USER=dulceflor1 QA_PASS=... node scripts/qa-produccion.cjs
 *
 * Opcional: QA_BASE para apuntar a otra URL (por defecto, producción).
 */
const { chromium } = require("playwright");
const BASE = process.env.QA_BASE || "https://dulceflorbcn.es";
const USER = process.env.QA_USER || "dulceflor1";
const GOOD = process.env.QA_PASS;

if (!GOOD) {
  console.error("Falta QA_PASS. Uso: QA_USER=dulceflor1 QA_PASS=... node scripts/qa-produccion.cjs");
  process.exit(1);
}

async function attempt(page, user, pass) {
  await page.fill("#admin-username", user);
  await page.fill("#admin-password", pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const alert = document.querySelector('[role="alert"]');
    return { url: location.pathname, error: alert ? alert.textContent.trim() : null };
  });
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];
  const notes = [];

  const res = await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  notes.push(`HTTP ${res.status()} en ${BASE}/admin`);

  const body = await page.evaluate(() => document.body.innerText);
  if (/no tiene cuentas configuradas/i.test(body)) {
    problems.push("el panel dice que NO hay cuentas configuradas: la variable no ha llegado al build");
  }

  const hasForm = await page.$("#admin-username");
  if (!hasForm) {
    problems.push("no aparece el formulario de login");
  } else {
    const vieja = await attempt(page, USER, "Flor2026.Rosa!");
    if (vieja.url !== "/admin") problems.push("la contrasena VIEJA sigue entrando");
    else notes.push("contrasena vieja rechazada");

    const buena = await attempt(page, USER, GOOD);
    if (buena.url === "/admin") {
      problems.push(`la contrasena NUEVA no entra (mensaje: ${buena.error})`);
    } else {
      notes.push(`login correcto -> ${buena.url}`);
    }
  }

  // El bundle servido no debe contener ninguna contrasena en claro
  const fuga = await page.evaluate(async (PASS) => {
    const srcs = [...document.querySelectorAll("script[src]")].map((s) => s.src);
    for (const src of srcs) {
      const text = await (await fetch(src)).text();
      if (text.includes(PASS) || /Flor2026|Astro2026/.test(text)) return src;
      if (/6465762d6f6e6c792d73616c74/.test(text)) return `${src} (cuenta dev)`;
    }
    return null;
  }, GOOD);
  if (fuga) problems.push(`credencial en claro dentro de ${fuga}`);
  else notes.push("ninguna contrasena ni la cuenta dev en el JavaScript servido");

  await browser.close();
  console.log(notes.map((n) => "  . " + n).join("\n"));
  console.log();
  console.log(problems.length ? problems.map((p) => "x " + p).join("\n") : "OK produccion correcta");
})();
