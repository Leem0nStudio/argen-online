# CHANGE 2026-08-26 — CHG-016: Visual assets procedurales — tiles, jugadores, NPCs, mobs

## System
Rendering / Tiles / Characters / NPCs / Monsters / Decor

## Intent
Que cada `WT` tile, cada raza/clase/equipo y cada mob/NPC se lean a golpe de vista sin PNGs, manteniendo 60fps con 1 Graphics/chunk.

## Before
- `WT_COLORS` planos 0x2d5a1e etc sin variación; `loadWorldChunk` solo 4 overlays (grass/forest/mountain/road) → desierto/tundra/hills/swamp/river/deposits se veían flat sin rasgo.
- `drawEnhancedCharacter` ignoraba `race/equipment`: elfo/enano se veían igual que humano, `iron_sword` no se veía.
- `addNPC` todos `warrior` gris, ícono 16px sin distinción `banker`, sin coin.
- `MONSTER_VISUALS` 4 colores pero sin escala (ogro igual que goblin) y sin arma.

## After
- `WT_COLORS` vibrantes 0x2f6b1e etc + `ironDeposit 0x7a6a5a/gold 0xd4aa20`; `loadWorldChunk` 14 overlays: `forest→canopy+trunk`, `mountain→ridge+facet`, `beach→wave`, `desert→dune stripes`, `tundra/savanna→tufts`, `hills→contour+rocks`, `swamp→lily+ bubbles`, `river→flow highlight`, `iron→veins sparkle`, `gold→sparkle`, `ocean→shimmer`, etc. Todo en 1 Graphics/chunk.
- `drawEnhancedCharacter` + `raceMods` `humano/elfo/elfo_oscuro/enano/gnomo` skin/scale/hair + `armorColors` + `boots` + `head helm` + `weapon/shield` geometry (sword/bow/staff/axe/pickaxe + shield) con `s` scale; `sig` incluye `race|equip`; `engine.ts:1215,813` pasa `race/equipment`.
- `addNPC` `banker:paladin gold 18px + coin`, `merchant:🛒`, `quest:❗ -42y`, `dialog:💬`, con `bob` y ring.
- `MONSTER_VISUALS` scale `goblin 0.92/lobo 1.02/esqueleto 1.0/ogro 1.32` + `container.scale`, + `weapon` (goblin dagger, lobo claws, esqueleto espada, ogro club) en `vfx.ts`.

## Reason
El continente complejo (CHG-013/014) necesita legibilidad inmediata: bosque denso vs bosque claro, vetas visibles y siluetas de clase/raza para PvP y trade.

## AO Principle
Preserva `zero-asset` y `identity` (raza/clase se ven), moderniza `rendering`.

## Gameplay Invariants
- Mismo `WT` id, solo color/overlay cambia; `isWalkable` idéntico.
- Firma `sig` evita rebuild si no cambia equipo/raza.

## Affected Systems
`src/game/engine`, `src/game/vfx`, `shared/world-gen` (no), `shared/world-map` (no).

## Validation
- [x] `tsc 0`, `test 12 OK`, `build` 563 modules OK, 60fps 1 Graphics/chunk sin aumento `tileContainer.children`.
- [x] Visual: forest canopy+trunk, mountain ridge, swamp lily, iron veins y gold sparkle visibles en world; elfo pálido 1.04×, enano 0.88×, `plate_armor` cambia body a `0xc0c8d0`, `iron_sword` espada lateral, `wooden_shield` a izquierda.

## AO Compatibility
- [x] Preserved (procedural, no assets externos)

## Risks
- `container.scale` en mobs escala también `name/hp` → ogro HP bar 1.32× (intencional, más legible) pero vigilar overlap.
- Más `drawCircle/Rect` por tile ~3× vs antes → +0.8ms/chunk en M1 (aceptable, 1 Graphics).

## Follow-up
- `crystalDeposit` color + `head` items con mesh, y `shadow` dinámica por `timeOfDay`.
