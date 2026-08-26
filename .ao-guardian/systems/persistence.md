# System: Persistence

## CURRENT STATE
- SQLite `better-sqlite3` WAL `server/db/database.ts:11` en `game.db`. Tablas: `players`, `inventory`, `equipment`, `bank`, `clans`, `clan_members`, `reputation`. Migraciones ad-hoc `ALTER TABLE ADD COLUMN` con try/catch. Guardado solo en `disconnect` + tras banco/trade/craft/quest; `savePlayer` no guarda `race/bank_gold` y `getPlayer` resetea `hp=maxHp`.

## INTENDED TARGET
Persistencia del mundo y del progreso del jugador (§7 persistencia).

## KNOWN GAP
- Sin transacciones (`BEGIN/COMMIT`), sin `foreign_keys=ON`, sin migraciones versionadas. `inventory` sin PK permite duplicados. `addReputation` con `INSERT OR REPLACE` y read-then-write no atómico (lost update). Ground/monsters/parties/quests/buffs no persisten.

## RISK
- Crash pierde todo desde último disconnect. `Players.delete` no limpia `deadPlayers` → reconexión queda muerto. `AttackCooldowns` leak. `Health` inalcanzable por `app.get("*")` primero.

## UNKNOWN
- UNKNOWN estrategia de backup/VACUUM y si se prevé multi-instancia con DB compartida.
