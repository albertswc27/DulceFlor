/**
 * Dominio del SMS de aviso al cliente.
 *
 * Aquí NO se envía nada: se decide a qué número se envía, qué dice el mensaje
 * y cuánto va a costar. El envío vive en la función serverless (`api/`), que
 * es la única que conoce las claves del proveedor.
 *
 * Todo lo de este fichero se comparte entre el navegador y el servidor, así
 * que no puede depender de `window` ni de `process`.
 */

/**
 * Prefijo internacional por defecto. Los clientes de Dulce Flor escriben su
 * móvil «a la española» (600 000 000) y esperan que funcione; un número de
 * nueve dígitos sin prefijo es, en la práctica, español.
 */
export const DEFAULT_COUNTRY_CODE = "34";

/** Longitud de un móvil español sin prefijo. */
const SPANISH_NATIONAL_LENGTH = 9;

export type PhoneProblem =
  | "vacio"
  | "demasiado-corto"
  | "demasiado-largo"
  | "no-es-movil";

export const PHONE_PROBLEM_MESSAGES: Record<PhoneProblem, string> = {
  vacio: "El pedido no tiene teléfono al que enviar el aviso.",
  "demasiado-corto": "El teléfono tiene menos dígitos de los necesarios.",
  "demasiado-largo": "El teléfono tiene más dígitos de los que admite un número internacional.",
  "no-es-movil":
    "El número no parece un móvil español (los móviles empiezan por 6 o 7), así que no le llegaría un SMS.",
};

export type PhoneResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; problem: PhoneProblem };

/**
 * Normaliza un teléfono al formato E.164 (`+34600111222`), que es lo único
 * que aceptan sin discutir las pasarelas de SMS.
 *
 * Acepta lo que la gente escribe de verdad: espacios, guiones, paréntesis,
 * `+34`, `0034` y `34` delante. Lo que NO hace es adivinar países: un número
 * de nueve dígitos se asume español y cualquier otro debe traer su prefijo.
 */
export function toE164(raw: string | undefined | null): PhoneResult {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 0) return { ok: false, problem: "vacio" };

  // «0034…» y «+34…» acaban en la misma cifra: se quita el prefijo de salida
  // internacional para quedarnos siempre con país + número nacional.
  let normalized = digits;
  if (normalized.startsWith("00")) normalized = normalized.slice(2);

  // Sin prefijo de país: se asume España.
  if (normalized.length === SPANISH_NATIONAL_LENGTH) {
    normalized = `${DEFAULT_COUNTRY_CODE}${normalized}`;
  }

  if (normalized.length < 11) return { ok: false, problem: "demasiado-corto" };
  // E.164 admite 15 dígitos como máximo, prefijo de país incluido.
  if (normalized.length > 15) return { ok: false, problem: "demasiado-largo" };

  const national = normalized.startsWith(DEFAULT_COUNTRY_CODE)
    ? normalized.slice(DEFAULT_COUNTRY_CODE.length)
    : null;

  // Solo se comprueba la numeración española, que es la que conocemos: los
  // móviles empiezan por 6 o 7. Un fijo no recibe SMS y avisarlo aquí evita
  // pagar un envío que nunca llega.
  if (national !== null) {
    if (national.length !== SPANISH_NATIONAL_LENGTH) {
      return {
        ok: false,
        problem: national.length < SPANISH_NATIONAL_LENGTH ? "demasiado-corto" : "demasiado-largo",
      };
    }
    if (!/^[67]/.test(national)) return { ok: false, problem: "no-es-movil" };
  }

  return { ok: true, e164: `+${normalized}`, national: national ?? normalized };
}

/* ------------------------------------------------------------------ */
/* Coste: cuántos SMS se pagan de verdad                               */
/* ------------------------------------------------------------------ */

/**
 * Caracteres del alfabeto GSM 03.38, el único que cabe a 160 por SMS.
 * Cualquier letra fuera de esta lista (una emoji, una comilla tipográfica)
 * convierte el mensaje entero a Unicode y lo deja en 70 caracteres por SMS:
 * un acento de más puede duplicar la factura.
 */
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

/**
 * Estos sí están en GSM-7, pero ocupan dos caracteres (van precedidos de una
 * secuencia de escape). Se listan uno a uno, sin escapes de cadena, para que
 * se vea exactamente qué caracteres son: ^ { } \ [ ~ ] | €
 */
const GSM7_EXTENDED = ["^", "{", "}", "\\", "[", "~", "]", "|", "€"];

export type SmsEncoding = "gsm7" | "unicode";

export interface SmsCost {
  encoding: SmsEncoding;
  /** Longitud contada como la cuenta el operador (los extendidos valen 2). */
  length: number;
  /** Nº de SMS que se facturan. */
  segments: number;
  /** Caracteres que aún caben sin pasar al siguiente SMS. */
  remaining: number;
  /** Caracteres no representables en GSM-7 que obligan a Unicode. */
  offenders: string[];
}

