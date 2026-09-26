/**
 * Este endpoint es el único del sistema que gasta dinero, así que lo que se
 * comprueba aquí no es tanto que funcione como que NO gaste cuando no debe:
 * sin sesión, con el cliente excluido, con un aviso ya enviado o con un
 * teléfono que no es un móvil. Cada uno de esos casos tiene que cortar ANTES
 * de llamar a la pasarela.
 *
 * La pasarela se sustituye por el modo `pruebas`, que no llama a nadie, y
 * Supabase por un doble configurable: así el circuito completo se recorre de
 * verdad sin tocar la base de datos real ni enviar un solo SMS.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Lo que el doble de Supabase va a responder en cada prueba. */
interface EscenarioSupabase {
  usuario: { id: string } | null;
  pedido: Record<string, unknown> | null;
  errorLectura: boolean;
  errorActualizacion: boolean;
}

const escenario: EscenarioSupabase = {
  usuario: { id: "user-1" },
  pedido: null,
  errorLectura: false,
  errorActualizacion: false,
};

/** Lo que el endpoint ha intentado escribir, para poder comprobarlo. */
let actualizaciones: Array<Record<string, unknown>> = [];

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () =>
        escenario.usuario
          ? { data: { user: escenario.usuario }, error: null }
          : { data: { user: null }, error: { message: "invalid" } },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            escenario.errorLectura
              ? { data: null, error: { message: "boom" } }
              : { data: escenario.pedido, error: null },
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async () => {
          actualizaciones.push(patch);
          return escenario.errorActualizacion ? { error: { message: "boom" } } : { error: null };
        },
      }),
    }),
  }),
}));

const { default: handler } = await import("./avisar-pedido");

const PEDIDO = {
  id: "11111111-2222-3333-4444-555555555555",
  public_id: "DF-2026-A1B2C",
  status: "confirmed",
  customer_name: "Ana Lopez",
  customer_phone: "600111222",
  requested_date: "2026-09-30",
  requested_time: "18:00",
  fulfillment_type: "pickup",
  payload: {},
};

function peticion(body: unknown, { token = "jwt-valido" }: { token?: string | null } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  return new Request("https://dulceflorbcn.es/api/avisar-pedido", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function cuerpo(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(() => {
  escenario.usuario = { id: "user-1" };
  escenario.pedido = { ...PEDIDO, payload: {} };
  escenario.errorLectura = false;
  escenario.errorActualizacion = false;
  actualizaciones = [];

  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.SUPABASE_ANON_KEY = "clave-anon";
  process.env.PUBLIC_SITE_URL = "https://dulceflorbcn.es";
  process.env.SMS_PROVIDER = "pruebas";
  process.env.SMS_SENDER = "DulceFlor";
});

describe("quién puede llamar", () => {
  it("solo acepta POST", async () => {
    const res = await handler.fetch(
      new Request("https://dulceflorbcn.es/api/avisar-pedido", { method: "GET" })
    );
    expect(res.status).toBe(405);
  });

  it("sin cabecera de autorización no se envía nada", async () => {
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }, { token: null }));
    expect(res.status).toBe(401);
    expect((await cuerpo(res)).error).toBe("sin_sesion");
  });

  it("con un token que Supabase rechaza, tampoco", async () => {
    escenario.usuario = null;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(401);
    expect((await cuerpo(res)).error).toBe("sesion_invalida");
    // Lo importante: no se ha llegado ni a preparar el enlace.
    expect(actualizaciones).toHaveLength(0);
  });
});

describe("configuración incompleta", () => {
  it("sin Supabase configurado responde 500 diciendo qué falta", async () => {
    delete process.env.SUPABASE_URL;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(500);
    expect(String((await cuerpo(res)).message)).toContain("SUPABASE_URL");
  });

  it("sin PUBLIC_SITE_URL no se envía: el SMS quedaría sin enlace", async () => {
    delete process.env.PUBLIC_SITE_URL;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(500);
    expect(String((await cuerpo(res)).message)).toContain("PUBLIC_SITE_URL");
  });

  it("sin remitente configurado tampoco, y se detecta antes de tocar el enlace", async () => {
    delete process.env.SMS_SENDER;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(500);
    expect(String((await cuerpo(res)).message)).toContain("SMS_SENDER");
    expect(actualizaciones).toHaveLength(0);
  });
});

