/**
 * El fallo más probable de este módulo no es el código: es una variable de
 * entorno sin poner en Vercel. Y se manifiesta de la peor forma posible —los
 * SMS dejan de salir sin que nadie se entere— así que aquí se fija que la
 * configuración se valide ANTES de intentar enviar nada y que el mensaje diga
 * exactamente qué falta.
 */
import { describe, expect, it } from "vitest";
import { buildProvider } from "./_sms-providers";

/** `NodeJS.ProcessEnv` es un Record<string, string | undefined>. */
function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

describe("buildProvider", () => {
  it("sin remitente no se puede enviar, y lo dice", () => {
    const setup = buildProvider(env({ SMS_PROVIDER: "labsmobile" }));
    expect(setup.ok).toBe(false);
    if (!setup.ok) expect(setup.message).toContain("SMS_SENDER");
  });

  it("LabsMobile es el proveedor por defecto: no hace falta declararlo", () => {
    const setup = buildProvider(
      env({ SMS_SENDER: "DulceFlor", LABSMOBILE_USERNAME: "a@b.c", LABSMOBILE_TOKEN: "t" })
    );
    expect(setup.ok).toBe(true);
    if (setup.ok) {
      expect(setup.provider.name).toBe("labsmobile");
      expect(setup.sender).toBe("DulceFlor");
    }
  });

  it("con LabsMobile a medias dice QUÉ variables faltan", () => {
    const setup = buildProvider(
      env({ SMS_SENDER: "DulceFlor", LABSMOBILE_USERNAME: "a@b.c" })
    );
    expect(setup.ok).toBe(false);
    if (!setup.ok) {
      expect(setup.message).toContain("LABSMOBILE_USERNAME");
      expect(setup.message).toContain("LABSMOBILE_TOKEN");
    }
  });

  it("Twilio se activa por variable, sin tocar código", () => {
    const setup = buildProvider(
      env({
        SMS_PROVIDER: "twilio",
        SMS_SENDER: "DulceFlor",
        TWILIO_ACCOUNT_SID: "ACxxx",
        TWILIO_AUTH_TOKEN: "secreto",
      })
    );
    expect(setup.ok).toBe(true);
    if (setup.ok) expect(setup.provider.name).toBe("twilio");
  });

  it("con Twilio a medias tampoco arranca", () => {
    const setup = buildProvider(
      env({ SMS_PROVIDER: "twilio", SMS_SENDER: "DulceFlor", TWILIO_ACCOUNT_SID: "ACxxx" })
    );
    expect(setup.ok).toBe(false);
    if (!setup.ok) expect(setup.message).toContain("TWILIO_AUTH_TOKEN");
  });

  it("el modo de pruebas no necesita credenciales: sirve mientras se tramita el alias", () => {
    const setup = buildProvider(env({ SMS_PROVIDER: "pruebas", SMS_SENDER: "DulceFlor" }));
    expect(setup.ok).toBe(true);
    if (setup.ok) expect(setup.provider.name).toBe("pruebas");
  });

  it("un proveedor mal escrito falla en claro, no envía por el que no es", () => {
    const setup = buildProvider(env({ SMS_PROVIDER: "labsmovil", SMS_SENDER: "DulceFlor" }));
    expect(setup.ok).toBe(false);
    if (!setup.ok) {
      expect(setup.message).toContain("labsmovil");
      expect(setup.message).toContain("labsmobile");
    }
  });

  it("ignora espacios sobrantes al pegar las variables en el panel de Vercel", () => {
    const setup = buildProvider(
      env({
        SMS_PROVIDER: "  Pruebas  ",
        SMS_SENDER: "  DulceFlor  ",
      })
    );
    expect(setup.ok).toBe(true);
    if (setup.ok) expect(setup.sender).toBe("DulceFlor");
  });
});

describe("el modo de pruebas", () => {
  it("da el envío por bueno sin llamar a nadie", async () => {
    const setup = buildProvider(env({ SMS_PROVIDER: "pruebas", SMS_SENDER: "DulceFlor" }));
    expect(setup.ok).toBe(true);
    if (!setup.ok) return;
    const resultado = await setup.provider.send({
      to: "+34600111222",
      text: "Dulce Flor: pedido DF-1 tramitado.",
      sender: "DulceFlor",
      reference: "DF-1",
    });
    expect(resultado.ok).toBe(true);
  });
});
