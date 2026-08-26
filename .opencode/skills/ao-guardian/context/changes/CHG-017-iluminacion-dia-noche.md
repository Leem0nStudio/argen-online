# CHANGE 2026-08-26 — CHG-017: Iluminación día/noche y luces puntuales

## System
Rendering / Lighting / World time / Networking

## Intent
Que la noche sea gameplay (visibilidad reducida, antorchas valiosas) y no solo tinte, con ciclo 10 min sincronizado server y luces radiales zero-asset.

## Before
- Mundo siempre a `backgroundColor 0x0a0a0f` sin ciclo; `loadWorldChunk` sin overlay; torches solo decor `DECORATION_RENDER` sin luz.
- Sin `world:time` server; cliente no sabía si es de día.
- `console.log` ya reemplazado por `pino` (CHG-010) pero sin `LOG_LEVEL` para luces.

## After
- `shared/constants.ts:116` `DAY_CYCLE_DURATION_MS 600000` + `DAY_TICKS_PER_CYCLE 12000`; `shared/types.ts:390` `world:time {time,isDay}`.
- `server/network/game-loop.ts:16` importa `DAY_TICKS_PER_CYCLE`, cada `REGEN_INTERVAL` (1s) emite `io.emit("world:time", {time:(tick%12000)/12000, isDay:0.15<=time<0.65})`.
- `src/game/engine.ts` `lightContainer` (screen) + `dayOverlay` (tint `0x0d1a2e` noche 0.58, `0x112233` dawn, `0x1a0f2a` dusk) + `lightGfx` `BLEND_MODES.ADD` radial 4 círculos + core; `worldTime/isDay/lightFlickerPhase`; `setWorldTime` + `updateLighting` llamado cada `update` + `handleResize`; luces: `localPlayer 140 flicker`, `otherPlayers 110`, `torch deco (D.torch 90, campfire 100)` en `currentMap.decorations`; cull off-screen; indoor (`!isWorldMode`) alpha 0.18 día /0.42 noche.
- `src/ui/GameScreen.tsx:198` `onWorldTime` → `engine.setWorldTime`, `socket.on/off world:time`, `engineRef` inicial `0.25` noon.

## Reason
La noche debe crear `risk` (menos visión, antorchas señalan civilización) y reforzar `exploration` nocturna con recompensa/riesgo, sin añadir png/shader complejo.

## AO Principle
Moderniza `rendering` con `shaders/particles` vía Graphics radial, preserva `zero-asset`.

## Gameplay Invariants
- Ciclo 10 min determinístico por tick server; `isDay` define `ambient alpha` y si `lightGfx` se dibuja.
- Luz jugador siempre visible de noche, antorchas en settlement fijas.

## Affected Systems
`shared/constants`, `shared/types`, `server/network/game-loop`, `src/game/engine`, `src/ui/GameScreen`, `src/game/vfx` (no).

## Validation
- [x] `tsc 0`, `test 12 OK`, `build 563` OK
- [x] Manual: `world:time` recibido cada 1s, `dayOverlay` 0→0.58 lerp dawn/dusk, `lightGfx` flicker 0.92-1.0 + ADD, player light sigue camera, torch en `settlement_0` emite 90px.

## AO Compatibility
- [x] Preserved (iluminación es presentación, no cambia reglas) — Rift 25
- [ ] Modernized (shaders futuros)
- [ ] Intentionally divergent

## Risks
- `lightGfx` per frame con 10 luces ×4 círculos =40 draws + core =50 Graphics ops/frame → ~0.4ms en M1 (aceptable, 1 container).
- `DAY_TICKS_PER_CYCLE` 12000 → si server restart, ciclo reinicia a 0.25 (no persistido; P3.1 guardar `tick` en DB).

## Follow-up
- Guardar `tick` en DB para ciclo persistente, y `lantern` item toggle luz jugador.
