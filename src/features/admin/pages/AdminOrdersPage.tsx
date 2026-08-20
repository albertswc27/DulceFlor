/**
 * Listado de pedidos con filtros combinables. En escritorio se muestra como
 * tabla; en móvil, como tarjetas apiladas. Cada fila abre el detalle.
 */
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { PackageSearch, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuros } from "@/domain/money";
import {
  CUSTOMER_TYPE_LABELS,
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  type CustomerType,
  type FulfillmentType,
  type Order,
  type OrderStatus,
} from "@/domain/types";
import { orderRepository } from "@/services/orderRepository";
import {
  ORDER_STATUS_SEQUENCE,
  SELECT_CLASS,
  STATUS_BADGE_VARIANT,
  formatCreatedAt,
  formatRequestedDayShort,
} from "@/features/admin/lib/adminUi";

type StatusFilter = OrderStatus | "all";
type TypeFilter = CustomerType | "all";
type FulfillmentFilter = FulfillmentType | "all";

function depositLabel(order: Order): string {
  if (order.pricing.pendingQuote) return "—";
  return order.pricing.depositRequired ? formatEuros(order.pricing.depositCents) : "—";
}

/**
 * Total mostrado en el listado. Con presupuesto pendiente (tarta a medida) el
 * total del dominio es parcial: se indica explícitamente en vez de un importe
 * engañoso. Con modificaciones pendientes (topping fuera de lista, notas o
 * imagen de referencia) el importe es el actual y se marca con un "+".
 */
function TotalLabel({ order }: { order: Order }) {
  const { pricing } = order;

  if (pricing.pendingQuote) {
    return (
      <>
        {pricing.subtotalCents > 0
          ? `${formatEuros(pricing.subtotalCents)} + a presupuestar`
          : "A presupuestar"}
      </>
    );
  }

  if (pricing.hasPendingExtras) {
    return (
      <span title="Modificaciones pendientes de confirmar">
        {formatEuros(pricing.totalCents)}{" "}
        <span aria-hidden="true" className="font-normal text-muted-foreground">
          +
        </span>
        <span className="sr-only">más modificaciones pendientes de confirmar</span>
      </span>
    );
  }

  return <>{formatEuros(pricing.totalCents)}</>;
}

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const [orders] = React.useState<Order[]>(() => orderRepository.list());

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [type, setType] = React.useState<TypeFilter>("all");
  const [fulfillment, setFulfillment] = React.useState<FulfillmentFilter>("all");
  const [date, setDate] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (type !== "all" && o.customerType !== type) return false;
      if (fulfillment !== "all" && o.fulfillmentType !== fulfillment) return false;
      if (date && o.requestedDate !== date) return false;
      if (q) {
        const haystack =
          `${o.publicId} ${o.customer.name} ${o.customer.phone}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, status, type, fulfillment, date]);

  const hasActiveFilters =
    search.trim() !== "" ||
    status !== "all" ||
    type !== "all" ||
    fulfillment !== "all" ||
    date !== "";

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setType("all");
    setFulfillment("all");
    setDate("");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-primary sm:text-3xl">
            Pedidos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length === orders.length
              ? `${orders.length} ${orders.length === 1 ? "pedido" : "pedidos"} en total`
              : `${filtered.length} de ${orders.length} pedidos`}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="filtro-busqueda">Buscar</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="filtro-busqueda"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ID, cliente o teléfono"
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filtro-estado">Estado</Label>
          <select
            id="filtro-estado"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className={SELECT_CLASS}
          >
            <option value="all">Todos los estados</option>
            {ORDER_STATUS_SEQUENCE.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filtro-tipo">Tipo de cliente</Label>
          <select
            id="filtro-tipo"
            value={type}
            onChange={(e) => setType(e.target.value as TypeFilter)}
            className={SELECT_CLASS}
          >
            <option value="all">Todos</option>
            <option value="individual">{CUSTOMER_TYPE_LABELS.individual}</option>
            <option value="business">{CUSTOMER_TYPE_LABELS.business}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filtro-modalidad">Modalidad</Label>
          <select
            id="filtro-modalidad"
            value={fulfillment}
            onChange={(e) => setFulfillment(e.target.value as FulfillmentFilter)}
            className={SELECT_CLASS}
          >
            <option value="all">Todas</option>
            <option value="pickup">{FULFILLMENT_LABELS.pickup}</option>
            <option value="delivery">{FULFILLMENT_LABELS.delivery}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filtro-fecha">Fecha solicitada</Label>
          <Input
            id="filtro-fecha"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-background-soft/60 px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/20 text-primary">
            <PackageSearch className="h-7 w-7" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-primary">
              {orders.length === 0
                ? "Todavía no hay pedidos registrados"
                : "Ningún pedido coincide con los filtros"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {orders.length === 0
                ? "Los pedidos de la web y del kiosk aparecerán en este listado."
                : "Prueba a ajustar la búsqueda o limpia los filtros."}
            </p>
          </div>
          {hasActiveFilters && (
            <Button type="button" variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Tabla en escritorio */}
          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card shadow-card md:block">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-border bg-background-soft/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">ID</th>
                  <th scope="col" className="px-4 py-3 font-medium">Creado</th>
                  <th scope="col" className="px-4 py-3 font-medium">Cliente</th>
                  <th scope="col" className="px-4 py-3 font-medium">Teléfono</th>
                  <th scope="col" className="px-4 py-3 font-medium">Tipo</th>
                  <th scope="col" className="px-4 py-3 font-medium">Para</th>
                  <th scope="col" className="px-4 py-3 font-medium">Modalidad</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Señal</th>
                  <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/admin/pedidos/${order.id}`)}
                    className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-background-soft/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/pedidos/${order.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.publicId}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatCreatedAt(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block max-w-[14rem] truncate font-medium text-foreground">
                        {order.customer.name}
                      </span>
                      {order.customer.companyName && (
                        <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">
                          {order.customer.companyName}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {order.customer.phone}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {CUSTOMER_TYPE_LABELS[order.customerType]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatRequestedDayShort(order.requestedDate)} · {order.requestedTime}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {FULFILLMENT_LABELS[order.fulfillmentType]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-display font-semibold text-primary">
                      <TotalLabel order={order} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                      {depositLabel(order)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant={STATUS_BADGE_VARIANT[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas en móvil */}
          <div className="space-y-3 md:hidden">
            {filtered.map((order) => (
              <Link
                key={order.id}
                to={`/admin/pedidos/${order.id}`}
                className="block rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-secondary hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-primary">{order.publicId}</p>
                    <p className="truncate text-sm text-foreground">
                      {order.customer.name}
                      {order.customer.companyName && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {order.customer.companyName}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">{order.customer.phone}</p>
                  </div>
                  <Badge variant={STATUS_BADGE_VARIANT[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {formatRequestedDayShort(order.requestedDate)} · {order.requestedTime} ·{" "}
                    {FULFILLMENT_LABELS[order.fulfillmentType]}
                  </span>
                  <span className="font-display text-lg font-bold text-primary">
                    <TotalLabel order={order} />
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {CUSTOMER_TYPE_LABELS[order.customerType]} · creado{" "}
                    {formatCreatedAt(order.createdAt)}
                  </span>
                  <span>Señal: {depositLabel(order)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
