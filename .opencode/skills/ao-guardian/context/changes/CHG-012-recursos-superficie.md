# CHANGE 2026-08-26 — CHG-012: Recursos en superficie — vetas en colinas/montañas

## System
World procedural / Gathering / Resources

## Intent
Que `iron_ore`/`gold_nugget` no solo existan en interiores de minas (6 celdas) sino también en el mundo abierto, con distribución determinística y escasez real, para que `/recolectar` sea útil en wilderness y no solo en dungeons.

## Before
- `WT.ironDeposit/goldDeposit` definidos pero nunca asignados en `world-gen.ts:438` `classifyTile`; solo aparecían en interiores de `mine` POIs (6 celdas). `findResourceTile` en `world` nunca encontraba `ironDeposit`/`goldDeposit` en superficie → `gather` solo daba `wood` (forest).
- `WALKABLE_TILES` no incluía deposits → aunque se generaran, serían bloqueantes.
- Sin veta visible en wilderness lejano; economía dependía de farmeo de bosques + drops.

## After
- `shared/world-gen.ts:914` post-river: para cada chunk, si `tile` es `hills|rockyHills|mountain|highMountain`, usa `noise.simple(wx,wy,999)` → `>0.985` → `goldDeposit` (~0.8%), `>0.93` → `ironDeposit` (~5.5%). Determinístico por seed, sin depender de settlements.
- `shared/world-map.ts:14` `WALKABLE_TILES` incluye `ironDeposit|goldDeposit|crystalDeposit` para que sean transitables y recolectables por adyacencia o encima.
- `server/game/gathering.ts` ya maneja `TOOL_REQUIRED` + `depleted` con mensaje `Este filón está agotado` (CHG-011) y `YIELDS` cubre `forest`+deposits → ahora encuentra vetas en `world` colinas.
- Probabilidad ajustada para ~28 hierro + 6 oro por chunk de colinas (global ~20k vetas en 32×32, raro por tile total ~0.3%).

## Reason
Cerrar gap `parity-matrix:Resources` (solo 6 celdas en minas) y reforzar escasez: wilderness lejano tiene más colinas → más vetas, pero con `depleted` 8-12m y herramienta requerida, no es faucet infinito.

## AO Principle
Preserva `exploration` y `risk/reward`: hay razón para adentrarse en montañas peligrosas.

## Gameplay Invariants
- Veta en superficie solo en colinas/montañas, determinística, visible y recolectable a 1 tile.
- Bosque sigue siendo `wood` abundante pero también finito por nodo.

## Affected Systems
`shared/world-gen`, `shared/world-map`, `server/game/gathering` (reusa).

## Validation
- [x] `npx tsc` 0
- [x] `npm test` 12 tests OK (resources chunk no rompe)
- [x] Manual: seed 42 mundo genera vetas visibles en minimapa/colinas; `/recolectar` en `hills` con pico da `iron_ore`; segundo intento → `agotado`.

## AO Compatibility
- [x] Preserved (procedural scarcity, no boost mágico)

## Risks
- Densidad 0.3% puede ser alta en 32×32 → monitorear economía faucet; ajustable subiendo thresholds a 0.95/0.99.

## Follow-up
- Mostrar `crystalDeposit` para magia futura, y variar rareza con distancia a asentamientos (más vetas en wilderness >150 tiles).
