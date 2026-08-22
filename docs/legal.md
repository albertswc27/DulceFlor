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

Mientras estén vacías, la página muestra «pendiente de confirmación» y un aviso
visible, en lugar de inventar el dato. Ver `src/config/legal.ts`.

## Datos del titular

Dulce Flor ha facilitado por WhatsApp el **nombre completo y el documento de
identidad del titular autónomo**. Al ser datos personales y este repositorio
público, **no se guardan aquí**: están anotados fuera del repositorio (memoria
de trabajo del proyecto) y deben incorporarse a la web mediante variables de
entorno o un fichero no versionado cuando se redacte el aviso legal.

⚠️ Antes de publicarlos hay que **confirmar el número de documento con el
cliente**: en dos mensajes distintos aparecen dos variantes que difieren en un
dígito.

## Datos confirmados que sí pueden publicarse

- Nombre comercial: Dulce Flor Repostería Casera.
- Dirección: C. Ntra. Sra. de Montserrat, 13, bajos · 08922 Santa Coloma de Gramenet.
- WhatsApp de contacto: +34 624 21 31 13.
- Instagram: @dulceflor.bcn.
- Horario: 10:00–22:00 todos los días.

## Pendiente de confirmar antes de redactar los textos

- Nombre fiscal/razón social exacta tal como debe figurar.
- Número de documento definitivo (ver aviso anterior).
- Email de contacto legal, si lo hay.
- Responsable del tratamiento de datos y plazo de conservación de los pedidos.

No se han redactado textos legales definitivos: deben revisarse con el cliente
(y preferiblemente con un asesor) antes de publicarse.
