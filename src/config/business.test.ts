/**
 * Los dos teléfonos tienen funciones distintas (pedidos por WhatsApp,
 * llamadas al otro número). Confundirlos manda al cliente a un número que
 * no atiende esa vía, así que se comprueba explícitamente.
 */
import { describe, expect, it } from "vitest";
import {
  PHONE_CALLS,
  PHONE_CALLS_DISPLAY,
  WHATSAPP_PHONE,
  WHATSAPP_PHONE_DISPLAY,
} from "./business";

const digits = (value: string) => value.replace(/\D/g, "");

describe("teléfonos de contacto", () => {
  it("el teléfono de llamadas es distinto del de WhatsApp", () => {
    expect(PHONE_CALLS).not.toBe(WHATSAPP_PHONE);
  });

  it("ambos están en formato internacional sin signos, listos para wa.me y tel:", () => {
    for (const phone of [WHATSAPP_PHONE, PHONE_CALLS]) {
      expect(phone).toMatch(/^34\d{9}$/);
    }
  });

  it("cada versión visible contiene los mismos dígitos que la técnica", () => {
    expect(digits(WHATSAPP_PHONE_DISPLAY)).toBe(WHATSAPP_PHONE);
    expect(digits(PHONE_CALLS_DISPLAY)).toBe(PHONE_CALLS);
  });

  it("el teléfono de llamadas es el facilitado el 24/08/2026", () => {
    expect(PHONE_CALLS).toBe("34614280430");
  });
});
