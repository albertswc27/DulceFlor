/**
 * Panel de control: métricas rápidas del día a día y próximos pedidos.
 * Los datos provienen del repositorio de pedidos (localStorage en la POC).
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { addDays, format } from "date-fns";
import {
  ArrowRight,
  Cake,
  CalendarDays,
  CalendarRange,
  ChefHat,
  CircleCheckBig,
  Coins,
  Hourglass,
  ReceiptEuro,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEuros } from "@/domain/money";
import { ORDER_STATUS_LABELS, type Order } from "@/domain/types";
import { orderRepository } from "@/services/orderRepository";
import {
  STATUS_BADGE_VARIANT,
  formatRequestedDayShort,
} from "@/features/admin/lib/adminUi";

interface MetricCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function MetricCard({ icon: Icon, label, value }: MetricCardProps) {
  return (
    <Card className="animate-fade-in">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="font-display text-2xl font-bold leading-tight text-primary">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingOrderRow({ order }: { order: Order }) {
  return (
    <Link
      to={`/admin/pedidos/${order.id}`}
      className="flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-background-soft/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-primary">
          {order.publicId}
          <span className="font-normal text-muted-foreground"> · {order.customer.name}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {formatRequestedDayShort(order.requestedDate)} · {order.requestedTime} h
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge variant={STATUS_BADGE_VARIANT[order.status]}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
        <span className="hidden font-display font-semibold text-primary sm:inline">
          {formatEuros(order.pricing.totalCents)}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const [orders, setOrders] = React.useState<Order[]>(() => orderRepository.list());

  // Re-lee los pedidos al recuperar el foco: así aparecen los creados desde
  // el kiosk (u otra pestaña) sin necesidad de recargar la página.
  React.useEffect(() => {
    function refresh() {
      setOrders(orderRepository.list());
    }
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  const now = React.useMemo(() => new Date(), []);
  const todayIso = format(now, "yyyy-MM-dd");
  const weekEndIso = format(addDays(now, 7), "yyyy-MM-dd");
  const nowKey = format(now, "yyyy-MM-dd HH:mm");

  const metrics = React.useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending").length;
    const pendingQuote = orders.filter((o) => o.status === "pending_quote").length;
    const forToday = orders.filter(
      (o) => o.status !== "cancelled" && o.requestedDate === todayIso
    ).length;
    const next7Days = orders.filter(
      (o) =>
        o.status !== "cancelled" &&
        o.requestedDate >= todayIso &&
        o.requestedDate <= weekEndIso
    ).length;
    const inPreparation = orders.filter((o) => o.status === "in_preparation").length;
    const ready = orders.filter((o) => o.status === "ready").length;
    // Sin cancelados ni pendientes de presupuesto: el total de estos últimos
    // es parcial (o 0) hasta que administración introduce el presupuesto.
    const expectedRevenueCents = orders
      .filter((o) => o.status !== "cancelled" && o.status !== "pending_quote")
      .reduce((sum, o) => sum + o.pricing.totalCents, 0);
    return {
      pending,
      pendingQuote,
      forToday,
      next7Days,
      inPreparation,
      ready,
      expectedRevenueCents,
    };
  }, [orders, todayIso, weekEndIso]);

  const upcoming = React.useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.status !== "cancelled" &&
            `${o.requestedDate} ${o.requestedTime}` >= nowKey
        )
        .sort((a, b) =>
          `${a.requestedDate} ${a.requestedTime}`.localeCompare(
            `${b.requestedDate} ${b.requestedTime}`
          )
        )
        .slice(0, 8),
    [orders, nowKey]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl">
          Panel de control
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de la actividad de pedidos de Dulce Flor.
        </p>
      </div>

      {orders.length === 0 ? (
        <Card className="mx-auto max-w-md animate-fade-in-up text-center">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/20 text-primary">
              <Cake className="h-8 w-8" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-primary">
                Todavía no hay pedidos
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cuando lleguen pedidos desde la web o el kiosk de tienda
                aparecerán aquí con sus métricas.
              </p>
            </div>
            <Button asChild size="lg">
              <Link to="/admin/kiosk">
                <Store />
                Crear pedido en el kiosk
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <MetricCard icon={Hourglass} label="Pendientes" value={String(metrics.pending)} />
            <MetricCard
              icon={ReceiptEuro}
              label="Pendientes de presupuesto"
              value={String(metrics.pendingQuote)}
            />
            <MetricCard icon={CalendarDays} label="Para hoy" value={String(metrics.forToday)} />
            <MetricCard
              icon={CalendarRange}
              label="Próximos 7 días"
              value={String(metrics.next7Days)}
            />
            <MetricCard
              icon={ChefHat}
              label="En preparación"
              value={String(metrics.inPreparation)}
            />
            <MetricCard icon={CircleCheckBig} label="Listos" value={String(metrics.ready)} />
            <MetricCard
              icon={Coins}
              label="Ingresos previstos"
              value={formatEuros(metrics.expectedRevenueCents)}
            />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Próximos pedidos</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/pedidos">
                  Ver todos
                  <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-background-soft/60 px-4 py-6 text-center text-sm text-muted-foreground">
                  No hay pedidos con fecha futura en este momento.
                </p>
              ) : (
                <div className="divide-y divide-border/70">
                  {upcoming.map((order) => (
                    <UpcomingOrderRow key={order.id} order={order} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
