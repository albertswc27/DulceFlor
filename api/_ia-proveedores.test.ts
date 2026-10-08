/**
 * Lo que se prueba aquí es la FORMA DE LA PETICIÓN que se le manda a Google,
 * y es la clase de fallo más cara de todas: no se ve en ninguna revisión, no
 * lo caza el compilador —el cuerpo es un objeto suelto— y no aparece hasta
 * que una clienta real pulsa el botón y no sale nada.
 *
 * Pasó de verdad: `image_size` y `aspect_ratio` estaban en la raíz del cuerpo
 * en vez de dentro de `response_format`, y la API contesta 400 «Unknown
 * parameter». El generador habría fallado en el 100% de las llamadas.
 *
 * Los valores están comprobados contra la API real y su referencia:
 *   - `image_size` solo admite 512, 1K, 2K y 4K, con la K en MAYÚSCULA, y
 *     Flash Lite Image únicamente 1K.
 *   - `aspect_ratio` admite 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9 y 21:9.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { construirProveedorIa, extraerImagenBase64 } from "./_ia-proveedores";

/** Un JPEG base64 creíble: el extractor exige el prefijo y cierta longitud. */
const JPEG = "/9j/" + "A".repeat(700);

let ultimoCuerpo: Record<string, unknown>;

beforeEach(() => {
  ultimoCuerpo = {};
  vi.stubGlobal("fetch", async (_url: unknown, init: { body: string }) => {
    ultimoCuerpo = JSON.parse(init.body);
    // La forma real que devuelve la API de interacciones.
    return new Response(
      JSON.stringify({
        id: "interactions/abc123",
        status: "completed",
        steps: [{ type: "message", content: [{ type: "image", mime_type: "image/jpeg", data: JPEG }] }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });
});

function proveedor() {
  const config = construirProveedorIa({
    IA_PROVEEDOR: "gemini",
    GEMINI_API_KEY: "clave",
  } as NodeJS.ProcessEnv);
  if (!config.ok) throw new Error(config.message);
  return config.proveedor;
}

const PETICION = {
  sistema: "eres un fotógrafo",
  texto: "tarta de nata rosa",
  referencias: [JPEG],
};

describe("el cuerpo que se le manda a Gemini", () => {
  it("mete el tamaño y la proporción DENTRO de response_format", async () => {
    await proveedor().generar(PETICION);

    const formato = ultimoCuerpo.response_format as Record<string, unknown>;
    expect(formato).toMatchObject({
      type: "image",
      mime_type: "image/jpeg",
      image_size: "1K",
      aspect_ratio: "4:5",
    });
    // `delivery` NO: la API devuelve 400 «Image delivery mode is not
    // supported». Comprobado contra el servicio real el 06/10/2026.
    expect(formato).not.toHaveProperty("delivery");
  });

  it("y NO los deja sueltos en la raíz, que es lo que devolvía 400", async () => {
    await proveedor().generar(PETICION);

    expect(ultimoCuerpo).not.toHaveProperty("image_size");
    expect(ultimoCuerpo).not.toHaveProperty("aspect_ratio");
    expect(ultimoCuerpo).not.toHaveProperty("mime_type");
  });

  it("manda el modelo, la instrucción y las referencias como imágenes", async () => {
    await proveedor().generar(PETICION);

    expect(ultimoCuerpo.model).toBe("gemini-3.1-flash-lite-image");
    expect(ultimoCuerpo.system_instruction).toBe("eres un fotógrafo");
    const input = ultimoCuerpo.input as Array<Record<string, unknown>>;
    expect(input[0]).toMatchObject({ type: "text" });
    expect(input[1]).toMatchObject({ type: "image", mime_type: "image/jpeg" });
  });

  it("al refinar manda previous_interaction_id, que es lo que EDITA la imagen", async () => {
    await proveedor().generar({ ...PETICION, interaccionAnterior: "interactions/abc123" });

    expect(ultimoCuerpo.previous_interaction_id).toBe("interactions/abc123");
  });

  it("sin refinado no lo manda: es la primera imagen", async () => {
    await proveedor().generar(PETICION);

    expect(ultimoCuerpo).not.toHaveProperty("previous_interaction_id");
  });
});

describe("leer la respuesta", () => {
  it("encuentra la imagen dentro de steps[].content[] y el id de la interacción", async () => {
    const resultado = await proveedor().generar(PETICION);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.base64).toBe(JPEG);
    // Sin esto el refinado generaría una imagen nueva en vez de editar la anterior.
    expect(resultado.interaccionId).toBe("interactions/abc123");
  });

  it("busca la imagen por el árbol, no por una ruta fija", () => {
    // Si Google cambia el nombre de un campo, el generador sigue funcionando.
    expect(extraerImagenBase64({ a: { b: [{ c: JPEG }] } })).toBe(JPEG);
    expect(extraerImagenBase64({ data: `data:image/jpeg;base64,${JPEG}` })).toBe(JPEG);
  });

  it("no confunde un texto cualquiera con una imagen", () => {
    expect(extraerImagenBase64({ output_text: "aquí tienes tu tarta" })).toBeNull();
    expect(extraerImagenBase64({ id: "interactions/abc123" })).toBeNull();
  });
});

describe("el refinado edita la imagen anterior, no genera otra", () => {
  it("al refinar NO se mandan las fotos de referencia", async () => {
    // Comprobado contra la API real: mandándolas, el modelo vuelve a generar a
    // partir de ellas y devuelve una tarta distinta —con el fondo de la tienda
    // incluido— en vez de la anterior con el cambio pedido. Es el fallo que
    // convertía «ponle perlas blancas» en una lotería.
    await proveedor().generar({ ...PETICION, interaccionAnterior: "interactions/abc" });

    const input = ultimoCuerpo.input as Array<Record<string, unknown>>;
    expect(input).toHaveLength(1);
    expect(input[0]).toMatchObject({ type: "text" });
    expect(ultimoCuerpo.previous_interaction_id).toBe("interactions/abc");
  });

  it("en la PRIMERA imagen sí van, que son las que fijan el estilo", async () => {
    await proveedor().generar(PETICION);

    const input = ultimoCuerpo.input as Array<Record<string, unknown>>;
    expect(input.length).toBeGreaterThan(1);
    expect(input[1]).toMatchObject({ type: "image" });
  });
});
