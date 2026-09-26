# Aviso por SMS al cliente

Cuando Dulce Flor marca un pedido como **Tramitado**, el cliente recibe
automáticamente un SMS con su número de pedido, el día y la hora de recogida, y
un enlace a una ficha web con el detalle y las condiciones.

---

## ⚠️ Antes de nada: el alias hay que registrarlo en la CNMC

**Desde el 15 de septiembre de 2026, los operadores españoles bloquean todo SMS
cuyo remitente alfanumérico no esté inscrito en el Registro de Alias de la
CNMC.** Lo bloquean *en silencio*: el proveedor responde «enviado», no hay
rebote, y el cliente simplemente no recibe nada.

Marco normativo: Orden TDF/149/2025 (BOE 15/02/2025) y Circular 1/2026 de la
CNMC. La fecha de bloqueo era el 7 de junio de 2026 y se trasladó al 15 de
septiembre; ya está en vigor y no hay periodo de gracia.

Es decir: **enviar con el remitente `DulceFlor` sin haberlo registrado no
funciona**, por muy bien configurado que esté todo lo demás.

### Qué hay que hacer

1. **Registrar el alias.** Trámite «Gestión del Registro de alias» en la sede
   electrónica de la CNMC (formulario 213). Es **gratuito**.
   - Lo puede hacer la titular con certificado digital (FNMT/DNIe) o Cl@ve, o
     delegarlo en el proveedor de SMS con una carta de autorización.
   - Hay que acreditar el vínculo con el alias: marca, nombre comercial,
     denominación social o dominio web.
   - Hay que declarar el **proveedor de origen (PRO)** que va a usar ese alias.
     Si se registra el alias pero no el proveedor correcto, el SMS se bloquea
     igual.
   - Plazo de resolución: **hasta un mes**.
2. **Respetar las mayúsculas.** El bloqueo distingue: `DulceFlor` no es lo mismo
   que `DULCEFLOR`. Hay que enviar exactamente con lo registrado.
3. **Mientras tanto**, hay dos salidas:
   - `SMS_PROVIDER=pruebas`: no envía nada, pero deja probar todo el circuito
     (permisos, enlace, ficha) sin gastar ni molestar a nadie.
   - Un **remitente numérico**: los identificadores puramente numéricos están
     exentos del registro. Llega, pero el cliente ve un número, no el nombre de
     la tienda.

> **Importante para el cliente:** un alias alfanumérico es de una sola
> dirección. Si la clienta responde al SMS, ese mensaje **se pierde**. Por eso
> el texto lleva el enlace a la ficha, donde sí hay botones de WhatsApp y
> teléfono.

---

## Proveedor

Por defecto **LabsMobile** (empresa española, Barcelona):

| | LabsMobile | Twilio |
| --- | --- | --- |
| Precio por SMS a España | ~0,045 € | ~0,075 € |
| Cuota mensual | no | no |
| Factura | en euros, con IVA | en dólares |
| Transferencia internacional de datos | **no** | sí (EE. UU.) |
| Tramita el alias en la CNMC | sí | no |

Se eligió LabsMobile porque evita el capítulo de transferencias
internacionales en la política de privacidad y porque tramita el registro del
alias. El código admite los dos: se cambia con `SMS_PROVIDER`, sin tocar nada
más.

**Hay que firmar/aceptar el contrato de encargado del tratamiento (art. 28
RGPD) con el proveedor y guardarlo.** No basta con crear la cuenta.

---

## Variables de entorno (en Vercel, NO en el repositorio)

Ninguna lleva el prefijo `VITE_`: ese prefijo hace que Vite las incruste en el
JavaScript que se descarga cualquier visitante, y este repositorio es público.

