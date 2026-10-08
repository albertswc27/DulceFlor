# Aviso legal y privacidad

La web **ya publica** la página `/aviso-legal`, enlazada desde el pie en todas
las páginas públicas. Su contenido describe el funcionamiento real del sitio
(qué datos se piden, para qué, dónde se guardan y que no hay cookies de
seguimiento), sin cláusulas genéricas.

**Falta un único dato para darla por definitiva:** la identificación fiscal del
titular. Se rellena sin tocar código, con dos variables de entorno en el
despliegue:

```bash
VITE_LEGAL_HOLDER="Nombre y apellidos del titular"
VITE_LEGAL_TAX_ID="00000000X"
```

Mientras estén vacías, la página legal **omite esas dos líneas**: no inventa el
dato, pero tampoco enseña «pendiente de confirmación» a un cliente. Ver
`src/config/legal.ts`.

⚠️ Eso significa que **hoy el aviso legal se publica sin identificar al
titular**, y el art. 10 de la LSSI lo exige. Como no se ve desde fuera, hay dos
recordatorios:

- `npx vite build` avisa por consola si las variables no están puestas
  (`vite.config.ts`, plugin `dulce-flor-avisar-datos-legales`).
- `LEGAL_DATA_PENDING`, en `src/config/legal.ts`, vale `true` mientras falten.

Los datos los facilitó Dulce Flor por WhatsApp y están anotados **fuera del
repositorio**. Se ponen como variables de entorno en Vercel, en las tres
environments, y **nunca** en el código: son datos personales y esto es público.

## Datos del titular

Dulce Flor ha facilitado por WhatsApp el **nombre completo y el documento de
identidad del titular autónomo**. Al ser datos personales y este repositorio
público, **no se guardan aquí**: están anotados fuera del repositorio (memoria
de trabajo del proyecto) y deben incorporarse a la web mediante variables de
entorno o un fichero no versionado cuando se redacte el aviso legal.

✅ **Resuelto el 07/10/2026.** Había dos variantes del documento que diferían en
un dígito, y la letra de control lo decide sola: a `16902215` le corresponde la
**K**, así que `16902215K` es el bueno; a `16002215` le tocaría una **B**, de
modo que `16002215K` nunca pudo existir. Ya está puesto y publicado.

## Datos confirmados que sí pueden publicarse

- Nombre comercial: Dulce Flor Repostería Casera.
- Dirección: C. Ntra. Sra. de Montserrat, 13, bajos · 08922 Santa Coloma de Gramenet.
- WhatsApp de contacto: +34 604 23 45 18.
- Instagram: @dulceflor.bcn.
- Horario (actualizado 01/10/2026 y confirmado con el cartel de la tienda): martes a sábado 10:00–21:00, domingos 11:00–20:00, **lunes cerrado**.

## Pendiente de confirmar antes de redactar los textos

- Nombre fiscal/razón social exacta tal como debe figurar.
- Email de contacto legal, si lo hay.
- Responsable del tratamiento de datos y plazo de conservación de los pedidos.

No se han redactado textos legales definitivos: deben revisarse con el cliente
(y preferiblemente con un asesor) antes de publicarse.
