/**
 * Prepara las fotos que anclan el ESTILO del generador de imágenes.
 *
 *   node scripts/referencias-ia.cjs
 *
 * Por qué existe. El riesgo número uno de esta funcionalidad no es técnico:
 * es que la IA genere tartas preciosas de estilo americano que Dulce Flor no
 * sabe ni puede hacer, y que eso acabe en una reclamación. La forma barata y
 * eficaz de evitarlo es enseñarle en cada petición tres fotos REALES de
 * tartas suyas de la misma familia, y pedirle que se mantenga en ese estilo.
 *
 * Las fotos ya están en el repositorio, pero en WebP y a 1000 px: se copian a
 * `public/referencias-ia/` en JPEG y a 640 px porque (a) la documentación del
 * proveedor no confirma que acepte WebP de entrada, (b) 640 px sobra para dar
 * estilo y (c) `public/` se sirve con ruta estable, sin el hash que Vite le
 * pone a lo que pasa por el bundle, así que la función serverless puede
 * pedirlas por URL sin engordar su propio paquete.
 *
 * El resultado se commitea: son cuatro ficheros pequeños derivados de otros
 * que ya están en el repositorio, y así el despliegue no depende de que nadie
 * se acuerde de ejecutar este script.
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const RAIZ = path.join(__dirname, "..");
const ORIGEN = path.join(RAIZ, "src", "assets", "fotos");
const DESTINO = path.join(RAIZ, "public", "referencias-ia");

/**
 * Qué foto representa cada acabado. Elegidas a mano mirándolas una a una: son
 * las que mejor muestran el acabado sin distraer con decoración muy concreta.
 */
const FAMILIAS = {
  nata: [
    "tartas/tarta-clasica-nata-drip-chocolate.webp",
    "tartas/tarta-clasica-chocolate-trufa-drip.webp",
    "tartas/tarta-clasica-chocolate-crema-cafe.webp",
  ],
  buttercream: [
    "tartas-personalizadas/tarta-buttercream-rosetones-lila.webp",
    "tartas-personalizadas/tarta-corazon-rosetones-rojos.webp",
    "tartas/tarta-clasica-lotus-buttercream.webp",
  ],
  fondant: [
    "tartas-fondant/tarta-fondant-cuadrada-rosas-modeladas.webp",
    "tartas-fondant/tarta-fondant-infantil-muneca-rosa.webp",
    "tartas-fondant/tarta-fondant-cars-dos-pisos.webp",
  ],
};

const LADO_MAYOR = 640;
const CALIDAD = 78;

async function main() {
  fs.mkdirSync(DESTINO, { recursive: true });
  let total = 0;

  for (const [familia, fotos] of Object.entries(FAMILIAS)) {
    for (const [indice, relativa] of fotos.entries()) {
      const entrada = path.join(ORIGEN, relativa);
      if (!fs.existsSync(entrada)) {
        console.error(`✗ falta la foto ${relativa}`);
        process.exitCode = 1;
        continue;
      }
      const salida = path.join(DESTINO, `${familia}-${indice + 1}.jpg`);
      await sharp(entrada)
        .resize({ width: LADO_MAYOR, height: LADO_MAYOR, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: CALIDAD, mozjpeg: true })
        .toFile(salida);
      const kb = Math.round(fs.statSync(salida).size / 1024);
      console.log(`  ✓ ${path.basename(salida)} (${kb} KB)`);
      total += 1;
    }
  }

  console.log(`\n${total} referencias en public/referencias-ia/`);
}

void main();
