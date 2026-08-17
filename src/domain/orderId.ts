/** Identificadores de pedido: UUID interno + ID público legible DF-AAAA-NNNN. */

export function formatPublicOrderId(year: number, sequence: number): string {
  return `DF-${year}-${String(sequence).padStart(4, "0")}`;
}

export function newInternalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback muy improbable (navegadores sin Web Crypto).
  return `id-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
