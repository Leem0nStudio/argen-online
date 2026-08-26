# System: Economy (Inventory/Items/Bank/Trade/Gather/Craft/Quests)

## CURRENT STATE
- `shared/items.ts:17` items (armas 3-18 dmg, armaduras 3-12 def, consumibles, 3 materiales). Tiendas con stock infinito y precios fijos (`buy 5-50`, `sell 1-25`).
- Inventario 20 slots `server/game/inventory.ts`, stack infinito, `pickup/drop/equip/use`. Banco `bank.ts` oro + tabla `bank` sin límite. Trade `trade.ts` doble confirmación rango 5, swap atómico pero `fits()` bug con no-stackables.
- Gathering `gathering.ts:5` tiles alrededor en `world` con cooldown 3s, bonus chance. Crafting `crafting.ts` 3 recetas sin estación. Quests `quest.ts` 4 cacerías con recompensa rep/xp/oro.

## INTENDED TARGET
Escasez, valor de ítems, interdependencia, sumideros (§7).

## KNOWN GAP
- Nodo infinito, sin herramienta/skill/agotamiento. Banco sin comisión/límite. Shop no valida `shopItems` del NPC. Trade sin escrow timeout. Ground items eternos sin TTL.

## RISK
- Arbitraje `iron_ore 8×5=40 → iron_sword vende 20` parece pérdida pero con gathering gratis es impresora 20 oro/craft cada 9s. Hiperinflación. `fits()` puede perder ítems no-stackables.

## UNKNOWN
- UNKNOWN economía AO deseada: ¿stock limitado real o stock infinito modernizado?
