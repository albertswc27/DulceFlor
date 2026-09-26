/**
 * Consulta de la ficha pública de un pedido.
 *
 * Es lo que abre el cliente desde el enlace del SMS. No hay sesión ni login:
 * lo único que autoriza la consulta es el token secreto del enlace, así que
 * el servidor NUNCA devuelve la tabla de pedidos, sino una función que
 * entrega solo los campos de la ficha (ver supabase/schema.sql).
 *
 * Por eso aquí no se puede usar `from("orders").select()`: esa consulta la
 * rechaza la seguridad por fila para quien no ha iniciado sesión, y hace bien.
 */
import { isOrderToken } from "@/domain/orderId";
import type { FulfillmentType, OrderStatus } from "@/domain/types";
import { normalizeOrderStatus } from "@/domain/types";
import { getSupabase, isSupabaseConfigured } from "./supabase";

/** Lo que ve el cliente en su ficha. Deliberadamente corto: ni teléfono, ni
 *  dirección de otros, ni notas internas. Solo lo que necesita para recoger. */
export interface PublicOrderView {
  publicId: string;
  customerName: string;
  /** ISO de cuando se hizo el pedido. */
  createdAt: string;
  /** "yyyy-MM-dd" de recogida o entrega. */
  requestedDate: string;
  /** "HH:MM". */
  requestedTime: string;
  fulfillmentType: FulfillmentType;
  status: OrderStatus;
  /** Descripción corta de cada artículo, ya resumida por el servidor. */
  items: Array<{ name: string; quantity: number; detail: string }>;
  /** null mientras el pedido esté pendiente de presupuesto. */
  totalCents: number | null;
  /** Señal ya cobrada, 0 si no hubo. */
  depositPaidCents: number;
  /** Lo que queda por pagar al recoger. null si el total aún no es firme. */
  balanceDueCents: number | null;
  urgent: boolean;
}

export type PublicOrderResult =
  | { state: "ok"; order: PublicOrderView }
  | { state: "not-found" }
  | { state: "unavailable"; message: string };

/**
 * Traduce la fila que devuelve la función de Postgres. Se valida campo a
 * campo: si el servidor cambiara de forma, es preferible decir «no
 * disponible» que pintar una ficha con huecos o con `undefined`.
 */
function parseRow(row: unknown): PublicOrderView | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.public_id !== "string" || typeof r.customer_name !== "string") return null;
  if (typeof r.requested_date !== "string" || typeof r.requested_time !== "string") return null;

  const rawItems = Array.isArray(r.items) ? r.items : [];
  const items = rawItems
    .map((item) => {
      const i = item as Record<string, unknown>;
      if (typeof i?.name !== "string") return null;
      return {
        name: i.name,
        quantity: typeof i.quantity === "number" ? i.quantity : 1,
        detail: typeof i.detail === "string" ? i.detail : "",
      };
    })
    .filter((i): i is PublicOrderView["items"][number] => i !== null);

  const numberOrNull = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  return {
    publicId: r.public_id,
    customerName: r.customer_name,
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
    requestedDate: r.requested_date,
    requestedTime: r.requested_time,
    fulfillmentType: r.fulfillment_type === "delivery" ? "delivery" : "pickup",
    status: normalizeOrderStatus(typeof r.status === "string" ? r.status : "pending"),
    items,
    totalCents: numberOrNull(r.total_cents),
    depositPaidCents: numberOrNull(r.deposit_paid_cents) ?? 0,
    balanceDueCents: numberOrNull(r.balance_due_cents),
    urgent: r.urgent === true,
  };
}

/**
 * Busca la ficha de un pedido por su token. Distingue «no existe» de «ahora
 * mismo no se puede consultar»: al cliente no se le puede decir que su pedido
 * no existe solo porque se haya caído la conexión.
 */
export async function fetchPublicOrder(token: string): Promise<PublicOrderResult> {
  // Un token con forma inválida no llega ni a salir del navegador: evita
  // convertir la barra de direcciones en un sondeo contra la base de datos.
  if (!isOrderToken(token)) return { state: "not-found" };

  if (!isSupabaseConfigured()) {
    return {
      state: "unavailable",
      message: "Esta web todavía no tiene activada la consulta de pedidos en línea.",
    };
  }

  const supabase = await getSupabase();
  if (!supabase) {
    return { state: "unavailable", message: "No se ha podido conectar con el servidor." };
  }

  try {
    const { data, error } = await supabase.rpc("get_order_card", {
      p_token: token,
    });
    if (error) {
      return {
        state: "unavailable",
        message: "No se ha podido consultar el pedido en este momento.",
      };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { state: "not-found" };
    const parsed = parseRow(row);
    if (!parsed) return { state: "not-found" };
    return { state: "ok", order: parsed };
  } catch {
    return {
      state: "unavailable",
      message: "No se ha podido conectar con el servidor. Comprueba tu conexión.",
    };
  }
}

/** URL absoluta de la ficha, que es lo que viaja dentro del SMS. */
export function buildPublicOrderUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/mi-pedido/${token}`;
}
