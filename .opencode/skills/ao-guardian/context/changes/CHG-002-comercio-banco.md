# CHANGE 2026-08-25 — CHG-002: Economía jugador-jugador (comercio + banco)

## System
Economy / Trade / Persistence / NPCs

## Intent
Habilitar interdependencia económica entre jugadores (pilar AO) y dar sumidero/refugio seguro al oro con el banco.

## Before
- Sin comercio J-J: única salida de ítems era venderle a NPCs.
- Sin banco: todo el oro viajaba siempre en el personaje (riesgo irreal de perderlo).
- Socket.io no tenía salas personales por jugador → imposible enviar eventos directos a un jugador.

## After
- **Banco**: NPC banquero en capitales y ciudades. Depósito/retiro de oro e ítems. Persistido en SQLite (tabla `bank`, columna `players.bank_gold` con migración automática).
- **Comercio J-J**: invitación por comando `/comerciar <nombre>` (requiere cercanía ≤5 tiles, mismo mapa), sesión con ofertas de ítems+oro por ambos lados, confirmación mutua, swap atómico validado por el servidor, cancelación y limpieza en desconexión.
- **Salas personales**: cada socket hace join(playerId) al autenticar → `io.to(playerId)` funciona.

## Reason
Skill §7: social/economic interdependence es cualidad sistémica central de AO.

## AO Principle Affected
Player-driven economy, scarcity, social dependence, risk (oro en bóveda vs cargado).

## Gameplay Invariants
- Servidor autoridad total: valida posesión de ítems/oro antes del swap.
- Ítems ofrecidos NO salen del inventario hasta doble confirmación.
- Validaciones anti-duplicado en confirmación.

## Rift Score
40 (Systemic) — nuevo sistema pero aditivo; no altera progresión ni combate.

## Affected Systems
bank.ts (nuevo), trade.ts (nuevo), database.ts, handlers.ts, world-map.ts (banqueros), types.ts, GameScreen.tsx (UI), index.css

## Validation
- tsc OK, build OK.
- Unit test trade.ts: swap completo oro+ítems PASS (A: 100→50 gold, -2 pociones; B: 100→150, +2).
- Integración sockets: invitación→aceptación→ofertas→doble confirmación→"completado" PASS.
- Banco live: depositar 60 (100→40) ✅, retirar 30 (40→70) ✅.

## Unresolved Risks
- UI de comercio usa prompts nativos (funcional pero mejorable).
- Falta UI para invitar comercio clickeando al jugador (hoy solo comando de chat).
- Criminales podrían comerciar para lavar botín (sin restricción v1).
