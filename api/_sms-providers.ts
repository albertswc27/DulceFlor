/**
 * Adaptadores de pasarela de SMS.
 *
 * El fichero empieza por «_» a propósito: Vercel no convierte en función los
 * ficheros que empiezan por guion bajo, así que esto es una utilidad interna
 * y no un endpoint accesible desde fuera.
 *
 * Hay dos proveedores porque la decisión no es solo técnica. LabsMobile es
 * español (factura en euros, con IVA, sin transferencia internacional de
 * datos) y sale a unos 0,045 €/SMS; Twilio cuesta casi el doble y obliga a
 * documentar la transferencia a EE. UU. en la política de privacidad. Se
 * empieza por LabsMobile, pero el día que haga falta cambiar no se toca ni el
 * endpoint ni el panel: solo la variable SMS_PROVIDER.
 *
 * OJO con España: desde el 15/09/2026 los operadores BLOQUEAN los SMS cuyo
 * remitente alfanumérico («DulceFlor») no esté inscrito en el Registro de
 * Alias de la CNMC, y lo hacen en silencio, sin devolver error. Ver
 * docs/setup.md antes de dar por bueno que «no llega ninguno».
 */

/** Resultado normalizado, igual venga del proveedor que venga. */
export type SmsSendResult =
  | { ok: true; providerId: string | null }
  | {
      ok: false;
      /** Código corto para registrar y decidir; no se le enseña al usuario. */
      code: string;
      /** Explicación en cristiano para la persona que está en el mostrador. */
      message: string;
      /**
       * true si reintentar más tarde tiene sentido (caída puntual, móvil
       * apagado). false en fallos definitivos: sin saldo, credenciales mal,
       * número inválido o remitente no registrado. Reintentar esos solo
       * gastaría dinero y tiempo.
       */
      retriable: boolean;
    };

