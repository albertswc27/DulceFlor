/**
 * Capa de persistencia de pedidos.
 *
 * Funciona en dos capas, y el orden importa:
 *
 *  1. **localStorage**, siempre. Crear un pedido es una escritura local
 *     inmediata y síncrona. Esto no es un resto del pasado: es lo que hace
 *     que el pedido no se pierda si el móvil no tiene cobertura al pulsar
 *     «Enviar», y lo que permite abrir WhatsApp dentro del gesto del usuario
 *     (si hubiera un `await` por medio, el navegador bloquearía la ventana).
 *
 *  2. **Supabase**, cuando está configurado. El pedido se sube en segundo
 *     plano y queda disponible para el panel desde cualquier dispositivo, que
 *     es justo lo que no ocurría antes: un pedido hecho desde el móvil de un
 *     cliente nunca llegaba a la tienda.
 *
 * Si Supabase no está configurado, todo sigue funcionando como antes, solo
 * que los pedidos no salen del dispositivo. Ver docs/setup.md.
 *
 * Lo que no se sube nunca son las imágenes de referencia: pesan y viven en su
 * propio almacén local (`imageStore`). El pedido solo lleva su identificador.
 */
import { newInternalId, newPublicOrderId } from "@/domain/orderId";
import { computeOrderPricing } from "@/domain/pricing";
import type { Order, OrderStatus } from "@/domain/types";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export interface OrderRepository {
  create(draft: Omit<Order, "id" | "publicId" | "createdAt" | "status">): Order;
  list(): Order[];
  getById(id: string): Order | undefined;
  updateStatus(id: string, status: OrderStatus): Order | undefined;
  /**
   * Introduce el presupuesto manual de un pedido con artículos de fondant y
   * recalcula el total y la señal desde el motor de dominio.
   */
  setQuotedPrice(id: string, quotedPriceCents: number): Order | undefined;
  /**
   * Sube lo que quedó pendiente y baja lo que hay en la base compartida.
   * Devuelve el listado ya combinado. Sin Supabase, devuelve lo local.
   */
  sync(): Promise<{ orders: Order[]; error: string | null }>;
}

const ORDERS_KEY = "dulce-flor:orders";
/** Ids de pedidos creados o modificados que aún no han llegado al servidor. */
const PENDING_KEY = "dulce-flor:orders-pending";

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

/**
 * Crear y modificar no son la misma operación contra el servidor, y no da
 * igual cuál se reintente:
 *
 *  - Un pedido nuevo lo sube el cliente, que va como "anon" y SOLO tiene
 *    permiso de INSERT. Si el reintento se hiciera como upsert, al chocar con
 *    la fila ya subida intentaría un UPDATE y el servidor lo rechazaría, así
 *    que el pedido se quedaría reintentando para siempre.
 *  - Un cambio de estado lo hace el panel, ya con sesión iniciada, y sí puede
 *    actualizar.
 *
 * Por eso la cola guarda qué hay que hacer con cada pedido, no solo su id.
 */
type PendingKind = "create" | "update";

function readPending(): Map<string, PendingKind> {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    // Formato antiguo (solo ids): se asume creación, que es lo único que
    // podía haber quedado pendiente en un dispositivo de cliente.
    if (Array.isArray(parsed)) {
      return new Map(parsed.filter((x) => typeof x === "string").map((id) => [id, "create"]));
    }
    if (parsed && typeof parsed === "object") {
      return new Map(
        Object.entries(parsed as Record<string, string>).filter(
          (entry): entry is [string, PendingKind] =>
            entry[1] === "create" || entry[1] === "update"
        )
      );
    }
    return new Map();
  } catch {
    return new Map();
  }
}

function writePending(pending: Map<string, PendingKind>): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(Object.fromEntries(pending)));
  } catch {
    // Sin espacio: el pedido ya está guardado, solo se pierde el reintento.
  }
}

function markPending(id: string, kind: PendingKind): void {
  const pending = readPending();
  // Si el pedido aún no ha llegado nunca al servidor, lo que toca sigue
  // siendo crearlo, aunque entretanto se le haya cambiado el estado.
  if (pending.get(id) === "create") return;
  pending.set(id, kind);
  writePending(pending);
}

function clearPending(id: string): void {
  const pending = readPending();
  if (pending.delete(id)) writePending(pending);
}

/* ------------------------------------------------------------------ */
/* Traducción entre el pedido del dominio y la fila de la base          */
/* ------------------------------------------------------------------ */

export interface OrderRow {
  id: string;
  public_id: string;
  created_at: string;
  status: string;
  customer_type: string;
  fulfillment_type: string;
  requested_date: string;
  requested_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  payload: Record<string, unknown>;
}

/**
 * Los campos que el panel filtra u ordena van en columnas propias; el resto
 * viaja en `payload`. Así se puede añadir una opción nueva al catálogo (velas,
 * bengalas, discos…) sin migrar la base de datos.
 */
export function toRow(order: Order): OrderRow {
  const { id, publicId, createdAt, status, customer, ...rest } = order;
  return {
    id,
    public_id: publicId,
    created_at: createdAt,
    status,
    customer_type: order.customerType,
    fulfillment_type: order.fulfillmentType,
    requested_date: order.requestedDate,
    requested_time: order.requestedTime,
    customer_name: customer.name,
    customer_phone: customer.phone,
    customer_email: customer.email ?? null,
    payload: { ...rest, customer } as unknown as Record<string, unknown>,
  };
}

