# AO PARITY MATRIX

| System | Status | Current Implementation | Reference Confidence | Notes |
|---|---|---|---|---|
| Character creation | IMPLEMENTED | registro con usuario/contraseña/clase/raza | VERIFIED | CHG-006 |
| Races | IMPLEMENTED | 5 razas (humano/elfo/elfo_oscuro/enano/gnomo) con mods str/dex/int/con/hp/mp | VERIFIED | RACE_MODS en constants.ts |
| Attributes | PARTIAL | str/dex/int/con fijos por clase, usados en fórmulas de combate | CURRENT PROJECT BEHAVIOR | sin distribución por nivel |
| Skills | PARTIAL | SKILLS por clase: daño, buffs, veneno, escudo | CURRENT PROJECT BEHAVIOR | sin árbol de niveles de skill |
| Combat | PARTIAL | melee autoritativo: crítico, esquiva, invuln, escudo | CURRENT PROJECT BEHAVIOR | sin distancia/ranged proyectiles |
| Magic | PARTIAL | hechizos vía sistema de skills | CURRENT PROJECT BEHAVIOR | |
| Weapons | PARTIAL | ítems con stats.damage + equip | CURRENT PROJECT BEHABIOR | catálogo chico (~10 ítems) |
| Armor | PARTIAL | stats.defense + equip por slots | CURRENT PROJECT BEHAVIOR | |
| Inventory | IMPLEMENTED | pickup/drop/equip/consumibles/loot verificados en juego | CURRENT PROJECT BEHAVIOR | grid fijo, sin peso AO-style |
| Experience | IMPLEMENTED | killMonster centralizada: XP en melee y skills, verificada con test | VERIFIED | curva level*100 |
| Leveling | IMPLEMENTED | sube stats (HP+10 MP+5 STR+2 DEX+1 INT+1 CON+2), restaura HP/MP, mensaje global | VERIFIED | test unitario CHG-001 |
| Death | IMPLEMENTED | -50 oro + 50% de un stack al azar en PvP + criminal -5 rep facción | VERIFIED | CHG-007 |
| PvE | IMPLEMENTED | spawns, IA básica, loot, quests de caza | VERIFIED | CHG-007 |
| PvP | IMPLEMENTED | criminalidad 5min, santuario en ciudades, botín al asesino, criminales rojos, drop de ítem | VERIFIED | CHG-007 |
| NPCs | IMPLEMENTED | comerciantes + banqueros + NPCs quest con diálogo y misiones | VERIFIED | CHG-007 |
| Trade | IMPLEMENTED | /comerciar + sesión con doble confirmación, swap atómico servidor | VERIFIED | CHG-002; UI por prompts (mejorable) |
| Professions | PARTIAL | recolección vía /recolectar en depósitos/bosques + cooldown | VERIFIED | CHG-004 |
| Crafting | IMPLEMENTED | 3 recetas (escudo madera, espada hierro, cota malla) vía /craftear | VERIFIED | CHG-004 |
| Resources | IMPLEMENTED | iron_ore, wood, gold_nugget recolectables del mundo | VERIFIED | CHG-004; v1 infinito sin agotamiento |
| Factions | IMPLEMENTED | reinos con territorio (getKingdomAt), reputación por caza | VERIFIED | CHG-006 |
| Clans | IMPLEMENTED | /clan crear/invitar/salir, hasta 8 miembros, chat /c, panel visible, persistido en SQLite | VERIFIED | CHG-006; loadClansFromDB al iniciar |
| Party | IMPLEMENTED | /party, XP compartida con bonus 1.25x, chat /p, roster visible | VERIFIED | CHG-003; sin loot distribution ni HP de miembros | |
| Reputation | IMPLEMENTED | +1-2 por kill en territorio del reino, /reputacion muestra standing, se guarda en DB | VERIFIED | CHG-006 |
| Wilderness | IMPLEMENTED | peligro escala con distancia a ciudades (bias Ogro/Esqueleto lejos) | VERIFIED | CHG-007 |
| World | IMPLEMENTED | continente procedural seed 42, streaming chunks | VERIFIED | determinista |
| Cities | IMPLEMENTED | asentamientos con interior, portón norte, servicios NPC | VERIFIED | |
| Dungeons | IMPLEMENTED | 30 POIs con interiores (dungeon/cave/ruins/mine/shrine), entrada desde mundo, monstruos, salida a mundo | VERIFIED | CHG-005; minimapa marca POIs |
| Economy | PARTIAL | oro + tiendas NPC + drops + banco + comercio J-J | CURRENT PROJECT BEHAVIOR | CHG-002; sin sumideros fuertes aún |
| Persistence | IMPLEMENTED | SQLite, guardado al desconectar | VERIFIED | |

## Status Definitions

NOT_STARTED
PARTIAL
IMPLEMENTED
VERIFIED
DIVERGENT
INTENTIONALLY_MODERNIZED
