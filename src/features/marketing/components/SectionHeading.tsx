import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  /** Pequeño rótulo script dorado sobre el título. */
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}

/** Cabecera de sección con eyebrow script, título display y subtítulo. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-1 font-display text-3xl font-bold text-primary sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">{subtitle}</p>
      )}
    </div>
  );
}
