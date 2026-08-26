# System: World (Procedural)

## CURRENT STATE
- `shared/world-gen.ts:176` CHUNK_SIZE 64, mundo 64×64 chunks, seed 42. 9 fases hasta POIs. `shared/world-map.ts:52` WorldMapManager cachea settlementMaps (12, sizes 14-30) y dungeonMaps (30, sizes 18-28) con interiores generados por `SeededRandom(wx*31+...)`. Streaming vía `world:request` (radius 1-3).
- VERIFIED: determinista por seed si `SeededRandom` no cambia de orden.

## INTENDED TARGET
Principio §10: `gameplay → geography → clima → bioma → recursos → asentamientos → caminos → peligro → economía`. Skill exige safe zones, recursos distribuidos, chokepoints, territorios.

## KNOWN GAP
- Recursos solo 6 celdas dentro de `mine`; no en superficie. Roads son lista de puntos no pavimentados. Ríos intra-chunk sin continuidad. Bioma no dicta peligro.
- `WALKABLE_TILES` incluye `river/lake` mientras `T.water` bloquea en legacy → inconsistencia.

## RISK
- Wrap negativo inconsistente (`%` vs `&`) desincroniza elevación/temperatura.
- `SeededRandom` global compartido: añadir una llamada cambia todas las posiciones de settlements/POIs (drift silencioso).
- `roads.slice(0,500)` trunca ~80% del grafo para el cliente.

## UNKNOWN
- UNKNOWN si la densidad 12 asentamientos en 4096² tiles es la deseada o placeholder.
