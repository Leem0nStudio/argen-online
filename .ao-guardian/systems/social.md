# System: Social (Party/Clan/Chat/PvP)

## CURRENT STATE
- Party `server/game/party.ts`: 5 miembros, invitación por username, bonus XP, chat `/p`, roster. Efímera (sin DB).
- Clan `server/game/clan.ts`: 8 miembros, persistido SQLite (`clans`, `clan_members`), `/clan crear/invitar/salir`, chat `/c`, panel. `loadClansFromDB` al boot.
- Chat `server/game/chat.ts`: 100 mensajes en RAM, `io.emit` global; canales `global/party/clan` via prefijo `channel`.
- PvP: criminal 5min, botín oro+ítem, nombre rojo. Ciudades santuario.

## INTENDED TARGET
Dependencia social, conflicto y persistencia (clanes, facciones, reputación).

## KNOWN GAP
- Party sin kick/promote/loot mode. Clan solo líder, sin rangos/bank/war. Chat global a todos los mapas rompe inmersión AO. Facciones solo 3 reinos por nearest capital sin fronteras.

## RISK
- `io.emit` global escala O(N²) y fuga inter-mapas. `memberClan` apunta a ids offline con `?`. `pendingInvites` sin limpieza periódica.

## UNKNOWN
- UNKNOWN si AO objetivo incluye Armada/Caos, karma, ranking, matrimonio, guild wars.
