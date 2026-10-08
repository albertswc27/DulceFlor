/**
 * CONFIGURACIÓN CENTRAL DEL NEGOCIO — única fuente de verdad para reglas cambiantes.
 *
 * Confirmado por Dulce Flor por WhatsApp (17/08/2026):
 *   - Antelación estándar: 3 días («Mínimo 3 días»). OJO: matizado el
 *     29/08/2026 — ya NO bloquea; con menos margen el pedido es URGENTE
 *     (ver STANDARD_ORDER_LEAD_TIME_DAYS más abajo).
 *   - Horario: ver BUSINESS_HOURS. ACTUALIZADO el 01/10/2026: cierran los
 *     lunes, martes a sábado 10:00–21:00 y domingos 11:00–20:00.
 *
 * Confirmado por Dulce Flor (18/08/2026): dirección de la tienda, zonas de
 * entrega tal como estaban, y fuera de Barcelona los gastos de envío se
 * calculan según distancia (se confirman por WhatsApp).
 *
 * Confirmado por Dulce Flor (29/08/2026): se puede reservar con meses de
 * antelación, y los pedidos con menos de 3 días se aceptan como urgentes a
 * confirmar por WhatsApp.
 * Ver docs/business-rules.md para el detalle completo.
 */

/** Precio de cada topping añadido. Actualizado por el cliente (2ª revisión): +2,50 €. */
export const TOPPING_PRICE_CENTS = 250;

/**
 * Suplemento de los sabores de bizcocho que NO van incluidos en el precio
 * (confirmado por Dulce Flor el 20/09/2026). Qué sabores son los incluidos se
 * define en el catálogo, no aquí: ver SPONGE_FLAVORS.
 */
export const SPONGE_FLAVOR_SURCHARGE_CENTS = 290;

/**
 * Suplemento de los rellenos que NO van incluidos en el precio (confirmado el
 * 20/09/2026). Los incluidos se marcan en CAKE_FILLINGS.
 */
export const CAKE_FILLING_SURCHARGE_CENTS = 250;

/**
 * Caja de transporte de las tartas.
 *
 * Dulce Flor pidió DOS cosas que parecen contradictorias y no lo son:
 *   1. Que el cliente tenga que MARCARLA para poder continuar, como la casilla
 *      obligatoria de un pedido de comida a domicilio («que te obligue a
 *      marcarlo»). Ver CAKE_BOX en el catálogo y la sección del configurador.
 *   2. Que su precio NO se vea en ninguna parte («sin necesidad de que
 *      aparezca el precio»): va sumado dentro del importe de la tarta, no como
 *      línea suelta del resumen. Ver getUnitBasePriceCents.
 *
 * Los aperitivos y los bocaditos pequeños no la llevan.
 *
 * Son 0,99 €, confirmado por Dulce Flor el 29/09/2026.
 *
 * NO LO CAMBIES a 1,99 € leyendo la transcripción automática del audio de
 * WhatsApp: ahí pone «le ponemos uno noventa y nueve, la caja», pero es un
 * error de la transcripción. Ya se cambió una vez por eso y hubo que
 * revertirlo. El precio acordado es 0,99 €.
 */
export const CAKE_BOX_PRICE_CENTS = 99;

/**
 * Suplemento por pedido urgente: menos de STANDARD_ORDER_LEAD_TIME_DAYS de
 * margen obliga a reorganizar el obrador (confirmado el 20/09/2026: 5 €).
 * Se aplica UNA vez por pedido, no por artículo.
 */
export const URGENT_ORDER_SURCHARGE_CENTS = 500;

/** Precio por vela (confirmado 23/08/2026): 1 € cada una. */
export const CANDLE_UNIT_PRICE_CENTS = 100;

/** Tope razonable de velas por tarta, para evitar cantidades absurdas. */
export const MAX_CANDLES = 50;

/**
 * Las velas son de números: el cliente compone la cifra que quiere ver en la
 * tarta (una edad, un aniversario). Seis dígitos cubren cualquier caso real
 * y evitan que alguien encargue una cifra interminable.
 */
export const MAX_CANDLE_DIGITS = 6;

/**
 * Acabado de los números (confirmado 24/08/2026): la misma cifra puede
 * montarse con velas normales o con bengalas, y la bengala cuesta más.
 * El precio por unidad depende del acabado, no de la cifra.
 */
export const NUMBER_SPARKLER_PRICE_CENTS = 200;

/** Bengala suelta, sin número. */
export const PLAIN_SPARKLER_PRICE_CENTS = 180;

/** Tope de bengalas sueltas por tarta. */
export const MAX_SPARKLERS = 20;

/** La paga y señal se exige cuando el total SUPERA este importe (> 40 €, no >=). */
export const DEPOSIT_THRESHOLD_CENTS = 4000;

