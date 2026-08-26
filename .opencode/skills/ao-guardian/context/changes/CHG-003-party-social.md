# CHANGE 2026-08-25 — CHG-003: Party y juego social

## System
Party / Social / Progression (XP sharing)

## Intent
Interdependencia entre jugadores: cazar en grupo debe ser ventajoso, con chat propio y roster visible.

## Before
- Sin grupos: XP 100% individual siempre.
- Chat único global.

## After
- **Parties de hasta 5** (`/party <nombre>` invita, aceptar por popup, `/salir` para salir).
- **XP compartida con bonus**: pool = ceil(xp × 1.25) dividido entre miembros cercanos (≤12 tiles, mismo mapa). Solo kill = xp completo sin cambios. Grupo de 2 sobre goblin(15): 9 cada uno (total 18 > 15 → agruparse paga).
- **Chat de grupo**: `/p mensaje` — solo lo ven los miembros, prefijo [Grupo] en cliente.
- Roster en pantalla con corona 👑 del líder; auto-promoción si el líder sale.
- Limpieza completa al desconectar.

## Reason
Skill §7: social dependence + group play como loop central AO.

## AO Principle Affected
Social interdependence, group play, meaningful cooperation.

## Gameplay Invariants
- Servidor autoridad de distribución de XP.
- Solo play NO penalizado (mantiene paridad con CHG-001).
- Lejanos al kill no reciben XP (evita farmeo pasivo).

## Rift Score
40 (Systemic)

## Affected Systems
party.ts (nuevo), combat.ts (killMonster usa sharedXpOnKill), handlers.ts, types.ts, GameScreen.tsx, index.css

## Validation
- tsc OK, build OK.
- Integración sockets: invitación→aceptación→roster con líder ✅; /p recibido por ambos con canal party ✅; salida actualiza roster ✅.
- Unit test XP: killer 9 ✅, cercano 9 ✅, lejano 0 ✅.

## Unresolved Risks
- Sin loot distribution por grupo (loot cae libre, primero que llega).
- Sin indicador de HP de compañeros en roster (solo nivel).
