/**
 * Ilustración vectorial de tarta coherente con la identidad de Dulce Flor.
 * Sin fotografías externas: SVG propio con los tokens de color de la marca.
 *
 * REGLA VISUAL (confirmada por el cliente): todos los discos de una misma
 * tarta se dibujan con EXACTAMENTE el mismo diámetro. Más discos = más alta,
 * nunca más estrecha arriba. Sin forma piramidal ni escalonada.
 *
 * - `tiers`: número de discos apilados (1–3+).
 * - `scale`: 0–3 → tarta más ancha (más personas).
 */
import { cn } from "@/lib/utils";

interface CakeIllustrationProps {
  tiers: number;
  scale?: 0 | 1 | 2 | 3;
  className?: string;
}

const TIER_HEIGHT = 20;
const BASE_Y = 100;

export function CakeIllustration({ tiers, scale = 1, className }: CakeIllustrationProps) {
  const discCount = Math.max(1, Math.round(tiers));
  // Mismo ancho para todos los discos; solo cambia con el nº de personas.
  const width = 56 + scale * 12; // 56–92
  const cx = 60;
  const x = cx - width / 2;

  // El viewBox crece con la altura para que las tartas altas no se recorten
  // y para que la diferencia de altura sea perceptible entre opciones.
  const cakeHeight = discCount * TIER_HEIGHT;
  const viewTop = Math.min(0, BASE_Y - cakeHeight - 22);

  const discs = Array.from({ length: discCount }, (_, i) => ({
    i,
    y: BASE_Y - (i + 1) * TIER_HEIGHT,
  }));
  const top = discs[discs.length - 1];

  return (
    <svg
      viewBox={`0 ${viewTop} 120 ${BASE_Y + 12 - viewTop}`}
      aria-hidden="true"
      className={cn("block h-auto w-full", className)}
    >
      {/* Plato */}
      <ellipse
        cx={cx}
        cy={BASE_Y + 4}
        rx={width / 2 + 12}
        ry={6}
        className="fill-blush"
      />
      <ellipse
        cx={cx}
        cy={BASE_Y + 3}
        rx={width / 2 + 9}
        ry={4.5}
        className="fill-card"
      />

      {discs.map(({ i, y }) => (
        <g key={i}>
          {/* Cuerpo del disco: mismo ancho en todos */}
          <rect
            x={x}
            y={y}
            width={width}
            height={TIER_HEIGHT}
            rx={3}
            className={i % 2 === 0 ? "fill-secondary/70" : "fill-blush"}
          />
          {/* Línea de crema entre discos (marca la separación sin estrechar) */}
          {i > 0 && (
            <rect
              x={x}
              y={y + TIER_HEIGHT - 3}
              width={width}
              height={3}
              className="fill-card/80"
            />
          )}
          {/* Puntitos decorativos vintage */}
          {[0.3, 0.7].map((f) => (
            <circle
              key={f}
              cx={x + width * f}
              cy={y + TIER_HEIGHT / 2 + 1}
              r={1.4}
              className="fill-primary/25"
            />
          ))}
        </g>
      ))}

      {/* Cobertura superior con goteo (scallops), del mismo ancho que la tarta */}
      <rect x={x} y={top.y - 1} width={width} height={8} rx={3} className="fill-card" />
      {[0.15, 0.38, 0.62, 0.85].map((f) => (
        <circle key={f} cx={x + width * f} cy={top.y + 7} r={3} className="fill-card" />
      ))}

      {/* Guinda superior */}
      <line
        x1={cx}
        y1={top.y - 7}
        x2={cx + 2.5}
        y2={top.y - 11}
        strokeWidth={1.6}
        strokeLinecap="round"
        className="stroke-accent"
      />
      <circle cx={cx} cy={top.y - 4.5} r={4} className="fill-primary" />
      <circle cx={cx - 1.4} cy={top.y - 6} r={1.1} className="fill-primary-foreground/70" />
    </svg>
  );
}