/** Porcentaje de paga y señal sobre el total. */
export const DEPOSIT_PERCENTAGE = 30;

/**
 * Antelación estándar, en DÍAS NATURALES (confirmado 17/08/2026: «Mínimo 3
 * días»; matizado el 29/08/2026): ya NO bloquea el calendario. Un pedido para
 * antes de este plazo se acepta pero queda marcado como URGENTE y debe
 * confirmarse por WhatsApp con la tienda.
 *
 * Días naturales, y no 72 horas, desde el 29/09/2026. Antes se contaban horas
 * rodantes y eso hacía que el MISMO jueves saliera urgente o no según la hora
 * a la que se hiciera el pedido: pedir el lunes a las 9:00 para el jueves eran
 * 73 h (no urgente) y pedirlo el lunes a las 18:00 eran 64 h (urgente, +5 €).
 * Dulce Flor cuenta días de calendario —«hasta el segundo día urgente, el día
 * 3 ya no»— y tenía razón: la regla de antes era imposible de explicar en el
 * mostrador.
 *
 * Con 3: hoy, mañana y pasado son urgentes; el tercer día ya no.
 */
export const STANDARD_ORDER_LEAD_TIME_DAYS = 3;

/**
 * Colchón mínimo incluso para pedidos urgentes: nadie puede pedir algo «para
 * dentro de 10 minutos» desde la web (confirmado por Dulce Flor el
 * 30/08/2026). El equipo siempre puede atender en persona lo más inmediato.
 */
export const URGENT_MIN_LEAD_TIME_MINUTES = 60;

/**
 * Horizonte máximo de reserva. El 29/08/2026 Dulce Flor confirmó que hay
 * clientes que apartan tarta con meses de antelación (p. ej. para noviembre)
 * y dejó la cifra a nuestro criterio; los 6 meses quedaron confirmados el
 * 30/08/2026.
 */
export const MAX_ORDER_ADVANCE_MONTHS = 6;

/** Intervalo entre horas seleccionables. */
export const SLOT_INTERVAL_MINUTES = 30;

/**
 * Dos teléfonos con funciones distintas (confirmado 24/08/2026):
 * los pedidos entran por WhatsApp y las llamadas las atiende otra persona.
 * No mezclarlos: llamar al de WhatsApp no garantiza respuesta.
 *
 * El de WhatsApp cambió el 08/10/2026: hasta entonces era el número PERSONAL
 * de la propietaria y pidió quitarlo. De aquí salen el botón de contacto de
 * toda la web y el enlace que abre el pedido ya redactado, así que tocarlo
 * cambia a dónde llegan los pedidos: es la dirección del negocio, no un dato
 * decorativo.
 */
export const WHATSAPP_PHONE = "34604234518";
export const WHATSAPP_PHONE_DISPLAY = "+34 604 23 45 18";

/** Teléfono de atención telefónica (llamadas, no pedidos por escrito). */
export const PHONE_CALLS = "34614280430";
export const PHONE_CALLS_DISPLAY = "+34 614 280 430";

/** Dirección de la tienda (confirmada 18/08/2026). */
export const BUSINESS_ADDRESS = {
  street: "C. Ntra. Sra. de Montserrat, 13, bajos",
  postalCode: "08922",
  city: "Santa Coloma de Gramenet",
  province: "Barcelona",
} as const;

export const BUSINESS_ADDRESS_DISPLAY = `${BUSINESS_ADDRESS.street} · ${BUSINESS_ADDRESS.postalCode} ${BUSINESS_ADDRESS.city}`;

/** Enlace a Google Maps para la dirección de la tienda. */
export const BUSINESS_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${BUSINESS_ADDRESS.street}, ${BUSINESS_ADDRESS.postalCode} ${BUSINESS_ADDRESS.city}`
)}`;

/** Instagram oficial. */
export const INSTAGRAM_HANDLE = "@dulceflor.bcn";
export const INSTAGRAM_URL = "https://www.instagram.com/dulceflor.bcn";

export interface TimeWindow {
  /** "HH:MM" en hora local */
  start: string;
  end: string;
}

/**
 * Horario de la tienda, actualizado por Dulce Flor el 01/10/2026:
 * «cerramos los lunes y nuestro horario es de martes a sábados de 10am hasta
 * las 9pm y los domingos 11am hasta las 8pm».
 *
 * Hasta esa fecha figuraba 10:00–22:00 todos los días, que es lo que dijeron
 * en agosto. El calendario del pedido sale de aquí, así que esto es lo que
 * decide qué días y qué horas puede elegir un cliente: el lunes deja de
 * ofrecerse entero.
 *
 * Clave: día de la semana según Date.getDay() (0 = domingo … 6 = sábado).
 * Un array vacío significa cerrado todo el día.
 */
