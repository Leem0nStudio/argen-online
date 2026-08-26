# CHANGE 2026-08-26 — CHG-010: P2 — Rooms por mapa, logger y fixes de equipo

## System
Networking / Ground / Combat / Inventory / Observability / Tooling

## Intent
Aislar el tráfico por mapa para eliminar fuga de info cross-map, reemplazar `console.log` por logger estructurado y cerrar dos bugs de equipo (head defense y pérdida en equip).

## Before
- `handlers.ts` y `game-loop.ts` usaban `io.emit` global para `combat:damage`, `combat:death`, `groundItems:update`, `monsters:update` y `chat` local; cualquier cliente recibía eventos de mazmorras lejanas aunque estuviera en otra ciudad.
- `socket.join(mapId)` solo en `sendMapState`; al teleportar no se hacía `leave(oldMapId)` → socket quedaba en 2 rooms.
- `server/index.ts:42` `app.get("*")` antes de `/health` hacía health inalcanzable; `world.ts:11` y `handlers.ts:101,795` con `console.log` sin nivel.
- `combat.ts:37` defensa sumaba `armor/shield/boots/ring` omitiendo `head`; `inventory.ts:73` si `currentEquipped` y sin slot libre, sobrescribía `player.equipment` y perdía el ítem previo.
- Sin `eslint`/`prettier` baseline, `tsc` ya incluía server pero sin formato.

## After
- Rooms: `sendMapState` ya hace `join(mapId)`; `player:move` teleported hace `leave(oldMapId)` + `io.to(oldMapId).emit player:leave` + `io.to(newMapId).emit players:list`; todos los broadcasts sensibles usan `io.to(mapId).emit` (`combat:damage` 232, `combat:death` 271, `ground` 241/274/312/561/601, `skill:effect` 290, `chat` local 225, `monsters:update` game-loop 103) y per-player `io.to(pid)` donde corresponde.
- `game-loop.ts:86` `Ground.purgeExpired` ahora broadcast per-map a `Players.onMap(mapId)` vía `io.to(pid)` para no filtrar cross-map; `monsters:update` también per-map + fallback para maps activos no wilderness.
- `server/utils/logger.ts` con `pino` (level `LOG_LEVEL` env, `info` prod / `debug` dev); `index.ts:16,55`, `world.ts:11` (`WORLD_SEED` env), `handlers.ts:101,795` reemplazan `console.log` por `logger.info/debug`.
- `index.ts:40` health antes de `express.static` y wildcard.
- `combat.ts:37` defensa incluye `head`.
- `inventory.ts:71` equip: filtra `inventoryWithoutEquipping`, busca `findFreeSlot`; si `currentEquipped` y `newSlot===-1` retorna `false` sin mutar; evita pérdida.
- Tooling: `.eslintrc.json` + `.prettierrc` baseline, `tsconfig` ya incluye `server`; `vite.config` test incluye `tests/**`.

## Reason
Restaurar aislamiento por mapa (escala y fairness), observabilidad con niveles y liberar health-check; corregir economía/equipo (head valioso, no perder ítems). Todo sistémico, no cambia identidad AO.

## AO Principle
Preserva `server authority` (§20) y `scarcity/valor de ítems`; moderniza `observability` y `scalability` (rooms).

## Gameplay Invariants
- Daño/muerte/loot solo visible en el mapa donde ocurrió (mismo `mapId`).
- Head con `defense` cuenta igual que armor/shield; equipar sin espacio falla y no consume ítem.
- Logs con nivel, world seed configurable `WORLD_SEED` env.

## Affected Systems
`server/network/handlers`, `game-loop`, `game/combat`, `game/inventory`, `game/world`, `index`, `utils/logger`, `shared/constants` (reuso), tooling.

## Validation
- [x] `npx tsc --noEmit` 0 errores (con `server`)
- [x] `npm run build` vite 563 modules OK
- [x] `npm run test` 3 files 6 tests OK (xp, combat mock, constants)
- [x] Manual: teleport entre `world`→`settlement_*` deja room viejo, `combat:damage` solo llega a jugadores del mismo `mapId` (probado con 2 clientes en mapas distintos).

## AO Compatibility
- [x] Preserved (aislamiento refuerza peligro local y economía)
- [ ] Modernized
- [ ] Intentionally divergent

## Risks
- Clientes en múltiples maps por reconnect rápido podrían recibir `players:list` duplicado (mitigado con `leave` explícito).
- `pino` sin `pino-pretty` en dev muestra JSON crudo (aceptable P2; añadir pretty en P3 si se desea).

## Follow-up
- P3: `io.to(mapId)` rooms nativos vs per-player loop (eficiencia), `head` items balance, `eslint --fix` en CI, más tests `trade swap`/`equip full`.
