/**
 * parseEurosToCents lo usan el kiosk (señal) y el panel (presupuesto). Un fallo
 * aquí desvía dinero, así que se fijan los casos límite: coma vs punto, blancos,
 * negativos y basura.
 */
import { describe, expect, it } from "vitest";
import { formatEuros, parseEurosToCents, percentOf } from "./money";

describe("parseEurosToCents", () => {
  it("acepta enteros y decimales con punto o con coma", () => {
    expect(parseEurosToCents("20")).toBe(2000);
    expect(parseEurosToCents("20.5")).toBe(2050);
    expect(parseEurosToCents("20,50")).toBe(2050);
    expect(parseEurosToCents("0")).toBe(0);
  });

  it("tolera espacios alrededor y dentro", () => {
    expect(parseEurosToCents("  20,50 ")).toBe(2050);
    expect(parseEurosToCents("1 000")).toBe(100000);
  });

  it("redondea al céntimo", () => {
    expect(parseEurosToCents("19.999")).toBe(2000);
    expect(parseEurosToCents("0,005")).toBe(1);
  });

  it("rechaza vacío, negativos y texto", () => {
    expect(parseEurosToCents("")).toBeNull();
    expect(parseEurosToCents("   ")).toBeNull();
    expect(parseEurosToCents("-5")).toBeNull();
    expect(parseEurosToCents("abc")).toBeNull();
    expect(parseEurosToCents("20€")).toBeNull();
  });
});

describe("formatEuros y percentOf (regresión rápida)", () => {
  it("formatea en euros", () => {
    expect(formatEuros(2050)).toContain("20,50");
  });
  it("percentOf redondea al céntimo", () => {
    expect(percentOf(4333, 30)).toBe(1300);
  });
});
