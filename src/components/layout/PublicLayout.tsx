import * as React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BUSINESS_ADDRESS_DISPLAY,
  BUSINESS_HOURS,
  BUSINESS_MAPS_URL,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  MIN_ORDER_LEAD_TIME_HOURS,
  WHATSAPP_PHONE,
  WHATSAPP_PHONE_DISPLAY,
  type TimeWindow,
} from "@/config/business";
import logo from "@/assets/logo-dulce-flor.jpeg";

const NAV_LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/carta", label: "Nuestra carta" },
  { to: "/#sobre", label: "Sobre Dulce Flor" },
  { to: "/#contacto", label: "Contacto" },
];

function Navbar() {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3" aria-label="Dulce Flor, ir al inicio">
          <img
            src={logo}
            alt=""
            className="h-11 w-11 rounded-full border border-secondary/50 object-cover shadow-soft"
          />
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold text-primary">Dulce Flor</span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-accent">
              Repostería Casera
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-primary/5 hover:text-primary",
                  isActive && !link.to.includes("#") && "text-primary"
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          <Button asChild size="default" className="ml-2">
            <Link to="/pedido">Hacer pedido</Link>
          </Button>
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <Button asChild size="sm">
            <Link to="/pedido">Pedir</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <nav
          id="menu-movil"
          aria-label="Navegación móvil"
          className="border-t border-border bg-background md:hidden"
        >
          <div className="container flex flex-col py-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-lg px-3 py-3 text-base font-medium text-foreground/90 hover:bg-primary/5"
              >
                {link.label}
              </Link>
            ))}
            <Button asChild size="lg" className="my-2">
              <Link to="/pedido">Hacer pedido</Link>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}

const DAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Filas de horario derivadas de BUSINESS_HOURS, agrupando días consecutivos iguales. */
function buildScheduleRows(): Array<{ label: string; text: string }> {
  const order = [1, 2, 3, 4, 5, 6, 0]; // lunes → domingo
  const fmt = (windows: TimeWindow[]) =>
    windows.length === 0
      ? "Cerrado"
      : windows.map((w) => `${w.start}–${w.end}`).join(" y ");
  const groups: Array<{ from: number; to: number; text: string }> = [];
  for (const day of order) {
    const text = fmt(BUSINESS_HOURS[day] ?? []);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.to = day;
    else groups.push({ from: day, to: day, text });
  }
  return groups.map((g) => ({
    label:
      g.from === g.to
        ? DAY_LABELS[g.from]
        : `${DAY_LABELS[g.from]} a ${DAY_LABELS[g.to].toLowerCase()}`,
    text: g.text,
  }));
}

function Footer() {
  return (
    <footer id="contacto" className="mt-16 bg-cocoa text-cocoa-foreground">
      <div className="container grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Logo de Dulce Flor"
              className="h-12 w-12 rounded-full object-cover"
            />
            <div>
              <p className="font-display text-lg font-bold">Dulce Flor</p>
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">
                Repostería Casera
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-xs text-sm text-cocoa-foreground/70">
            Tartas, cheesecakes y tres leches hechos con amor para compartir momentos
            inolvidables.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-semibold text-secondary">Contacto</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href={BUSINESS_MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                {BUSINESS_ADDRESS_DISPLAY}
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${WHATSAPP_PHONE}`}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                WhatsApp: {WHATSAPP_PHONE_DISPLAY}
              </a>
            </li>
            <li>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="underline-offset-4 hover:underline"
              >
                Instagram: {INSTAGRAM_HANDLE}
              </a>
            </li>
            <li className="text-cocoa-foreground/70">
              Pedidos con antelación mínima de {MIN_ORDER_LEAD_TIME_HOURS / 24} días.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-base font-semibold text-secondary">
            Horario
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-cocoa-foreground/80">
            {buildScheduleRows().map((row) => (
              <li key={row.label}>
                {row.label}: {row.text.toLowerCase() === "cerrado" ? "cerrado" : row.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-cocoa-foreground/50">
            Abierto todos los días.
          </p>
        </div>
      </div>
      <div className="border-t border-cocoa-foreground/10 py-4">
        <p className="container text-center text-xs text-cocoa-foreground/50">
          © {new Date().getFullYear()} Dulce Flor Repostería Casera · Hechos con amor para
          compartir momentos inolvidables
        </p>
      </div>
    </footer>
  );
}

function ScrollToHash() {
  const { hash, pathname } = useLocation();
  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [hash, pathname]);
  return null;
}

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToHash />
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <Navbar />
      <main id="contenido" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
