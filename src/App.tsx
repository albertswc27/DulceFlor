import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import PublicLayout from "@/components/layout/PublicLayout";
import { OrderDraftProvider } from "@/features/order/state/OrderDraftContext";
import HomePage from "@/features/marketing/pages/HomePage";
import MenusPage from "@/features/marketing/pages/MenusPage";
import OrderWizardPage from "@/features/order/pages/OrderWizardPage";
import OrderConfirmationPage from "@/features/order/pages/OrderConfirmationPage";
import { AdminAuthProvider } from "@/features/admin/state/AdminAuthContext";
import RequireAdmin from "@/features/admin/components/RequireAdmin";
import NotFoundPage from "@/features/marketing/pages/NotFoundPage";

// La zona de administración se carga bajo demanda: los visitantes de la web
// pública no descargan su código.
const AdminLoginPage = lazy(() => import("@/features/admin/pages/AdminLoginPage"));
const AdminLayout = lazy(() => import("@/features/admin/components/AdminLayout"));
const AdminDashboardPage = lazy(() => import("@/features/admin/pages/AdminDashboardPage"));
const AdminOrdersPage = lazy(() => import("@/features/admin/pages/AdminOrdersPage"));
const AdminOrderDetailPage = lazy(() => import("@/features/admin/pages/AdminOrderDetailPage"));
const KioskPage = lazy(() => import("@/features/admin/pages/KioskPage"));

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="animate-fade-in text-sm text-muted-foreground">Cargando…</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <OrderDraftProvider>
        <AdminAuthProvider>
          <Suspense fallback={<AdminFallback />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/carta" element={<MenusPage />} />
              <Route path="/pedido" element={<OrderWizardPage />} />
              <Route
                path="/pedido/confirmacion/:orderId"
                element={<OrderConfirmationPage />}
              />
            </Route>

            <Route path="/admin" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              }
            >
              <Route path="panel" element={<AdminDashboardPage />} />
              <Route path="pedidos" element={<AdminOrdersPage />} />
              <Route path="pedidos/:orderId" element={<AdminOrderDetailPage />} />
            </Route>
            <Route
              path="/admin/kiosk"
              element={
                <RequireAdmin>
                  {/* Borrador independiente: el kiosk nunca mezcla ni pisa el pedido
                      que un cliente pudiera tener a medias en la web pública. */}
                  <OrderDraftProvider storageKey="dulce-flor:order-draft:kiosk-v1">
                    <KioskPage />
                  </OrderDraftProvider>
                </RequireAdmin>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "hsl(36 60% 97%)",
                color: "hsl(340 25% 21%)",
                border: "1px solid hsl(24 42% 84%)",
              },
            }}
          />
        </AdminAuthProvider>
      </OrderDraftProvider>
    </BrowserRouter>
  );
}