export function fromRow(row: OrderRow): Order | null {
  const order = {
    ...(row.payload as unknown as Omit<Order, "id" | "publicId" | "createdAt" | "status">),
    id: row.id,
    publicId: row.public_id,
    createdAt: row.created_at,
    status: row.status as OrderStatus,
  } as Order;
  // Una fila escrita por una versión distinta de la web podría no encajar:
  // se descarta en vez de reventar el panel entero.
  return isOrderShape(order) ? order : null;
}

/** Mensaje corto y en cristiano para la interfaz. */
function describeError(error: unknown): string {
  const message = (error as { message?: string })?.message ?? String(error);
  if (/Failed to fetch|NetworkError|ERR_INTERNET/i.test(message)) {
    return "Sin conexión con el servidor de pedidos.";
  }
  if (/JWT|not authenticated|permission denied|row-level security/i.test(message)) {
    return "Tu sesión no tiene permiso para leer los pedidos. Vuelve a entrar.";
  }
  return message;
}

class OrderRepositoryImpl implements OrderRepository {
  create(draft: Omit<Order, "id" | "publicId" | "createdAt" | "status">): Order {
    const orders = readOrders();

    // Idempotencia: si el usuario reintenta (doble clic, volver atrás),
    // devolvemos el pedido ya registrado en lugar de duplicarlo.
    const existing = orders.find((o) => o.clientRequestId === draft.clientRequestId);
    if (existing) return existing;

    const now = new Date();
    // Las solicitudes con artículos de fondant nacen "pendiente de
    // presupuesto"; el resto, "pendiente de confirmación".
    const requiresQuote = draft.items.some((item) => item.requiresQuote);
    const order: Order = {
      ...draft,
      id: newInternalId(),
      publicId: newPublicOrderId(now.getFullYear()),
      createdAt: now.toISOString(),
      status: requiresQuote ? "pending_quote" : "pending",
    };
    orders.push(order);
    writeOrders(orders);

    // A partir de aquí el pedido ya está a salvo en el dispositivo. La subida
    // va suelta y sin esperar: si falla (sin cobertura, servidor caído), queda
    // marcada como pendiente y se reintenta en la siguiente sincronización.
    markPending(order.id, "create");
    void this.push(order, "create");

    return order;
  }

  list(): Order[] {
    return readOrders().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getById(id: string): Order | undefined {
    return readOrders().find((o) => o.id === id);
  }

  updateStatus(id: string, status: OrderStatus): Order | undefined {
    return this.mutate(id, (order) => ({ ...order, status }));
  }

  setQuotedPrice(id: string, quotedPriceCents: number): Order | undefined {
    return this.mutate(id, (order) => ({
      ...order,
      pricing: computeOrderPricing(
        order.items,
        order.pricing.deliveryFeeCents,
        quotedPriceCents
      ),
    }));
  }

  private mutate(id: string, change: (order: Order) => Order): Order | undefined {
    const orders = readOrders();
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) return undefined;
    const updated = change(orders[index]);
    orders[index] = updated;
    writeOrders(orders);
    markPending(updated.id, "update");
    void this.push(updated, readPending().get(updated.id) ?? "update");
    return updated;
  }

  /** Sube un pedido. Silencioso a propósito: el reintento lo hace `sync()`. */
  private async push(order: Order, kind: PendingKind): Promise<boolean> {
    const supabase = await getSupabase();
    if (!supabase) return false;
    try {
      const row = toRow(order);
      if (kind === "create") {
        // INSERT a secas: es lo único para lo que un cliente ("anon") tiene
        // permiso. NO se usa upsert con ignore-duplicates, que parece pensado
        // para esto pero por dentro necesita permiso de SELECT (comprobado
        // contra el servidor: da 401 para anon).
        const { error } = await supabase.from("orders").insert(row);
        // Si el pedido ya estaba subido (reintento de algo que sí llegó), el
        // servidor responde violación de unicidad: eso es éxito, no fallo.
        if (error && error.code !== "23505") return false;
      } else {
        const { error } = await supabase.from("orders").update(row).eq("id", order.id);
        if (error) return false;
      }
      clearPending(order.id);
      return true;
    } catch {
      return false;
    }
  }

  async sync(): Promise<{ orders: Order[]; error: string | null }> {
    if (!isSupabaseConfigured()) return { orders: this.list(), error: null };
    const supabase = await getSupabase();
    if (!supabase) return { orders: this.list(), error: null };

    // 1) Lo que quedó sin subir. Se hace antes de bajar para que un cambio de
    //    estado hecho sin conexión no lo pise la versión antigua del servidor.
    const pending = readPending();
    if (pending.size > 0) {
      const locals = new Map(readOrders().map((o) => [o.id, o]));
      for (const [id, kind] of pending) {
        const order = locals.get(id);
        // Un id pendiente que ya no existe en local no se puede subir nunca.
        if (!order) clearPending(id);
        else await this.push(order, kind);
      }
    }

    // 2) Bajamos todo y lo combinamos con lo local.
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return { orders: this.list(), error: describeError(error) };

      const remote = (data as OrderRow[]).map(fromRow).filter((o): o is Order => o !== null);
      const merged = new Map(readOrders().map((o) => [o.id, o]));
      for (const order of remote) {
        // Lo local manda solo si aún no se ha subido; si no, gana el servidor.
        if (!readPending().has(order.id)) merged.set(order.id, order);
      }
      const orders = [...merged.values()];
      writeOrders(orders);
      return {
        orders: orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        error: null,
      };
    } catch (error) {
      return { orders: this.list(), error: describeError(error) };
    }
  }
}

export const orderRepository: OrderRepository = new OrderRepositoryImpl();
