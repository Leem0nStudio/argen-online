# CHANGE 2026-08-26 — CHG-019: UI mobile-first + sistema interfaz reutilizable

## System
UI/UX / Mobile / Design System / Haptics

## Intent
Que el juego sea cómodo a pulgares sin perder HUD clásico AO (barras, skill, chat, inventario) y que futuros paneles no reinventen botones/modales.

## Before
- `VirtualJoystick` 46px radius, deadZone 0.25, sin háptica, base 120px; `D-pad` 52px sin `haptic`; `attack` sin vibración.
- `GameScreen` HUD absolute top-left, `skill-bar` 44px, `action-bar` 40px, `inventory-panel` 16 slots hardcode, `npc-close` `<button>` sin háptica, `chat` 200px, sin `safe-area` thumb zones.
- Sin sistema reutilizable: cada panel definía `npc-close`/`trade-ok` ad-hoc.

## After
- `src/ui/hooks/useHaptic.ts` `haptic(light 12ms, medium 20, heavy [20,12,20])` via `navigator.vibrate`.
- `src/ui/components/tokens.css` tokens `ao-radius/thumb/space/font/ease/shadow` + `src/ui/components/AOButton.tsx` (variant primary/ghost/danger/gold, size sm/md/lg, min-height 44-56, haptic) y `AOPanel.tsx` `AOPanel`/`AOBottomSheet` (backdrop, handle, title).
- `src/index.css` importa tokens + `ao-btn/panel/sheet/thumb-zone/skill-wheel/action-dock` + media `@media (max-width:767px)` hud 100% width, skill 52px, action 56px, chat 92vw, `thumb 48-56` + `coarse pointer` larger tap, `safe-area` insets.
- `VirtualJoystick.tsx` radius 58, deadZone 0.18, repeat 140ms, `haptic light` en `touchStart` y cada `dist>0.9*radius`, base 136px knob 58px, D-pad `startDir` con haptic.
- `GameScreen.tsx` imports `AOPanel/AOButton/haptic`, `handleEquip/Use/Buy/useSkill` con `haptic`, `inventory-panel` ahora `AOBottomSheet` en `isMobile` (20 slots vs 16) + `AOButton ghost` cerrar, `npc-close`/`crafting` a `AOButton`, `chat` ya con `safe-bottom` y `thumb` enlarge.

## Reason
AO es PC primero pero el target actual es web mobile. Con pulgares 48px, `vibrate` y `bottom-sheet` el jugador no pierde foco en combate/chat/trade y no se inventa `auto-play`.

## AO Principle
Preserva `identity` (mismo HUD barras/skill/inventario 20 slots, sin `gear-score` nuevo) y moderniza `UX/mobile` con `haptics` y `safe-area`.

## Gameplay Invariants
- Mismo `MAX_INVENTORY_SLOTS 20` (antes UI mostraba 16), mismo `SKILLS Q/W/E` y `action 1-3`, solo visual/háptica cambia.
- `VirtualJoystick` sigue `moveFromJoystick` + `stopFromJoystick` sin cambiar `canWalk` server.

## Affected Systems
`src/ui/components/*`, `src/ui/hooks/useHaptic`, `src/ui/VirtualJoystick`, `src/ui/GameScreen`, `src/index.css`.

## Validation
- [x] `tsc 0`, `test 13 OK`, `build 563` OK
- [x] Manual mobile (Chrome DevTools 390×844): `skill 52px` y `action 56px` pulsables con pulgar, `inventory BottomSheet` 82vh, `chat` 92vw, `joystick 58 radius` + `haptic` al aparecer, `D-pad` 56px, sin `iOS zoom` (`16px` input).

## AO Compatibility
- [x] Preserved (mismo loop, solo ergonomía)
- [ ] Modernized (haptics/bottom-sheet)
- [ ] Intentionally divergent

## Risks
- `navigator.vibrate` no soportado en iOS Safari <16 → fallback silencioso (ya).
- `AOBottomSheet` backdrop `rgba(0,0,0,0.5)` puede ocultar minimap en móvil vertical → `z-index 400` ya sobre `hud 100`.

## Follow-up
- Skill wheel radial long-press `attack`, `drag & drop` inventario, y `quick-bar` customizable por `localStorage`.
