/**
 * Resolución de zona de entrega por municipio y código postal.
 * Configuración de zonas en src/config/business.ts (PROVISIONAL).
 */
import { DELIVERY_ZONES, type DeliveryZone } from "@/config/business";

export interface ZoneResolution {
  zone: DeliveryZone | null;
  /** null cuando la zona no está cubierta → "Consultar disponibilidad de entrega". */
  feeCents: number | null;
  needsConsultation: boolean;
}

/** Normaliza nombres de municipio: minúsculas, sin acentos, espacios colapsados. */
export function normalizeMunicipality(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function postalCodeInRange(postalCode: string, [from, to]: [string, string]): boolean {
  const cp = postalCode.trim();
  if (!/^\d{5}$/.test(cp)) return false;
  return cp >= from && cp <= to;
}

/**
 * Determina la zona a partir de municipio y/o código postal.
 * El código postal tiene prioridad estricta: si es válido (5 dígitos) y no
 * pertenece a ninguna zona, la dirección está fuera de cobertura automática
 * y NO se cae al nombre de municipio (un CP fuera de rango es evidencia más
 * fiable que un municipio tecleado a mano).
 */
export function resolveDeliveryZone(input: {
  municipality?: string;
  postalCode?: string;
}): ZoneResolution {
  const postalCode = input.postalCode?.trim() ?? "";
  if (/^\d{5}$/.test(postalCode)) {
    for (const zone of DELIVERY_ZONES) {
      if (zone.postalCodeRanges.some((range) => postalCodeInRange(postalCode, range))) {
        return { zone, feeCents: zone.feeCents, needsConsultation: zone.feeCents === null };
      }
    }
    return { zone: null, feeCents: null, needsConsultation: true };
  }

  const municipality = normalizeMunicipality(input.municipality ?? "");
  if (municipality) {
    for (const zone of DELIVERY_ZONES) {
      if (zone.municipalities.some((m) => normalizeMunicipality(m) === municipality)) {
        return { zone, feeCents: zone.feeCents, needsConsultation: zone.feeCents === null };
      }
    }
  }

  return { zone: null, feeCents: null, needsConsultation: true };
}
