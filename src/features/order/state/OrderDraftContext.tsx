/**
 * Estado del borrador de pedido, compartido por el configurador público
 * y el kiosk de tienda. Toda la lógica de precios vive en src/domain.
 */
import * as React from "react";
import { z } from "zod";
import { resolveDeliveryZone } from "@/domain/delivery";
import { newInternalId } from "@/domain/orderId";
import {
  buildOrderItem,
  computeOrderPricing,
  type ItemSelection,
} from "@/domain/pricing";
import type {
  CustomerInfo,
  CustomerType,
  DeliveryAddress,
  FulfillmentType,
  ItemCustomization,
  OrderItem,
  OrderPricing,
} from "@/domain/types";
import { deleteImage, pruneImagesExcept } from "@/services/imageStore";
import { orderRepository } from "@/services/orderRepository";

export interface DraftItem {
  id: string;
  selection: ItemSelection;
  customization: ItemCustomization;
  quantity: number;
}

export interface OrderDraftState {
  customerType: CustomerType | null;
  items: DraftItem[];
  fulfillmentType: FulfillmentType | null;
  address: DeliveryAddress | null;
  requestedDate: string | null;
  requestedTime: string | null;
  customer: CustomerInfo | null;
  /** Solo empresas: entrega en fuente de cristal reutilizable (opcional). */
  reusableTray: boolean;
  /** Idempotencia del envío: estable hasta que el pedido se registra. */
  clientRequestId: string;
}

const initialState = (): OrderDraftState => ({
  customerType: null,
  items: [],
  fulfillmentType: null,
  address: null,
  requestedDate: null,
  requestedTime: null,
  customer: null,
  reusableTray: false,
  clientRequestId: newInternalId(),
});

type Action =
  | { type: "setCustomerType"; customerType: CustomerType }
  | { type: "addItem"; item: DraftItem }
  | { type: "updateItem"; item: DraftItem }
  | { type: "removeItem"; itemId: string }
  | { type: "setQuantity"; itemId: string; quantity: number }
  | { type: "setFulfillment"; fulfillmentType: FulfillmentType }
  | { type: "setAddress"; address: DeliveryAddress | null }
  | { type: "setSlot"; date: string | null; time: string | null }
  | { type: "setCustomer"; customer: CustomerInfo }
  | { type: "setReusableTray"; reusableTray: boolean }
  | { type: "reset" };

function reducer(state: OrderDraftState, action: Action): OrderDraftState {
  switch (action.type) {
    case "setCustomerType": {
      if (state.customerType === action.customerType) return state;
      // El catálogo difiere entre particulares y empresas: al cambiar de
      // modalidad se vacían los artículos para evitar precios inválidos.
      return {
        ...initialState(),
        clientRequestId: state.clientRequestId,
        customerType: action.customerType,
      };
    }
    case "addItem":
      return { ...state, items: [...state.items, action.item] };
    case "updateItem":
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.item.id ? action.item : i)),
      };
    case "removeItem":
      return { ...state, items: state.items.filter((i) => i.id !== action.itemId) };
    case "setQuantity":
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.itemId ? { ...i, quantity: Math.max(1, action.quantity) } : i
        ),
      };
    case "setFulfillment":
      return {
        ...state,
        fulfillmentType: action.fulfillmentType,
        address: action.fulfillmentType === "pickup" ? null : state.address,
      };
    case "setAddress":
      return { ...state, address: action.address };
    case "setSlot":
      return { ...state, requestedDate: action.date, requestedTime: action.time };
    case "setCustomer":
      return { ...state, customer: action.customer };
    case "setReusableTray":
      return { ...state, reusableTray: action.reusableTray };
    case "reset":
      return initialState();
    default:
      return state;
  }
}

/** Clave versionada: si el esquema del borrador cambia, subir la versión. */
const DEFAULT_STORAGE_KEY = "dulce-flor:order-draft:v1";

const selectedOptionSchema = z.object({ id: z.string(), label: z.string() });

/**
 * Validación estricta del borrador restaurado de sessionStorage: un borrador
 * corrupto o de un esquema antiguo NUNCA debe tumbar la app — se descarta.
 */
const draftStateSchema = z.object({
  customerType: z.enum(["individual", "business"]).nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      selection: z.object({
        productId: z.string(),
        customerType: z.enum(["individual", "business"]),
        sizeId: z.string(),
        flavorId: z.string().optional(),
        toppingIds: z.array(z.string()),
        extraIds: z.array(z.string()),
      }),
      customization: z.object({
        size: selectedOptionSchema,
        flavor: selectedOptionSchema.optional(),
        filling: selectedOptionSchema.optional(),
        toppings: z.array(selectedOptionSchema),
        customToppingRequest: z.string().optional(),
        extras: z.array(selectedOptionSchema.extend({ priceCents: z.number() })),
        dedicationText: z.string().optional(),
        designDescription: z.string().optional(),
        notes: z.string().optional(),
        referenceImageId: z.string().optional(),
      }),
      quantity: z.number().int().min(1),
    })
  ),
  fulfillmentType: z.enum(["pickup", "delivery"]).nullable(),
  address: z
    .object({
      street: z.string(),
      municipality: z.string(),
      postalCode: z.string(),
      details: z.string().optional(),
    })
    .nullable(),
  requestedDate: z.string().nullable(),
  requestedTime: z.string().nullable(),
  customer: z
    .object({
      name: z.string(),
      phone: z.string(),
      email: z.string().optional(),
      companyName: z.string().optional(),
    })
    .nullable(),
  // default(false): borradores antiguos sin este campo siguen siendo válidos.
  reusableTray: z.boolean().default(false),
  clientRequestId: z.string().min(1),
});

