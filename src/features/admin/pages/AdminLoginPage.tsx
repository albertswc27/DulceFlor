/**
 * Acceso al panel de administración. Formulario centrado, sin exponer
 * credenciales en la UI (ver limitaciones de la POC en src/services/auth.ts).
 */
import * as React from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/features/admin/state/AdminAuthContext";
import logo from "@/assets/logo-dulce-flor.jpeg";

export default function AdminLoginPage() {
  const { session, login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // RequireAdmin redirige aquí con state.from (ruta original). Se tipa con
  // cautela: el state de la navegación es `unknown` para React Router.
  const locationState = location.state as { from?: unknown } | null;
  const from =
    typeof locationState?.from === "string" ? locationState.from : null;

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  if (session) return <Navigate to={from ?? "/admin/panel"} replace />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const result = await login(username, password);
    if (result.ok) {
      navigate(from ?? "/admin/panel", { replace: true });
      return;
    }
    setError(result.error);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in-up">
        <Card className="vintage-frame shadow-lifted">
          <CardHeader className="items-center text-center">
            <img
              src={logo}
              alt="Logotipo de Dulce Flor"
              width={72}
              height={72}
              className="mb-2 h-[72px] w-[72px] rounded-full border border-secondary/40 object-cover shadow-soft"
            />
            <p className="eyebrow">Dulce Flor</p>
            <CardTitle className="text-2xl">Administración</CardTitle>
            <CardDescription>
              Acceso privado para el equipo de Dulce Flor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="admin-username">Usuario</Label>
                <Input
                  id="admin-username"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Contraseña</Label>
                <Input
                  id="admin-password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
                >
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                <LockKeyhole />
                {loading ? "Comprobando…" : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-5 text-center">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la web
          </Link>
        </div>
      </div>
    </div>
  );
}
