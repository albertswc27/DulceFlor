/**
 * La autenticación del panel es lo único que separa a un cliente curioso de
 * los pedidos guardados en la tablet, así que conviene fijar su
 * comportamiento: que la derivación coincida con la del script generador,
 * que no queden credenciales en el repositorio y que los intentos fallidos
 * se penalicen de verdad.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

const PBKDF2_ITERATIONS = 210_000;

/**
 * Los tests corren en Node, que no trae localStorage ni sessionStorage. Un
 * par de stubs en memoria evitan tener que instalar jsdom solo para esto.
 */
function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
  } as Storage;
}

vi.stubGlobal("localStorage", createStorage());
vi.stubGlobal("sessionStorage", createStorage());

/** Misma derivación que src/services/auth.ts, calculada con Node. */
function derive(password: string, saltHex: string): string {
  return pbkdf2Sync(
    Buffer.from(password, "utf8"),
    Buffer.from(saltHex, "hex"),
    PBKDF2_ITERATIONS,
    32,
    "sha256"
  ).toString("hex");
}

function buildAccounts(
  entries: Array<{ username: string; displayName: string; password: string }>
): string {
  return entries
    .map(({ username, displayName, password }) => {
      const saltHex = randomBytes(16).toString("hex");
      return `${username}:${displayName}:${saltHex}:${derive(password, saltHex)}`;
    })
    .join(";");
}

const CUENTAS = buildAccounts([
  { username: "dulceflor1", displayName: "Propietaria 1", password: "Kx7m-Qp42-Rt9v-Zb3n" },
  { username: "albert", displayName: "Albert", password: "Hn4t-Wy88-Cj2q-Ms7d" },
]);

async function loadAuth() {
  vi.resetModules();
  vi.stubEnv("VITE_ADMIN_ACCOUNTS", CUENTAS);
  // Estos tests cubren el modo LOCAL de autenticación. Si el entorno tiene
  // Supabase configurado (un .env con las variables de producción), el login
  // tiraría de la rama remota y probaría contra el servidor real. Se apaga
  // aquí para que la prueba sea del código local, no de la red.
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  return import("./auth");
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("credenciales fuera del repositorio", () => {
  it("el código no contiene ninguna contraseña ni derivación fija de producción", () => {
    const source = readFileSync("src/services/auth.ts", "utf8");
    // La única derivación admitida en el fichero es la de la cuenta de
    // desarrollo, y tiene que estar dentro del bloque import.meta.env.DEV
    // para que Vite la elimine del build de producción.
    const derivaciones = source.match(/"[0-9a-f]{64}"/g) ?? [];
    expect(derivaciones).toHaveLength(1);

    const bloqueDev = source.slice(source.indexOf("if (import.meta.env.DEV)"));
    expect(bloqueDev).toContain(derivaciones[0]);
  });

  it("la cuenta de desarrollo no llega al build de producción", () => {
    // Comprobación de contrato, no de compilación: si alguien saca la cuenta
    // a una constante de módulo, Vite deja de poder descartarla y viaja a la
    // web publicada aunque nunca se use.
    const source = readFileSync("src/services/auth.ts", "utf8");
    const posicionDev = source.indexOf('username: "dev"');
    const posicionGuarda = source.indexOf("if (import.meta.env.DEV)");
    expect(posicionGuarda).toBeGreaterThan(-1);
    expect(posicionDev).toBeGreaterThan(posicionGuarda);
  });

  it("la documentación ya no publica las contraseñas", () => {
    const setup = readFileSync("docs/setup.md", "utf8");
    expect(setup).not.toMatch(/Flor2026|Astro2026/);
  });

  it("sin cuentas configuradas nadie entra", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_ADMIN_ACCOUNTS", "");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const auth = await import("./auth");
    // En el build de desarrollo queda la cuenta `dev`; lo que no puede pasar
    // es que se acepte una credencial antigua del repositorio.
    const result = await auth.login("dulceflor1", "Flor2026.Rosa!");
    expect(result.ok).toBe(false);
  });
});

