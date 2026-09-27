/**
 * El repositorio es público y Vite mete VITE_SUPABASE_ANON_KEY dentro del
 * JavaScript que se descarga cualquiera. Si ahí acaba una clave secreta,
 * queda publicada y se salta todas las políticas de seguridad por fila: se
 * podrían descargar todos los pedidos con nombres, teléfonos y direcciones.
 *
 * Por eso esto se prueba: es el único aviso que hay antes de ese error, y
 * tiene que reconocer los dos formatos de clave de Supabase.
 */
import { describe, expect, it } from "vitest";

import { looksLikeServiceRoleKey } from "./supabase";

/** Un JWT de los de antes: solo importa el payload del medio. */
function jwtCon(payload: Record<string, unknown>): string {
  return `cabecera.${btoa(JSON.stringify(payload))}.firma`;
}

describe("reconocer una clave que no debe llegar al navegador", () => {
  it("caza la service_role antigua por el rol del payload", () => {
    expect(looksLikeServiceRoleKey(jwtCon({ role: "service_role" }))).toBe(true);
  });

  it("caza la clave secreta nueva por el prefijo", () => {
    // Las nuevas son opacas: no hay payload que leer, solo el prefijo delata.
    expect(looksLikeServiceRoleKey("sb_secret_ABC123defGHI456")).toBe(true);
  });

  it("deja pasar la anon antigua", () => {
    expect(looksLikeServiceRoleKey(jwtCon({ role: "anon" }))).toBe(false);
  });

  it("deja pasar la publishable nueva", () => {
    expect(looksLikeServiceRoleKey("sb_publishable_ABC123defGHI456")).toBe(false);
  });

  it("no revienta con una cadena que no es ninguna de las dos", () => {
    // Una variable mal copiada no debe tumbar la carga del módulo.
    expect(looksLikeServiceRoleKey("")).toBe(false);
    expect(looksLikeServiceRoleKey("esto-no-es-una-clave")).toBe(false);
    expect(looksLikeServiceRoleKey("a.b.c")).toBe(false);
  });
});