const DE_MARTES_A_SABADO: TimeWindow[] = [{ start: "10:00", end: "21:00" }];
const DOMINGO: TimeWindow[] = [{ start: "11:00", end: "20:00" }];
const CERRADO: TimeWindow[] = [];

export const BUSINESS_HOURS: Record<number, TimeWindow[]> = {
  0: DOMINGO,
  1: CERRADO, // lunes
  2: DE_MARTES_A_SABADO,
  3: DE_MARTES_A_SABADO,
  4: DE_MARTES_A_SABADO,
  5: DE_MARTES_A_SABADO,
  6: DE_MARTES_A_SABADO,
};

export interface DeliveryZone {
  id: string;
  label: string;
  /** null = fuera de zona automática → "Consultar disponibilidad de entrega". */
  feeCents: number | null;
  /** Nombres de municipio normalizados (minúsculas, sin acentos). */
  municipalities: string[];
  /** Rangos inclusivos de códigos postales [desde, hasta]. */
  postalCodeRanges: Array<[string, string]>;
}

/**
 * Zonas de entrega confirmadas por Dulce Flor (18/08/2026).
 * Fuera de estas zonas: gastos de envío según distancia, a confirmar por
 * WhatsApp (feeCents null → la UI lo comunica así).
 */
export const DELIVERY_ZONES: DeliveryZone[] = [
  {
    id: "zona-1",
    label: "Santa Coloma de Gramenet",
    feeCents: 0,
    municipalities: ["santa coloma de gramenet", "santa coloma"],
    postalCodeRanges: [["08921", "08924"]],
  },
  {
    id: "zona-2",
    label: "Badalona, Sant Adrià de Besòs y Montcada i Reixac",
    feeCents: 500,
    municipalities: [
      "badalona",
      "sant adria de besos",
      "sant adria del besos",
      "montcada i reixac",
      "montcada",
    ],
    postalCodeRanges: [
      ["08910", "08918"],
      ["08930", "08930"],
      ["08110", "08110"],
    ],
  },
  {
    id: "zona-3",
    label: "Barcelona ciudad",
    feeCents: 1000,
    municipalities: ["barcelona"],
    postalCodeRanges: [["08001", "08042"]],
  },
];

/**
 * Extras de personalización documentados en las cartas.
 * La disponibilidad por producto se define en el catálogo.
 */
export const EXTRAS = {
  /** Dedicatoria sobre la tarta. Actualizado por Dulce Flor (20/09/2026): 2,50 €. */
  DEDICATION_PRICE_CENTS: 250,
  /** Imagen impresa en papel comestible. Actualizado (20/09/2026): 8 €. */
  EDIBLE_PAPER_PRICE_CENTS: 800,
  /** Set de 6 figuras decorativas sobre la tarta. Nuevo extra (20/09/2026): 5 €. */
  CAKE_TOPPERS_PRICE_CENTS: 500,
} as const;

/**
 * Condiciones de recogida que Dulce Flor entrega hoy en papel al cliente.
 * Van en la confirmación digital y en el aviso que se envía al tramitar el
 * pedido, para que quede constancia de lo mismo que se dice en el mostrador.
 */
export const PICKUP_CONDITIONS: readonly string[] = [
  "Revisa el pedido antes de salir de la tienda: si algo no está como esperabas, lo solucionamos en el momento.",
  "Una vez retirado el pedido del establecimiento, Dulce Flor no se responsabiliza de los daños causados por el transporte, golpes o manipulación.",
  "Transporta la tarta en plano, en el suelo del coche y evitando el calor directo.",
];

/**
 * ¿Se le enseña a la clienta el generador de imágenes con IA?
 *
 * **Apagado por defecto, y a propósito.** Con `IA_PROVEEDOR=pruebas` el
 * servidor devuelve una de las fotos REALES de la tienda etiquetada como
 * «generada con IA», escriba lo que escriba la clienta. Eso vale para
 * revisar la interfaz, pero delante de un cliente de verdad es una función
 * que parece rota —pides un unicornio y sale una tarta de nata cualquiera— y
 * además pone una etiqueta falsa sobre una foto auténtica, que es justo lo
 * que todo el aparato legal de esta funcionalidad intenta evitar.
 *
 * Se enciende con `VITE_AI_PREVIEW=1` en Vercel, y solo cuando la clave de
 * Gemini tenga facturación: sin ella el modelo responde 0 peticiones al día.
 * Ver docs/ia-imagenes.md.
 */
export const AI_PREVIEW_ENABLED =
  (import.meta.env.VITE_AI_PREVIEW as string | undefined)?.trim() === "1";
