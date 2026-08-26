/**
 * Pedidos del panel, ya sincronizados con la base compartida.
 *
 * Pinta primero lo que hay guardado en el dispositivo (instantáneo, y sirve
 * aunque no haya red) y en paralelo baja lo que haya en el servidor. Así el
 * panel nunca se queda en blanco esperando, pero acaba mostrando también los
 * pedidos hechos desde el móvil de un cliente, que es lo que antes no llegaba.
 */
import * as React from "react";
import type { Order } from "@/domain/types";
import { orderRepository } from "@/services/orderRepository";
import { isSupabaseConfigured } from "@/services/supabase";

interface SyncedOrders {
  orders: Order[];
  /** true mientras se está hablando con el servidor por primera vez. */
  syncing: boolean;
  /** Mensaje si la sincronización falló; null si fue bien o no aplica. */
  error: string | null;
  /** Hay base compartida detrás: los pedidos llegan de cualquier dispositivo. */
  shared: boolean;
  refresh: () => void;
}

export function useSyncedOrders(): SyncedOrders {
  const [orders, setOrders] = React.useState<Order[]>(() => orderRepository.list());
  const [syncing, setSyncing] = React.useState(isSupabaseConfigured());
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let vivo = true;
    setSyncing(isSupabaseConfigured());
    void orderRepository.sync().then((result) => {
      if (!vivo) return;
      setOrders(result.orders);
      setError(result.error);
      setSyncing(false);
    });
    return () => {
      vivo = false;
    };
  }, [nonce]);

  // Estable entre renders: si no, quien la use como dependencia de un efecto
  // (el dashboard la engancha al foco de la ventana) resincronizaría en bucle.
  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  return { orders, syncing, error, shared: isSupabaseConfigured(), refresh };
}
