/**
 * Autenticación del panel de administración.
 *
 * ⚠️ LIMITACIÓN DE LA POC — LEER ANTES DE PRODUCCIÓN:
 * No existe backend, por lo que esta autenticación se ejecuta íntegramente
 * en el navegador y NO es segura: cualquier persona con conocimientos
 * técnicos puede saltarla inspeccionando el código. Sirve para modelar el
 * flujo (login, sesión, rutas protegidas, multiusuario) y para uso interno
 * de demostración. Para producción es imprescindible mover la verificación
 * a un servidor o proveedor de identidad (ver docs/architecture.md).
 *
 * Las contraseñas NO se guardan en texto plano: se compara el hash SHA-256.
 * Credenciales de desarrollo en docs/setup.md.
 */

interface AdminUser {
  username: string;
  displayName: string;
  /** SHA-256 (hex) de la contraseña de desarrollo. */
  passwordSha256: string;
}

/**
 * Tres cuentas: las dos propietarias de Dulce Flor y Albert (administración
 * técnica). Credenciales de desarrollo en docs/setup.md.
 */
const ADMIN_USERS: AdminUser[] = [
  {
    username: "dulceflor1",
    displayName: "Propietaria 1",
    passwordSha256: "4a2ff0bf1a00f7b8fca0d02165cb49ab0cdea7ca7a7d02a73ff7dc0290a18eba",
  },
  {
    username: "dulceflor2",
    displayName: "Propietaria 2",
    passwordSha256: "1605e4f4eb2ebe3db2dc0f15dab680ee5598d5f1dcec2ae45913065d2becff2e",
  },
  {
    username: "albert",
    displayName: "Albert (AstroLanding)",
    passwordSha256: "37d9e31630f9a63f65d481b31776c1dc46edad634b029ef8ce4615f1da154332",
  },
];

const SESSION_KEY = "dulce-flor:admin-session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

export interface AdminSession {
  username: string;
  displayName: string;
  expiresAt: number;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function login(
  username: string,
  password: string
): Promise<{ ok: true; session: AdminSession } | { ok: false; error: string }> {
  const user = ADMIN_USERS.find((u) => u.username === username.trim().toLowerCase());
  const hash = await sha256Hex(password);
  if (!user || user.passwordSha256 !== hash) {
    return { ok: false, error: "Usuario o contraseña incorrectos" };
  }
  const session: AdminSession = {
    username: user.username,
    displayName: user.displayName,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, session };
}

export function getSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (!session.expiresAt || session.expiresAt < Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Reverifica la contraseña de un usuario ya autenticado, sin tocar la sesión.
 * Se usa para acciones protegidas como salir del modo kiosk.
 */
export async function verifyPassword(username: string, password: string): Promise<boolean> {
  const user = ADMIN_USERS.find((u) => u.username === username.trim().toLowerCase());
  if (!user) return false;
  return user.passwordSha256 === (await sha256Hex(password));
}

/* ------------------------------------------------------------------ */
/* Modo kiosk bloqueado                                                */
/*                                                                     */
/* Mientras el candado está activo, la tablet del kiosk queda de cara  */
/* al público: el resto de la zona de administración rebota al kiosk   */
/* (ver AdminLayout / AdminLoginPage) y salir exige la contraseña.     */
/* ------------------------------------------------------------------ */

const KIOSK_LOCK_KEY = "dulce-flor:kiosk-lock";

export function lockKiosk(): void {
  sessionStorage.setItem(KIOSK_LOCK_KEY, "1");
}

export function unlockKiosk(): void {
  sessionStorage.removeItem(KIOSK_LOCK_KEY);
}

export function isKioskLocked(): boolean {
  return sessionStorage.getItem(KIOSK_LOCK_KEY) === "1";
}
