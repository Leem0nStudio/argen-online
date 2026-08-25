# CURRENT STATE

## Current Architecture

- **Cliente**: React 18 + PixiJS v7 (WebGL con fallback canvas), Vite dev server.
- **Servidor**: Node + tsx, Express + Socket.io (WebSocket/polling), autoridad total del servidor.
- **Persistencia**: SQLite (better-sqlite3 v12) en `game.db` (raíz del proyecto — NO usar `data/game.db`, es un residuo).
- **Mundo**: generación procedural determinista (seed 42), compartida entre cliente y servidor vía `shared/world-gen.ts` / `shared/world-map.ts`.
- **Build**: el juego se juega por puerto 3001 (build de producción en `dist/`). Tras cambios hay que correr `npm run build` + reiniciar servidor.

## Current Gameplay

- Registro/login con 4 clases: warrior, mage, archer, paladin (sin razas).
- Atributos: str/dex/int/con; HP/MP derivados.
- Combate melee servidor-autoritativo con crítico, esquiva, invulnerabilidad breve, absorción por escudo (`server/game/combat.ts`).
- Habilidades por clase en `shared/types.ts` (SKILLS): daño, buffs, veneno, escudo absorbente.
- Inventario funcional: recoger, tirar, equipar, pociones (`server/game/inventory.ts`).
- Monstruos con IA simple, spawns y loot (`server/game/monster-ai.ts`).
- NPCs comerciantes con tienda y diálogo (`server/game/npc.ts`, `world-map.ts` genera NPCs de asentamientos).
- XP al matar (`combat.ts:227`) y niveles; penalización de muerte: -50 oro al resucitar.
- Chat global simple.
- Controles móviles: joystick analógico dinámico + D-pad con repetición + botón ataque (agosto 2026).

## Current World

- Continente procedural 32×32 chunks (CHUNK_SIZE=64 tiles), seed 42, ~23s de generación en arranque.
- 12 asentamientos (capitales/ciudades/pueblos/aldeas) con mapa interior propio, murallas y portón norte.
- 3 reinos con capitales, 803 segmentos de camino, 30 POIs (solo puntos, sin contenido aún).
- Streaming de chunks al cliente; consolidación de terreno en 1 Graphics por chunk (optimización 60fps).
- Spawn de personajes: capital más cercana (`getSpawnPoint`).

## Current Multiplayer Model

- Socket.io eventos tipados (`shared/types.ts`). Servidor valida todo movimiento/combate.
- Sin predicción del cliente con reconciliación formal (el cliente mueve localmente y el servidor corrige).
- Guardado en DB al desconectar.

## Current Economy

- Oro, tiendas NPC con buy/sellPrice fijos, drops de monstruos.
- Sin comercio jugador-a-jugador, sin banco, sin crafting.

## Current Progression

- XP por kill → subida de nivel (fórmula pendiente de verificación).
- Equipamiento por slots (weapon, armor, shield, head, boots, ring).

## Current Rendering

- PixiJS Graphics procedurales (zero-asset ✓).
- Optimizaciones aplicadas (ago 2026): caché de sprites por firma, terreno 1 Graphics/chunk, culling de chunks lejanos, contador FPS (tecla F / 3 dedos).

## Known Gaps

- PvP sin verificar (tryAttack acepta cualquier targetId).
- Comercio jugador-jugador, banco, party, clanes, profesiones, crafting, recursos, dungeons, reputación: ausentes.
- Razas ausentes.
- Muerte: solo penalización de oro; no hay pérdida de ítems (decisión AO pendiente).

## Known Contradictions

- `data/game.db` vs `game.db`: dos bases; el servidor usa `game.db`. Eliminar el residuo algún día.
- Mapas estáticos legacy (`rucci`, campos) conviven con el mundo procedural; jugadores viejos pueden tener map_id legacy.

## Last Updated

2026-08-25 (post-optimización 60fps y controles móviles)
