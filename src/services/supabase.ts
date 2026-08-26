/**
 * Cliente de Supabase: la base de datos compartida donde aterrizan los
 * pedidos, para que lleguen al panel se hagan donde se hagan.
 *
 * Está detrás de dos variables de entorno. Si faltan, la web sigue
 * funcionando exactamente como antes (pedidos solo en el dispositivo), así
 * que se puede desplegar sin base de datos y añadirla después sin tocar
 * código. Ver docs/setup.md.
 *
 * La librería se carga con `import()` dinámico y solo la primera vez que hace
 * falta de verdad: al registrar un pedido o al entrar en el panel. Son unos
 * 225 kB que, si se importaran de la forma normal, se descargaría también
 * quien solo entra a mirar la carta desde el móvil.
 *
 * La clave anon es PÚBLICA por diseño: viaja dentro del JavaScript. Lo que
 * protege los datos de los clientes son las políticas de seguridad por fila
 * definidas en supabase/schema.sql, no el secreto de esta clave. Nunca meter
 * aquí la service_role key, que sí se salta todas las políticas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

/**
 * Salvaguarda: la service_role key se salta la seguridad por fila. Si alguien
 * la pega aquí por error, cualquiera podría descargarse todos los pedidos
 * desde el navegador. Preferimos quedarnos sin base de datos a publicarla.
 */
function looksLikeServiceRoleKey(key: string): boolean {
  try {
    const payload = JSON.parse(atob(key.split(".")[1] ?? ""));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

const misconfigured = Boolean(ANON_KEY && looksLikeServiceRoleKey(ANON_KEY));

if (misconfigured) {
  console.error(
    "[Dulce Flor] VITE_SUPABASE_ANON_KEY parece una service_role key. " +
      "Esa clave se salta la seguridad por fila y NO puede ir en el navegador. " +
      "Se ignora la conexión: usa la clave anon/publishable del proyecto."
  );
}

const configured = Boolean(URL && ANON_KEY && !misconfigured);

/**
 * true cuando hay base de datos compartida detrás. Es síncrono y no descarga
 * nada, para poder decidir qué enseñar en la interfaz sin esperas.
 */
export function isSupabaseConfigured(): boolean {
  return configured;
}

let clientPromise: Promise<SupabaseClient | null> | null = null;

/** El cliente, creándolo la primera vez. null si no hay configuración. */
export function getSupabase(): Promise<SupabaseClient | null> {
  if (!configured) return Promise.resolve(null);
  clientPromise ??= import("@supabase/supabase-js")
    .then(({ createClient }) =>
      createClient(URL!, ANON_KEY!, {
        auth: {
          // La sesión del panel se guarda por pestaña, igual que hacía la
          // autenticación anterior: cerrar la pestaña cierra la sesión.
          storage: typeof sessionStorage !== "undefined" ? sessionStorage : undefined,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    )
    .catch((error) => {
      console.error("[Dulce Flor] No se pudo cargar el cliente de Supabase", error);
      return null;
    });
  return clientPromise;
}
