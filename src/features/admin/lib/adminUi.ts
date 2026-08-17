/**
 * Utilidades de presentación compartidas por las pantallas de administración.
 * Solo formato/estilo: la lógica de negocio vive en src/domain.
 */
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { BadgeProps } from "@/components/ui/badge";
import type { OrderStatus } from "@/domain/types";

/** Color del badge por estado del pedido. */
export const STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  NonNullable<BadgeProps["variant"]>
> = {
  pending: "warning",
  confirmed: "secondary",
  in_preparation: "accent",
  ready: "success",
  completed: "outline",
  cancelled: "destructive",
};

/** Orden natural de los estados para selects y botoneras. */
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  "pending",
  "confirmed",
  "in_preparation",
  "ready",
  "completed",
  "cancelled",
];

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
 * Enlace wa.me hacia el teléfono de un cliente. Se normaliza el número:
 * solo dígitos, sin el prefijo internacional "00" (wa.me no lo admite) y,
 * si quedan 9 dígitos, se asume prefijo de España (+34).
 */
export function waUrlForPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9) digits = `34${digits}`;
  return `https://wa.me/${digits}`;
}

/** Clases para <select> nativos coherentes con el componente Input. */
export const SELECT_CLASS =
  "flex h-11 w-full appearance-none rounded-lg border border-input bg-card px-3 py-2 text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";
