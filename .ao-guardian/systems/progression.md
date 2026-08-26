# System: Progression (XP/Level/Races)

## CURRENT STATE
- `shared/constants.ts:78` `xpForLevel(level)=level*100` lineal. `server/game/combat.ts:283` `grantXp` sube múltiples niveles, `+10HP +5MP +2STR +1DEX/INT +2CON` fijo, restaura HP/MP.
- Party XP `server/game/party.ts:119` pool `ceil(base*1.25)` dividido entre miembros cercanos ≤12 tiles, mismo mapa.
- Razas `RACE_MODS` + `CLASS_BASE_STATS` sumados en `server/db/database.ts:129`.
- Reputación `+1-2` por kill, `+5-12` por quest, `-5` por criminal.

## INTENDED TARGET
Progresión significativa con identidad de clase/raza, especialización y dependencia social (§7).

## KNOWN GAP
- Curva lineal L20=21k XP (280 Ogros) vs AO exponencial; sube demasiado rápido. Stats automáticos eliminan builds. Skills sin requisitos de nivel/raza.
- Party leech 12 tiles sin penalización por nivel dispar. Cooldowns/buffs no persisten.

## RISK
- Convergencia de builds: gnomo-enano inicial diverge pero a nivel 10 diferencia irrelevante. Incentiva power-leveling de alters.
- `sharedXpOnKill` usa `floor(pool/n)` pierde resto XP.

## UNKNOWN
- UNKNOWN curva AO real objetivo; `INTENTIONALLY_MODERNIZED` vs `VERIFIED` requiere research.
