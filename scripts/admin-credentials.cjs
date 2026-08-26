/**
 * Genera las credenciales del panel de administración.
 *
 * Imprime por pantalla dos cosas:
 *   1. Las contraseñas en claro, para entregárselas a cada persona por un
 *      canal privado. Se muestran UNA VEZ y no se guardan en ningún sitio.
 *   2. El valor de VITE_ADMIN_ACCOUNTS, que se pega en las variables de
 *      entorno de Vercel (y en un .env local, que está en .gitignore).
 *
 * Este script NO escribe ficheros a propósito: así no hay forma de que una
 * contraseña acabe commiteada por descuido.
 *
 * Uso:
 *   node scripts/admin-credentials.cjs                      (contraseñas nuevas)
 *   node scripts/admin-credentials.cjs --keep-passwords     (pide las actuales)
 *
 * Debe generar exactamente lo mismo que la derivación del navegador
 * (src/services/auth.ts): PBKDF2-SHA256, 210.000 iteraciones, 32 bytes.
 */
const crypto = require("crypto");
const readline = require("readline");

const PBKDF2_ITERATIONS = 210_000;
const DERIVED_KEY_BYTES = 32;
const SALT_BYTES = 16;

/** Las tres cuentas del panel. Cambiar aquí si entra o sale alguien. */
const ACCOUNTS = [
  { username: "dulceflor1", displayName: "Propietaria 1" },
  { username: "dulceflor2", displayName: "Propietaria 2" },
  { username: "albert", displayName: "Albert (AstroLanding)" },
];

/**
 * Alfabeto sin parejas que se confundan al dictar la contraseña por teléfono
 * o al copiarla a mano: fuera O/0, l/1 y la I mayúscula.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/**
 * Longitud pedida por Dulce Flor (26/08/2026): 10 caracteres, para poder
 * teclearla rápido en la tablet del mostrador.
 *
 * 10 caracteres de este alfabeto son 56^10, unos 58 bits. Combinado con las
 * 210.000 iteraciones de PBKDF2, probarlas todas lleva siglos incluso con
 * GPUs dedicadas, así que sigue siendo seguro. Lo que NO sería seguro es
 * bajar de aquí o usar palabras reconocibles.
 */
const PASSWORD_LENGTH = 10;

function generatePassword() {
  let password = "";
  for (let i = 0; i < PASSWORD_LENGTH; i += 1) {
    password += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return password;
}

function derive(password, saltHex) {
  return crypto
    .pbkdf2Sync(
      Buffer.from(password, "utf8"),
      Buffer.from(saltHex, "hex"),
      PBKDF2_ITERATIONS,
      DERIVED_KEY_BYTES,
      "sha256"
    )
    .toString("hex");
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

(async () => {
  const keepPasswords = process.argv.includes("--keep-passwords");
  const rows = [];

  for (const account of ACCOUNTS) {
    const password = keepPasswords
      ? await ask(`Contraseña actual de ${account.username}: `)
      : generatePassword();

    if (!password) {
      console.error(`\nSin contraseña para ${account.username}. Abortado.`);
      process.exit(1);
    }
    if (/[:;]/.test(password)) {
      console.error(
        `\nLa contraseña de ${account.username} lleva ":" o ";", que son los separadores del formato. Usa otra.`
      );
      process.exit(1);
    }

    const saltHex = crypto.randomBytes(SALT_BYTES).toString("hex");
    rows.push({
      ...account,
      password,
      entry: `${account.username}:${account.displayName}:${saltHex}:${derive(password, saltHex)}`,
    });
  }

  console.log("\n=== CONTRASEÑAS (entrégalas por un canal privado y no las guardes aquí) ===\n");
  for (const row of rows) {
    console.log(`  ${row.username.padEnd(12)} ${row.displayName.padEnd(24)} ${row.password}`);
  }

  console.log("\n=== VITE_ADMIN_ACCOUNTS (pegar en Vercel y en el .env local) ===\n");
  console.log(rows.map((row) => row.entry).join(";"));
  console.log(
    "\nEn Vercel: Settings > Environment Variables > Add > VITE_ADMIN_ACCOUNTS,\n" +
      "marcando Production, Preview y Development. Después, redeploy.\n"
  );
})();
