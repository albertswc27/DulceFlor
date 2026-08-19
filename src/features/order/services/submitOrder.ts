/**
 * Validación final y registro del pedido.
 * IMPORTANTE: el pedido se guarda en el sistema ANTES de abrir WhatsApp;
 * si WhatsApp no se abre, el pedido no se pierde.
 */
import { resolveDeliveryZone } from "@/domain/delivery";
import { isRequestedSlotValid } from "@/domain/schedule";
import { computeOrderPricing } from "@/domain/pricing";
import { addressSchema, customerSchema } from "@/domain/validation";
import type { Order } from "@/domain/types";
import { orderRepository } from "@/services/orderRepository";
import {
  toOrderItems,
  type OrderDraftDerived,
  type OrderDraftState,
} from "@/features/order/state/OrderDraftContext";

export type SubmitResult =
  | { ok: true; order: Order }
  | { ok: false; errors: string[] };

export function submitOrder(
  state: OrderDraftState,
  _derived: OrderDraftDerived,
  source: "web" | "kiosk" = "web"
): SubmitResult {
  const errors: string[] = [];

  if (!state.customerType) errors.push("Selecciona si el pedido es de particular o empresa.");
  if (state.items.length === 0) errors.push("Añade al menos un producto al pedido.");
  if (!state.fulfillmentType) errors.push("Elige recogida en tienda o entrega a domicilio.");

  const customerParsed = customerSchema.safeParse(state.customer ?? {});
  if (!customerParsed.success) {
    errors.push(...customerParsed.error.issues.map((i) => i.message));
  }

  if (state.fulfillmentType === "delivery") {
    const addressParsed = addressSchema.safeParse(state.address ?? {});
    if (!addressParsed.success) {
      errors.push(...addressParsed.error.issues.map((i) => i.message));
    }
  }

  if (!state.requestedDate || !state.requestedTime) {
    errors.push("Selecciona fecha y hora.");
  } else if (!isRequestedSlotValid(state.requestedDate, state.requestedTime)) {
    errors.push(
      "La fecha u hora seleccionada ya no está disponible (horario o antelación mínima). Vuelve a elegirla."
    );
  }

  // Los artículos se reconstruyen desde el catálogo: nunca se confía en
  // precios que pudieran llegar manipulados desde la UI.
  const orderItems = toOrderItems(state.items);
  if (orderItems.length !== state.items.length) {
    errors.push("Alguna combinación de producto ya no es válida. Revisa el pedido.");
  }

  if (errors.length > 0) return { ok: false, errors };

  // La zona y la tarifa se recalculan aquí desde la configuración (no desde la UI).
  const zoneResolution =
    state.fulfillmentType === "delivery" && state.address
      ? resolveDeliveryZone({
          municipality: state.address.municipality,
          postalCode: state.address.postalCode,
        })
      : null;

  const pricing = computeOrderPricing(
    orderItems,
    state.fulfillmentType === "delivery" ? (zoneResolution?.feeCents ?? null) : 0
  );

  const order = orderRepository.create({
    clientRequestId: state.clientRequestId,
    customerType: state.customerType!,
    customer: {
      name: state.customer!.name.trim(),
      phone: state.customer!.phone.trim(),
      email: state.customer!.email?.trim() || undefined,
      companyName:
        state.customerType === "business"
          ? state.customer!.companyName?.trim() || undefined
          : undefined,
    },
    items: orderItems,
    fulfillmentType: state.fulfillmentType!,
    address: state.fulfillmentType === "delivery" ? (state.address ?? undefined) : undefined,
    deliveryZoneId: zoneResolution?.zone?.id,
    deliveryZoneLabel: zoneResolution?.zone?.label,
    requestedDate: state.requestedDate!,
    requestedTime: state.requestedTime!,
    pricing,
    reusableTray:
      state.customerType === "business" && state.reusableTray ? true : undefined,
    source,
  });

  return { ok: true, order };
}
