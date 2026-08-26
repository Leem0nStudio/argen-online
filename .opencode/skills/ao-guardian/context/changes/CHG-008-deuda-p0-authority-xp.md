# CHANGE 2026-08-26 — CHG-008: Deuda P0 — Authority, XP y persistencia

## System
XP / Combat / Movement / Inventory / Auth / DB / World sanctuary

## Intent
Cerrar 7 deudas P0 bloqueantes detectadas en auditoría 2026-08-26 sin alterar loop AO: unificar XP, restaurar autoridad del servidor en movimiento/combate/drop, corregir persistencia atómica y fuga de `data/game.db` trackeado.

## Before
- `xpForLevel` duplicado: `shared/constants.ts:87` ( `lvl*lvl*80+20` ) vs `shared/types.ts:312` ( `lvl*100` ); UI `GameScreen.tsx:300` usa `lvl*100` divergente; `StatPanel` usa correcta; `handlers.ts:253-273` doble `grantXp` → hasta 2× XP por kill.
- `server/network/handlers.ts:578` `item:drop` no-op: nunca llama `dropItem`, no crea `Ground`, no persiste.
- PvP santuario roto: `server/game/combat.ts:137` y `server/game/skills.ts:117` solo consultan `MAPS[defender.mapId]` (legacy `shared/maps.ts`); `settlement_*`/`poi_*` de `WorldMapManager` (`shared/world-map.ts:390`) quedan como `undefined` → PvP permitido en ciudades.
- Movimiento confía en cliente: `server/game/movement.ts:47` valida `canMoveTo` pero no `dist(old,new)<=1`, no `PLAYER_MOVE_INTERVAL_MS:150` (`shared/constants.ts:16` no usado server), sin `Number.isFinite` sanitización.
- Registro ignora raza: `handlers.ts:104` llama `registerPlayer(u,p,cls)` sin 4º arg `race`; `AuthScreen.tsx:36` envía `race` pero DB siempre `humano`.
- Persistencia frágil: `disconnect handlers.ts:769` + `database.ts:250` hacen 3 statements separados sin `transaction`; `migrations database.ts:90` solo `ALTER` suelto; `data/game.db` trackeado pese a `.gitignore:3`.
- XP UI inconsistente y niveles sin validación cruzada.

## After
- `xpForLevel` single source `shared/constants.ts:87`; `shared/types.ts:312` eliminado/reexport; `GameScreen.tsx:300` y `StatPanel.tsx:104` usan misma curva; eliminado segundo `grantXp` en `handlers.ts` (solo `killMonster→sharedXpOnKill→grantXp`).
- `item:drop` handler valida `player`, `slot`, `quantity` (`Number.isFinite`, `>0`), llama `dropItem`, si `GroundItem` creado emite `groundItems:update` + `player:update` y persiste vía `Ground` (broadcast por `mapId` cuando aplique).
- Sanctuary: `combat.ts:137` y `skills.ts:117` resuelven `zone` con fallback `getWorldMap().getMap(mapId)?.zone ?? MAPS[mapId]?.zone`; si `zone===City` bloquean PvP inclusive para `settlement_*` y `poi_*`.
- Movimiento: `movement.ts:47` valida `Number.isFinite(x,y)`, `Math.abs(dx)+Math.abs(dy)<=1` (Manhattan, allow `0` para stop), throttle por `lastMoveAt Map<string,number>` vs `PLAYER_MOVE_INTERVAL_MS`; `stopPlayer` también sanitiza; `handlers.ts:148` rechaza coords no finitas antes de `movePlayer`.
- Registro: `handlers.ts:104` pasa `data.race ?? "humano"` con whitelist `RACE_MODS` keys; `database.ts:131` mantiene default.
- DB: `database.ts` envuelve `savePlayer/saveInventory/saveEquipment` y `disconnect` en `db.transaction`; añade `busy_timeout=5000` y `synchronous=NORMAL`; `git rm --cached data/game.db` + `data/game.db-shm/wal` removidos del índice (permanecen en disco ignorados).
- Migrations siguen tolerantes pero documentadas como deuda P1.

## Reason
Restaurar server-authority y coherencia de progresión/economía sin cambiar identidad AO; evitar exploit XP/TP y fuga de datos. Todas son correcciones sistémicas, no rediseño de gameplay.

## AO Principle
Preserva: meaningful progression (XP única), risk/reward (santuario ciudad), scarcity/valor ítems (drop real), server authority (`constitution.md:20`), persistencia confiable. No introduce mecánicas modernas tipo battle-pass.

## Gameplay Invariants
- XP por nivel: `lvl*lvl*80+20` para todos los clientes/server; niveles requieren XP exacta, sin duplicación.
- Ciudad = santuario total PvP (incluye interiores procedurales).
- Movimiento max 1 tile por tick server, 150ms throttle.
- Drop crea objeto en suelo en pos del jugador, visible para mapa.
- Raza afecta stats iniciales y persiste.

## Affected Systems
- `shared/constants.ts`, `shared/types.ts`, `server/game/combat.ts`, `server/game/movement.ts`, `server/game/skills.ts`, `server/db/database.ts`, `server/network/handlers.ts`, `src/ui/GameScreen.tsx`, `src/ui/StatPanel.tsx`, `src/game/engine.ts` (si aplica), git index.

## Validation
- [ ] `npx tsc --noEmit` incluye `server/` (ajustar `tsconfig`)
- [ ] Unit: `xpForLevel(1)=100, 2=360, 5=2100` y `grantXp` no duplica
- [ ] Integración: `movePlayer` rechaza TP y flood; `tryAttack` bloqueado en `settlement_*` City; `item:drop` crea Ground verificable
- [ ] Manual: kill monster otorga XP correcta y toast; PvP en ciudad no daña; drop/recogida roundtrip; registro elfo guarda `race`
- [ ] `git ls-files | grep data/game.db` vacío

## AO Compatibility
- [x] Preserved (authority y economía corregidas, no cambio de loop)
- [ ] Modernized
- [ ] Intentionally divergent

## Risks
- Throttle 150ms puede sentirse si cliente envía 50ms; mitigado con `lastMoveAt` server + predicción cliente.
- Cambio XP curva requiere migración invisible para jugadores con XP vieja `lvl*100`; resuelto manteniendo curva nueva para todos y no migrando XP existente (P1).

## Follow-up
- P1: `tsconfig` incluir `server/`, `vitest`, centralizar magic numbers, `Ground` TTL + broadcast por mapa, `busy_timeout`/WAL checkpoint cron, `bcrypt` cost 10, validación username regex.
