/**
 * Adaptadores del generador de imágenes.
 *
 * Empieza por «_» para que Vercel no lo convierta en un endpoint: es una
 * utilidad interna.
 *
 * Proveedor elegido: **Google Gemini 3.1 Flash Image**, en su variante Lite.
 * El motivo no es el precio (aunque sale a unos 3 céntimos por imagen), sino
 * que es el único del mercado que documenta admitir varias fotos de
 * referencia de ESTILO en la misma petición. Eso es exactamente lo que hace
 * falta aquí: que la tarta generada se parezca a las que Dulce Flor hace de
 * verdad, y no a una tarta de concurso que luego no se puede entregar.
 *
 * Se descartó Black Forest Labs pese a ser europea: su política dice
 * literalmente que pueden entrenar sus modelos con los textos y las imágenes
 * que se les envían, y aquí el texto lo escribe un cliente anónimo.
 *
 * IMPORTANTE sobre el nivel de cuenta: hay que usar SIEMPRE una clave con
 * facturación activada. En el nivel gratuito, Google usa lo que se envía para
 * mejorar sus productos y revisores humanos pueden leerlo; en el de pago, no.
 */

export interface ImagenPedida {
  /** Instrucción fija de estilo (ver AI_SYSTEM_PROMPT en domain/aiPreview). */
  sistema: string;
  /** Lo que se quiere de esta imagen en concreto. */
  texto: string;
  /** Fotos reales de la pastelería que anclan el estilo, en base64 JPEG. */
  referencias: string[];
  /**
   * Interacción anterior, para EDITAR la imagen en vez de generar otra. Con
   * solo dos intentos por pedido, devolverle una tarta distinta a quien pedía
   * «ponle perlas blancas» es la peor forma de gastar el segundo.
   */
  interaccionAnterior?: string;
}

export type ImagenResultado =
  | {
      ok: true;
      /** JPEG en base64, sin el prefijo `data:`. */
      base64: string;
      /** Identificador para poder editar esta imagen después. */
      interaccionId: string | null;
    }
  | {
      ok: false;
      code: string;
      /** Mensaje en español, pensado para enseñárselo al cliente tal cual. */
      message: string;
      /** true si reintentar más tarde tiene sentido. */
      retriable: boolean;
    };

export interface ProveedorImagen {
  readonly name: string;
  generar(peticion: ImagenPedida): Promise<ImagenResultado>;
}

/** Generar una imagen tarda segundos, no milisegundos. */
const TIMEOUT_MS = 45_000;

async function postConTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca la imagen en la respuesta del proveedor.
 *
 * Recorre el JSON en vez de leer una ruta fija a propósito: las APIs de
 * imagen cambian la forma de la respuesta entre versiones, y un cambio de
 * nombre de campo no puede dejar sin funcionar el generador entero. Se busca
 * el primer texto que parezca un JPEG o un PNG en base64.
 *
 * Los tres primeros bytes de un JPEG en base64 empiezan por `/9j/`, y los de
 * un PNG por `iVBORw0`.
 */
export function extraerImagenBase64(valor: unknown, profundidad = 0): string | null {
  if (profundidad > 8) return null;
  if (typeof valor === "string") {
    const limpio = valor.startsWith("data:") ? (valor.split(",")[1] ?? "") : valor;
    if (limpio.length > 512 && /^(\/9j\/|iVBORw0)/.test(limpio)) return limpio;
    return null;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) {
      const encontrado = extraerImagenBase64(item, profundidad + 1);
      if (encontrado) return encontrado;
    }
    return null;
  }
  if (valor && typeof valor === "object") {
    for (const item of Object.values(valor as Record<string, unknown>)) {
      const encontrado = extraerImagenBase64(item, profundidad + 1);
      if (encontrado) return encontrado;
    }
  }
  return null;
}

