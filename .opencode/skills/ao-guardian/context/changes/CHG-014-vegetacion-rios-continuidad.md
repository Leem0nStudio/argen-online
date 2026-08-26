# CHANGE 2026-08-26 — CHG-014: Vegetación por humedad y ríos continuos inter-chunk

## System
World procedural / Biome / Tile / Hydrology / Gathering

## Intent
Que la densidad forestal responda a `rainfall` (no solo `variation`) y que los ríos dejen de cortarse en cada `64×64` chunk por acumulación aislada, volviéndose determinísticos y navegables como valles continuos.

## Before
- `classifyTile` usaba `variation>0.5` fijo para `forest` vs `darkGrass` y `variation>0.7` para `savanna` etc, sin `rain` → bosque 50% aleatorio independiente de clima.
- `computeRiverMap` flow accumulation por chunk 64×64 (4096 celdas, sort, acumulación) solo dentro del chunk → ríos se truncaban en bordes, sin garantía inter-chunk; threshold `CHUNK_SIZE*2` generaba ~0% o ~6% según elev pero aislado.
- `YIELDS` `swamp` no existía como fuente `wood` para `wetland`.

## After
- `classifyTile` ahora usa `rain→vegDensity=(rain-0.3)*1.2` y `slope`: `forest` si `vegDensity>0.15 && variation>0.5` sino `grass`; `savanna→plains` si `vegDensity<0.35`; `jungle→denseForest` si `slope>0.06` y `vegDensity>0.5`; `wetland→swamp` si `vegDensity>0.4`; `dense_forest` requiere `vegDensity>0.3`; etc. Transiciones por `slope` y `rain` en `tundra/taiga/boreal/cold_desert`.
- `computeRiverMap` reemplazado por `isRiverTile(wx,wy)` global: checks `elev 0.02..0.47`, `rain>0.52`, `ridged 0.0016 >0.86` + `warp 0.03` → `>0.88`. Determinístico en todo el mundo (2048×2048), continuo porque `noise.ridged` es global; ~1.09% tiles río en 8×8 chunks.
- `gathering.ts` añade `YIELDS[WT.swamp]` `wood 0.25` y `TOOL/RESPAWN` para `swamp` (5m), `WALKABLE` ya incluye deposits (CHG-012).

## Reason
El bosque aleatorio y ríos cortados hacían el continente “ruido bonito pero sin geografía legible”. Con densidad por humedad el jugador lee dónde hay madera, y con ríos continuos los valles guían rutas comerciales y chokepoints.

## AO Principle
Preserva `exploration` (vegetación y agua como señales) y moderniza `procedural world` (§10) sin añadir `gear-score`.

## Gameplay Invariants
- `forest` más denso donde `rain>0.6`; `wetland` genera `wood` en `swamp`.
- Río ~1% tiles, determinístico por seed, en valles húmedos, atraviesa chunks sin corte.

## Affected Systems
`shared/world-gen` (classifyTile, computeRiverMap, isRiverTile), `shared/world-map` (usa nuevo river map), `server/game/gathering` (swamp).

## Validation
- [x] `tsc 0`, `test 12 OK`, `build` OK
- [x] `WorldGenerator 42 32 32` → 12 settlements/1268 roads/30 POIs idénticos (solo rivers cambian porcentaje 1.09% vs 6% anterior en chunk 0,0)
- [x] Chunk 0,0 rivers 253/4096 (6.1%) vs chunk 10,10 0/4096 (desierto) → distribución por clima, no por chunk.

## AO Compatibility
- [x] Preserved (ríos guían gameplay, no cambian economía por sí solos)

## Risks
- `vegDensity` puede hacer `forest→grass` más agresivo en clima seco → menos `wood` en desierto (intencional) pero vigilar faucet.
- Río 1.09% puede ser escaso para hidrología; ajustable bajando `ridged` threshold a 0.84.

## Follow-up
- Decoraciones `density` por `rain` en `decorations` layer (árboles por tile), y `crystalDeposit` en `wetland` para magia.
