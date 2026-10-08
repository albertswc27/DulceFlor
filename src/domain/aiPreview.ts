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

/**
 * Lo que el prompt necesita saber del catálogo, copiado aquí a mano.
 *
 * Y no importado, que sería lo natural: `catalog.ts` importa con el alias
 * `@/`, que Node no resuelve dentro de la función serverless. Importarlo
 * tumbaría `/api/generar-imagen` en producción, igual que pasó con las
 * extensiones de los imports.
 *
 * El riesgo de copiar es que se desincronice, así que hay un test que compara
 * estas tres tablas con el catálogo y falla nombrando lo que sobra o falta.
 */
const ALTURA_POR_DISCO: Record<string, number> = {
  "1d": 8,
  "2d": 13,
  "3d": 20,
};

const PERSONAS_POR_TAMANO: Record<string, string> = {
  "4-6": "4 a 6",
  "10-12": "10 a 12",
  "16-18": "16 a 18",
  "20-22": "20 a 22",
};

const TOPPINGS_PARA_LA_IA: Record<string, string> = {
  fresas: "fresas frescas",
  "dulce-de-leche": "dulce de leche",
  oreo: "galletas Oreo",
  "kinder-bueno": "Kinder Bueno",
  lotus: "galletas Lotus",
  nutella: "Nutella",
  "frutos-rojos": "frutos rojos",
  chocolate: "chocolate",
};

