# CHANGE 2026-08-26 — CHG-015: Asentamientos en valles y caminos A* con coste

## System
World civilization / Roads / Settlement scoring

## Intent
Que ciudades nazcan en valles fértiles junto a ríos y que los caminos no atraviesen en línea recta montañas/agua, sino que sigan relieve y vadeen ríos con coste.

## Before
- `scoreSettlement` 0.3+temp+rain+biome → ignoraba río y pendiente; ciudades podían caer en ladera `slope>0.09` o lejos de agua.
- `findRoadPath` sampling lineal `dist/3` con búsqueda local 6 tiles si bloqueado → atravesaba `mountain`/`ocean` si no había walkable cercano, sin coste, sin continuidad; 1268 segments en 32×32.

## After
- `scoreSettlement` añade `+0.22` si `isRiverTile` en 13×13 (±6) y `-0.28` si `slope>0.09` else `+0.08` si `slope<0.04`; `goodBiomes` incluye `boreal_forest/wetland`.
- `findRoadPath` A* bounded (padding 40, maxIter 8000) con `heuristic Manhattan`, `moveCostWithRiver = getMoveCost +6 si isRiverTile` (cruzar río caro sin puente), 8 dirs (diagonal 1.4×), `gScore` Map, `cameFrom`; fallback a sampling lineal si no encuentra camino. `generateRoads` sigue conectando nearest neighbor → 1463 segments (+15% por desvíos valle).
- `isRiverTile` ya en CHG-014 (ridged 0.0016), reutilizado para scoring y coste.

## Reason
El continente tectónico ya tenía relieve y ríos continuos, pero la civilización los ignoraba. Con valles fluviales las rutas comerciales tienen sentido y el jugador lee “seguir camino → encontrar agua → encontrar ciudad”.

## AO Principle
Preserva `exploration` y `player routes` (caminos ahora son gameplay, no decoración).

## Gameplay Invariants
- Seed 42 sigue 12 settlements (3 capitals 9 cities) pero roads más largos y con desvíos; asentamientos tienden a valles (validado mismo `Rucci/Valdris/Thornwall` top).
- `getMoveCost` Infinity sigue bloqueando agua/montaña → A* los evita.

## Affected Systems
`shared/world-gen` (scoreSettlement, findRoadPath, isRiverTile reuse).

## Validation
- [x] `tsc 0`, `test 12 OK`, `build` OK
- [x] `WorldGenerator 42 32 32` → 12 settlements, 1463 roads, 30 POIs (vs 1268 antes) determinístico; `generateChunkRegion 0,0` sin crash; `isRiverTile` 1.09% rivers.

## AO Compatibility
- [x] Preserved

## Risks
- A* 8000 iter por road ×12 roads = ~96k nodos → +0.5s generación mundo (aceptable, cache por chunk no afecta runtime).
- Penalización pendiente puede hacer 0 `village` si relieve alto → monitoreo de distribución `capital/city/town/village`.

## Follow-up
- `crystalDeposit` en `wetland` para magia, y puente automático donde road cruza río (actual solo coste +6, no `bridge` tile).
