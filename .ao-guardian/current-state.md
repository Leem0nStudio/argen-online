# CURRENT STATE — 2026-08-26

> Documento generado en fase de ANÁLISIS (solo lectura). No modifica gameplay. Refleja el repositorio tal cual está en `main` tras los últimos builds (render, mundo procedural, progresión, comercio, party/clan, crafting, dungeons).

## 1. Arquitectura actual

**CURRENT STATE**
- Monorepo `npm` con `client` (Vite + React 18 + PixiJS 7) y `server` (Node + tsx + Express + Socket.io 4.7). Script `dev` usa `concurrently` para ambos procesos (`package.json:7`).
- Alias `@shared` para código común (`vite.config.ts:9`, `tsconfig.json:19`). Todo es ES Module (`"type":"module"`).
- Servidor único sin clustering, sin DI. `server/index.ts:19` orden `initDB → loadClansFromDB → initWorld(seed=42) → express.static(dist) → setupHandlers → startGameLoop → listen 3001`.
- Cliente: `GameEngine` (PIXI) desacoplado de `GameScreen.tsx` (React) vía callbacks `onMove/onAttack/onRequestChunks`. Sin gestor de estado global, sin reconciliación.

**INTENDED TARGET** (skill §2, §20)
- Infraestructura moderna capaz de 3D (shaders/iluminación/partículas) aunque el juego sea 2D; autoridad del servidor estricta.

**KNOWN GAP**
- Sin sharding/rooms por mapa bien aisladas; `handlers.ts` usa `io.emit` global para chat/daño/loot (escala O(N²)).
- Sin graceful shutdown, sin rate-limit, sin validación de tipos en sockets.

**RISK**
- `app.get("*")` antes de `/health` hace health-check inalcanzable (`server/index.ts:36-42`).
- `express.static` + fallback frágil si `dist` se mueve.

**UNKNOWN**
- UNKNOWN si se prevé despliegue con múltiples instancias o CDN para `dist`.

---

## 2. Cliente

**CURRENT STATE** — `src/game/engine.ts` (1132 líneas) renderiza con `PIXI.Application` (`antialias:false, resolution=devicePixelRatio, autoDensity:true`) con fallback canvas. `vfx.ts` dibuja personajes/monstruos via `Graphics` + `Text`. `VirtualJoystick.tsx` para móvil (D-pad + joystick dinámico).

**INTENDED TARGET** — 2D jugable con capacidades 3D internas (shaders/partículas ya existen).

**KNOWN GAP** — `canWalk` duplica lógica de colisión del servidor con discrepancias `WT` vs `T`; sin interpolación de otros jugadores.

**RISK** — Movimiento optimista sin reconciliación; `MOVE_INTERVAL` solo en cliente.

---

## 3. Servidor y Networking

**CURRENT STATE** — Socket.io `websocket+polling`, reconexión 10 intentos. 30+ `socket.on` en monolito `handlers.ts:741`. `game-loop.ts` tick 50ms con sub-loops `REGEN_INTERVAL 1s`, `AI_TICK 200ms`, `MONSTER_BROADCAST 500ms`.

**INTENDED TARGET** — Autoridad del servidor (§20) con predicción cliente tolerada.

**KNOWN GAP** — `item:drop` handler no-op; `bank:item` con `Number(itemId)` incoherente; `trade:addGold` permite valor negativo.

**RISK** — Sin validación de adyacencia en `player:move` (teleport si `canMoveTo` true); `world:request` sin validación de `NaN`.

---

## 4. Mundo procedural

**CURRENT STATE** — `shared/world-gen.ts` (918 líneas, seed 42, `CHUNK_SIZE=64`, mundo 64×64 chunks = 4096×4096 tiles). Pipeline `noise → elevation/climate/biome → tile → settlement scoring → kingdoms (nearest capital) → roads (línea recta) → 30 POIs`. `shared/world-map.ts` expone `WorldMapManager` con `settlementMaps` (12) y `dungeonMaps` (30) y `WALKABLE_TILES`. `server/game/world.ts` serializa `seed+settlements+kingdoms+pois+roads.slice(0,500)` al cliente; chunks se piden vía `world:request`.

**INTENDED TARGET** (skill §10) — `gameplay → geography → clima → bioma → recursos → asentamientos → caminos → peligro → economía → rutas`.

