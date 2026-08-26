/**
 * Sesión de administración. Ver limitaciones de seguridad de la POC en
 * src/services/auth.ts y docs/architecture.md.
 */
import * as React from "react";
import {
  getSession,
  login as authLogin,
  logout as authLogout,
  revalidateSession,
  type AdminSession,
} from "@/services/auth";

interface AdminAuthContextValue {
  session: AdminSession | null;
  login: (
    username: string,
    password: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
}

const AdminAuthContext = React.createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<AdminSession | null>(() => getSession());

  // Revalida la sesión, al arrancar y cada minuto. Con base de datos, quien
  // manda es el servidor: si allí ha caducado, la interfaz no puede seguir
  // creyéndose dentro mientras las lecturas de pedidos fallan.
  React.useEffect(() => {
    let vivo = true;
    const comprobar = () => {
      void revalidateSession().then((s) => {
        if (vivo) setSession(s);
      });
    };
    comprobar();
    const interval = setInterval(comprobar, 60_000);
    return () => {
      vivo = false;
      clearInterval(interval);
    };
  }, []);

  const value = React.useMemo<AdminAuthContextValue>(
    () => ({
      session,
      login: async (username, password) => {
        const result = await authLogin(username, password);
        if (result.ok) {
          setSession(result.session);
          return { ok: true };
        }
        return { ok: false, error: result.error };
      },
      logout: () => {
        authLogout();
        setSession(null);
      },
    }),
    [session]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = React.useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth debe usarse dentro de AdminAuthProvider");
  return ctx;
}
