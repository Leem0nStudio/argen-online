# DECISION 2026-08-25 — DEC-001: Modelo de PvP con criminalidad

## Contexto
El sistema #2 del roadmap requiere reglas de PvP. AO clásico tiene PvP abierto con
sistema de criminalidad (atacar a inocentes te marca; los criminales pueden ser
atacados libremente y los guardias los persiguen en ciudades).

## Decisión (DESIGN DECISION — no se afirma paridad histórica exacta)
1. **Ciudades = santuario absoluto** (ya existía: MapZone.City bloquea ataques).
2. **Continente = PvP abierto**.
3. Atacar a un jugador **inocente** (no criminal) marca al agresor como **criminal por 5 minutos** (`PVP_CRIMINAL_DURATION_MS`).
4. Atacar a un **criminal** NO marca al atacante — cazar criminales es legal y sin costo.
5. Los criminales se renderizan en **rojo** para todos los clientes.
6. Muerte en PvP: la víctima pierde 10% de su oro y **el asesino lo recibe** (botín).
7. `criminalUntil` es runtime-only (no persiste en DB) en v1.

## Alternativas descartadas
- PvP por consentimiento/duelos: rompe identidad AO (riesgo constante fuera de ciudades).
- Guardias NPC anti-criminales en ciudades: pospuesto a fase de NPCs avanzados.
- Pérdida de ítems al morir: Rift Score alto, requiere aprobación explícita del usuario.

## Consecuencias
- Riesgo real al salir al continente: refuerza loop AO (preparar→arriesgar→recompensa).
- Futuro: guardias NPC que ataquen criminales cerca de portones; reputación integrada con facciones/reinos.

## Referencias
- Implementación: server/game/combat.ts (isCriminal, markCriminalIfInnocent), skills.ts, engine.ts (playerColor)
- Test: /tmp/opencode/test-pvp2.ts (tryAttack real, criminalidad, botín, expiración)