**KNOWN GAP**
- Recursos (`ironDeposit` etc.) no generados en superficie; solo 6 celdas dentro de interiores de mina. Sin escasez real.
- Ríos intra-chunk sin continuidad continental; caminos son interpolación lineal, no A*, y no pavimentan el terreno (solo lista para minimapa). Riesgo visual-first.

**RISK** — `SeededRandom` global compartido; orden de llamadas afecta reproducibilidad. Wrap negativo inconsistente (`%` vs `&`) desincroniza bioma/elevación.

---

## 5. Mapas, Personajes, Combate

**CURRENT STATE**
- Personajes: `characterClass` warrior/mage/archer/paladin + `Race` (5) con `RACE_MODS`/`CLASS_BASE_STATS` (`shared/constants.ts`). Stats `str/dex/int/con/hp/mp` + `HP+10 MP+5 STR+2` por nivel (lineal `xpForLevel=level*100`).
- Combate `server/game/combat.ts`: daño `BASE_DAMAGE(5)+str+weapon ±2 variance`, defensa plana suma `armor/shield/boots/ring` (omite `head`), crítico `10%+0.5%*dex *1.5`, buffs `strength/dodge/invuln/shield_absorb`, cooldown global 800ms, rango Manhattan 3. PvP safe en `MapZone.City`, criminalidad 5min.
- Skills `shared/types.ts:SKILLS`: 3 por clase (ej. `fireball 15mp 20dmg range5`, `war_cry +50%str 5s`). `server/game/skills.ts` valida mana/cooldown/range.

**INTENDED TARGET** — Identidad AO: progresión significativa, riesgo, especialización.

**KNOWN GAP** — Sin `to-hit`/`evasion` por skill; daño determinista → gear-score puro. Poison/stun definidos pero sin efecto. Rango universal 3 para melee.

**RISK** — Transferencia automática de oro al asesino en PvP (mata rol de corpse/loot manual AO).

---

## 6. Inventario, Items, Progresión, Economía

**CURRENT STATE** — `shared/items.ts` 17 items; `server/game/inventory.ts` 20 slots, stack infinito para consumibles/materiales; `bank.ts` con `bank_gold` + tabla `bank`; `trade.ts` trade seguro con doble confirmación (rango 5); `gathering.ts` 5 tiles alrededor en `world` con cooldown 3s; `crafting.ts` 3 recetas; `quest.ts` 4 quests de caza con recompensa rep/xp/oro.

**INTENDED TARGET** — Escasez y valor de ítems, interdependencia.

**KNOWN GAP** — Gathering infinito sin agotamiento/herramienta; crafting sin estación/skill; banco sin límite; precios fijos sin fluctuación por reputación.

**RISK** — Arbitraje `iron_ore 8 → iron_sword vende 20` con farmeo infinito imprime oro.

---

## 7. Social y Persistencia

**CURRENT STATE** — `server/game/party.ts` (5 miembros, bonus XP 1.25×, rango 12), `server/game/clan.ts` (8 miembros, persistido en SQLite, chat `/c`, panel), `server/db/database.ts` 7 tablas (`players`, `inventory`, `equipment`, `bank`, `clans`, `clan_members`, `reputation`). Guardado en `disconnect` + tras banco/trade/craft; `getPlayer` resetea `hp=maxHp`.

**INTENDED TARGET** — Dependencia social, persistencia del mundo.

**KNOWN GAP** — Party efímera, sin persistencia; `buffs/cooldowns/criminalUntil/quests` no persisten; suelo/monstruos en memoria. `savePlayer` no guarda `race/bank_gold`.

**RISK** — Chat global broadcast a todos los mapas (fuga de inmersión); `players.delete` no limpia `deadPlayers`/`AttackCooldowns`.

---

## 8. Rendering, Audio, VFX

**CURRENT STATE** — Zero-asset procedural (skill §8 cumplido): `vfx.ts` con `drawEnhancedCharacter/Monster/Item` via `Graphics`/`Text`, `ParticleSystem`, `ScreenShake`, `AmbientTiles`. `audio.ts` con síntesis procedural simple.

**KNOWN GAP** — `ScreenShake` con drift acumulativo; `AmbientTiles` hace `clear()/beginFill` por tile cada frame (GC churn).

---

## 9. Tests y Tooling

**CURRENT STATE** — Sin tests automatizados. `npx tsc --noEmit` usado manualmente; builds de prototipo en `/tmp/opencode/*.mjs` vía `tsx` no versionados. Sin CI.

**RISK** — Validación ad-hoc frágil.

---

## 10. Última actualización

2026-08-26 — fase de análisis puro, sin cambios de código.
