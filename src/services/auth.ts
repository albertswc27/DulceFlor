/**
 * Autenticación del panel de administración.
 *
 * Hay DOS modos, y el que manda depende de si hay base de datos configurada:
 *
 * A) **Con Supabase** (producción): la contraseña la comprueba el servidor.
 *    Es autenticación de verdad, y además es imprescindible: las políticas de
 *    la base de datos solo dejan LEER pedidos a una sesión iniciada, así que
 *    sin este login el panel no vería nada. Saltarse el formulario editando
 *    el JavaScript no sirve de nada: el servidor seguiría diciendo que no.
 *
 * B) **Sin Supabase** (desarrollo, o despliegue sin base de datos): se cae al
 *    modo local descrito abajo, que sí es saltable y solo sirve para proteger
 *    la tablet del kiosk frente a un cliente curioso.
 *
 * ⚠️ LIMITACIÓN DEL MODO LOCAL:
 * Se ejecuta íntegramente en el navegador. Sirve para modelar el flujo (login, sesión, rutas
 * protegidas, multiusuario) y para proteger la tablet del kiosk frente a un
 * cliente curioso. NO sustituye a una autenticación de servidor: alguien con
 * conocimientos técnicos puede saltársela editando el código que se ejecuta
 * en su propio navegador.
 *
 * Lo que sí está resuelto, y es lo que de verdad importa aquí:
 *
 * 1. Las credenciales NO viven en el repositorio. Salen de una variable de
 *    entorno (VITE_ADMIN_ACCOUNTS) que se configura en Vercel y nunca se
 *    commitea. Ver docs/setup.md.
 * 2. No se guarda la contraseña ni un hash rápido, sino una derivación
 *    PBKDF2-SHA256 con sal propia por cuenta y 210.000 iteraciones. Aunque
 *    alguien extraiga el valor del bundle, no puede volver atrás por
 *    diccionario en un tiempo razonable.
 * 3. La comparación es de tiempo constante.
 * 4. Los intentos fallidos se penalizan con un bloqueo creciente, para que
 *    nadie pueda ir probando contraseñas en la tablet del mostrador.
 *
 * Los pedidos viven en el localStorage de cada dispositivo, no en un
 * servidor: quien abra el panel desde su propio equipo no ve ningún dato de
 * Dulce Flor. Por eso el riesgo real está en los dispositivos de la tienda,
 * que es justo lo que cubren el bloqueo de kiosk y el límite de intentos.
 */

import { getSupabase, isSupabaseConfigured } from "./supabase";

/**
 * Las cuentas del panel se crean en Supabase con un correo derivado del
 * usuario, para que el equipo siga escribiendo "dulceflor1" y no un email.
 * Si alguien escribe un correo completo, se usa tal cual.
 */
const ADMIN_EMAIL_DOMAIN =
  (import.meta.env.VITE_ADMIN_EMAIL_DOMAIN as string | undefined)?.trim() ||
  "dulceflorbcn.es";

function toEmail(username: string): string {
  const clean = username.trim().toLowerCase();
  return clean.includes("@") ? clean : `${clean}@${ADMIN_EMAIL_DOMAIN}`;
}

/** true cuando la contraseña la comprueba el servidor y no el navegador. */
export function isRemoteAuth(): boolean {
  return isSupabaseConfigured();
}

/** Coste de la derivación. Subirlo encarece un ataque por fuerza bruta. */
const PBKDF2_ITERATIONS = 210_000;
const DERIVED_KEY_BITS = 256;

interface AdminUser {
  username: string;
  displayName: string;
  /** Sal aleatoria propia de esta cuenta, en hexadecimal. */
  saltHex: string;
  /** PBKDF2-SHA256(contraseña, sal) en hexadecimal. */
  derivedKeyHex: string;
}

/* ------------------------------------------------------------------ */
/* Cuentas                                                             */
/* ------------------------------------------------------------------ */

/**
 * Formato de VITE_ADMIN_ACCOUNTS: cuentas separadas por `;`, y dentro de
 * cada una `usuario:Nombre visible:sal:clave`. Lo genera
 * `node scripts/admin-credentials.cjs`, que nunca escribe nada en el disco
 * del repositorio.
 *
 * Se descarta en silencio cualquier entrada malformada en lugar de dejar una
 * cuenta a medias: es preferible quedarse sin acceso y revisar la
 * configuración que crear una cuenta con datos incompletos.
 */
function parseAccounts(raw: string | undefined): AdminUser[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(":"))
    .filter(
      (parts): parts is [string, string, string, string] =>
        parts.length === 4 && parts.every((part) => part.trim().length > 0)
    )
    .map(([username, displayName, saltHex, derivedKeyHex]) => ({
      username: username.trim().toLowerCase(),
      displayName: displayName.trim(),
      saltHex: saltHex.trim(),
      derivedKeyHex: derivedKeyHex.trim(),
    }));
}

