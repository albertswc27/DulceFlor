import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Retardo en segundos para escalonar apariciones. */
  delay?: number;
}

/**
 * Aparición suave al entrar en el viewport (una sola vez).
 *
 * REGLA DE SEGURIDAD: el contenido nunca puede depender de la animación para
 * verse. Si el observador de viewport no llega a dispararse (herramientas de
 * captura, navegadores antiguos, scroll dentro de contenedores raros), un
 * temporizador lo muestra igualmente. Con prefers-reduced-motion se pinta
 * directamente, sin animación.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const reducedMotion = useReducedMotion();
  const [forceVisible, setForceVisible] = React.useState(false);

  React.useEffect(() => {
    // Red de seguridad: pasado un momento, el contenido se muestra sí o sí.
    const timer = window.setTimeout(() => setForceVisible(true), 1200);
    return () => window.clearTimeout(timer);
  }, []);

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      animate={forceVisible ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, amount: 0.05 }}
      transition={{ duration: 0.55, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