describe("qué pedido", () => {
  it("sin orderId responde 400", async () => {
    const res = await handler.fetch(peticion({}));
    expect(res.status).toBe(400);
    expect((await cuerpo(res)).error).toBe("sin_pedido");
  });

  it("con un cuerpo que no es JSON responde 400 y no revienta", async () => {
    const res = await handler.fetch(
      new Request("https://dulceflorbcn.es/api/avisar-pedido", {
        method: "POST",
        headers: { Authorization: "Bearer jwt", "Content-Type": "application/json" },
        body: "{{{",
      })
    );
    expect(res.status).toBe(400);
  });

  it("si el pedido no existe responde 404", async () => {
    escenario.pedido = null;
    const res = await handler.fetch(peticion({ orderId: "otro" }));
    expect(res.status).toBe(404);
  });

  it("si la base de datos falla, lo dice como reintentable", async () => {
    escenario.errorLectura = true;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(502);
    expect((await cuerpo(res)).retriable).toBe(true);
  });
});

describe("todo lo que evita un gasto inútil", () => {
  it("respeta al cliente que ha pedido que no le avisen por SMS", async () => {
    escenario.pedido = { ...PEDIDO, payload: { smsOptOut: true } };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(409);
    expect((await cuerpo(res)).error).toBe("sin_sms");
    expect(actualizaciones).toHaveLength(0);
  });

  it("no avisa dos veces al mismo cliente", async () => {
    escenario.pedido = {
      ...PEDIDO,
      payload: { customerNotifiedAt: "2026-09-25T10:00:00.000Z" },
    };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(409);
    expect((await cuerpo(res)).error).toBe("ya_avisado");
    expect(actualizaciones).toHaveLength(0);
  });

  it("pero sí reenvía cuando se pide expresamente", async () => {
    escenario.pedido = {
      ...PEDIDO,
      payload: { customerNotifiedAt: "2026-09-25T10:00:00.000Z" },
    };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id, force: true }));
    expect(res.status).toBe(200);
    expect((await cuerpo(res)).ok).toBe(true);
  });

  it("no gasta un SMS en un teléfono fijo, y explica por qué", async () => {
    escenario.pedido = { ...PEDIDO, customer_phone: "931234567" };
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(422);
    const body = await cuerpo(res);
    expect(body.error).toBe("telefono_invalido");
    expect(String(body.message)).toContain("móvil");
    expect(actualizaciones).toHaveLength(0);
  });

  it("si no se puede guardar el enlace, NO se envía el SMS", async () => {
    escenario.errorActualizacion = true;
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(502);
    expect(String((await cuerpo(res)).message)).toContain("No se ha enviado");
  });
});

describe("el envío correcto", () => {
  it("responde con el enlace, el coste y el momento del envío", async () => {
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    expect(res.status).toBe(200);
    const body = await cuerpo(res);
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("pruebas");
    // Un aviso normal tiene que caber en un solo SMS facturado.
    expect(body.segments).toBe(1);
    expect(body.encoding).toBe("gsm7");
    expect(String(body.cardUrl)).toMatch(
      /^https:\/\/dulceflorbcn\.es\/mi-pedido\/[2-9bcdfghjkmnpqrstvwxyz]{22}$/
    );
    expect(typeof body.sentAt).toBe("string");
  });

  it("guarda el HASH del token, nunca el token que viaja en el SMS", async () => {
    const res = await handler.fetch(peticion({ orderId: PEDIDO.id }));
    const body = await cuerpo(res);
    const token = String(body.cardUrl).split("/").pop()!;

    expect(actualizaciones).toHaveLength(1);
    const guardado = actualizaciones[0];
    const hash = String(guardado.card_token_hash);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Lo que se guarda no puede ser el token ni contenerlo.
    expect(hash).not.toContain(token);
    expect(JSON.stringify(guardado)).not.toContain(token);
  });

  it("el enlace caduca: se guarda una fecha futura", async () => {
    await handler.fetch(peticion({ orderId: PEDIDO.id }));
    const caduca = new Date(String(actualizaciones[0].card_expires_at)).getTime();
    expect(caduca).toBeGreaterThan(Date.now());
  });

  it("cada envío estrena token: dos avisos no comparten enlace", async () => {
    const primero = await cuerpo(await handler.fetch(peticion({ orderId: PEDIDO.id })));
    const segundo = await cuerpo(
      await handler.fetch(peticion({ orderId: PEDIDO.id, force: true }))
    );
    expect(primero.cardUrl).not.toBe(segundo.cardUrl);
    expect(actualizaciones[0].card_token_hash).not.toBe(actualizaciones[1].card_token_hash);
  });

  it("una entrega a domicilio también sale en un solo SMS", async () => {
    escenario.pedido = { ...PEDIDO, fulfillment_type: "delivery" };
    const body = await cuerpo(await handler.fetch(peticion({ orderId: PEDIDO.id })));
    expect(body.ok).toBe(true);
    expect(body.segments).toBe(1);
  });
});