export interface SmsMessage {
  /** Destino en E.164, con el «+» delante. */
  to: string;
  text: string;
  /** Remitente: alias alfanumérico o número. */
  sender: string;
  /** Referencia propia, para casar el envío con el pedido en el proveedor. */
  reference: string;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

/** Timeout de red: si la pasarela no responde, no bloqueamos el panel. */
const TIMEOUT_MS = 10_000;

async function postWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function basicAuth(user: string, secret: string): string {
  return `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`;
}

/* ------------------------------------------------------------------ */
/* LabsMobile (proveedor español, el que se usa por defecto)           */
/* ------------------------------------------------------------------ */

/**
 * Códigos de error de LabsMobile que conviene traducir. El resto se registra
 * tal cual: es preferible enseñar un código raro que inventarse una causa.
 */
const LABSMOBILE_ERRORS: Record<string, { message: string; retriable: boolean }> = {
  "10": { message: "La petición al proveedor de SMS iba incompleta.", retriable: false },
  "11": { message: "La petición al proveedor de SMS estaba mal formada.", retriable: false },
  "21": { message: "El texto del SMS llegó vacío.", retriable: false },
  "23": { message: "No se indicó ningún destinatario.", retriable: false },
  "27": { message: "El texto del SMS contiene caracteres que el proveedor no admite.", retriable: false },
  "30": { message: "El proveedor no pudo enviar el mensaje.", retriable: true },
  "35": {
    message: "La cuenta de SMS se ha quedado sin saldo. Recarga créditos para seguir avisando.",
    retriable: false,
  },
  "51": { message: "Faltan datos obligatorios en la petición al proveedor.", retriable: false },
};

function labsMobile(username: string, apiToken: string): SmsProvider {
  return {
    name: "labsmobile",
    async send({ to, text, sender, reference }) {
      let response: Response;
      try {
        response = await postWithTimeout("https://api.labsmobile.com/json/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: basicAuth(username, apiToken),
          },
          body: JSON.stringify({
            message: text,
            tpoa: sender,
            // LabsMobile quiere el número SIN el «+»: 34600111222.
            recipient: [{ msisdn: to.replace(/^\+/, "") }],
            // Máximo 20 caracteres según su documentación.
            subid: reference.slice(0, 20),
          }),
        });
      } catch {
        return {
          ok: false,
          code: "red",
          message: "No se ha podido contactar con el proveedor de SMS.",
          retriable: true,
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          code: `http_${response.status}`,
          message: "El proveedor de SMS ha rechazado las credenciales. Revisa la configuración.",
          retriable: false,
        };
      }
      if (response.status === 402) {
        return {
          ok: false,
          code: "http_402",
          message: "La cuenta de SMS se ha quedado sin saldo.",
          retriable: false,
        };
      }

      // Un HTTP 200 NO basta: LabsMobile devuelve los fallos de negocio
      // (sin saldo, texto inválido) dentro del cuerpo, con code distinto de
      // "0" y como STRING, no como número.
      let body: { code?: unknown; subid?: unknown; message?: unknown };
      try {
        body = (await response.json()) as typeof body;
      } catch {
        return {
          ok: false,
          code: "respuesta_ilegible",
          message: "El proveedor de SMS respondió algo que no se entiende.",
          retriable: true,
        };
      }

      const code = String(body.code ?? "");
      if (code === "0") {
        return { ok: true, providerId: typeof body.subid === "string" ? body.subid : null };
      }
      const known = LABSMOBILE_ERRORS[code];
      return {
        ok: false,
        code: `labsmobile_${code || "desconocido"}`,
        message:
          known?.message ??
          `El proveedor de SMS devolvió el error ${code || "desconocido"}: ${String(
            body.message ?? ""
          )}`,
        retriable: known?.retriable ?? true,
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Twilio (alternativa, por si algún día se cambia)                    */
/* ------------------------------------------------------------------ */

/**
 * Errores de Twilio que NO se deben reintentar. 30041 y 30042 son los del
 * remitente alfanumérico sin registrar, justo lo que provoca el bloqueo
 * español desde septiembre de 2026.
 */
const TWILIO_PERMANENT: Record<string, string> = {
  "21211": "El teléfono del cliente no tiene un formato válido.",
  "21608": "La cuenta de Twilio está en pruebas y no puede escribir a este número.",
  "21612": "Twilio no puede enviar con esta combinación de remitente y destino.",
  "30006": "El número de destino es un fijo o el operador no lo alcanza.",
  "30041":
    "El remitente alfanumérico no está registrado. En España hay que inscribirlo en el Registro de Alias de la CNMC.",
  "30042": "El operador ha bloqueado este remitente alfanumérico por genérico.",
};

function twilio(accountSid: string, authToken: string): SmsProvider {
  return {
    name: "twilio",
    async send({ to, text, sender, reference }) {
      const form = new URLSearchParams({
        To: to,
        From: sender,
        Body: text,
      });
      let response: Response;
      try {
        response = await postWithTimeout(
          `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
            accountSid
          )}/Messages.json`,
          {
            method: "POST",
            headers: {
              // Twilio NO acepta JSON en este endpoint: es formulario.
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: basicAuth(accountSid, authToken),
              "Idempotency-Key": reference,
            },
            body: form.toString(),
          }
        );
      } catch {
        return {
          ok: false,
          code: "red",
          message: "No se ha podido contactar con el proveedor de SMS.",
          retriable: true,
        };
      }

      let body: { sid?: unknown; code?: unknown; message?: unknown };
      try {
        body = (await response.json()) as typeof body;
      } catch {
        body = {};
      }

      if (response.ok) {
        return { ok: true, providerId: typeof body.sid === "string" ? body.sid : null };
      }

      const code = String(body.code ?? response.status);
      const permanent = TWILIO_PERMANENT[code];
      return {
        ok: false,
        code: `twilio_${code}`,
        message:
          permanent ??
          `El proveedor de SMS devolvió el error ${code}: ${String(body.message ?? "")}`,
        retriable: permanent === undefined,
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Modo de pruebas                                                     */
/* ------------------------------------------------------------------ */

/**
 * No envía nada y da el envío por bueno. Sirve para probar todo el circuito
 * —permisos, enlace, ficha— sin gastar créditos ni molestar a nadie, y para
 * que el panel siga siendo usable mientras se tramita el alias en la CNMC.
 * Se activa con SMS_PROVIDER=pruebas y deja rastro en los registros.
 */
function consola(): SmsProvider {
  return {
    name: "pruebas",
    async send({ to, text, sender }) {
      console.info(
        `[SMS en modo pruebas] de "${sender}" a ${to} (${text.length} caracteres): ${text}`
      );
      return { ok: true, providerId: null };
    },
  };
}

/* ------------------------------------------------------------------ */

export type ProviderSetup =
  | { ok: true; provider: SmsProvider; sender: string }
  | { ok: false; message: string };

/**
 * Construye el proveedor a partir de las variables de entorno del servidor.
 *
 * Si falta algo, se dice EXACTAMENTE qué variable falta: el fallo más
 * probable de este módulo no es el código, es una variable sin poner en
 * Vercel, y adivinarlo a ciegas cuesta mucho más que leerlo aquí.
 */
export function buildProvider(env: NodeJS.ProcessEnv): ProviderSetup {
  const sender = (env.SMS_SENDER ?? "").trim();
  if (!sender) {
    return { ok: false, message: "Falta la variable de entorno SMS_SENDER." };
  }

  const name = (env.SMS_PROVIDER ?? "labsmobile").trim().toLowerCase();

  if (name === "pruebas") return { ok: true, provider: consola(), sender };

  if (name === "labsmobile") {
    const username = (env.LABSMOBILE_USERNAME ?? "").trim();
    const apiToken = (env.LABSMOBILE_TOKEN ?? "").trim();
    if (!username || !apiToken) {
      return {
        ok: false,
        message: "Faltan las variables de entorno LABSMOBILE_USERNAME y/o LABSMOBILE_TOKEN.",
      };
    }
    return { ok: true, provider: labsMobile(username, apiToken), sender };
  }

  if (name === "twilio") {
    const sid = (env.TWILIO_ACCOUNT_SID ?? "").trim();
    const token = (env.TWILIO_AUTH_TOKEN ?? "").trim();
    if (!sid || !token) {
      return {
        ok: false,
        message: "Faltan las variables de entorno TWILIO_ACCOUNT_SID y/o TWILIO_AUTH_TOKEN.",
      };
    }
    return { ok: true, provider: twilio(sid, token), sender };
  }

  return {
    ok: false,
    message: `SMS_PROVIDER tiene el valor "${name}", que no existe. Valores válidos: labsmobile, twilio, pruebas.`,
  };
}
