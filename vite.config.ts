/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

/**
 * Avisa al construir si el aviso legal va a salir sin titular ni NIF.
 *
 * El artículo 10 de la LSSI obliga a que la web identifique a quien está
 * detrás. La página legal omite esas líneas cuando las variables no están
 * —mejor eso que enseñarle «pendiente de confirmación» a un cliente— y ese
 * es justo el problema: se publica incompleta y en silencio, y nadie se
 * enteraría nunca.
 *
 * Avisa, no falla: bloquear el despliegue de toda la web por esto sería peor.
 * Los datos son personales y el repositorio es público, así que van en
 * variables de entorno de Vercel, nunca en el código. Ver docs/legal.md.
 */
function avisarSiFaltanDatosLegales(): Plugin {
  let modo = "production";
  return {
    name: "dulce-flor-avisar-datos-legales",
    apply: "build",
    config(_, entorno) {
      modo = entorno.mode;
    },
    buildStart() {
      // loadEnv y no process.env a secas: en Vercel las variables llegan por
      // el entorno, pero en local viven en el .env y solo Vite las lee. Mirando
      // solo process.env el aviso saltaba en cada build local aunque los datos
      // estuvieran puestos, y un aviso que miente acaba ignorándose.
      const env = { ...loadEnv(modo, process.cwd(), ""), ...process.env };
      const faltan = ["VITE_LEGAL_HOLDER", "VITE_LEGAL_TAX_ID"].filter(
        (nombre) => !env[nombre]?.trim()
      );
      if (faltan.length === 0) return;
      this.warn(
        `El aviso legal se va a publicar SIN identificar al titular: falta ${faltan.join(" y ")}. ` +
          "El art. 10 de la LSSI lo exige. Ponlas en Vercel (las tres environments) " +
          "y vuelve a desplegar. Ver docs/legal.md."
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), avisarSiFaltanDatosLegales()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Separa las librerías del código propio: el navegador puede cachear
         * React y las animaciones entre despliegues y la primera carga baja.
         */
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-forms": ["zod", "date-fns", "sonner"],
        },
      },
    },
  },
  test: {
    environment: "node",
    // api/ también se prueba: su configuración es lo que más fácilmente se
    // queda a medias, y un fallo ahí solo se ve cuando un SMS no sale.
    include: ["src/**/*.test.ts", "api/**/*.test.ts"],
  },
});
