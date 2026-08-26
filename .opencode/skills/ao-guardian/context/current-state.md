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

- Continente procedural 32×32 chunks (CHUNK_SIZE=64 tiles), seed 42, ~23s de generación en arranque.
- 12 asentamientos (capitales/ciudades/pueblos/aldeas) con mapa interior propio, murallas y portón norte.
- 3 reinos con capitales, 803 segmentos de camino, 30 POIs (solo puntos, sin contenido aún).
- Streaming de chunks al cliente; consolidación de terreno en 1 Graphics por chunk (optimización 60fps).
- Spawn de personajes: capital más cercana (`getSpawnPoint`).

## Current Multiplayer Model

- Socket.io eventos tipados (`shared/types.ts`), rooms por `mapId` (`join/leave` + `io.to(mapId)` para `move/damage/death/ground/monsters/chat` CHG-010).
- Servidor valida movimiento (dist≤1, 150ms, sanitización) y combate (head+defense).
- Guardado atómico (`savePlayerFull`) + logger `pino` + health `/health` antes de static.

## Current Economy

- Oro, tiendas NPC, drops, banco (gold/items), comercio J-J atómico, crafting/gathering básico (constants centralizados).
- Ground TTL 5m cap 200 per-map; drop PvP 50% stack +10% oro; head aporta defensa; equip sin pérdida si full (CHG-010).

## Current Progression

- XP por kill → subida de nivel curva `xpForLevel = lvl*lvl*80+20` (single source `shared/constants.ts`), `MAX_LEVEL 50`, `STAT_POINTS_PER_LEVEL 3`.
- Equipamiento por slots (weapon, armor, shield, head, boots, ring) + inventario 20 slots.

## Current Rendering

- PixiJS Graphics procedurales (zero-asset ✓).
- Optimizaciones aplicadas (ago 2026): caché de sprites por firma, terreno 1 Graphics/chunk, culling de chunks lejanos, contador FPS (tecla F / 3 dedos).

## Known Gaps

- Tests: 6 tests (xp/combat/constants) vitest 4.1; `eslint` baseline solo config sin CI.
- Ground purge per-map listo; monsters ahora per-map rooms (CHG-010).
- Head defense y equip fix verificados (CHG-010); queda balance de precios y sumideros.
- Muerte completa AO pendiente Rift 71.

## Known Contradictions

- `data/game.db` removido del índice en CHG-008 (ahora ignorado, queda en disco pero no en repo).
- Mapas legacy conviven con procedural; migración pendiente.

## Last Updated

2026-08-26 (CHG-010 — rooms p2 + logger + head/equip fix)