/**
 * Cuántos SMS cuesta un texto. Se usa en el panel para que Dulce Flor vea
 * antes de enviar si un mensaje se le ha ido a dos SMS, y en las pruebas para
 * que un cambio de redacción no duplique el coste sin que nadie se entere.
 */
export function measureSms(text: string): SmsCost {
  let length = 0;
  const offenders: string[] = [];

  for (const char of text) {
    if (GSM7_BASIC.includes(char)) {
      length += 1;
    } else if (GSM7_EXTENDED.includes(char)) {
      length += 2;
    } else {
      if (!offenders.includes(char)) offenders.push(char);
      length += 1;
    }
  }

  if (offenders.length > 0) {
    // En Unicode cada carácter ocupa 2 bytes y la cuenta se hace en unidades
    // UTF-16, no en «caracteres»: un emoji fuera del plano básico vale 2.
    const units = [...text].reduce((sum, c) => sum + (c.codePointAt(0)! > 0xffff ? 2 : 1), 0);
    const perSegment = units <= 70 ? 70 : 67;
    const segments = Math.max(1, Math.ceil(units / perSegment));
    return {
      encoding: "unicode",
      length: units,
      segments,
      remaining: segments * perSegment - units,
      offenders,
    };
  }

  const perSegment = length <= 160 ? 160 : 153;
  const segments = Math.max(1, Math.ceil(length / perSegment));
  return {
    encoding: "gsm7",
    length,
    segments,
    remaining: segments * perSegment - length,
    offenders: [],
  };
}

/* ------------------------------------------------------------------ */
/* El texto que recibe el cliente                                      */
/* ------------------------------------------------------------------ */

/** Lo mínimo que hace falta del pedido para redactar el aviso. */
export interface SmsOrderSummary {
  publicId: string;
  customerName: string;
  /** "yyyy-MM-dd" */
  requestedDate: string;
  /** "HH:MM" */
  requestedTime: string;
  fulfillmentType: "pickup" | "delivery";
}

/** "2026-09-24" → "24/09". El año se omite: nadie recoge una tarta a un año vista. */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

/**
 * Nombre de pila, recortado. Un nombre muy largo se comería el presupuesto de
 * caracteres y empujaría el mensaje a un segundo SMS de pago; doce caracteres
 * cubren de sobra cualquier nombre de pila español real.
 */
const MAX_FIRST_NAME = 12;

function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  // Se recorta por PUNTOS DE CÓDIGO, no con slice. Un slice parte por la mitad
  // los caracteres que ocupan dos unidades (una emoji pegada al nombre, y pasa)
  // y deja una cadena mal formada que el proveedor rechaza por «caracteres no
  // válidos»: el aviso no saldría y nadie sabría por qué.
  return [...first].slice(0, MAX_FIRST_NAME).join("");
}

/**
 * Texto del SMS de «pedido tramitado».
 *
 * Está escrito para caber en UN solo SMS (160 caracteres GSM-7), porque cada
 * segmento se factura aparte. Eso impone dos reglas que conviene no olvidar al
 * retocar la redacción:
 *
 *  1. Nada de á, í, ó ni ú: NO están en el alfabeto GSM-7 y una sola de ellas
 *     convierte el mensaje a Unicode, que son 70 caracteres por segmento. Sí se
 *     pueden usar é, à, ñ, ü, ¡ y ¿. Por eso dice «esta tramitado» sin tilde:
 *     no es una errata.
 *  2. El detalle (importe, señal, condiciones de recogida) NO va aquí, va en la
 *     ficha del enlace. El SMS solo tiene que conseguir que la abran.
 *
 * El nombre del cliente es la única parte que no controlamos: «Sofía» o «Jesús»
 * llevan tilde prohibida y duplican el coste de ese envío concreto. Se asume a
 * propósito —son céntimos y el saludo personal lo pidió el negocio—, y el panel
 * enseña el coste real antes de enviar para que nunca sea una sorpresa.
 */
export function buildOrderStatusSms(order: SmsOrderSummary, url: string): string {
  const cuando = `${shortDate(order.requestedDate)} ${order.requestedTime}`;
  const verbo = order.fulfillmentType === "delivery" ? "Entrega" : "Recogida";
  return toGsm7Friendly(
    `Dulce Flor: ${firstName(order.customerName)}, pedido ${order.publicId} ` +
      `tramitado. ${verbo} ${cuando}. Detalles: ${url}`
  );
}

/**
 * Deja un texto dentro del alfabeto GSM-7 cambiando lo que tiene equivalente
 * evidente (comillas y guiones tipográficos, puntos suspensivos). NO quita
 * acentos: «Ana» y «Andrés» son nombres de personas y escribirlos mal para
 * ahorrar un céntimo no compensa.
 */
export function toGsm7Friendly(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}
