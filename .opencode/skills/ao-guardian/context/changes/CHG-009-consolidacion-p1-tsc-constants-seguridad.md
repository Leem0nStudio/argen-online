# CHANGE 2026-08-26 — CHG-009: Consolidación P1 — tsc, constants, seguridad y persistencia Ground

## System
Tooling / Constants / Security / Ground / Tests

## Intent
Cerrar el siguiente bloque de deuda P1: hacer que `server/` sea type-checked, centralizar fuentes de verdad mágicas, endurecer registro y limitar crecimiento del suelo.

## Before
- `tsconfig.json:23` `include ["src","shared"]` excluía `server/`; `npx tsc` era verde falso; 14 errores en `state.ts`/`combat.ts`/`monster-ai.ts`/`trade`/`handlers`.
- Magic numbers dispersos: `GATHER_COOLDOWN_MS 3000` en `gathering.ts:10`, `TRADE_RANGE 5` en `trade.ts:16`, `PARTY_*` en `party.ts:8`, `CLAN_*` en `clan.ts:23`; `gathering.ts:73` hardcode `20` slots; `trade.ts:40` `30_000` literal.
- Registro: `bcrypt cost 8` (`database.ts:135`), sin regex username `3-20`, sin whitelist clase; handler `auth:register` ya corrige race pero DB no valida.
- Ground infinito: `Ground` Map sin TTL/cap, nunca purga, broadcast global `io.emit` a todos los mapas.
- 0 tests, sin runner.

## After
- `tsconfig.json` incluye `server`; corregidos 14 errores: `Monsters.all()` tipo `IterableIterator<[string,Monster]>`, `sharedXpOnKill` acepta `LevelUpResult|boolean`, casts `as unknown as Record` en `combat/inventory/database/handlers`, `Trade.accept` handler fetch via `getSession`, `monster-ai` flee check `as string`.
- `shared/constants.ts:99-113` single source: `PARTY_MAX_MEMBERS/_XP_RANGE/_XP_BONUS/_INVITE_TTL`, `CLAN_MAX_*`, `TRADE_RANGE/_INVITE_TTL`, `GATHER_COOLDOWN_MS`, `GROUND_ITEM_TTL_MS 5m`, `GROUND_MAX_ITEMS 200`.
- `server/game/*` re-exportan desde constants (backward compat) y `gathering.ts:73` usa `MAX_INVENTORY_SLOTS`.
- `server/db/database.ts:134` valida `username /^[a-z0-9_]{3,20}$`, `password 3-64`, clase whitelist; `bcrypt 10`.
- `server/game/state.ts:62-110` Ground con `groundCreatedAt`, `set` enforce cap 200 (evicta oldest), `purgeExpired()` TTL 5m.
- `server/network/game-loop.ts:13,86` importa `Ground`, purga cada `RESPAWN_CHECK_INTERVAL` (1s) y broadcast per-map a `Players.onMap(mapId)` via `io.to(pid)`.
- Infra: `vitest 4.1` + `vite.config.ts:test`, `package.json:scripts test`, `tests/xp.test.ts` y `tests/combat.test.ts` (4 tests) verifican curva `100,360,2100,8200` y no-duplicación.

## Reason
Evitar regresiones silenciosas (tsc), eliminar duplicación que diverge (`worst` `20` vs `MAX_INVENTORY_SLOTS`), cerrar superficie de ataque en registro y fuga de memoria/broadcast del suelo.

## AO Principle
Preserva server authority y escasez (TTL/cap), moderniza tooling sin cambiar core loop.

## Gameplay Invariants
- Cooldown recolecta 3s global, trade 5 tiles, party 12 tiles/1.25×.
- Ground vive 5 min o hasta 200 items (oldest evicted), visible solo en su mapa tras purga.

## Affected Systems
`tsconfig`, `shared/constants`, `server/game/state`, `game-loop`, `party/clan/trade/gathering`, `db/database`, `vite.config`, `package.json`, tests.

## Validation
- [x] `npx tsc --noEmit` 0 errores con `include server`
- [x] `npm run build` vite 563 modules OK
- [x] `npm run test` 2 files 4 tests OK
- [x] Manual: `Ground.purgeExpired` expulsa oldest al superar 200; `registerPlayer` rechaza `a`/`x*64`.

## AO Compatibility
- [x] Preserved
- [ ] Modernized
- [ ] Intentionally divergent

## Risks
- TTL broadcast per-player duplica mensajes si 10 jugadores en mismo mapa (10 emits redundantes, mitigable con `io.to(mapId)` rooms futuro P2).
- bcrypt cost 10 aumenta latencia login ~150ms (aceptable).

## Follow-up
- P2: rooms por mapa + `io.to(mapId)`, `pino` logger, Head defensa fix, Ground broadcast global residual en `handlers` (5 emits restantes), `eslint`+`prettier`, más cobertura `party/trade`.
