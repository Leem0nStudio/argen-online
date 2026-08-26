# CHANGE 2026-08-26 — CHG-018: Linterna y antorcha — luz portátil

## System
Items / Crafting / Inventory / Buffs / Rendering (lights)

## Intent
Que la noche sea jugable sin estar a ciegas: farol permanente (equipable) y antorcha consumible 5 min, ambos zero-asset y con coste.

## Before
- `ITEMS` sin fuente de luz portátil; `RECIPES` sin `torch/lantern`; `useConsumable` solo curaba `hp/mp`; `engine` luz jugador fija 140 flicker, sin distinguir equipo/buff.
- `PlayerState` sin `lanternOn`; luz siempre igual de noche (72-140) sin progresión.

## After
- `shared/types.ts:143` `lanternOn?` (reservado), `shared/items.ts:84` `torch` consumable stackable 8/2 y `lantern` shield `60/15` def1, `shared/crafting.ts:38` `torch 3× (2 wood+1 bandage 5g)` y `lantern 1× (4 ore+1 gold+2 wood 30g)`, `shared/crafting.ts` `RECIPES` 7 total.
- `server/db/database.ts:179` starter kit ya incluye `wood_axe/iron_pickaxe` (CHG-011), no añade torch/lantern para forzar crafteo.
- `server/game/inventory.ts:88` `useConsumable` ahora: `torch` → `buff torch_light 5m` (extiende si ya existe) + consume 1; `lantern` (shield) → si `shield !== lantern` lo equipa (mueve `cur` shield a inventario si hay slot libre) y no consume.
- `src/game/engine.ts:282` luz jugador: `hasLantern = equipment.shield==="lantern" ? 185 : hasTorch( buff torch_light ) ?145 :72`, color `ffe8a0/ff d080/ffc080`, alpha `1.0/0.9/0.55`, `lightGfx` radial 4 círculos + core `ADD` flicker; `otherPlayers` 110 base; torches settlement 90, campfire 100.
- `src/game/engine.ts` `handleResize` llama `updateLighting`, `update` llama `updateLighting` per frame para flicker y camera.

## Reason
Cerrar loop `noche → necesitas luz → crafteas torch (barata, 5 min) o farol (cara, permanente) → trade`. Refuerza `scarcity` y `player agency` sin añadir `auto-light`.

## AO Principle
Moderniza `rendering` (luces radiales) y preserva `zero-asset`.

## Gameplay Invariants
- Antorcha 5 min, stack, se consume al usar; farol permanente mientras equipado `shield`.
- Sin farol/antorcha radio 72 (penumbra) vs 185/145 con luz.

## Affected Systems
`shared/types`, `shared/items`, `shared/crafting`, `server/game/inventory`, `server/db/database` (no), `src/game/engine`, `src/ui/GameScreen` (usa mismo `world:time`).

## Validation
- [x] `tsc 0`, `test 12→14 OK` (economy incluye `torch/lantern` + fee), `build` OK
- [x] Manual: `/craftear torch` en ciudad con 2 wood+1 bandage 5g → 3 torch; `usar torch` → `buff torch_light` 5m, luz 145; equipar `lantern` → luz 185; sin luz → 72.

## AO Compatibility
- [x] Preserved (luz como recurso, no `night vision` mágico)

## Risks
- `lanternOn` no persiste en DB (se pierde al relog, pero al re-equipar vuelve); P3.1 guardarlo.
- `otherPlayers` luz no refleja su `torch_light` (requiere `otherPlayerData` Map; fallback 110).

## Follow-up
- `lantern` toggle `on/off` con hotkey (ahora siempre on si equipado), y `oil` para recargar.
