# AO PARITY MATRIX

| System | Status | Current Implementation | Reference Confidence | Notes |
|---|---|---|---|---|
| Character creation | IMPLEMENTED | registro con usuario/contraseña/clase/raza | VERIFIED | CHG-006 |
| Races | IMPLEMENTED | 5 razas (humano/elfo/elfo_oscuro/enano/gnomo) con mods str/dex/int/con/hp/mp | VERIFIED | RACE_MODS en constants.ts |
| Attributes | PARTIAL | str/dex/int/con fijos por clase, usados en fórmulas de combate | CURRENT PROJECT BEHAVIOR | sin distribución por nivel |
| Skills | PARTIAL | SKILLS por clase: daño, buffs, veneno, escudo | CURRENT PROJECT BEHAVIOR | sin árbol de niveles de skill |
| Combat | PARTIAL | melee autoritativo: crítico, esquiva, invuln, escudo (head+defense CHG-010) | CURRENT PROJECT BEHAVIOR | per-map rooms, sin ranged |
| Magic | PARTIAL | hechizos vía sistema de skills (per-map broadcast) | CURRENT PROJECT BEHAVIOR | CHG-010 rooms |
| Weapons | PARTIAL | ítems con stats.damage + equip | CURRENT PROJECT BEHABIOR | catálogo chico (~10 ítems) |
| Armor | PARTIAL | stats.defense + equip por slots (head ahora cuenta) | CURRENT PROJECT BEHAVIOR | CHG-010 fix head |
| Inventory | IMPLEMENTED | pickup/drop/equip (sin pérdida si full) + Ground TTL per-map | VERIFIED | CHG-010 equip fix + rooms |
| Experience | IMPLEMENTED | killMonster centralizada: XP vía sharedXpOnKill→grantXp única, sin duplicación | VERIFIED | CHG-008 curva `lvl*lvl*80+20` unificada |
| Leveling | IMPLEMENTED | sube stats (HP+8+con*0.5 MP+4+int*0.3), statPoints, skill unlocks Q/W/E | VERIFIED | CHG-001+008 |
| Death | IMPLEMENTED | -50 oro + 50% de un stack al azar en PvP + criminal -5 rep facción | VERIFIED | CHG-007 |
| PvE | IMPLEMENTED | spawns, IA básica, loot, quests de caza | VERIFIED | CHG-007 |
| PvP | IMPLEMENTED | criminalidad 5min, santuario Ciudad (legacy+procedural) verificado, botín al asesino | VERIFIED | CHG-008 fix santuario WorldMap fallback |
| NPCs | IMPLEMENTED | comerciantes + banqueros + NPCs quest con diálogo y misiones | VERIFIED | CHG-007 |
| Trade | IMPLEMENTED | /comerciar + sesión con doble confirmación (RANGE 5 centralizado), swap atómico | VERIFIED | CHG-002+009 |
| Professions | PARTIAL | /recolectar cooldown 3s centralizado, sin herramienta | VERIFIED | CHG-004+009 |
| Crafting | IMPLEMENTED | 3 recetas vía /craftear (invoca constants centralizados) | VERIFIED | CHG-004 |
| Resources | IMPLEMENTED | iron_ore/wood/gold_nugget + Ground TTL 5m cap 200 | VERIFIED | CHG-009 Ground purge |
| Factions | IMPLEMENTED | reinos con territorio (getKingdomAt), reputación por caza | VERIFIED | CHG-006 |
| Clans | IMPLEMENTED | /clan crear/invitar/salir, hasta 8 miembros, chat /c, panel visible, persistido en SQLite | VERIFIED | CHG-006; loadClansFromDB al iniciar |
| Party | IMPLEMENTED | /party, XP compartida con bonus 1.25x, chat /p, roster visible | VERIFIED | CHG-003; sin loot distribution ni HP de miembros | |
| Reputation | IMPLEMENTED | +1-2 por kill en territorio del reino, /reputacion muestra standing, se guarda en DB | VERIFIED | CHG-006 |
| Wilderness | IMPLEMENTED | peligro escala con distancia a ciudades (bias Ogro/Esqueleto lejos) | VERIFIED | CHG-007 |
| World | IMPLEMENTED | continente procedural seed 42, streaming chunks | VERIFIED | determinista |
| Cities | IMPLEMENTED | asentamientos con interior, portón norte, servicios NPC | VERIFIED | |
| Dungeons | IMPLEMENTED | 30 POIs con interiores (dungeon/cave/ruins/mine/shrine), entrada desde mundo, monstruos, salida a mundo | VERIFIED | CHG-005; minimapa marca POIs |
| Economy | PARTIAL | oro + tiendas NPC + drops + banco + comercio J-J | CURRENT PROJECT BEHAVIOR | CHG-002; sin sumideros fuertes aún |
| Persistence | IMPLEMENTED | SQLite WAL + busy_timeout, guardado atómico, logger pino | VERIFIED | CHG-008/010 |
| Movement | IMPLEMENTED | server-authority dist≤1 150ms + rooms (leave/join) | VERIFIED | CHG-008/010 |
| Networking | IMPLEMENTED | rooms por mapId, chats/daño/loot per-map | VERIFIED | CHG-010 |

## Status Definitions

NOT_STARTED
PARTIAL
IMPLEMENTED
VERIFIED
DIVERGENT
INTENTIONALLY_MODERNIZED
