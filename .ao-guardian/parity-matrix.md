# AO PARITY MATRIX — 2026-08-26 (Análisis)

> Estado verificado por lectura directa del repositorio. `VERIFIED REFERENCE` solo si existe documento AO externo en el repo (no hay). Todo lo demás es `CURRENT PROJECT BEHAVIOR` o `ASSUMPTION`.

| System | Status | Current Implementation | Reference Confidence | Notes |
|---|---|---|---|---|
| Character creation | IMPLEMENTED | registro usuario/contraseña/clase/raza | CURRENT PROJECT BEHAVIOR | RACE_MODS sin preview de stats en AuthScreen |
| Races | IMPLEMENTED | 5 razas (humano/elfo/elfo_oscuro/enano/gnomo) con mods | CURRENT PROJECT BEHAVIOR | Handler ignora race si se envía inválida → fallback humano silencioso |
| Classes | IMPLEMENTED | 4 clases con 3 skills c/u | CURRENT PROJECT BEHAVIOR | Sin requisitos de nivel/raza, sin árbol |
| Attributes | PARTIAL | str/dex/int/con fijos por clase+raza, +2/+1 automático por nivel | ASSUMPTION | AO asigna puntos manualmente; aquí lineal fijo |
| Skills | PARTIAL | 12 skills en SKILLS, buffs string-typed | CURRENT PROJECT BEHAVIOR | poison/stun sin efecto |
| Combat | PARTIAL | daño base+str+arma, defensa plana, crítico dex*0.5%, cd 800ms, rango 3 | CURRENT PROJECT BEHAVIOR | Sin to-hit/evasion AO |
| Magic | PARTIAL | vía skills (fireball, ice_shield, heal) | CURRENT PROJECT BEHAVIOR | Escala con str en vez de int para mago |
| Weapons | PARTIAL | 6 armas 3-18 dmg por ITEMS | CURRENT PROJECT BEHAVIOR | Sin requisitos nivel |
| Armor | PARTIAL | 3 armaduras + escudo, defensa omite head | CURRENT PROJECT BEHAVIOR | Bug: head nunca da defensa |
| Inventory | IMPLEMENTED | 20 slots, pickup/drop/equip/use, stack infinito | CURRENT PROJECT BEHAVIOR | Bug equipItem pierde ítem si inventario lleno |
| Experience | IMPLEMENTED | killMonster XP en melee y magia, curva level*100 | CURRENT PROJECT BEHAVIOR | Lineal, no exponencial AO |
| Leveling | IMPLEMENTED | +10HP +5MP +stats fijos, restaura HP/MP, anuncio global | CURRENT PROJECT BEHAVIOR | Converge builds |
| Death | IMPLEMENTED | -50 oro respawn + 50% stack aleatorio en PvP, -5 rep | DIVERGENT | AO es full-drop + corpse; aquí mitigado |
| PvE | IMPLEMENTED | spawns 4/6, IA idle/patrol/chase/attack/flee, loot 1 random | CURRENT PROJECT BEHAVIOR | Spawn reactivo por jugador, no ecosistema |
| PvP | IMPLEMENTED | criminal 5min, santuario City, botín oro al asesino, rojo | DESIGN DECISION | Sin guardias NPC |
| NPCs | IMPLEMENTED | merchant/banker/quest/dialog por jerarquía capital→village | CURRENT PROJECT BEHAVIOR | shop infinito sin stock, compra sin validar shopItems |
| Trade | IMPLEMENTED | /comerciar, doble confirmación, rango 5, swap atómico | VERIFIED | Bug fits() con no-stackables puede perder ítems |
| Professions | PARTIAL | /recolectar con cooldown 3s, sin herramienta/skill | CURRENT PROJECT BEHAVIOR | Nodo infinito |
| Crafting | IMPLEMENTED | 3 recetas, validación inventario, consumo exacto | CURRENT PROJECT BEHAVIOR | Sin estación, gold cost, fallo |
| Resources | IMPLEMENTED | iron_ore/wood/gold_nugget en bosques/depósitos | CURRENT PROJECT BEHAVIOR | Solo 6 celdas en minas, no en superficie |
| Factions | IMPLEMENTED | 3 reinos (nearest capital), getKingdomAt | CURRENT PROJECT BEHAVIOR | Solo nombre/color, sin fronteras |
| Clans | IMPLEMENTED | 8 miembros, persistido SQLite, /clan crear/invitar/salir, chat /c | VERIFIED | Sin kick/rangos/bank |
| Party | IMPLEMENTED | 5 miembros, bonus 1.25×, rango 12, chat /p | VERIFIED | Sin loot mode, floor pierde XP |
| Reputation | IMPLEMENTED | +1-2 por kill, +5-12 por quest, -5 por criminal, tabla reputation | CURRENT PROJECT BEHAVIOR | Sin efecto en precios/guardias |
| World | IMPLEMENTED | 64×64 chunks (4096² tiles), seed 42, streaming | VERIFIED | Determinista por seed, pero roads slice(0,500) trunca |
| Cities | IMPLEMENTED | 12 asentamientos 14-30 tiles, portón norte, NPCs | VERIFIED | Gate solo 1 tile exacto |
| Wilderness | IMPLEMENTED | bias Ogro/Esqueleto a >150 tiles de ciudad | CURRENT PROJECT BEHAVIOR | No escala por bioma |
| Dungeons | IMPLEMENTED | 30 POIs con interiores 18-28, 4-6 salas, mina con depósitos | VERIFIED | Sin boss/loot diferenciado |
| Economy | PARTIAL | oro + tiendas + drops + banco ilimitado + trade + quests faucet | CURRENT PROJECT BEHAVIOR | Sin sumideros fuertes |
| Persistence | IMPLEMENTED | SQLite WAL, 7 tablas, save en disconnect | CURRENT PROJECT BEHAVIOR | No guarda HP actual/buffs/quests/suelo/mobs |

**Estados:** NOT_STARTED | PARTIAL | IMPLEMENTED | VERIFIED | DIVERGENT | INTENTIONALLY_MODERNIZED
