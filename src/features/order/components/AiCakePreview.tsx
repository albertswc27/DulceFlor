/**
 * Previsualización de la tarta con IA.
 *
 * Tres cosas de esta pantalla NO son decoración y no se pueden quitar:
 *
 *  1. Se dice que se está usando una IA antes de usarla (art. 50.1 del
 *     Reglamento europeo de IA).
 *  2. CADA imagen lleva encima una etiqueta visible de que la ha generado un
 *     ordenador. La Comisión Europea excluye expresamente los metadatos, los
 *     iconos que hay que pulsar y la letra pequeña: tiene que verse sin hacer
 *     nada (art. 50.4 y 50.5).
 *  3. Para poder adjuntar la imagen al pedido hay que marcar una casilla que
 *     NO viene marcada, con un texto que dice en qué va a diferir la tarta
 *     real. Esto es lo que de verdad protege: sin aceptación expresa y por
 *     separado, la imagen puede funcionar como «muestra o modelo» del pedido
 *     (art. 115 ter TRLGDCU) y una cláusula general de exoneración sería nula.
 *
 * Lo demás —lista cerrada de acabados, paleta cerrada, texto libre corto— está
 * para que lo generado se parezca a lo que el obrador puede entregar.
 */
import * as React from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CAKE_COLOURS,
  CAKE_FINISHES,
  MAX_COLOURS,
  MAX_DETAIL_LENGTH,
  type AiPreviewOptions,
  type CakeFinish,
} from "@/domain/aiPreview";
import { generateCakeImage } from "@/services/aiPreview";

export interface AiPreviewAccepted {
  /** La imagen elegida, como data URL. */
  image: string;
  /** Resumen de lo pedido, para que el obrador sepa qué se le enseñó. */
  summary: string;
}

interface AiCakePreviewProps {
  /** Acabado sugerido según el producto que se está configurando. */
  suggestedFinish?: CakeFinish;
  /** Se llama cuando la clienta acepta usar la imagen en su pedido. */
  onAccept: (resultado: AiPreviewAccepted) => void;
}

/** Etiqueta obligatoria. Va SOBRE la imagen, no debajo ni en un desplegable. */
function EtiquetaIa() {
  return (
    <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-foreground/80 px-2 py-1 text-xs font-medium text-background shadow-soft">
      Imagen generada con IA · orientativa
    </span>
  );
}

