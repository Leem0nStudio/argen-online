# CHANGE 2026-08-25 — CHG-005: Mazmorras (POIs) + clanes base

## System
Dungeons / Wilderness / Clans / Social

## Intent
Dar destinos de exploración con riesgo/recompensa en los 30 POIs existentes y base social persistente tipo AO.

## Before
- 30 POIs generados (dungeon/ruins/mine/cave/shrine) solo como puntos en el mundo, sin interior.
- Sin clanes.

## After
- **Dungeons**: cada POI tiene mapa interior procedural (tamaño 18-28 según tipo), generación de habitaciones, murallas y portón norte, zona Dungeon/Wilderness. Entrada pisando el tile del POI en el mundo, salida por portón. Spawn de monstruos (MONSTERS_PER_DUNGEON) y colisiones WT. Minimapa marca POIs con puntos de color.
- **Clanes**: `/clan crear <nombre>` (3-20 chars, único), `/clan invitar <usuario>`, `/clan salir`, chat `/c mensaje` solo a miembros, panel con lista y corona líder, hasta 8 miembros, auto-promoción. Runtime-only (no DB persistente aún). Broadcast de estado a todos los miembros.

## Rift Score
45 (Systemic + Gameplay leve para clanes)

## Validation
- tsc OK, build OK (563 modules).
- Parity matrix actualizado.
- Smoke test: canMoveTo para poi_0 verificado, worldMap getMap para poi_0 OK.

## Unresolved
- Clan disband en last member correcto, pero sin tabla DB (se pierde al reiniciar servidor).
- Dungeon interiors sin loot tables diferenciadas ni jefe.
- POI tile marker en mundo no visible como tile especial (entrada invisible hasta pisar).