describe("login", () => {
  it("acepta la contraseña correcta y abre sesión", async () => {
    const auth = await loadAuth();
    const result = await auth.login("dulceflor1", "Kx7m-Qp42-Rt9v-Zb3n");
    expect(result.ok).toBe(true);
    expect(auth.getSession()?.displayName).toBe("Propietaria 1");
  });

  it("no distingue mayúsculas ni espacios en el usuario", async () => {
    const auth = await loadAuth();
    const result = await auth.login("  DulceFlor1 ", "Kx7m-Qp42-Rt9v-Zb3n");
    expect(result.ok).toBe(true);
  });

  it("rechaza la contraseña incorrecta sin abrir sesión", async () => {
    const auth = await loadAuth();
    const result = await auth.login("dulceflor1", "Kx7m-Qp42-Rt9v-Zb3m");
    expect(result.ok).toBe(false);
    expect(auth.getSession()).toBeNull();
  });

  it("no revela si el usuario existe", async () => {
    const auth = await loadAuth();
    const inexistente = await auth.login("noexiste", "loquesea");
    auth.__resetThrottleForTests();
    const existente = await auth.login("dulceflor1", "loquesea");
    expect(inexistente.ok).toBe(false);
    expect(existente.ok).toBe(false);
    expect(inexistente).toEqual(existente);
  });

  it("las credenciales viejas del repositorio ya no valen", async () => {
    const auth = await loadAuth();
    for (const [user, pass] of [
      ["dulceflor1", "Flor2026.Rosa!"],
      ["dulceflor2", "Flor2026.Crema!"],
      ["albert", "Astro2026.Admin!"],
    ]) {
      auth.__resetThrottleForTests();
      expect((await auth.login(user, pass)).ok).toBe(false);
    }
  });
});

describe("límite de intentos", () => {
  it("bloquea tras varios fallos seguidos", async () => {
    const auth = await loadAuth();
    for (let i = 0; i < 5; i += 1) {
      await auth.login("dulceflor1", "mal");
    }
    expect(auth.getLockoutRemainingMs()).toBe(0);

    const sexto = await auth.login("dulceflor1", "mal");
    expect(sexto.ok).toBe(false);
    expect(auth.getLockoutRemainingMs()).toBeGreaterThan(0);
  });

  it("estando bloqueado ni siquiera acepta la contraseña buena", async () => {
    const auth = await loadAuth();
    for (let i = 0; i < 6; i += 1) await auth.login("dulceflor1", "mal");

    const result = await auth.login("dulceflor1", "Kx7m-Qp42-Rt9v-Zb3n");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/intentos/i);
  });

  it("la espera crece con cada fallo adicional", async () => {
    const auth = await loadAuth();
    for (let i = 0; i < 6; i += 1) await auth.login("dulceflor1", "mal");
    const primera = auth.getLockoutRemainingMs();

    localStorage.setItem(
      "dulce-flor:admin-throttle",
      JSON.stringify({ failures: 6, blockedUntil: 0 })
    );
    await auth.login("dulceflor1", "mal");
    expect(auth.getLockoutRemainingMs()).toBeGreaterThan(primera);
  });

  it("un acierto limpia el contador", async () => {
    const auth = await loadAuth();
    for (let i = 0; i < 3; i += 1) await auth.login("dulceflor1", "mal");
    await auth.login("dulceflor1", "Kx7m-Qp42-Rt9v-Zb3n");

    for (let i = 0; i < 5; i += 1) await auth.login("dulceflor1", "mal");
    expect(auth.getLockoutRemainingMs()).toBe(0);
  });

  it("salir del kiosk cuenta para el mismo límite", async () => {
    const auth = await loadAuth();
    for (let i = 0; i < 6; i += 1) {
      await auth.verifyPassword("dulceflor1", "mal");
    }
    const result = await auth.verifyPassword("dulceflor1", "Kx7m-Qp42-Rt9v-Zb3n");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/intentos/i);
  });
});

describe("sesión", () => {
  it("caduca sola y no se puede prolongar tocando el reloj", async () => {
    const auth = await loadAuth();
    await auth.login("dulceflor1", "Kx7m-Qp42-Rt9v-Zb3n");
    expect(auth.getSession()).not.toBeNull();

    vi.setSystemTime(Date.now() + 9 * 60 * 60 * 1000);
    expect(auth.getSession()).toBeNull();
    vi.useRealTimers();
  });

  it("una sesión manipulada a mano se descarta", async () => {
    const auth = await loadAuth();
    sessionStorage.setItem(
      "dulce-flor:admin-session",
      JSON.stringify({ username: "intruso", displayName: "Intruso" })
    );
    expect(auth.getSession()).toBeNull();
  });
});