/** Igual de defensivo con el identificador de la interacción. */
function extraerInteraccionId(cuerpo: unknown): string | null {
  if (!cuerpo || typeof cuerpo !== "object") return null;
  const c = cuerpo as Record<string, unknown>;
  for (const clave of ["id", "interaction_id", "interactionId", "name"]) {
    const valor = c[clave];
    if (typeof valor === "string" && valor.length > 0 && valor.length < 300) return valor;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Google Gemini                                                       */
/* ------------------------------------------------------------------ */

function gemini(apiKey: string, modelo: string): ProveedorImagen {
  return {
    name: "gemini",
    async generar({ sistema, texto, referencias, interaccionAnterior }) {
      const input: Array<Record<string, unknown>> = [{ type: "text", text: texto }];
      for (const referencia of referencias) {
        input.push({ type: "image", mime_type: "image/jpeg", data: referencia });
      }

      const cuerpo: Record<string, unknown> = {
        model: modelo,
        input,
        system_instruction: sistema,
        // TODO ESTO VA DENTRO DE response_format, no en la raíz. Comprobado
        // contra la API real: con `image_size` o `aspect_ratio` sueltos
        // responde 400 «Unknown parameter», así que el generador habría
        // fallado en el 100% de las llamadas.
        response_format: {
          type: "image",
          // JPEG y no el PNG por defecto: el PNG pesa unas trece veces más y
          // no cabría en el almacén del navegador ni en el bucket.
          mime_type: "image/jpeg",
          // Flash Lite Image solo admite 1K, y la «K» va en mayúscula.
          image_size: "1K",
          // Vertical, que es como están hechas sus fotos y como se mira un móvil.
          aspect_ratio: "4:5",
          // Los bytes dentro de la respuesta, no una URL que habría que ir a
          // buscar en una segunda petición.
          delivery: "inline",
        },
      };
      if (interaccionAnterior) cuerpo.previous_interaction_id = interaccionAnterior;

      let respuesta: Response;
      try {
        respuesta = await postConTimeout(
          "https://generativelanguage.googleapis.com/v1beta/interactions",
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(cuerpo),
          }
        );
      } catch {
        return {
          ok: false,
          code: "red",
          message:
            "La generación está tardando demasiado. Vuelve a intentarlo en un momento.",
          retriable: true,
        };
      }

      if (respuesta.status === 401 || respuesta.status === 403) {
        return {
          ok: false,
          code: `http_${respuesta.status}`,
          message: "El generador de imágenes no está bien configurado.",
          retriable: false,
        };
      }
      if (respuesta.status === 429) {
        return {
          ok: false,
          code: "http_429",
          message: "El generador está saturado ahora mismo. Prueba dentro de un minuto.",
          retriable: true,
        };
      }

      let json: unknown;
      try {
        json = await respuesta.json();
      } catch {
        return {
          ok: false,
          code: "respuesta_ilegible",
          message: "El generador ha devuelto algo que no se entiende.",
          retriable: true,
        };
      }

      if (!respuesta.ok) {
        return {
          ok: false,
          code: `http_${respuesta.status}`,
          message: "No se ha podido generar la imagen. Vuelve a intentarlo.",
          retriable: respuesta.status >= 500,
        };
      }

      const base64 = extraerImagenBase64(json);
      if (!base64) {
        // Pasa cuando el filtro de contenido del proveedor bloquea la
        // petición: responde 200 pero sin imagen.
        return {
          ok: false,
          code: "sin_imagen",
          message:
            "No hemos podido generar esta imagen. Prueba a describir la tarta de otra manera.",
          retriable: false,
        };
      }

      return { ok: true, base64, interaccionId: extraerInteraccionId(json) };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Modo de pruebas                                                     */
/* ------------------------------------------------------------------ */

/**
 * No llama a nadie: devuelve una de las fotos reales de referencia como si la
 * hubiera generado. Sirve para recorrer el circuito completo —cupos, guardado,
 * etiquetado, ficha— sin gastar un céntimo ni depender de que haya clave.
 *
 * Que devuelva una foto de verdad (y no un cuadrado gris) es a propósito: así
 * la revisión visual de la interfaz es representativa.
 */
function pruebas(): ProveedorImagen {
  return {
    name: "pruebas",
    async generar({ referencias, texto }) {
      console.info(`[IA en modo pruebas] ${texto.length} caracteres de instrucción`);
      if (referencias.length === 0) {
        return {
          ok: false,
          code: "sin_referencias",
          message: "No se han podido cargar las fotos de referencia.",
          retriable: true,
        };
      }
      // Una referencia distinta en cada llamada, para que el refinado se note.
      const indice = Math.min(referencias.length - 1, texto.length % referencias.length);
      return { ok: true, base64: referencias[indice], interaccionId: "pruebas" };
    },
  };
}

/* ------------------------------------------------------------------ */

export type ConfiguracionIa =
  | { ok: true; proveedor: ProveedorImagen }
  | { ok: false; message: string };

/**
 * Construye el proveedor desde las variables de entorno del servidor. Si algo
 * falta, se dice exactamente qué: el fallo más probable de este módulo no es
 * el código, es una variable sin poner en Vercel.
 */
export function construirProveedorIa(env: NodeJS.ProcessEnv): ConfiguracionIa {
  const nombre = (env.IA_PROVEEDOR ?? "gemini").trim().toLowerCase();

  if (nombre === "pruebas") return { ok: true, proveedor: pruebas() };

  if (nombre === "gemini") {
    const apiKey = (env.GEMINI_API_KEY ?? "").trim();
    if (!apiKey) {
      return { ok: false, message: "Falta la variable de entorno GEMINI_API_KEY." };
    }
    const modelo = (env.IA_MODELO ?? "gemini-3.1-flash-lite-image").trim();
    return { ok: true, proveedor: gemini(apiKey, modelo) };
  }

  return {
    ok: false,
    message: `IA_PROVEEDOR tiene el valor "${nombre}", que no existe. Valores válidos: gemini, pruebas.`,
  };
}
