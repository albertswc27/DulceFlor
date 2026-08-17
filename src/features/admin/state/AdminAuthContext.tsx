/**
 * Sesión de administración. Ver limitaciones de seguridad de la POC en
 * src/services/auth.ts y docs/architecture.md.
 */
import * as React from "react";
import {
  getSession,
  login as authLogin,
  logout as authLogout,
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

  // Revalida la sesión periódicamente para expirar sesiones caducadas.
  React.useEffect(() => {
    const interval = setInterval(() => {
      setSession(getSession());
    }, 60_000);
    return () => clearInterval(interval);
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
