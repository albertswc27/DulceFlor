/**
 * Datos para el aviso legal y la política de privacidad.
 *
 * ⚠️ PENDIENTE ANTES DE PUBLICAR EN DOMINIO PROPIO: rellenar `holderName` y
 * `holderTaxId` con los datos definitivos del titular (autónomo). Dulce Flor
 * los facilitó por WhatsApp, pero envió dos variantes del número de documento,
 * así que hay que confirmar cuál es el correcto. Mientras estén vacíos, las
 * páginas legales muestran un aviso claro en lugar de inventar el dato.
 *
 * Este repositorio es público: no escribas aquí el documento de identidad
 * hasta que el proyecto tenga un repositorio privado o se cargue desde una
 * variable de entorno (import.meta.env.VITE_LEGAL_TAX_ID).
 */
import {
  BUSINESS_ADDRESS,
  PHONE_CALLS_DISPLAY,
  WHATSAPP_PHONE_DISPLAY,
} from "./business";

export const LEGAL = {
  /** Nombre comercial con el que opera el negocio. */
  tradeName: "Dulce Flor Repostería Casera",
  /** Titular (autónomo). Vacío = pendiente de confirmar. */
  holderName: (import.meta.env.VITE_LEGAL_HOLDER as string | undefined) ?? "",
  /** NIF/DNI del titular. Vacío = pendiente de confirmar. */
  holderTaxId: (import.meta.env.VITE_LEGAL_TAX_ID as string | undefined) ?? "",
  address: `${BUSINESS_ADDRESS.street}, ${BUSINESS_ADDRESS.postalCode} ${BUSINESS_ADDRESS.city} (${BUSINESS_ADDRESS.province})`,
  contactPhone: WHATSAPP_PHONE_DISPLAY,
  /** Teléfono de llamadas, distinto del de WhatsApp. */
  contactPhoneCalls: PHONE_CALLS_DISPLAY,
  /** Última revisión de los textos legales. */
  lastUpdated: "22 de agosto de 2026",
} as const;

/**
 * true mientras falten los datos fiscales. La página legal omite esas líneas
 * en lugar de mostrar «pendiente de confirmación» al visitante; este indicador
 * queda disponible para avisos internos o comprobaciones de despliegue.
 */
export const LEGAL_DATA_PENDING = !LEGAL.holderName || !LEGAL.holderTaxId;
