/**
 * Capturas de QA visual. Uso:
 *   npx vite --port 5300   (en otra terminal)
 *   node scripts/screenshots.cjs <carpetaDestino>
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.QA_BASE_URL || "http://localhost:5300";
const OUT = process.argv[2] || path.join(__dirname, "..", ".screenshots");

const VIEWPORTS = [
  { name: "movil", width: 390, height: 844 },
  { name: "escritorio", width: 1440, height: 900 },
];

/** Páginas públicas + recorrido del pedido. */
const PAGES = [
  { name: "home", path: "/" },
  { name: "carta", path: "/carta" },
  { name: "aviso-legal", path: "/aviso-legal" },
  { name: "404", path: "/pagina-que-no-existe" },
];

/**
 * Antes de capturar: recorre la página para que se disparen las apariciones y
 * la carga diferida de imágenes, y comprueba que no haya scroll horizontal.
 */
async function settle(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
  });
  // Espera a que las imágenes terminen de cargar, con tope de tiempo: una
  // imagen que nunca resuelve no puede bloquear la captura.
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const pending = Array.from(document.images).filter((img) => !img.complete);
        if (pending.length === 0) return resolve(undefined);
        let left = pending.length;
        const done = () => { if (--left <= 0) resolve(undefined); };
        pending.forEach((img) => { img.onload = img.onerror = done; });
        setTimeout(() => resolve(undefined), 4000);
      })
  );
  return page.evaluate(() => ({
    docWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    imagenesRotas: Array.from(document.images).filter(
      (i) => i.complete && i.naturalWidth === 0
    ).length,
  }));
}

async function shoot(page, file, fullPage = true) {
  const info = await settle(page);
  if (info.docWidth > info.viewport) {
    console.log(
      `  ⚠ SCROLL HORIZONTAL en ${path.basename(file)}: documento ${info.docWidth}px / viewport ${info.viewport}px`
    );
  }
  if (info.imagenesRotas > 0) {
    console.log(`  ⚠ ${info.imagenesRotas} imágenes rotas en ${path.basename(file)}`);
  }
  await page.screenshot({ path: file, fullPage });
  console.log("→", path.basename(file));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge" });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      locale: "es-ES",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

    for (const p of PAGES) {
      await page.goto(BASE + p.path, { waitUntil: "networkidle" });
      await shoot(page, path.join(OUT, `${vp.name}-${p.name}.png`));
    }

    // Recorrido del pedido: tipo de cliente → familias → configurador
    await page.goto(BASE + "/pedido", { waitUntil: "networkidle" });
    await shoot(page, path.join(OUT, `${vp.name}-pedido-1-tipo.png`));

    await page.getByRole("button", { name: /Particular/ }).first().click();
    await page.waitForTimeout(600);
    await shoot(page, path.join(OUT, `${vp.name}-pedido-2-tartas.png`));

    await page.getByRole("button", { name: "Aperitivos", exact: true }).click();
    await page.waitForTimeout(600);
    await shoot(page, path.join(OUT, `${vp.name}-pedido-3-aperitivos.png`));

    await page.getByRole("button", { name: /Desayunos y regalos/ }).click();
    await page.waitForTimeout(600);
    await shoot(page, path.join(OUT, `${vp.name}-pedido-4-regalos.png`));

    // Configurador de un aperitivo (tramos de cantidad)
    await page.getByRole("button", { name: "Aperitivos", exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Mini sándwich de huevo/ }).click();
    await page.waitForTimeout(600);
    await shoot(page, path.join(OUT, `${vp.name}-config-aperitivo.png`));

    // Configurador de tarta clásica (discos y referencias).
    // El wizard es estado interno: se vuelve con su botón, no con el historial.
    await page.getByRole("button", { name: "Volver" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Tartas", exact: true }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Tarta clásica Dulce Flor/ }).click();
    await page.waitForTimeout(800);
    await shoot(page, path.join(OUT, `${vp.name}-config-tarta.png`));

    if (errors.length) {
      fs.writeFileSync(
        path.join(OUT, `${vp.name}-errores-consola.txt`),
        errors.join("\n")
      );
      console.log(`⚠ ${vp.name}: ${errors.length} errores de consola`);
    } else {
      console.log(`✓ ${vp.name}: consola limpia`);
    }
    await context.close();
  }

  await browser.close();
  console.log("Capturas en:", OUT);
})();
