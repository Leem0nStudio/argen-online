# AO PARITY MATRIX

| System | Status | Current Implementation | Reference Confidence | Notes |
|---|---|---|---|---|
| Character creation | PARTIAL | registro con usuario/contraseña/clase | CURRENT PROJECT BEHAVIOR | sin razas ni atributos asignables |
| Races | NOT_STARTED | — | — | AO tiene razas; decidir alcance |
| Classes | IMPLEMENTED | 4 clases (warrior/mage/archer/paladin) con skills y emblemas propios | CURRENT PROJECT BEHAVIOR | verificar paridad de roles AO |
| Attributes | PARTIAL | str/dex/int/con fijos por clase, usados en fórmulas de combate | CURRENT PROJECT BEHAVIOR | sin distribución por nivel |
| Skills | PARTIAL | SKILLS por clase: daño, buffs, veneno, escudo | CURRENT PROJECT BEHAVIOR | sin árbol de niveles de skill |
| Combat | PARTIAL | melee autoritativo: crítico, esquiva, invuln, escudo | CURRENT PROJECT BEHAVIOR | sin distancia/ranged proyectiles |
| Magic | PARTIAL | hechizos vía sistema de skills | CURRENT PROJECT BEHAVIOR | |
| Weapons | PARTIAL | ítems con stats.damage + equip | CURRENT PROJECT BEHABIOR | catálogo chico (~10 ítems) |
| Armor | PARTIAL | stats.defense + equip por slots | CURRENT PROJECT BEHAVIOR | |
| Inventory | IMPLEMENTED | pickup/drop/equip/consumibles/loot verificados en juego | CURRENT PROJECT BEHAVIOR | grid fijo, sin peso AO-style |
| Experience | IMPLEMENTED | killMonster centralizada: XP en melee y skills, verificada con test | VERIFIED | curva level*100 |
| Leveling | IMPLEMENTED | sube stats (HP+10 MP+5 STR+2 DEX+1 INT+1 CON+2), restaura HP/MP, mensaje global | VERIFIED | test unitario CHG-001 |
| Death | PARTIAL | pantalla muerte + resurrección -50 oro | DIVERGENT | AO clásico pierde ítems; decidir política |
| PvE | IMPLEMENTED | spawns, IA básica, loot | CURRENT PROJECT BEHAVIOR | |
| PvP | NOT_STARTED | tryAttack técnicamente acepta jugadores pero sin reglas/flags | — | decidir modelo AO (seguro/criminal) antes |
| NPCs | PARTIAL | comerciantes con tienda/diálogo en ciudades | CURRENT PROJECT BEHAVIOR | |
| Trade | NOT_STARTED | — | — | pilar económico AO |
| Professions | NOT_STARTED | — | — | |
| Crafting | NOT_STARTED | — | — | |
| Resources | NOT_STARTED | depósitos generados en mundo pero sin mecánica | — | WT.ironDeposit/goldDeposit existen |
| Factions | NOT_STARTED | reinos generados pero solo cosméticos | — | |
| Clans | NOT_STARTED | — | — | |
| Party | NOT_STARTED | — | — | |
| Reputation | NOT_STARTED | — | — | |
| World | IMPLEMENTED | continente procedural seed 42, streaming chunks | VERIFIED | determinista |
| Cities | IMPLEMENTED | asentamientos con interior, portón norte, servicios NPC | VERIFIED | |
| Wilderness | PARTIAL | continente transitable con monstruos | CURRENT PROJECT BEHAVIOR | peligro desbalanceado por verificar |
| Dungeons | NOT_STARTED | POIs generados sin contenido | — | |
| Economy | PARTIAL | oro + tiendas NPC + drops | CURRENT PROJECT BEHAVIOR | sin sumideros/relojería |
| Persistence | IMPLEMENTED | SQLite, guardado al desconectar | VERIFIED | |

## Status Definitions

NOT_STARTED
PARTIAL
IMPLEMENTED
VERIFIED
DIVERGENT
INTENTIONALLY_MODERNIZED
