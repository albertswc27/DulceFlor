import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { formatEuros } from "@/domain/money";
import { cn } from "@/lib/utils";

/** Precio con transición sutil al cambiar de importe. */
export function AnimatedPrice({
  cents,
  className,
}: {
  cents: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <span
      className={cn(
        "relative inline-flex overflow-hidden font-display font-bold text-primary",
        className
      )}
    >
      {/* Anuncio para lectores de pantalla: solo el precio vigente, sin duplicados
          transitorios de la animación. */}
      <span role="status" className="sr-only">
        {formatEuros(cents)}
      </span>
      <span aria-hidden="true" className="inline-flex overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={cents}
            initial={reduced ? false : { y: "0.8em", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: "-0.8em", opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="inline-block"
          >
            {formatEuros(cents)}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
