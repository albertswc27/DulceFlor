/**
 * Lo que se comprueba aquí es que NO se pierda por el camino nada de lo que la
 * clienta ha elegido.
 *
 * Ya pasó: el tamaño, los toppings y los toppers se añadieron al tipo, al
 * componente y al prompt, pero este servicio enumeraba los campos a mano, así
 * que se caían aquí sin que fallara nada. La IA seguía dibujando una tarta
 * cualquiera y Dulce Flor lo vio antes que nosotros.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiPreviewOptions } from "@/domain/aiPreview";

import { generateCakeImage } from "./aiPreview";

let enviado: Record<string, unknown> = {};

beforeEach(() => {
  enviado = {};
  vi.stubGlobal("fetch", async (_url: unknown, init: { body: string }) => {
    enviado = JSON.parse(init.body);
    return new Response(JSON.stringify({ ok: true, image: "data:image/jpeg;base64,x", remaining: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
});

/** Una configuración con TODOS los campos, para comprobar la forma entera. */
const COMPLETA: AiPreviewOptions = {
  finish: "buttercream",
  colourIds: ["rosa", "lila"],
  detail: "flores pequeñas",
  tierId: "4-6",
  discId: "1d",
  toppingIds: ["fresas"],
  figurineToppers: true,
};

describe("lo que se le manda al servidor", () => {
  it("viaja TODO lo que la clienta ha elegido", async () => {
    await generateCakeImage(COMPLETA);

    // Si esto falla, el nombre que falta es el campo que se está perdiendo.
    for (const campo of Object.keys(COMPLETA)) {
      expect(enviado).toHaveProperty(campo);
    }
    expect(enviado.tierId).toBe("4-6");
    expect(enviado.discId).toBe("1d");
    expect(enviado.toppingIds).toEqual(["fresas"]);
    expect(enviado.figurineToppers).toBe(true);
  });

  it("y también la sesión y el refinado cuando los hay", async () => {
    await generateCakeImage(COMPLETA, { sessionToken: "s1", refine: "ponle perlas" });
    expect(enviado.sessionToken).toBe("s1");
    expect(enviado.refine).toBe("ponle perlas");
  });
});
