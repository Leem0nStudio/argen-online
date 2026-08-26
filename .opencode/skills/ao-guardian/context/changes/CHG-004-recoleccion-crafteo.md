# CHANGE 2026-08-25 — CHG-004: Recolección y crafteo base

## System
Professions / Resources / Crafting / Economy

## Intent
Dar loop de gathering → crafting con materiales del mundo, sumidero económico y progresión no-combat.

## Before
- Materiales existían como tiles (ironDeposit etc) pero sin mecánica.
- Sin recetas, sin acción de recolección.

## After
- Recolección: `/recolectar` en mundo (5 tiles alrededor) otorga wood/iron_ore/gold_nugget con cooldown 3s y bonus chance. Server authority.
- Crafteo: `shared/crafting.ts` 3 recetas, validación server, consumo de materiales, creación de ítem. Panel `/craftear` muestra recetas con have/missing.
- Nuevos tipos/eventos: `gather`, `crafting:craft`, `action:result`.

## Rift Score
38 (Systemic)

## Validation
- tsc OK, build OK.
- Unit test craft: chainmail rechazado sin oro, espada consumió 5 ore correctamente.

## Unresolved
- V1 infinito sin agotamiento de nodos; sin herramientas requeridas.
