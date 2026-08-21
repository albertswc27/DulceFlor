import { Link } from "react-router-dom";
import { CakeSlice, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo-dulce-flor.jpeg";

/** Página 404 con la estética de Dulce Flor (se renderiza sin layout público). */
export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background via-background-soft/60 to-background px-4 py-16 text-center">
      <div className="animate-fade-in-up flex flex-col items-center">
        <Link to="/" aria-label="Dulce Flor, ir al inicio">
          <img
            src={logo}
            alt="Logotipo de Dulce Flor Repostería Casera"
            width={96}
            height={96}
            className="h-24 w-24 rounded-full border border-secondary/50 object-cover shadow-soft"
          />
        </Link>

        <p className="eyebrow mt-6">¡Vaya!</p>
        <p
          className="font-display text-7xl font-bold leading-none text-primary/20 sm:text-8xl"
          aria-hidden="true"
        >
          404
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-primary sm:text-3xl">
          No encontramos esta página
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground">
          Puede que el enlace haya cambiado o que la página ya no exista. Lo
          importante sigue en su sitio: nuestras tartas, aperitivos y regalos
          caseros.
        </p>

        <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/">
              <Home aria-hidden="true" />
              Volver al inicio
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link to="/pedido">
              <CakeSlice aria-hidden="true" />
              Hacer pedido
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
