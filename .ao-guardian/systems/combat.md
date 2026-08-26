# System: Combat

## CURRENT STATE
- `server/game/combat.ts:40` daño `5 + effectiveStr* (1+buff%) + weaponDamage ±2`, defensa `armor+shield+boots+ring` (head ignorado). Crítico `10%+0.5%*dex` ×1.5. Buffs `strength/dodge/invuln/shield_absorb` por `Date.now()`. `ATTACK_RANGE=3` manhattan, `ATTACK_COOLDOWN_MS=800`.
- PvP safe en `MapZone.City`; `markCriminalIfInnocent` 5min + `-5 rep` kingdom.
- Skills `shared/types.ts:55` 12 skills (warrior/mage/archer/paladin) con mana/cooldown/range. `server/game/skills.ts` valida y aplica.
- `monsterAttackPlayer` sin variance ni crítico, elige target más cercano por `attackRange`.

## INTENDED TARGET
Riesgo/recompensa AO: combate con decisiones de posicionamiento, manejo de recursos (mana/buffs), consecuencias de PvP.

## KNOWN GAP
- Sin `to-hit`/`evasion` por skill/nivel; crítico es única variabilidad. Poison/stun definidos sin tick. Skills escalan con `str` incluso para mago.
- Rango universal 3 hace melee en cruz grande; arco/magia range 5 no diferenciado.

## RISK
- `getArmorDefense` omite `head` → cascos inútiles. Crit después de `absorbShield` mal ordenado. `hasDodge` sin `cleanBuffs` en monster→player deja buff expirado bloqueando daño. Ground items sin validación de `canMoveTo` aparecen sobre pared.

## UNKNOWN
- UNKNOWN fórmula histórica AO de dados de arma, defensa escudo y evasión exacta.