export function AiCakePreview({ suggestedFinish, onAccept }: AiCakePreviewProps) {
  const [finish, setFinish] = React.useState<CakeFinish>(suggestedFinish ?? "nata");
  const [colourIds, setColourIds] = React.useState<string[]>([]);
  const [detail, setDetail] = React.useState("");
  const [refine, setRefine] = React.useState("");

  const [image, setImage] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState("");
  const [sessionToken, setSessionToken] = React.useState<string | undefined>();
  const [remaining, setRemaining] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [accepted, setAccepted] = React.useState(false);
  const [aceptaAviso, setAceptaAviso] = React.useState(false);

  const opciones: AiPreviewOptions = { finish, colourIds, detail };
  const sinCupo = remaining !== null && remaining <= 0;

  function toggleColour(id: string) {
    setColourIds((previos) => {
      if (previos.includes(id)) return previos.filter((c) => c !== id);
      if (previos.length >= MAX_COLOURS) return previos;
      return [...previos, id];
    });
  }

  async function generar(textoRefinado?: string) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const resultado = await generateCakeImage(opciones, {
        sessionToken,
        refine: textoRefinado,
      });
      if (!resultado.ok) {
        setError(resultado.message);
        // Cuando el motivo es el cupo, el servidor ya no dará más: se refleja
        // en la interfaz para no invitar a intentarlo otra vez en balde.
        if (resultado.outOfQuota) setRemaining(0);
        return;
      }
      setImage(resultado.image);
      setSummary(resultado.summary);
      setSessionToken(resultado.sessionToken || sessionToken);
      setRemaining(resultado.remaining);
      setRefine("");
      // Cada imagen nueva es una imagen distinta: la aceptación de la anterior
      // no vale para esta.
      setAceptaAviso(false);
      setAccepted(false);
    } finally {
      setLoading(false);
    }
  }

  function usarImagen() {
    if (!image || !aceptaAviso) return;
    onAccept({ image, summary });
    setAccepted(true);
  }

  return (
    <div className="space-y-5 rounded-2xl border border-secondary/50 bg-background-soft/50 p-4 sm:p-5">
      <div>
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-primary">
          <Wand2 className="h-4 w-4 text-accent" aria-hidden="true" />
          Imagina tu tarta
        </h3>
        {/* Art. 50.1: decirlo ANTES, no después. */}
        <p className="mt-1 text-sm text-muted-foreground">
          Elige cómo la quieres y <strong>una inteligencia artificial</strong> te
          enseñará una idea aproximada. No es una foto de tu tarta: es un dibujo
          para que nos entendamos mejor.
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-foreground">Acabado</legend>
        <div role="group" aria-label="Acabado" className="grid gap-2 sm:grid-cols-3">
          {CAKE_FINISHES.map((opcion) => {
            const activo = finish === opcion.id;
            return (
              <button
                key={opcion.id}
                type="button"
                aria-pressed={activo}
                onClick={() => setFinish(opcion.id)}
                className={cn(
                  "min-h-[48px] rounded-xl border px-3 py-2 text-left transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  activo
                    ? "border-primary bg-primary/[0.04] ring-1 ring-primary/40"
                    : "border-border bg-card hover:border-secondary"
                )}
              >
                <span className="block font-medium text-foreground">{opcion.label}</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  {opcion.description}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 flex w-full items-baseline justify-between gap-2 text-sm font-medium text-foreground">
          <span>Colores</span>
          <span className="text-xs font-normal text-muted-foreground">
            Hasta {MAX_COLOURS}
          </span>
        </legend>
        <div role="group" aria-label="Colores" className="flex flex-wrap gap-2">
          {CAKE_COLOURS.map((color) => {
            const activo = colourIds.includes(color.id);
            const lleno = !activo && colourIds.length >= MAX_COLOURS;
            return (
              <button
                key={color.id}
                type="button"
                aria-pressed={activo}
                disabled={lleno}
                onClick={() => toggleColour(color.id)}
                className={cn(
                  "flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  activo
                    ? "border-primary bg-primary/[0.04] ring-1 ring-primary/40"
                    : "border-border bg-card hover:border-secondary",
                  lleno && "cursor-not-allowed opacity-40"
                )}
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: color.hex }}
                />
                {color.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="ia-detalle">¿Algún tema o motivo? (opcional)</Label>
        <Input
          id="ia-detalle"
          value={detail}
          maxLength={MAX_DETAIL_LENGTH}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Por ejemplo: flores pequeñas, perlas, un conejito"
        />
        <p className="text-xs text-muted-foreground">
          No hace falta que escribas la dedicatoria: la tarta llevará una placa en
          blanco y el texto lo ponemos nosotros a mano, que queda mucho mejor.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
          {error}
        </p>
      )}

      {image && (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card">
            <img
              src={image}
              alt="Idea aproximada de la tarta, generada con inteligencia artificial"
              className="w-full object-cover"
            />
            <EtiquetaIa />
          </div>

          {/* Art. 115 ter.5 TRLGDCU: información específica de en qué va a
              diferir, y aceptación expresa y por separado. Sin esto marcado, la
              imagen no se adjunta al pedido. NO puede venir premarcada. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 p-3">
            <input
              type="checkbox"
              checked={aceptaAviso}
              onChange={(e) => {
                setAceptaAviso(e.target.checked);
                setAccepted(false);
              }}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-border accent-primary"
            />
            <span className="text-sm leading-snug text-foreground">
              Entiendo que esta imagen la ha generado un ordenador y que{" "}
              <strong>la tarta real no será idéntica</strong>: el tono exacto de los
              colores, la forma de las flores y los detalles de la decoración
              dependerán del trabajo a mano y de los ingredientes del día. Sirve como
              orientación, no como el aspecto final garantizado.
            </span>
          </label>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="flex-1"
              disabled={!aceptaAviso || accepted}
              onClick={usarImagen}
            >
              <Sparkles />
              {accepted ? "Añadida a tu pedido" : "Usar esta idea en mi pedido"}
            </Button>
          </div>

          {/* El refinado gasta la segunda imagen, así que se dice antes. */}
          {!sinCupo && (
            <div className="space-y-1.5 rounded-xl bg-card p-3">
              <Label htmlFor="ia-refinado">¿Cambiarías algo?</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="ia-refinado"
                  value={refine}
                  maxLength={MAX_DETAIL_LENGTH}
                  onChange={(e) => setRefine(e.target.value)}
                  placeholder="Por ejemplo: ponle perlas blancas"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || refine.trim().length === 0}
                  onClick={() => void generar(refine.trim())}
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
                  Cambiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Te queda{remaining === 1 ? "" : "n"} {remaining ?? "…"} cambio
                {remaining === 1 ? "" : "s"}. Se modifica la imagen de arriba, no se
                empieza de cero.
              </p>
            </div>
          )}
        </div>
      )}

      {!image && (
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={loading || sinCupo}
          onClick={() => void generar()}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {loading ? "Imaginando tu tarta…" : "Ver una idea"}
        </Button>
      )}

      {sinCupo && (
        <p className="text-xs text-muted-foreground">
          Si ninguna te convence, puedes adjuntar una foto tuya de referencia aquí
          abajo: nos sirve igual de bien.
        </p>
      )}
    </div>
  );
}