function loadInitialState(storageKey: string): OrderDraftState {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return initialState();
    const parsed = draftStateSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return initialState();
    return parsed.data;
  } catch {
    return initialState();
  }
}

export interface OrderDraftDerived {
  orderItems: OrderItem[];
  deliveryFeeCents: number | null;
  deliveryZoneLabel: string | null;
  needsDeliveryConsultation: boolean;
  pricing: OrderPricing;
}

interface OrderDraftContextValue {
  state: OrderDraftState;
  derived: OrderDraftDerived;
  setCustomerType: (t: CustomerType) => void;
  addConfiguredItem: (
    selection: ItemSelection,
    customization: ItemCustomization,
    quantity: number
  ) => boolean;
  updateConfiguredItem: (item: DraftItem) => void;
  removeItem: (itemId: string) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  setFulfillment: (t: FulfillmentType) => void;
  setAddress: (a: DeliveryAddress | null) => void;
  setSlot: (date: string | null, time: string | null) => void;
  setCustomer: (c: CustomerInfo) => void;
  setReusableTray: (value: boolean) => void;
  reset: () => void;
}

const OrderDraftContext = React.createContext<OrderDraftContextValue | null>(null);

export function toOrderItems(items: DraftItem[]): OrderItem[] {
  const result: OrderItem[] = [];
  for (const draft of items) {
    const item = buildOrderItem({
      id: draft.id,
      selection: draft.selection,
      customization: draft.customization,
      quantity: draft.quantity,
    });
    if (item) result.push(item);
  }
  return result;
}

export function OrderDraftProvider({
  children,
  storageKey = DEFAULT_STORAGE_KEY,
}: {
  children: React.ReactNode;
  /** El kiosk usa una clave propia para no mezclar su borrador con el de la web pública. */
  storageKey?: string;
}) {
  const [state, dispatch] = React.useReducer(reducer, storageKey, loadInitialState);

  React.useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Sin sessionStorage (modo privado extremo): el borrador no persiste.
    }
  }, [state, storageKey]);

  // Limpieza de imágenes huérfanas: conserva solo las referenciadas por algún
  // pedido guardado o por CUALQUIER borrador activo (web pública y kiosk).
  React.useEffect(() => {
    try {
      const referenced = new Set<string>();
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key?.startsWith("dulce-flor:order-draft")) continue;
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as {
            items?: Array<{ customization?: { referenceImageId?: string } }>;
          };
          parsed.items?.forEach((item) => {
            const id = item?.customization?.referenceImageId;
            if (id) referenced.add(id);
          });
        } catch {
          // borrador ilegible: se ignora
        }
      }
      for (const order of orderRepository.list()) {
        for (const item of order.items) {
          const id = item.customization?.referenceImageId;
          if (id) referenced.add(id);
        }
      }
      pruneImagesExcept(referenced);
    } catch {
      // sin almacenamiento disponible
    }
  }, []);

  const derived = React.useMemo<OrderDraftDerived>(() => {
    const orderItems = toOrderItems(state.items);
    let deliveryFeeCents: number | null = 0;
    let deliveryZoneLabel: string | null = null;
    let needsDeliveryConsultation = false;

    if (state.fulfillmentType === "delivery") {
      if (state.address) {
        const resolution = resolveDeliveryZone({
          municipality: state.address.municipality,
          postalCode: state.address.postalCode,
        });
        deliveryFeeCents = resolution.feeCents;
        deliveryZoneLabel = resolution.zone?.label ?? null;
        needsDeliveryConsultation = resolution.needsConsultation;
      } else {
        deliveryFeeCents = null;
        needsDeliveryConsultation = false;
      }
    }

    const pricing = computeOrderPricing(
      orderItems,
      state.fulfillmentType === "delivery" ? deliveryFeeCents : 0
    );
    return {
      orderItems,
      deliveryFeeCents,
      deliveryZoneLabel,
      needsDeliveryConsultation,
      pricing,
    };
  }, [state.items, state.fulfillmentType, state.address]);

  const value = React.useMemo<OrderDraftContextValue>(
    () => ({
      state,
      derived,
      setCustomerType: (customerType) => dispatch({ type: "setCustomerType", customerType }),
      addConfiguredItem: (selection, customization, quantity) => {
        const item = buildOrderItem({ id: newInternalId(), selection, customization, quantity });
        if (!item) return false;
        dispatch({
          type: "addItem",
          item: { id: item.id, selection, customization, quantity: item.quantity },
        });
        return true;
      },
      updateConfiguredItem: (item) => dispatch({ type: "updateItem", item }),
      removeItem: (itemId) => {
        // Al quitar un artículo, su imagen de referencia deja de usarse.
        const item = state.items.find((i) => i.id === itemId);
        if (item?.customization.referenceImageId) {
          deleteImage(item.customization.referenceImageId);
        }
        dispatch({ type: "removeItem", itemId });
      },
      setQuantity: (itemId, quantity) => dispatch({ type: "setQuantity", itemId, quantity }),
      setFulfillment: (fulfillmentType) => dispatch({ type: "setFulfillment", fulfillmentType }),
      setAddress: (address) => dispatch({ type: "setAddress", address }),
      setSlot: (date, time) => dispatch({ type: "setSlot", date, time }),
      setCustomer: (customer) => dispatch({ type: "setCustomer", customer }),
      setReusableTray: (reusableTray) => dispatch({ type: "setReusableTray", reusableTray }),
      reset: () => dispatch({ type: "reset" }),
    }),
    [state, derived]
  );

  return <OrderDraftContext.Provider value={value}>{children}</OrderDraftContext.Provider>;
}

export function useOrderDraft(): OrderDraftContextValue {
  const ctx = React.useContext(OrderDraftContext);
  if (!ctx) throw new Error("useOrderDraft debe usarse dentro de OrderDraftProvider");
  return ctx;
}
