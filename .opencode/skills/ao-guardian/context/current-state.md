# CURRENT STATE

## Current Architecture

- **Cliente**: React 18 + PixiJS v7 (WebGL con fallback canvas), Vite dev server.
- **Servidor**: Node + tsx, Express + Socket.io (WebSocket/polling), autoridad total del servidor.
- **Persistencia**: SQLite (better-sqlite3 v12) en `game.db` (raíz del proyecto — NO usar `data/game.db`, es un residuo).
- **Mundo**: generación procedural determinista (seed 42), compartida entre cliente y servidor vía `shared/world-gen.ts` / `shared/world-map.ts`.
- **Build**: el juego se juega por puerto 3001 (build de producción en `dist/`). Tras cambios hay que correr `npm run build` + reiniciar servidor.

## Current Gameplay

- Registro/login con 4 clases + 5 razas (humano/elfo/elfo_oscuro/enano/gnomo) con mods (`RACE_MODS`).
- Atributos: str/dex/int/con; HP/MP derivados; statPoints y skill unlocks Q/W/E por nivel.
- Combate autoritativo con crítico, esquiva, invuln, absorción; santuario Ciudad (fallback WorldMap) verificado (`combat.ts:137`, `skills.ts:117`).
- Habilidades por clase en `shared/types.ts` (SKILLS): daño, buffs, veneno, escudo absorbente; XP compartida en party.
- Inventario funcional: recoger, tirar (atómico `dropItem` + Ground), equipar, pociones (`inventory.ts`), loot de monstruos.
- Monstruos con IA (patrol/chase/attack/flee), spawns procedural y wilderness bias.
- NPCs comerciantes + banqueros + quests; trade/party/clan/reputation/gathering/crafting implementados (CHG-002..007).
- XP al matar vía `killMonster→sharedXpOnKill→grantXp` única, curva `lvl*lvl*80+20`, sin duplicación (CHG-008).
- Chat global/party/clan + comandos `/trade /party /clan /reputacion` etc.
- Controles móviles: joystick + D-pad + ataque.

## Current World

- Continente tectónico 32×32 seed 42 + islas satélite, 15 biomas `vegDensity`+`slope`, ríos 1.09% continuos, vetas `iron/gold` en colinas (CHG-012), asentamientos en valles fluviales (bonus +0.22 río, -0.28 pendiente) + roads A* 1463 con coste `river+6` (CHG-015).
- 12 asentamientos (3 capitals 9 cities) +3 reinos +30 POIs; `WALKABLE` deposits+swamp.
- Spawn: capital más cercana.

## Current Multiplayer Model

- Socket.io eventos tipados (`shared/types.ts`), rooms por `mapId` (`join/leave` + `io.to(mapId)` para `move/damage/death/ground/monsters/chat` CHG-010).
- Servidor valida movimiento (dist≤1, 150ms, sanitización) y combate (head+defense).
- Guardado atómico (`savePlayerFull`) + logger `pino` + health `/health` antes de static.

## Current Economy

- Oro con fee banco 2% sink, tiendas stock 10/resupply 10m + descuento 15% por rep, drops.
- Gathering finito 5-12m respawn por nodo, requiere pico/hacha; crafting 5 recetas (incl. herramientas) solo en ciudad + costo 10-60 oro, starter kit con herramientas (CHG-011).
- Ground TTL 5m cap 200 per-map; drop PvP 50% stack +10% oro; head aporta defensa; equip sin pérdida si full (CHG-010).

## Current Progression

- XP por kill → subida de nivel curva `xpForLevel = lvl*lvl*80+20` (single source `shared/constants.ts`), `MAX_LEVEL 50`, `STAT_POINTS_PER_LEVEL 3`.
- Equipamiento por slots (weapon, armor, shield, head, boots, ring) + inventario 20 slots.

## Current Rendering

- PixiJS 7 zero-asset (CHG-016): `WT_COLORS` vibrantes, 14 overlays por tile en 1 Graphics/chunk 60fps.
- Jugadores: `raceMods` + `armor/weapon/shield/head` visibles; NPCs `merchant🛒/banker🏦/quest❗`+coin; mobs `goblin 0.92/ogro 1.32`+arma.
- Iluminación (CHG-017/018): ciclo 10 min `world:time` 1s, `dayOverlay` 0→0.58, `lightGfx` radial `ADD` flicker; luz jugador `lantern 185 / torch 145 (buff 5m) / base 72`.

## Current UI/UX

- Mobile-first (CHG-019): tokens `ao-thumb 48-56`, `AOButton/AOPanel/AOBottomSheet` reutilizables, `VirtualJoystick` 58 radius + `haptic light` + `D-pad` 56px, `skill 52`/`action 56` thumb zones, `inventory BottomSheet 20 slots` + `chat 92vw` con `safe-area`, `GameScreen` `handleEquip/Use/Buy/useSkill` con `haptic`.

## Known Gaps

- Tests: 10 tests (xp/combat/constants/economy) vitest 4.1; `eslint` baseline sin CI.
- Economía: stock global por item (no per-NPC) y herramientas starter podrían saturar early game.
- Muerte completa AO pendiente Rift 71.

## Known Contradictions

- `data/game.db` removido del índice en CHG-008 (ahora ignorado, queda en disco pero no en repo).
- Mapas legacy conviven con procedural; migración pendiente.

## Last Updated

2026-08-26 (CHG-019 — ui mobile-first)
