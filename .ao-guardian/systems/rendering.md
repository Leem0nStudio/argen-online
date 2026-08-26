# System: Rendering / VFX / Audio

## CURRENT STATE
- `src/game/engine.ts:1132` PIXI 7 con tileContainer/decoContainer/entityContainer/fxContainer/uiContainer. `vfx.ts` `drawEnhancedCharacter/Monster/Item` vía `Graphics+Text`, `ParticleSystem`, `ScreenShake`, `AmbientTiles`. Procedural zero-asset (§8) cumplido. Optimizaciones 60fps: caché por firma y terreno 1 Graphics/chunk, culling radius 3, `antialias:false, resolution=devicePixelRatio`.

## INTENDED TARGET
2D jugable con capacidades 3D internas (§9): shaders, iluminación, partículas ya base.

## KNOWN GAP
- `ScreenShake` con drift acumulativo; `AmbientTiles` hace `clear()` por tile cada frame. `canWalk` cliente/servidor desincronizados en `shallowWater`.

## RISK
- `cacheAsBitmap` no usado; firma por contenedor es parche, no textura.
- `devicePixelRatio` 3× en móviles con 100k objetos históricos ya mitigado pero `resolution` sin cap a 2.

## UNKNOWN
- UNKNOWN si se prevé migrar a WebGL2/Three.js para aprovechar 3D real o quedarse en PIXI canvas.
