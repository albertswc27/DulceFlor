/**
 * La subida de la imagen de referencia al Storage depende de dos piezas puras
 * y fáciles de romper sin darse cuenta: la ruta del archivo y la conversión
 * del data URL a Blob. El resto (red, sesión) se prueba a mano contra Supabase.
 */
import { describe, expect, it } from "vitest";
import { dataUrlToBlob, remoteImagePath } from "./imageStore";

describe("remoteImagePath", () => {
  it("usa el id como nombre de archivo .jpg", () => {
    expect(remoteImagePath("abc-123")).toBe("abc-123.jpg");
  });
});

describe("dataUrlToBlob", () => {
  it("reconstruye los bytes y el tipo desde un data URL", async () => {
    // "abc" en base64 es "YWJj" (3 bytes).
    const blob = dataUrlToBlob("data:image/jpeg;base64,YWJj");
    expect(blob.type).toBe("image/jpeg");
    expect(blob.size).toBe(3);
    expect(await blob.text()).toBe("abc");
  });

  it("respeta el tipo declarado (png)", () => {
    const blob = dataUrlToBlob("data:image/png;base64,YWJj");
    expect(blob.type).toBe("image/png");
  });

  it("cae a image/jpeg si el encabezado no trae tipo", () => {
    const blob = dataUrlToBlob("data:;base64,YWJj");
    expect(blob.type).toBe("image/jpeg");
  });
});
