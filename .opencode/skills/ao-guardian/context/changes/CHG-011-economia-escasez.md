# CHANGE 2026-08-26 — CHG-011: Economía con escasez — gathering finito, crafting con estación y sumideros

## System
Economía / Gathering / Crafting / Bank / NPC / Items

## Intent
Cerrar el loop faucet/sink: que `iron_ore/wood/gold_nugget` tengan valor por rareza y no se impriman infinito, y que el oro tenga drenaje.

## Before
- Gathering infinito sin herramienta: `gathering.ts` devolvía `wood/iron_ore` en cualquier bosque/depósito sin cooldown por tile ni coste, sin verificar `iron_pickaxe/wood_axe`.
- Crafting sin estación ni costo: `crafting.ts` consumía solo mats en cualquier mapa, sin oro, con hardcode `20` slots.
- Bank sin fee: `withdrawGold` devolvía íntegro el monto.
- NPC sin escasez ni reputación: `npcBuyItem` stock infinito, precio fijo `buyPrice` aunque `reputation +200`.
- Items sin herramientas; nuevos jugadores sin forma de bindear escasez.

## After
- `shared/items.ts:84` añade `iron_pickaxe` (weapon slot `weapon`, dmg 2) y `wood_axe` (dmg 2) como herramientas.
- `shared/crafting.ts` `Recipe.goldCost` + 2 recetas nuevas `iron_pickaxe (3 ore+2 wood 15g)` y `wood_axe (3 wood+1 ore 12g)`; `wooden_shield 10g`, `iron_sword 25g`, `chainmail 60g`.
- `server/game/gathering.ts` finito: `depleted Map` por `${mapId}:${x}:${y}` con `RESPAWN_MS` 5m bosque / 8m hierro / 12m oro; `TOOL_REQUIRED` + `hasTool` (equipped o inventario); `findResourceTile` salta depleted; `gather` verifica herramienta (msg `Necesitas un pico/hacha`), marca `deplete` tras éxito.
- `server/db/database.ts:179` starter kit incluye `wood_axe` slot2 y `iron_pickaxe` slot3 para nuevos personajes (evita deadlock).
- `server/game/crafting.ts` requiere `mapId startsWith settlement_` (banco de trabajo) + `goldCost` check/deducción, usa `MAX_INVENTORY_SLOTS`.
- `server/game/bank.ts:21` `withdrawGold` fee 2% `Math.ceil(amount*0.02)` quemado (sink): `bank -amount`, `player += amount-fee`.
- `server/game/npc.ts` Stock global `STOCK_MAX 10` por `itemId` con `STOCK_RESUPPLY_MS 10m`; `decStock`/`getStock`; `discountFor` 5%/10%/15% según rep 50/100/200 del reino actual (`getKingdomAt`); `npcBuyItem` aplica `unitPrice = ceil(buyPrice*(1-discount))` y verifica stock antes de vender.

## Reason
Dar significado a `wood/iron_ore` (escasez temporal y herramienta) y drenar oro (craft+fee+stock) para evitar hiperinflación vista en auditoría (faucet infinito vs sumidero -50 oro muerte). Mantiene loop AO `leave → gather → risk → craft → return`.

## AO Principle
Preserva `scarcity/valor de ítems` y `player interdependence` (necesitas ciudad para craftear, reputación para descuento).

## Gameplay Invariants
- Nodo agotado 5-12m no da nada hasta respawn.
- Sin `iron_pickaxe` no minás; sin `wood_axe`/`pickaxe` no talás.
- Craftear solo en `settlement_*` y con oro.
- Withdraw pierde 2%.
- Tienda con stock 10/resupply 10m y 15% max descuento.

## Affected Systems
`shared/items`, `shared/crafting`, `server/game/gathering`, `server/game/crafting`, `server/db/database`, `server/game/bank`, `server/game/npc`.

## Validation
- [x] `npx tsc` 0 errores
- [x] `npm run build` y `test` (6 tests + nuevos 2 economía)
- [x] Manual: `/recolectar` sin herramienta → `Necesitas un pico`; segundo gather mismo tile → `No hay nada`; `/craftear iron_sword` fuera ciudad → `Necesitas banco`; `bank:gold withdraw 100` → recibe 98; `npcBuy` 11× mismo ítem → 11º falla stock; rep 120 → `iron_sword` 72g en vez de 80g.

## AO Compatibility
- [x] Preserved (escasez temporal, no bind-on-pickup moderno)
- [ ] Modernized
- [ ] Intentionally divergent

## Risks
- Starter tools ocupan 2 slots (4/20) puede sentirse apretado para nuevos; mitigable con quest que da bolsa.
- Stock global por itemId no por NPC: comprador puede vaciar toda la economía global (P3.1 per-NPC).

## Follow-up
- Per-NPC stock (`${mapId}:${npcId}`), mostrar `stock` y `precio con descuento` en UI `npc:interact`, migración para dar tools a jugadores viejos.
