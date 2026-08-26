# CHANGE 2026-08-25 — CHG-007: Quests, penalización de muerte completa y wilderness

## System
Quests / Death / Reputation / Wilderness / NPCs

## Intent
Cerrar el loop de facciones (matar → reputación → misiones) y dar consecuencia completa a la muerte.

## Before
- NPCs quest solo diálogo.
- Muerte PvP solo oro; sin ítem drop ni rep penalty.

## After
- Quests: `shared/quests.ts` 4 misiones de caza, `server/game/quest.ts` estado por jugador, handlers `/quest aceptar|abandonar|reclamar`, HUD con progreso y lista. Recompensa +rep facción del territorio. Integrado en `killMonster` y `sharedXpOnKill` para todo el party cercano.
- Muerte PvP: drop de 50% de un stack aleatorio al suelo + -5 rep con el reino del asesino (`combat.ts:145`) y broadcast `groundItems:update` + `player:update` a víctima.
- Wilderness: bias hacia Ogro/Esqueleto a >150 tiles de cualquier asentamiento (`server/game/monster-ai.ts:89`).

## Rift Score
48 (Systemic+Gameplay)

## Validation
- tsc OK, build OK.

## Unresolved
- Quests sin persistencia DB (se pierden al desconectar).