| Variable | Qué es |
| --- | --- |
| `SMS_PROVIDER` | `labsmobile` (por defecto), `twilio` o `pruebas` |
| `SMS_SENDER` | El remitente. `DulceFlor` una vez registrado en la CNMC |
| `LABSMOBILE_USERNAME` | El email de la cuenta de LabsMobile |
| `LABSMOBILE_TOKEN` | Token de API (panel WebSMS → Configuración API). **No** es la contraseña de acceso |
| `TWILIO_ACCOUNT_SID` | Solo si `SMS_PROVIDER=twilio` |
| `TWILIO_AUTH_TOKEN` | Solo si `SMS_PROVIDER=twilio` |
| `SUPABASE_URL` | La misma URL que `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | La misma clave que `VITE_SUPABASE_ANON_KEY` |
| `PUBLIC_SITE_URL` | Dominio público, sin barra final. **Va dentro de cada SMS enviado**: cambiarlo después deja muertos los enlaces ya enviados |

Las variables solo se aplican a despliegues **nuevos**: después de añadirlas hay
que volver a desplegar.

> `SUPABASE_ANON_KEY` es la clave pública, no la `service_role`. La función no
> necesita la `service_role` y no debe tenerla: trabaja con la sesión de quien
> llama, así que no puede ver ni tocar nada que la dueña no pudiera desde el
> panel.

---

## Base de datos

Ejecutar `supabase/ficha-sms.sql` en el SQL Editor de Supabase, **después** de
`schema.sql`. Es idempotente. Añade:

- `orders.card_token_hash` y `orders.card_expires_at`.
- La función `get_order_card(token)`, que es lo que lee la ficha pública.

La base de datos guarda el **hash** del token, nunca el token. Consecuencia
buscada: si alguien se llevara la tabla entera, no podría fabricar enlaces
válidos. Consecuencia asumida: **reenviar el aviso genera un enlace nuevo y el
anterior deja de funcionar**.

---

## Cómo se comporta

1. La dueña pulsa **Tramitado** en el detalle del pedido.
2. El panel llama a `/api/avisar-pedido` con su sesión.
3. La función comprueba, por este orden y **antes de gastar nada**: que la
   sesión es válida, que el pedido existe, que el cliente no está excluido de
   los SMS, que no se le ha avisado ya, y que el teléfono es un móvil.
4. Genera el token, guarda su hash, envía el SMS.
5. **Solo si la pasarela confirma el envío**, el pedido queda marcado como
   avisado. Si falla, el panel lo dice y ofrece WhatsApp.

Casos que el panel resuelve sin que haya que preguntar a nadie:

| Situación | Qué pasa |
| --- | --- |
| El cliente dejó un fijo | Se avisa en la ficha del pedido **antes** de tramitar y no se envía nada |
| Ya se le avisó | No se reenvía; hay que pulsar «volver a enviar» expresamente |
| El cliente no quiere SMS | Se marca en su pedido y el envío automático lo respeta |
| Sin saldo / credenciales mal | Mensaje concreto en el panel y botón de WhatsApp |
| Sin conexión | Se dice que no se ha enviado, y se puede reintentar |

---

## Coste

Un SMS de 160 caracteres es **1 envío facturado**. Pasarse de ahí son 2.

La trampa cara: el alfabeto GSM-7 incluye `é`, `à`, `ñ`, `ü`, `¡` y `¿`, pero
**no incluye `á`, `í`, `ó` ni `ú`**. Una sola de esas vocales convierte el
mensaje a Unicode y baja el límite a **70 caracteres**, es decir, duplica el
coste.

Por eso el texto del aviso está escrito sin ellas (`esta tramitado`, sin tilde:
no es una errata) y hay un test que falla si alguien reescribe el mensaje y se
pasa de un envío. El nombre de pila del cliente es la excepción: «Sofía» lleva
tilde prohibida y ese envío concreto cuesta el doble. Se asume a propósito —son
céntimos y el saludo personal lo pidió el negocio— y el panel enseña el coste
real antes de enviar.

---

## Probar sin gastar

```bash
# 1. En Vercel (o en .env local si se usa `vercel dev`):
SMS_PROVIDER=pruebas
SMS_SENDER=DulceFlor
PUBLIC_SITE_URL=https://…
SUPABASE_URL=…
SUPABASE_ANON_KEY=…
```

Con `pruebas` no se envía nada: el circuito completo funciona, el enlace se
genera de verdad y la ficha se puede abrir. En los registros de la función
aparece el texto exacto que se habría enviado.
