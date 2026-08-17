import { describe, expect, it } from "vitest";
import { normalizeMunicipality, resolveDeliveryZone } from "./delivery";

describe("zonas de entrega (config PROVISIONAL)", () => {
  it("caso 6: Santa Coloma de Gramenet → 0 €", () => {
    const byName = resolveDeliveryZone({ municipality: "Santa Coloma de Gramenet" });
    expect(byName.feeCents).toBe(0);
    expect(byName.needsConsultation).toBe(false);

    const byCp = resolveDeliveryZone({ postalCode: "08922" });
    expect(byCp.feeCents).toBe(0);
  });

  it("caso 7: Badalona → 5 €", () => {
    expect(resolveDeliveryZone({ municipality: "Badalona" }).feeCents).toBe(500);
    expect(resolveDeliveryZone({ postalCode: "08912" }).feeCents).toBe(500);
  });

  it("Sant Adrià y Montcada → 5 €", () => {
    expect(resolveDeliveryZone({ municipality: "Sant Adrià de Besòs" }).feeCents).toBe(500);
    expect(resolveDeliveryZone({ postalCode: "08930" }).feeCents).toBe(500);
    expect(resolveDeliveryZone({ municipality: "Montcada i Reixac" }).feeCents).toBe(500);
    expect(resolveDeliveryZone({ postalCode: "08110" }).feeCents).toBe(500);
  });

  it("caso 8: Barcelona ciudad → 10 €", () => {
    expect(resolveDeliveryZone({ municipality: "Barcelona" }).feeCents).toBe(1000);
    expect(resolveDeliveryZone({ postalCode: "08025" }).feeCents).toBe(1000);
  });

  it("resto → consultar (sin tarifa automática)", () => {
    const res = resolveDeliveryZone({ municipality: "Sabadell", postalCode: "08201" });
    expect(res.feeCents).toBeNull();
    expect(res.needsConsultation).toBe(true);
    expect(res.zone).toBeNull();
  });

  it("el código postal tiene prioridad sobre un municipio ambiguo", () => {
    // CP de Badalona con municipio mal escrito → gana el CP
    const res = resolveDeliveryZone({ municipality: "Badalonaa", postalCode: "08915" });
    expect(res.feeCents).toBe(500);
  });

  it("un CP válido fuera de todas las zonas NO cae al municipio: consultar", () => {
    // CP de L'Hospitalet con municipio "Barcelona": el CP manda → fuera de zona
    const res = resolveDeliveryZone({ municipality: "Barcelona", postalCode: "08901" });
    expect(res.feeCents).toBeNull();
    expect(res.needsConsultation).toBe(true);
  });

  it("sin CP (o CP inválido) se usa el municipio", () => {
    expect(resolveDeliveryZone({ municipality: "Barcelona", postalCode: "080" }).feeCents).toBe(1000);
    expect(resolveDeliveryZone({ municipality: "Badalona" }).feeCents).toBe(500);
  });

  it("normaliza acentos y mayúsculas", () => {
    expect(normalizeMunicipality("SANT ADRIÀ DE BESÒS")).toBe("sant adria de besos");
    expect(resolveDeliveryZone({ municipality: "  santa   coloma de gramenet " }).feeCents).toBe(0);
  });
});
