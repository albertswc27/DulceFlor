/**
 * Previsualización de la tarta con IA: qué se le puede pedir y cómo se le pide.
 *
 * La decisión de diseño que sostiene todo lo demás: **el texto libre NO decide
 * la arquitectura de la tarta**. La forma, el acabado y el número de pisos
 * salen de una lista cerrada de lo que Dulce Flor sabe hacer de verdad; el
 * texto libre solo modula colores, tema y motivos.
 *
 * No es una restricción por comodidad. El riesgo real de esta funcionalidad no
 * es técnico: es que la IA enseñe una tarta de concurso que el obrador no puede
 * reproducir, que la clienta la dé por buena y que acabe en una reclamación —y
 * en derecho de consumo español una imagen así puede funcionar como «muestra o
 * modelo» del pedido. Cerrar el espacio de opciones y anclar el estilo con
 * fotos reales suyas es lo que hace que lo generado se parezca a lo entregable.
 *
 * Este fichero lo comparten el navegador y la función serverless, así que no
 * puede depender de `window` ni de `process`.
 */

/** Acabados que Dulce Flor hace de verdad. Cada uno tiene sus fotos de estilo. */
export type CakeFinish = "nata" | "buttercream" | "fondant";

export interface FinishOption {
  id: CakeFinish;
  label: string;
  description: string;
  /**
   * Cómo se le describe el acabado al modelo. En español: las pruebas del
   * proveedor rinden igual y así el texto queda legible para quien lo revise.
   */
  prompt: string;
}

export const CAKE_FINISHES: FinishOption[] = [
  {
    id: "nata",
    label: "Nata y chocolate",
    description: "Nuestro acabado clásico, con cobertura y chorreado de chocolate.",
    prompt:
      "tarta redonda de dos pisos bajos cubierta de nata montada lisa, con un chorreado (drip) de chocolate por el borde superior",
  },
  {
    id: "buttercream",
    label: "Buttercream",
    description: "Rosetones y cenefa hechos con manga pastelera.",
    prompt:
      "tarta redonda cubierta de buttercream con rosetones y cenefa hechos a manga pastelera, textura visible de crema",
  },
  {
    id: "fondant",
    label: "Fondant",
    description: "Forrada de fondant liso, con figuras modeladas a mano.",
    prompt:
      "tarta forrada de fondant liso y mate, con figuras sencillas modeladas a mano, acabado artesanal",
  },
];

/** Paleta cerrada: evita el «azul eléctrico» que ningún colorante alimentario da. */
export interface ColourOption {
  id: string;
  label: string;
  /** Cómo se nombra el color en el texto que se manda al modelo. */
  prompt: string;
  /** Muestra para la interfaz. */
  hex: string;
}

export const CAKE_COLOURS: ColourOption[] = [
  { id: "blanco", label: "Blanco", prompt: "blanco roto", hex: "#F7F3EC" },
  { id: "marfil", label: "Marfil", prompt: "marfil suave", hex: "#EFE2CB" },
  { id: "rosa", label: "Rosa", prompt: "rosa empolvado", hex: "#E9B7C0" },
  { id: "lila", label: "Lila", prompt: "lila suave", hex: "#C9B6DD" },
  { id: "azul", label: "Azul", prompt: "azul cielo apagado", hex: "#A9C4DA" },
  { id: "verde", label: "Verde", prompt: "verde salvia", hex: "#AEC3A8" },
  { id: "amarillo", label: "Amarillo", prompt: "amarillo mantequilla", hex: "#EFD79B" },
  { id: "rojo", label: "Rojo", prompt: "rojo intenso", hex: "#C0453F" },
  { id: "chocolate", label: "Chocolate", prompt: "marrón chocolate", hex: "#6B4A34" },
  { id: "dorado", label: "Dorado", prompt: "detalles dorados comestibles", hex: "#C9A24A" },
];

export const MAX_COLOURS = 2;
/** Tope del texto libre. Corto a propósito: cuanto más largo, más se desvía. */
export const MAX_DETAIL_LENGTH = 120;

export interface AiPreviewOptions {
  finish: CakeFinish;
  /** Hasta dos colores de la paleta. */
  colourIds: string[];
  /** Tema o motivos, en palabras del cliente. Opcional. */
  detail: string;
}

export type AiPreviewProblem =
  | "acabado-invalido"
  | "demasiados-colores"
  | "color-invalido"
  | "detalle-largo"
  | "detalle-sospechoso";

export const AI_PREVIEW_PROBLEM_MESSAGES: Record<AiPreviewProblem, string> = {
  "acabado-invalido": "Elige uno de los acabados disponibles.",
  "demasiados-colores": `Puedes elegir como máximo ${MAX_COLOURS} colores.`,
  "color-invalido": "Alguno de los colores elegidos no está en la carta.",
  "detalle-largo": `La descripción no puede pasar de ${MAX_DETAIL_LENGTH} caracteres.`,
  "detalle-sospechoso":
    "Cuéntanos solo cómo quieres la tarta: colores, tema o motivos. Este texto no parece describir una tarta.",
};

/**
 * Palabras que no pintan nada describiendo una tarta y que, si aparecen, casi
 * siempre son un intento de usar el generador para otra cosa. No pretende ser
 * un filtro de contenido completo —eso lo hace el propio proveedor—, sino
 * cortar lo evidente ANTES de gastar un céntimo.
 */
const PALABRAS_VETADAS = [
  "desnud",
  "porn",
  "sexual",
  "sangre",
  "arma",
  "pistola",
  "cuchillo",
  "droga",
  "nazi",
  "esvástica",
  "esvastica",
  "ignora las instrucciones",
  "ignore previous",
  "system prompt",
];

