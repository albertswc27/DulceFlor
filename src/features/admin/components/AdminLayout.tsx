/**
 * Estructura común del panel de administración: cabecera compacta con
 * navegación, identidad de la sesión y <Outlet/> para cada página.
 */
import { Link, Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/features/admin/state/AdminAuthContext";
import { isKioskLocked } from "@/services/auth";
import logo from "@/assets/logo-dulce-flor.jpeg";

const NAV_ITEMS = [
  { to: "/admin/panel", label: "Panel", icon: LayoutDashboard },
  { to: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { to: "/admin/kiosk", label: "Kiosk", icon: Store },
] as const;

export default function AdminLayout() {
  const { session, logout } = useAdminAuth();
  const navigate = useNavigate();

  // Modo kiosk bloqueado: la tablet está de cara al público. Cualquier intento
  // de llegar al panel (botón atrás, URL directa) rebota al kiosk hasta que se
  // desbloquee con contraseña desde el propio kiosk.
  if (isKioskLocked()) {
    return <Navigate to="/admin/kiosk" replace />;
  }

  function handleLogout() {
    logout();
    navigate("/admin", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link
            to="/admin/panel"
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={logo}
              alt="Logotipo de Dulce Flor"
              width={40}
              height={40}
              loading="lazy"
              className="h-10 w-10 shrink-0 rounded-full border border-secondary/40 object-cover"
            />
            <span className="truncate font-display text-base font-bold text-primary sm:text-lg">
              Dulce Flor{" "}
              <span className="hidden font-normal text-muted-foreground sm:inline">
                · Administración
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-3">
            {session && (
              <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground md:inline">
                {session.displayName}
              </span>
            )}
            <Button type="button" variant="outline" onClick={handleLogout}>
              <LogOut />
              <span className="hidden sm:inline">Cerrar sesión</span>
              <span className="sr-only sm:hidden">Cerrar sesión</span>
            </Button>
          </div>
        </div>

        <nav
          aria-label="Navegación de administración"
          className="container flex items-center gap-1 overflow-x-auto pb-2"
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-primary hover:bg-primary/5"
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
          <Link
            to="/"
            className="flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-4 w-4" />
            Ver web
          </Link>
        </nav>
      </header>

      <main className="container py-6 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}
