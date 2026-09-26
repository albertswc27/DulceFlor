/** Identificadores de pedido: UUID interno + ID público legible DF-AAAA-NNNN. */

/**
 * ID público legible, único en todas partes sin necesidad de coordinarse.
 *
 * Antes era un contador guardado en el navegador. Con varios dispositivos
 * creando pedidos a la vez (el móvil de cada cliente y la tablet de la
 * tienda), ese contador repetía número: dos pedidos distintos podían salir
 * los dos como DF-2026-0001. El sufijo aleatorio lo evita, se genera sin
 * conexión, y el cliente y la tienda ven SIEMPRE el mismo identificador.
 *
 * Cinco caracteres en base 36 dan 60.466.176 combinaciones. Con cuatro se
 * quedaba corto: a un par de miles de pedidos al año, la paradoja del
 * cumpleaños daba ya una colisión anual (medido: 125 repetidos en 20.000
 * identificadores). Con cinco, ese riesgo baja a algo así como una vez cada
 * varias décadas, y la base de datos lleva además una restricción de unicidad
 * como red de seguridad.
 */
const PUBLIC_ID_LENGTH = 5;
const PUBLIC_ID_SPACE = 36 ** PUBLIC_ID_LENGTH;

export function newPublicOrderId(year: number): string {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  const value =
    (bytes[0] * 2 ** 24 + bytes[1] * 2 ** 16 + bytes[2] * 2 ** 8 + bytes[3]) %
    PUBLIC_ID_SPACE;
  return `DF-${year}-${value.toString(36).toUpperCase().padStart(PUBLIC_ID_LENGTH, "0")}`;
}

export function newInternalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback muy improbable (navegadores sin Web Crypto).
  return `id-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Token secreto del pedido: lo que va en el enlace del SMS
 * (`/pedido/estado/<token>`) y lo único que hace falta para ver la ficha.
 *
 * Como sustituye a una contraseña, se genera con el generador criptográfico
 * del navegador y NO con Math.random. 22 caracteres sobre un alfabeto de 28
 * son unos 105 bits de entropía: adivinar uno exigiría del orden de 10^31
 * intentos, y cada intento es una petición al servidor. La longitud está
 * ajustada además al presupuesto del SMS, donde el enlace es lo que más ocupa
 * (ver buildOrderStatusSms en domain/sms.ts).
 *
 * Alfabeto sin vocales ni parejas confundibles (0/O, 1/l/I): así el enlace no
 * compone palabras por accidente y se puede dictar por teléfono si hace falta.
 */
const TOKEN_ALPHABET = "23456789bcdfghjkmnpqrstvwxyz";
const TOKEN_LENGTH = 22;

export function newOrderToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    // Sin Web Crypto no hay token seguro: es preferible no generar uno que
    // dar por bueno un enlace adivinable.
    throw new Error("Este navegador no puede generar un enlace seguro de pedido.");
  }
  let out = "";
  for (const byte of bytes) out += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  return out;
}

/** ¿Tiene forma de token? Filtra basura antes de consultar a la base de datos. */
export function isOrderToken(value: string | undefined): boolean {
  return typeof value === "string" && new RegExp(`^[${TOKEN_ALPHABET}]{${TOKEN_LENGTH}}$`).test(value);
}
