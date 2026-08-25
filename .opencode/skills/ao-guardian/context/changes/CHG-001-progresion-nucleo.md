# CHANGE 2026-08-25 — CHG-001: Núcleo de progresión (XP/loot/muerte)

## System
Progression / Combat / Death

## Intent
Que el loop central AO (cazar → recompensa → progresar) funcione en todos los caminos de combate, y que la muerte tenga consecuencias definidas y consistentes.

## Before
- Matar monstruos con arma NO daba XP ni loot (solo kills con hechizo recompensaban).
- Loot dropeado por skills nunca se transmitía a los clientes.
- Lógica de muerte de monstruo duplicada en 3 lugares (combat.ts melee, skills single, skills AoE).
- Respawn usaba valor mágico 50 en vez del constante RESPAWN_GOLD_COST.
- PvP death: el oro perdido desaparecía (nadie lo recibía).

## After
- `killMonster(killer, monster)` centralizada en combat.ts: XP + loot + estado de respawn. Usada por melee, skill single-target y AoE.
- DamageEvent extendido con xpGained/levelUp; handlers emiten groundItems:update al morir un monstruo y mensaje de chat global al subir de nivel ("⚔️ X ha alcanzado el nivel Y!").
- PvP kill: el asesino recibe el oro caído del vencido (10%).
- Respawn usa RESPAWN_GOLD_COST (50).

## Reason
El loop core AO estaba roto: el 90% del combate (melee) no recompensaba. Ver skill §7 (loop: hunt → reward → progress).

## AO Principle Affected
Meaningful progression, risk/reward, scarcity (loot).

## Gameplay Invariants
- Servidor sigue siendo autoridad de todo daño/xp/loot.
- Fórmulas de daño sin cambios.
- Curva xpForLevel(level)=level*100 y gains por nivel sin cambios.

## Rift Score
35 (Systemic) — restaura comportamiento intended, no cambia reglas base.

## Affected Systems
combat.ts, skills.ts, handlers.ts, movement.ts, shared/types.ts

## Validation
- tsc --noEmit OK, vite build OK.
- Test unitario tsx: killMonster otorga XP (90+15→nivel 2 con carryover 5), sube maxHp 120→130, str 8→10, restaura HP, deja 1 loot, monster idle/target null. PASS.
- Pendiente: validación manual en cliente (mensaje de nivel, loot visible).

## Unresolved Risks
- Política de pérdida de ítems al morir (AO clásico) NO implementada — requiere decisión de usuario (Rift Score alto).
- Monstruo muerto tarda hasta 500ms en desaparecer de otros clientes (broadcast periódico).
