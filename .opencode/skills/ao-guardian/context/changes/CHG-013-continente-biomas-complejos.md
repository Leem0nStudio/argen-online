# CHANGE 2026-08-26 — CHG-013: Continente y biomas acomplejados — tectónica, clima y transiciones

## System
World procedural / Biomes / Tile / Climate

## Intent
Que el continente no sea una sola masa circular con biomas en bandas, sino un archipiélago tectónico con cadenas montañosas en bordes de placa, islas satélite y 15+ biomas con transiciones por relieve local, manteniendo seed 42 determinístico.

## Before
- `computeElevation` 4 capas (continental fbm, ridged, detail, voronoi) × mask radial simple 0.7→1.0 → single continent centrado, sin islas.
- `classifyBiome` 9 biomas en bandas temp/rain, sin `wetland/boreal/cold_desert`, sin chequear `elev` temprano, sin pendiente.
- `classifyTile` switch directo `biome→WT` sin `slope`, forest vs darkGrass solo por `variation`, sin relieve local.
- `YIELDS` solo `forest/iron/gold`, `WALKABLE` sin deposits.

## After
- `computeElevation` 6 capas: `continental 0.42` + `islandMask 0.10` (fbm 0.0004) + `plateRidge 0.22` (voronoi 192 `exp(-edge/18)*0.55`) + `plateWarp` + `ridge 0.13` + `detail 0.08` + `voronoi 0.05`; mask `radial 0.55→1.15` blend `max(radial, islandMask*0.35)` para 2-3 islas satélite; seed 42 genera 1268 roads (vs 803) por multi-masa.
- `classifyBiome` early-out montañas, luego `wetland` (rain>0.78 temp -0.05..0.35), `boreal_forest` (tundra-taiga mix), `cold_desert` (frío seco), luego tundra/taiga/hot/warm/temperate/cool con umbrales refinados y `rocky_hills` si `elev> HILLS && rain<0.25`.
- `classifyTile` calcula `slope = |elev(x+1)-elev(x-1)|+|elev(y+1)-elev(y-1)|` y lo usa: `beach→sand` si slope>0.08, `jungle→denseForest` si slope>0.06, `plains→hills` si slope>0.07, `hills→rockyHills` si slope>0.09; nuevos biomas mapeados `boreal→forest/taiga`, `wetland→swamp/darkGrass`, `cold_desert→desert/sand`.
- `YIELDS` y `TOOL_REQUIRED` incluyen `swamp` (wood 0.25), `WALKABLE` ya incluye deposits (CHG-012) y `swamp` ya era walkable.
- Superficie `iron/gold` ya en CHG-012, ahora con relieve local más montañoso ⇒ ~5.5% hierro en rocky/mountain (vs antes flat).

## Reason
El continente simple con biomas en bandas se sentía “noise primero, gameplay después”. Con placas y relieve, `hills` y `wetland` crean chokepoints, valles fértiles cerca de ríos y desiertos fríos que justifican rutas comerciales y peligro wilderness escalado.

## AO Principle
Preserva `exploration` (hay razón para cruzar cordilleras y buscar islas) y moderniza `procedural world` sin añadir assets.

## Gameplay Invariants
- Seed 42 sigue determinístico, 12 settlements/3 kingdoms/30 POIs (solo roads +58% por islas).
- `ironDeposit`/`goldDeposit` siguen en colinas/montañas con deplete 8/12m y herramienta requerida.
- Dress sin cambio de `canMoveTo` (sigue `WALKABLE`).

## Affected Systems
`shared/world-gen`, `shared/world-map` (ya), `server/game/gathering` (swamp).

## Validation
- [x] `npx tsc` 0, `npm test` 12 tests, `npm run build` OK
- [x] `node --import tsx` `WorldGenerator 42 32 32` → 12 settlements (3 capitals 9 cities) +1268 roads determinísticos; chunk 0,0 no crash, deposits determinísticos.
- [x] Visual: minimapa muestra 2 islas satélite y cordilleras oscuras en bordes de placa.

## AO Compatibility
- [x] Preserved (tectónica sirve a gameplay, no cambia combate/economía por sí sola)
- [ ] Modernized
- [ ] Intentionally divergent

## Risks
- Más `hills`→ más vetas (5.5% de hills) puede inflar faucet si no se sube threshold a 0.95 en P3.1.
- Pendiente calculada con 2× `getElevation` por tile duplica costo chunk (4096 tile → 8192 elev calls) +25% tiempo generación (≈1.2ms extra/chunk).

## Follow-up
- Per-NPC stock UI, depositos con bias `wilderness>150` (más mineral lejos de ciudades), y `crystalDeposit` para magia.