const CONFIGURED_USERS = parseAccounts(
  import.meta.env.VITE_ADMIN_ACCOUNTS as string | undefined
);

/**
 * Sal de relleno para derivar cuando el usuario no existe. NO es una cuenta:
 * no tiene clave asociada, solo sirve para gastar el mismo tiempo de CPU.
 */
const DECOY_SALT_HEX = "00112233445566778899aabbccddeeff";

/**
 * Cuentas activas. En desarrollo sin configurar queda una cuenta obvia
 * (`dev` / `dev`) para poder entrar.
 *
 * La cuenta va escrita DENTRO del `if`, no en una constante de módulo: así
 * Vite sustituye `import.meta.env.DEV` por `false` al compilar y el bloque
 * entero desaparece del bundle de producción. Sacarla fuera la dejaría
 * viajando a la web publicada aunque nunca se usara.
 */
function getUsers(): AdminUser[] {
  if (CONFIGURED_USERS.length > 0) return CONFIGURED_USERS;
  if (import.meta.env.DEV) {
    return [
      {
        username: "dev",
        displayName: "Desarrollo",
        saltHex: "6465762d6f6e6c792d73616c742d3031",
        derivedKeyHex:
          "91109e0c8c322954291fb0107d1027abf9e8f847f4ca280a39ed365df321cae7",
      },
    ];
  }
  return [];
}

/**
 * true cuando el panel está desplegado sin ninguna forma de entrar. Con
 * Supabase las cuentas viven en el servidor, así que nunca falta nada aquí.
 */
export function isAuthUnconfigured(): boolean {
  return !isSupabaseConfigured() && getUsers().length === 0;
}

/* ------------------------------------------------------------------ */
/* Derivación y comparación                                            */
/* ------------------------------------------------------------------ */

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(Math.floor(hex.length / 2)));
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function derive(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    DERIVED_KEY_BITS
  );
  return bytesToHex(new Uint8Array(bits));
}

/**
 * Comparación de tiempo constante: sale siempre por el mismo camino, para no
 * filtrar cuántos caracteres coinciden a través del tiempo de respuesta.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Comprueba una contraseña contra las cuentas configuradas. Cuando el usuario
 * no existe se deriva igualmente contra la sal del señuelo, para que probar
 * un usuario inexistente cueste lo mismo que uno real y no se pueda deducir
 * qué usuarios hay.
 */
async function checkCredentials(
  username: string,
  password: string
): Promise<AdminUser | null> {
  const users = getUsers();
  const normalized = username.trim().toLowerCase();
  const user = users.find((candidate) => candidate.username === normalized);
  const saltHex = user?.saltHex ?? users[0]?.saltHex ?? DECOY_SALT_HEX;
  const derived = await derive(password, saltHex);
  if (!user) return null;
  return timingSafeEqual(derived, user.derivedKeyHex) ? user : null;
}

/* ------------------------------------------------------------------ */
/* Límite de intentos                                                  */
/* ------------------------------------------------------------------ */

const THROTTLE_KEY = "dulce-flor:admin-throttle";
/** Intentos permitidos antes de empezar a bloquear. */
const FREE_ATTEMPTS = 5;
/** Espera base, que se dobla con cada fallo posterior hasta el tope. */
const BASE_LOCKOUT_MS = 30 * 1000;
const MAX_LOCKOUT_MS = 15 * 60 * 1000;

interface ThrottleState {
  failures: number;
  blockedUntil: number;
}

function readThrottle(): ThrottleState {
  try {
    const raw = localStorage.getItem(THROTTLE_KEY);
    if (!raw) return { failures: 0, blockedUntil: 0 };
    const parsed = JSON.parse(raw) as Partial<ThrottleState>;
    return {
      failures: Math.max(0, Math.floor(parsed.failures ?? 0)),
      blockedUntil: Math.max(0, Math.floor(parsed.blockedUntil ?? 0)),
    };
  } catch {
    return { failures: 0, blockedUntil: 0 };
  }
}

function writeThrottle(state: ThrottleState): void {
  try {
    localStorage.setItem(THROTTLE_KEY, JSON.stringify(state));
  } catch {
    // Modo privado o almacenamiento lleno: sin persistencia no hay bloqueo,
    // pero tampoco tiene sentido impedir el acceso por ello.
  }
}

/** Milisegundos que faltan para poder volver a intentarlo. 0 si no hay bloqueo. */
export function getLockoutRemainingMs(): number {
  return Math.max(0, readThrottle().blockedUntil - Date.now());
}

