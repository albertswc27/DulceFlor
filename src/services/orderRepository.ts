/**
 * Capa de persistencia de pedidos.
 *
 * POC: implementación sobre localStorage detrás de una interfaz estrecha
 * (OrderRepository) para poder sustituirla por un backend real (Supabase,
 * Firebase, API propia…) sin tocar UI ni dominio. Limitaciones documentadas
 * en docs/architecture.md: los datos viven solo en el navegador/dispositivo
 * donde se crean.
 */
import { formatPublicOrderId, newInternalId } from "@/domain/orderId";
import type { Order, OrderStatus } from "@/domain/types";

export interface OrderRepository {
  create(draft: Omit<Order, "id" | "publicId" | "createdAt" | "status">): Order;
  list(): Order[];
  getById(id: string): Order | undefined;
  updateStatus(id: string, status: OrderStatus): Order | undefined;
}

const ORDERS_KEY = "dulce-flor:orders";
const SEQ_KEY_PREFIX = "dulce-flor:order-seq:";

/**
 * Comprobación estructural mínima: un registro corrupto o de un esquema
 * antiguo se descarta en la lectura para no tumbar el panel de administración.
 */
function isOrderShape(value: unknown): value is Order {
  const o = value as Order;
  return Boolean(
    o &&
      typeof o === "object" &&
      typeof o.id === "string" &&
      typeof o.publicId === "string" &&
      typeof o.createdAt === "string" &&
      typeof o.status === "string" &&
      Array.isArray(o.items) &&
      o.items.every((i) => i && typeof i === "object" && typeof i.productName === "string") &&
      o.pricing &&
      typeof o.pricing.totalCents === "number" &&
      o.customer &&
      typeof o.customer.name === "string"
  );
}

function readOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isOrderShape) : [];
  } catch {
    return [];
  }
}

function writeOrders(orders: Order[]): void {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function nextSequence(year: number): number {
  const key = `${SEQ_KEY_PREFIX}${year}`;
  const current = Number(localStorage.getItem(key) ?? "0");
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return next;
}

class LocalStorageOrderRepository implements OrderRepository {
  create(draft: Omit<Order, "id" | "publicId" | "createdAt" | "status">): Order {
    const orders = readOrders();

    // Idempotencia: si el usuario reintenta (doble clic, volver atrás),
    // devolvemos el pedido ya registrado en lugar de duplicarlo.
    const existing = orders.find((o) => o.clientRequestId === draft.clientRequestId);
    if (existing) return existing;

    const now = new Date();
    const order: Order = {
      ...draft,
      id: newInternalId(),
      publicId: formatPublicOrderId(now.getFullYear(), nextSequence(now.getFullYear())),
      createdAt: now.toISOString(),
      status: "pending",
    };
    orders.push(order);
    writeOrders(orders);
    return order;
  }

  list(): Order[] {
    return readOrders().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getById(id: string): Order | undefined {
    return readOrders().find((o) => o.id === id);
  }

  updateStatus(id: string, status: OrderStatus): Order | undefined {
    const orders = readOrders();
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) return undefined;
    orders[index] = { ...orders[index], status };
    writeOrders(orders);
    return orders[index];
  }
}

export const orderRepository: OrderRepository = new LocalStorageOrderRepository();
