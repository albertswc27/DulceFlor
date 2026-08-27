/** Utilidades monetarias. Todos los importes internos van en céntimos (enteros). */

const formatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export function formatEuros(cents: number): string {
  return formatter.format(cents / 100);
}

/** Redondeo al céntimo más cercano de un porcentaje sobre un importe. */
export function percentOf(cents: number, percentage: number): number {
  return Math.round((cents * percentage) / 100);
}

/**
 * Convierte un importe escrito a mano ("20", "20,50", "20.5") a céntimos.
 * Acepta coma o punto decimal. Devuelve null si no es un número válido y no
 * negativo, para que quien lo llame decida qué mensaje mostrar.
 */
export function parseEurosToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const euros = Number(normalized);
  if (!Number.isFinite(euros) || euros < 0) return null;
  return Math.round(euros * 100);
}