export type AiPreviewValidation =
  | { ok: true; options: AiPreviewOptions }
  | { ok: false; problem: AiPreviewProblem };

/** Valida lo que llega del navegador. Se repite en el servidor: no se confía. */
export function validateAiPreviewOptions(raw: {
  finish?: unknown;
  colourIds?: unknown;
  detail?: unknown;
}): AiPreviewValidation {
  const finish = CAKE_FINISHES.find((f) => f.id === raw.finish)?.id;
  if (!finish) return { ok: false, problem: "acabado-invalido" };

  const colourIds = Array.isArray(raw.colourIds)
    ? raw.colourIds.filter((c): c is string => typeof c === "string")
    : [];
  if (colourIds.length > MAX_COLOURS) {
    return { ok: false, problem: "demasiados-colores" };
  }
  if (!colourIds.every((id) => CAKE_COLOURS.some((c) => c.id === id))) {
    return { ok: false, problem: "color-invalido" };
  }

  const detail = typeof raw.detail === "string" ? raw.detail.trim() : "";
  if (detail.length > MAX_DETAIL_LENGTH) {
    return { ok: false, problem: "detalle-largo" };
  }
  const enMinusculas = detail.toLowerCase();
  if (PALABRAS_VETADAS.some((palabra) => enMinusculas.includes(palabra))) {
    return { ok: false, problem: "detalle-sospechoso" };
  }

  return { ok: true, options: { finish, colourIds, detail } };
}

/**
 * Instrucción fija que acompaña a cada generación.
 *
 * Tres cosas que no son negociables y por qué:
 *
 *  - «alcanzable por una pastelería pequeña»: es lo que frena las tartas de
 *    concurso de cinco pisos que luego hay que explicar que no se pueden hacer.
 *  - «sin ningún texto ni letra»: los modelos escriben mal, y corregirlo
 *    gastaría la segunda generación. La dedicatoria se pide como una placa en
 *    blanco y se escribe después. Además, así el nombre del niño y su edad
 *    —que es lo que suele poner una dedicatoria— nunca salen hacia el
 *    proveedor.
 *  - «fotografía real»: el encuadre de foto de producto es lo que hace que la
 *    imagen sirva para decidir, en vez de parecer una ilustración.
 */
export const AI_SYSTEM_PROMPT = [
  "Eres el fotógrafo de producto de una pastelería artesanal pequeña de barrio.",
  "Genera UNA fotografía realista de UNA sola tarta, centrada, sobre una mesa neutra y con luz natural suave.",
  "La tarta debe ser ARTESANAL Y ALCANZABLE: como mucho dos pisos bajos, decoración sencilla hecha a mano.",
  "Nada de tartas de concurso, esculturas de azúcar, pisos imposibles, purpurina irreal ni acabados industriales.",
  "NO escribas ningún texto, letra, número ni firma sobre la tarta ni en la imagen.",
  "Si la descripción pide una dedicatoria, coloca en su lugar una placa lisa de chocolate blanco EN BLANCO, sin nada escrito.",
  "Sigue el estilo, la textura y el nivel de acabado de las fotografías de referencia que se adjuntan.",
].join(" ");

/** Describe los colores elegidos, o deja que el estilo mande si no hay ninguno. */
function describeColours(colourIds: string[]): string {
  const nombres = colourIds
    .map((id) => CAKE_COLOURS.find((c) => c.id === id)?.prompt)
    .filter((p): p is string => Boolean(p));
  if (nombres.length === 0) return "";
  if (nombres.length === 1) return `Color principal: ${nombres[0]}.`;
  return `Colores: ${nombres.join(" y ")}.`;
}

/** El texto que se envía al modelo para la PRIMERA generación. */
export function buildImagePrompt(options: AiPreviewOptions): string {
  const finish = CAKE_FINISHES.find((f) => f.id === options.finish)!;
  const partes = [`Una ${finish.prompt}.`, describeColours(options.colourIds)];
  if (options.detail) {
    // El texto del cliente va al final y marcado como decoración: así no puede
    // reescribir lo anterior («ignora lo de arriba y haz…»), solo añadir.
    partes.push(`Decoración pedida por el cliente: ${options.detail}.`);
  }
  partes.push("Sin ningún texto escrito sobre la tarta.");
  return partes.filter(Boolean).join(" ");
}

/**
 * El texto del REFINADO. Se edita la imagen anterior en lugar de generar otra:
 * con solo dos intentos, devolver una tarta distinta a quien solo pedía «ponle
 * perlas blancas» es la peor forma de gastar el segundo.
 */
export function buildRefinePrompt(cambio: string): string {
  return [
    `Modifica la imagen anterior: ${cambio.trim()}.`,
    "Mantén EXACTAMENTE igual el resto: la forma de la tarta, el acabado, el encuadre, el fondo y la luz.",
    "Sigue sin escribir ningún texto sobre la tarta.",
  ].join(" ");
}

/** Resumen legible de lo pedido, para guardar junto al pedido y enseñárselo al obrador. */
export function describeAiPreview(options: AiPreviewOptions): string {
  const finish = CAKE_FINISHES.find((f) => f.id === options.finish);
  const colores = options.colourIds
    .map((id) => CAKE_COLOURS.find((c) => c.id === id)?.label)
    .filter(Boolean)
    .join(" y ");
  return [
    finish?.label,
    colores ? `colores ${colores}` : "",
    options.detail,
  ]
    .filter(Boolean)
    .join(" · ");
}
