/**
 * Genera el juego completo de iconos de la web a partir del logo original.
 *
 * Ejecutar tras cambiar el logo:  node scripts/generate-icons.cjs
 *
 * El logo es una insignia circular sobre fondo claro: se recorta cuadrado y se
 * asienta sobre el crema de marca para que no aparezcan bordes blancos en el
 * icono de la pestaña ni en la pantalla de inicio del móvil.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src", "assets", "logo-dulce-flor.jpeg");
const OUT = path.join(__dirname, "..", "public");
/** Crema de marca (--background) para rellenar el cuadrado. */
const BG = { r: 253, g: 247, b: 240, alpha: 1 };

function square(size) {
  return sharp(SRC)
    .resize(size, size, { fit: "cover", position: "centre" })
    .flatten({ background: BG });
}

/** ICO moderno: cabecera + entradas de directorio + PNG incrustados. */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reservado
  header.writeUInt16LE(1, 2); // tipo icono
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // paleta
    entry.writeUInt8(0, 3); // reservado
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por píxel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // PNG sueltos para navegadores modernos, Android y iOS.
  const pngs = [
    ["favicon-16x16.png", 16],
    ["favicon-32x32.png", 32],
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
  ];
  for (const [name, size] of pngs) {
    await square(size).png().toFile(path.join(OUT, name));
    console.log(name, size + "x" + size);
  }

  // favicon.ico con 16/32/48 para compatibilidad y para /favicon.ico directo.
  const icoImages = [];
  for (const size of [16, 32, 48]) {
    icoImages.push({ size, data: await square(size).png().toBuffer() });
  }
  fs.writeFileSync(path.join(OUT, "favicon.ico"), buildIco(icoImages));
  console.log("favicon.ico (16/32/48)");
})();
