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
