/**
 * Cliente del generador de imágenes, visto desde el configurador.
 *
 * No genera nada: se lo pide a la función serverless, que es la única que
 * conoce la clave del proveedor y la única que puede llevar la cuenta de
 * cuántas imágenes se han hecho. Contar aquí no serviría de nada —basta con
 * borrar los datos del navegador— y por eso el número de generaciones que
 * queda lo dice siempre el servidor, nunca este fichero.
 */
import type { AiPreviewOptions } from "@/domain/aiPreview";

export interface AiPreviewOk {
  ok: true;
  /** La imagen, como data URL JPEG lista para enseñar. */
  image: string;
  /** Sesión de generación: hay que devolverla en la siguiente petición. */
  sessionToken: string;
  /** Generaciones que quedan, según el servidor. */
  remaining: number;
  /** Resumen legible de lo pedido, para guardar junto al pedido. */
  summary: string;
}

export interface AiPreviewError {
  ok: false;
  code: string;
  message: string;
  retriable: boolean;
  /** true cuando el motivo es haber agotado el cupo, no un fallo. */
  outOfQuota: boolean;
}

export type AiPreviewResult = AiPreviewOk | AiPreviewError;

interface RespuestaServidor {
  ok?: unknown;
  error?: unknown;
  message?: unknown;
  retriable?: unknown;
  image?: unknown;
  sessionToken?: unknown;
  remaining?: unknown;
  summary?: unknown;
}

const CUPO_AGOTADO = ["limite_sesion", "limite_cliente", "limite_tienda"];

/**
 * Pide una imagen. Con `refine` se edita la anterior en lugar de generar otra
 * distinta: es lo que hace que gastar el segundo intento en «ponle perlas
 * blancas» devuelva la misma tarta con perlas, y no otra tarta cualquiera.
 */
export async function generateCakeImage(
  options: AiPreviewOptions,
  extras: { sessionToken?: string; refine?: string } = {}
): Promise<AiPreviewResult> {
  let response: Response;
  try {
    response = await fetch("/api/generar-imagen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        finish: options.finish,
        colourIds: options.colourIds,
        detail: options.detail,
        sessionToken: extras.sessionToken,
        refine: extras.refine,
      }),
    });
  } catch {
    return {
      ok: false,
      code: "sin_conexion",
      message: "No hay conexión con el servidor. Inténtalo en un momento.",
      retriable: true,
      outOfQuota: false,
    };
  }

  let body: RespuestaServidor;
  try {
    body = (await response.json()) as RespuestaServidor;
  } catch {
    return {
      ok: false,
      code: "respuesta_ilegible",
      message:
        response.status === 404
          ? "El generador de imágenes no está disponible en esta versión de la web."
          : "El servidor ha respondido algo inesperado.",
      retriable: response.status !== 404,
      outOfQuota: false,
    };
  }

  if (response.ok && body.ok === true && typeof body.image === "string") {
    return {
      ok: true,
      image: body.image,
      sessionToken: typeof body.sessionToken === "string" ? body.sessionToken : "",
      remaining: typeof body.remaining === "number" ? body.remaining : 0,
      summary: typeof body.summary === "string" ? body.summary : "",
    };
  }

  const code = typeof body.error === "string" ? body.error : `http_${response.status}`;
  return {
    ok: false,
    code,
    message:
      typeof body.message === "string" && body.message
        ? body.message
        : "No se ha podido generar la imagen.",
    retriable: body.retriable === true,
    outOfQuota: CUPO_AGOTADO.includes(code),
  };
}
