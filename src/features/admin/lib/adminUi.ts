/**
 * Utilidades de presentación compartidas por las pantallas de administración.
 * Solo formato/estilo: la lógica de negocio vive en src/domain.
 */
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { BadgeProps } from "@/components/ui/badge";
import type { OrderStatus } from "@/domain/types";
import { buildWhatsAppUrlForPhone } from "@/domain/whatsapp";

/** Color del badge por estado del pedido. */
export const STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  NonNullable<BadgeProps["variant"]>
> = {
  pending: "warning",
  pending_quote: "destructive",
  confirmed: "success",
  completed: "outline",
  cancelled: "destructive",
};

/**
 * Orden natural de los estados, para ordenar y listar: el recorrido real de un
 * pedido es pendiente → tramitado → finalizado (ver ORDER_STATUS_LABELS).
 */
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  "pending_quote",
  "pending",
  "confirmed",
  "completed",
  "cancelled",
];

/**
 * Lo que el panel ofrece PULSAR. Dos botones y no cinco, por petición expresa
 * de Dulce Flor (01/10/2026): «solo dos opciones, tramitado o finalizado».
 *
 * No es lo mismo que ORDER_STATUS_SEQUENCE a propósito. «Pendiente» y
 * «Pendiente de presupuesto» no se eligen: son el estado con el que NACE el
 * pedido según cómo se haya hecho, y ofrecerlos como botón solo invitaba a
 * retroceder sin motivo. Un pedido que esté en ellos los sigue mostrando.
 */
export const ORDER_STATUS_ACTIONS: OrderStatus[] = ["confirmed", "completed"];

/** "2026-08-17" → "domingo, 17 de agosto de 2026". */
export function formatRequestedDay(dateIso: string): string {
  return format(parseISO(dateIso), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
}

/** "2026-08-17" → "dom 17 ago". */
export function formatRequestedDayShort(dateIso: string): string {
  return format(parseISO(dateIso), "EEE d MMM", { locale: es });
}

/** ISO completo de creación → "17 ago 2026 · 12:30". */
export function formatCreatedAt(createdAtIso: string): string {
  return format(new Date(createdAtIso), "d MMM yyyy · HH:mm", { locale: es });
}

/**
 * Enlace wa.me hacia el teléfono de un cliente. La normalización del número
 * vive en el dominio para que el panel y los mensajes no diverjan.
 */
export function waUrlForPhone(phone: string): string {
  return buildWhatsAppUrlForPhone(phone);
}

/** Clases para <select> nativos coherentes con el componente Input. */
export const SELECT_CLASS =
  "flex h-11 w-full appearance-none rounded-lg border border-input bg-card px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";
