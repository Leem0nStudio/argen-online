# System: Architecture

## CURRENT STATE
- Monorepo: `server/` (tsx + Express + Socket.io), `src/` (React + PixiJS 7), `shared/` (tipos/constantes/mundo). `package.json:6` dev usa `concurrently`.
- Bootstrap `server/index.ts:19` orden frágil `initDB → loadClans → initWorld(64,64)`. `vite.config.ts:8` alias `@shared`.
- VERIFIED: build `vite build` genera `dist/` servido por Express con fallback `*`.

## INTENDED TARGET
Infraestructura moderna 3D-capable para juego 2D (§9), autoridad del servidor (§20), zero-asset (§8).

## KNOWN GAP
- Sin DI/config loader; `SERVER_PORT` sin validación NaN; `distPath` relativo.
- `app.get("*")` antes de `/health` hace health inalcanzable.
- CORS `*` sin rate-limit.

## RISK
- `world` y `DB` orden dependiente; si `initWorld` falla, registro cae a fallback `rucci` silencioso.
- `express.static` intercepta rutas API si no hay orden correcto.

## UNKNOWN
- UNKNOWN si se prevé clustering/sharding o despliegue single-instance.
