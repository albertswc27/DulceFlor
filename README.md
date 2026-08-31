# Dulce Flor Repostería — Web de pedidos

POC funcional de la web de **Dulce Flor Repostería Casera**: catálogo real transcrito de sus cartas, configurador de tartas con precios en vivo, pedidos por WhatsApp, panel de administración y kiosk táctil para la tienda.

## Arranque rápido

```bash
npm install
npm run dev
```

## Documentación

- [docs/setup.md](docs/setup.md) — comandos, rutas y credenciales de desarrollo.
- [docs/business-rules.md](docs/business-rules.md) — reglas de negocio (confirmadas y provisionales).
- [docs/architecture.md](docs/architecture.md) — arquitectura, persistencia y límites de la POC.
- [docs/assets-inventory.md](docs/assets-inventory.md) — inventario y renombrado de assets.

## Estado

Primera iteración completa (2026-08-17); desde entonces el cliente ha ido confirmando reglas por WhatsApp (la antelación, entre ellas: estándar de 3 días que ya no bloquea — con menos margen el pedido es urgente — y reserva con hasta 6 meses vista). Queda como **provisional** la zona 2 de entrega — ver `docs/business-rules.md`.
