/**
 * Ilustración vectorial de tarta coherente con la identidad de Dulce Flor.
 * Sin fotografías externas: SVG propio con los tokens de color de la marca.
 *
 * - `tiers`: número de pisos/discos visibles (1–3) → tarta más alta.
 * - `scale`: 0–3 → tarta más ancha (más personas).
 */
import { cn } from "@/lib/utils";

interface CakeIllustrationProps {
  tiers: 1 | 2 | 3;
  scale?: 0 | 1 | 2 | 3;
  className?: string;
}

const TIER_HEIGHT = 22;
const BASE_Y = 96;

export function CakeIllustration({ tiers, scale = 1, className }: CakeIllustrationProps) {
  const baseWidth = 56 + scale * 12; // 56–92
  const cx = 60;

  const tierRects = [];
  for (let i = 0; i < tiers; i++) {
    const width = baseWidth - i * 16;
    const x = cx - width / 2;
    const y = BASE_Y - (i + 1) * TIER_HEIGHT;
    tierRects.push({ i, x, y, width });
  }
  const top = tierRects[tierRects.length - 1];

  return (
    <svg
      viewBox="0 0 120 108"
      aria-hidden="true"
      className={cn("block h-auto w-full", className)}
    >
      {/* Plato */}
      <ellipse
        cx={cx}
        cy={BASE_Y + 4}
        rx={baseWidth / 2 + 12}
        ry={6}
        className="fill-blush"
      />
      <ellipse
        cx={cx}
        cy={BASE_Y + 3}
        rx={baseWidth / 2 + 9}
        ry={4.5}
        className="fill-card"
      />

      {tierRects.map(({ i, x, y, width }) => (
        <g key={i}>
          {/* Cuerpo del piso */}
          <rect
            x={x}
            y={y}
            width={width}
            height={TIER_HEIGHT}
            rx={4}
            className={i % 2 === 0 ? "fill-secondary/70" : "fill-blush"}
          />
          {/* Cobertura superior con goteo (scallops vintage) */}
          <rect x={x} y={y} width={width} height={7} rx={3.5} className="fill-card" />
          {[0.2, 0.5, 0.8].map((f) => (
            <circle
              key={f}
              cx={x + width * f}
              cy={y + 8.5}
              r={2.6}
              className="fill-card"
            />
          ))}
          {/* Puntitos decorativos */}
          {[0.3, 0.7].map((f) => (
            <circle
              key={f}
              cx={x + width * f}
              cy={y + TIER_HEIGHT - 6}
              r={1.4}
              className="fill-primary/30"
            />
          ))}
        </g>
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
