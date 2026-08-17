import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/features/admin/state/AdminAuthContext";

/** Protege las rutas de administración: sin sesión válida → login. */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { session } = useAdminAuth();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/admin" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