/** Para el test de sincronía con el catálogo. */
export const AI_CATALOGO_LOCAL = {
  discos: ALTURA_POR_DISCO,
  tamanos: PERSONAS_POR_TAMANO,
  toppings: TOPPINGS_PARA_LA_IA,
};

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
      "cubierta de nata montada lisa, con un chorreado (drip) de chocolate por el borde superior",
  },
  {
    id: "buttercream",
    label: "Buttercream",
    description: "Rosetones y cenefa hechos con manga pastelera.",
    prompt:
      "cubierta de buttercream con rosetones y cenefa hechos a manga pastelera, textura visible de crema",
  },
  {
    id: "fondant",
    label: "Fondant",
    description: "Forrada de fondant liso, con figuras modeladas a mano.",
    prompt:
      "forrada de fondant liso y mate, con figuras sencillas modeladas a mano, acabado artesanal",
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
  /**
   * Tamaño elegido en el configurador, para que la tarta dibujada sea LA SUYA.
   *
   * Dulce Flor lo detectó probándolo: «pongo de un disco, de 4-6 personas, y
   * me hace una torta de dos pisos». Normal: hasta ahora no se le mandaba el
   * tamaño, solo el acabado y los colores, así que la altura y el diámetro se
   * los inventaba el modelo.
   *
   * Ojo con el vocabulario, que es la causa del malentendido: los DISCOS son
   * la altura de UNA tarta de un solo piso (1 disco = 8 cm, 2 = 13, 3 = 20),
   * no tartas apiladas.
   */
  tierId?: string;
  discId?: string;
  /** Toppings elegidos: van POR ENCIMA y se ven. */
  toppingIds?: string[];
  /** El extra «Toppers de 6 figuras»: figuritas de pie sobre la tarta. */
  figurineToppers?: boolean;
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
  tierId?: unknown;
  discId?: unknown;
  toppingIds?: unknown;
  figurineToppers?: unknown;
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

  // Lo nuevo también sale de listas cerradas del catálogo: nada de esto lo
  // escribe el cliente, así que no amplía la superficie de lo que se le puede
  // colar al modelo. Lo que no se reconozca, se ignora en vez de fallar: un
  // id viejo no puede dejar sin generar a nadie.
  const tierId =
    typeof raw.tierId === "string" && raw.tierId in PERSONAS_POR_TAMANO ? raw.tierId : undefined;
  const discId =
    typeof raw.discId === "string" && raw.discId in ALTURA_POR_DISCO ? raw.discId : undefined;
  const toppingIds = Array.isArray(raw.toppingIds)
    ? raw.toppingIds.filter((id): id is string => typeof id === "string" && id in TOPPINGS_PARA_LA_IA)
    : [];

  return {
    ok: true,
    options: {
      finish,
      colourIds,
      detail,
      tierId,
      discId,
      toppingIds,
      figurineToppers: raw.figurineToppers === true,
    },
  };
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
  "La tarta debe ser ARTESANAL Y ALCANZABLE: decoración sencilla hecha a mano, del nivel de una pastelería de barrio.",
  "MUY IMPORTANTE: es UNA tarta REDONDA de UN SOLO PISO, salvo que la descripción diga otra cosa. NUNCA apiles tartas ni hagas pisos escalonados por tu cuenta.",
  "La altura y el diámetro te los da la descripción: respétalos, son los que ha encargado el cliente.",
  "Nada de tartas de concurso, esculturas de azúcar, pisos imposibles, purpurina irreal ni acabados industriales.",
  "NO escribas ningún texto, letra, número ni firma sobre la tarta ni en la imagen.",
  "Si la descripción pide una dedicatoria, coloca en su lugar una placa lisa de chocolate blanco EN BLANCO, sin nada escrito.",
  "Las fotografías de referencia son SOLO para el estilo: la textura de la crema, el nivel de acabado y el aire artesanal.",
  "NO las copies: no reproduzcas su fondo, su decoración, sus colores, su composición ni los adornos que lleven encima.",
  "El fondo debe ser neutro y sencillo, de estudio: nunca el interior de una tienda.",
  "Si alguna referencia lleva un cartel, un topper o letras, IGNÓRALO: en tu imagen no puede aparecer texto de ninguna clase.",
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

/**
 * La forma de la tarta: un solo piso, con su altura y su diámetro.
 *
 * Se dice en centímetros y en personas porque el modelo entiende mucho mejor
 * «12 cm de alto» que «2 discos», y porque «disco» en una pastelería es una
 * capa de bizcocho, no un piso: traducirlo mal era justo lo que hacía que
 * saliera una tarta de dos pisos cuando se pedía la más pequeña.
 */
function describeArquitectura(options: AiPreviewOptions): string {
  const alto = options.discId ? ALTURA_POR_DISCO[options.discId] : undefined;
  const personas = options.tierId ? PERSONAS_POR_TAMANO[options.tierId] : undefined;
  if (!alto && !personas) return "";
  const partes = ["UNA sola tarta redonda de UN SOLO PISO"];
  if (alto) partes.push(`de unos ${alto} cm de alto`);
  if (personas) partes.push(`y del tamaño de una tarta para ${personas} personas`);
  return `${partes.join(" ")}.`;
}

/** Los toppings van por encima y SE VEN: si se piden fresas, hay fresas. */
function describeToppings(toppingIds: string[] | undefined): string {
  if (!toppingIds || toppingIds.length === 0) return "";
  const nombres = toppingIds
    .map((id) => TOPPINGS_PARA_LA_IA[id])
    .filter((n): n is string => Boolean(n));
  if (nombres.length === 0) return "";
  return `Por encima lleva, bien visible: ${nombres.join(", ")}.`;
}

/** El texto que se envía al modelo para la PRIMERA generación. */
export function buildImagePrompt(options: AiPreviewOptions): string {
  const finish = CAKE_FINISHES.find((f) => f.id === options.finish)!;
  const partes = [
    describeArquitectura(options),
    `Acabado: ${finish.prompt}.`,
    describeColours(options.colourIds),
    describeToppings(options.toppingIds),
  ];
  if (options.figurineToppers) {
    partes.push("Lleva seis figuritas decorativas de pie sobre la tarta.");
  }
  // El bizcocho y el relleno NO se mandan a propósito: van por dentro y no se
  // ven en una foto. Lo dijo la propia Dulce Flor al probarlo.
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
