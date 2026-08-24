/**
 * CONFIGURACIÓN CENTRAL DEL NEGOCIO — única fuente de verdad para reglas cambiantes.
 *
 * Confirmado por Dulce Flor por WhatsApp (17/08/2026):
 *   - Antelación mínima: 3 días («Mínimo 3 días»).
 *   - Horario: 10:00–22:00 («Hacemos de 10am hasta las 10pm»); no indicaron
 *     días de cierre, se asume abierto todos los días hasta que digan lo contrario.
 *
 * Confirmado por Dulce Flor (18/08/2026): dirección de la tienda, zonas de
 * entrega tal como estaban, y fuera de Barcelona los gastos de envío se
 * calculan según distancia (se confirman por WhatsApp).
 * Ver docs/business-rules.md para el detalle completo.
 */

/** Precio de cada topping añadido. Actualizado por el cliente (2ª revisión): +2,50 €. */
export const TOPPING_PRICE_CENTS = 250;

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

/** Confirmado (17/08/2026): mínimo 3 días de antelación. */
export const MIN_ORDER_LEAD_TIME_HOURS = 72;

/** Intervalo entre horas seleccionables. */
export const SLOT_INTERVAL_MINUTES = 30;

/**
 * Dos teléfonos con funciones distintas (confirmado 24/08/2026):
 * los pedidos entran por WhatsApp y las llamadas las atiende otra persona.
 * No mezclarlos: llamar al de WhatsApp no garantiza respuesta.
 */
export const WHATSAPP_PHONE = "34624213113";
export const WHATSAPP_PHONE_DISPLAY = "+34 624 21 31 13";

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
 * Horario confirmado por Dulce Flor (17/08/2026): 10:00–22:00.
 * No indicaron días de cierre → abierto todos los días hasta nuevo aviso.
 * Clave: día de la semana según Date.getDay() (0 = domingo … 6 = sábado).
 * Un array vacío significa cerrado todo el día.
 */
const DAILY_HOURS: TimeWindow[] = [{ start: "10:00", end: "22:00" }];

export const BUSINESS_HOURS: Record<number, TimeWindow[]> = {
  0: DAILY_HOURS,
  1: DAILY_HOURS,
  2: DAILY_HOURS,
  3: DAILY_HOURS,
  4: DAILY_HOURS,
  5: DAILY_HOURS,
  6: DAILY_HOURS,
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
  /** "¿Quieres añadir una dedicatoria o mensaje especial? Se cobrará 2 € más" */
  DEDICATION_PRICE_CENTS: 200,
  /** "Imágenes con papel comestible — 7 €" (carta de tres leches) */
  EDIBLE_PAPER_PRICE_CENTS: 700,
} as const;
