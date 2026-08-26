# CHANGE 2026-08-25 — CHG-006: Razas, facciones/reputación y clanes persistentes

## System
Character creation / Races / Factions / Reputation / Clans / Wilderness

## Intent
Cerrar el loop de identidad (raza modifica stats de forma AO), dar sentido a los 3 reinos generados vía reputación, y hacer que los clanes sobrevivan al reinicio.

## Before
- Registro solo pedía clase.
- 3 reinos solo cosméticos.
- Clanes en memoria se perdían al reiniciar.
- Sin reputación.

## After
- **Razas**: enum Race (humano/elfo/elfo_oscuro/enano/gnomo) con RACE_MODS en `shared/constants.ts` y selector en `AuthScreen.tsx`. `registerPlayer` aplica mods a los stats base. DB columna `players.race` con migración. Retorno en `getPlayer` incluye `race` y `reputation`.
- **Facciones/Reputación**: tabla `reputation(player_id, kingdom, value)`. Helper `server/game/reputation.ts` otorga +1-2 por kill en territorio del reino (via `getKingdomAt`), sincronizado a `player.reputation` en memoria. Comando `/reputacion` / `/rep` muestra standings. Persistido vía `addReputation`.
- **Clanes persistentes**: tablas `clans` + `clan_members` creadas en `initDB`, helpers db* en `database.ts`, `clan.ts` ahora hace DB writes en create/accept/leave y `loadClansFromDB()` al iniciar el servidor (`server/index.ts:12`).
- **Wilderness**: verificado transitable con monstruos; peligro base equilibrado (sin cambios numéricos en esta entrega).

## Rift Score
42 (Systemic + leve Gameplay por razas que afectan progresión inicial)

## Validation
- `npx tsc --noEmit` OK
- `npm run build` OK (560 modules)
- Registro manual con raza elfo verifica mods (str -1 dex +2 etc).

## Unresolved
- Razas existentes en DB antigua quedan como humano por defecto.
- Reputación solo positiva por PvE; sin penalización por PvP criminal ni quests de facción.
- Clanes sin límite de nivel ni wars.