function registerFailure(): void {
  const { failures } = readThrottle();
  const next = failures + 1;
  if (next <= FREE_ATTEMPTS) {
    writeThrottle({ failures: next, blockedUntil: 0 });
    return;
  }
  const penalty = Math.min(
    MAX_LOCKOUT_MS,
    BASE_LOCKOUT_MS * 2 ** (next - FREE_ATTEMPTS - 1)
  );
  writeThrottle({ failures: next, blockedUntil: Date.now() + penalty });
}

function clearThrottle(): void {
  try {
    localStorage.removeItem(THROTTLE_KEY);
  } catch {
    // Ver writeThrottle.
  }
}

function formatWait(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

/* ------------------------------------------------------------------ */
/* Sesión                                                              */
/* ------------------------------------------------------------------ */

const SESSION_KEY = "dulce-flor:admin-session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

export interface AdminSession {
  username: string;
  displayName: string;
  expiresAt: number;
}

export async function login(
  username: string,
  password: string
): Promise<{ ok: true; session: AdminSession } | { ok: false; error: string }> {
  const waitMs = getLockoutRemainingMs();
  if (waitMs > 0) {
    return {
      ok: false,
      error: `Demasiados intentos fallidos. Prueba de nuevo en ${formatWait(waitMs)}.`,
    };
  }

  // Con base de datos, manda el servidor. La sesión de Supabase es la que
  // permite leer pedidos, así que sin ella el panel estaría vacío.
  const supabase = await getSupabase();
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password,
    });
    if (error || !data.user) {
      registerFailure();
      const nextWait = getLockoutRemainingMs();
      return {
        ok: false,
        error: nextWait
          ? `Usuario o contraseña incorrectos. Espera ${formatWait(nextWait)} antes de reintentar.`
          : "Usuario o contraseña incorrectos",
      };
    }
    clearThrottle();
    const session: AdminSession = {
      username: username.trim().toLowerCase(),
      displayName:
        (data.user.user_metadata?.display_name as string | undefined) ??
        username.trim().toLowerCase(),
      expiresAt: (data.session?.expires_at ?? 0) * 1000 || Date.now() + SESSION_TTL_MS,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session };
  }

  if (isAuthUnconfigured()) {
    return {
      ok: false,
      error:
        "El panel no tiene cuentas configuradas. Define VITE_ADMIN_ACCOUNTS en el entorno.",
    };
  }

  const user = await checkCredentials(username, password);
  if (!user) {
    registerFailure();
    const nextWait = getLockoutRemainingMs();
    return {
      ok: false,
      error: nextWait
        ? `Usuario o contraseña incorrectos. Espera ${formatWait(nextWait)} antes de reintentar.`
        : "Usuario o contraseña incorrectos",
    };
  }

  clearThrottle();
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
  // No se espera: cerrar sesión en la interfaz debe ser inmediato aunque la
  // red vaya lenta. El espejo local ya está borrado.
  void getSupabase().then((client) => client?.auth.signOut());
}

/**
 * Comprueba que la sesión del servidor sigue viva y borra el espejo local si
 * no lo está. Sin esto, la interfaz podría creerse dentro mientras la base de
 * datos rechaza todas las lecturas.
 */
export async function revalidateSession(): Promise<AdminSession | null> {
  const local = getSession();
  if (!local || !isSupabaseConfigured()) return local;
  const supabase = await getSupabase();
  if (!supabase) return local;
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
  return local;
}

/**
 * Reverifica la contraseña de un usuario ya autenticado, sin tocar la sesión.
 * Se usa para acciones protegidas como salir del modo kiosk, que es
 * precisamente donde alguien intentaría probar contraseñas: por eso cuenta
 * para el mismo límite de intentos que el login.
 */
export async function verifyPassword(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const waitMs = getLockoutRemainingMs();
  if (waitMs > 0) {
    return {
      ok: false,
      error: `Demasiados intentos fallidos. Prueba de nuevo en ${formatWait(waitMs)}.`,
    };
  }

  // Reverificar contra el servidor: si no hay conexión NO se desbloquea, que
  // es lo correcto — es preferible que el kiosk siga cerrado a abrirlo sin
  // haber comprobado nada.
  const supabase = await getSupabase();
  const ok = supabase
    ? !(await supabase.auth.signInWithPassword({ email: toEmail(username), password })).error
    : Boolean(await checkCredentials(username, password));

  if (!ok) {
    registerFailure();
    const nextWait = getLockoutRemainingMs();
    return {
      ok: false,
      error: nextWait
        ? `Contraseña incorrecta. Espera ${formatWait(nextWait)} antes de reintentar.`
        : "Contraseña incorrecta.",
    };
  }

  clearThrottle();
  return { ok: true };
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

/** Solo para pruebas: deja el contador de intentos como recién estrenado. */
export function __resetThrottleForTests(): void {
  clearThrottle();
}
