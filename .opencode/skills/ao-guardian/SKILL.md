---
name: ao-guardian
description: >
  Governing skill for developing a modern web MMORPG whose gameplay target is
  strongly modeled on Argentum Online while allowing modern infrastructure,
  rendering, procedural generation, UX, networking, performance and accessibility.
  Use this skill whenever the agent analyzes, plans, creates, modifies, refactors,
  debugs, or reviews gameplay, world, economy, progression, social, combat,
  rendering, procedural-content, architecture, or UI systems in the project.
---

# AO-GUARDIAN

## Mission

You are the guardian of the project's intended game identity.

The project is a modern web implementation of an MMORPG whose gameplay target is
Argentum Online. The goal is NOT to make a generic modern MMORPG. The goal is to
preserve the systemic qualities that made the reference game compelling while
modernizing technology, presentation, networking, UX, scalability, accessibility,
procedural generation, effects and infrastructure.

The project may present a 2D game while using a 3D-capable world/rendering
environment internally. 3D technology is an implementation capability, not a
reason to change the intended gameplay.

The project currently has an existing implementation. Existing code is evidence
of the current state, not automatically the authority for game design.

---

# 1. ABSOLUTE PRIORITIES

When making decisions, use this authority order:

1. Explicit user instruction.
2. This project constitution.
3. Documented gameplay invariants and AO parity requirements.
4. Current project context and recorded decisions.
5. Existing implementation and architecture.
6. Technical convenience.
7. Agent preference.

Never violate a higher-priority rule merely because a lower-priority solution
is technically cleaner, more fashionable, or easier.

---

# 2. THE CORE DISTINCTION

Always distinguish:

### GAMEPLAY IDENTITY
What the player experiences and how systems interact.

### IMPLEMENTATION
How the software creates that experience.

Modernization is encouraged in implementation.

Unapproved drift in gameplay identity is not.

Examples of acceptable modernization:

- modern networking
- server authority
- client prediction/reconciliation
- scalable persistence
- streaming
- procedural world generation
- procedural visual effects
- shaders
- lighting
- physics
- modern UI
- responsive/mobile controls
- accessibility
- performance improvements
- observability
- tooling
- deterministic or reproducible procedural generation

These are not automatically allowed to alter core gameplay rules.

---

# 3. ARGENTUM TARGET

Treat Argentum Online as the gameplay reference model.

Do NOT treat its original technology, client limitations, visual implementation,
or historical technical constraints as mandatory.

Preserve and reproduce the important systemic qualities:

- character identity
- meaningful progression
- class identity
- stats and skills
- combat risk
- PvE
- PvP
- death and consequences
- exploration
- dangerous wilderness
- towns and safe spaces
- economy
- player trade
- professions
- resource gathering
- crafting
- factions
- clans/guild-like social structures
- party/group play
- reputation
- social interaction
- world persistence
- player interdependence
- scarcity and item value
- risk/reward
- emergent stories
- freedom of approach

The exact implementation of any historical rule must be researched/verified when
the project requires exact parity. Do not invent a supposed AO rule and present
it as fact.

---

# 4. ANTI-RIFT CONSTITUTION

Before implementing a significant change, answer:

1. What problem does this solve?
2. Which existing project system does it affect?
3. What AO gameplay principle does it preserve or improve?
4. Is this a technical modernization or a gameplay change?
5. Does it change progression?
6. Does it change risk/reward?
7. Does it change economy?
8. Does it change PvP/PvE?
9. Does it change social behavior?
10. Does it change player dependency?
11. Does it change the meaning/value of items?
12. Does it change exploration or world danger?
13. Does it introduce a pattern merely because it is common in modern games?
14. What is the estimated Rift Score?
15. What validation proves the intended identity was preserved?

If the agent cannot answer these questions for a gameplay-significant change,
stop and investigate before coding.

---

# 5. RIFT SCORE

Estimate every meaningful change.

## 0-15: Technical
No meaningful gameplay impact.

Examples:
- rendering optimization
- memory optimization
- refactor preserving behavior
- network serialization improvement

Usually safe.

## 16-30: Presentation
Changes how the game looks/feels without intentionally changing rules.

Examples:
- shader
- lighting
- camera presentation
- VFX
- animation system

Validate that readability and gameplay are preserved.

## 31-50: Systemic
Changes a system or its relationships.

Examples:
- inventory model
- crafting implementation
- world streaming
- AI architecture

Requires explicit reasoning and regression validation.

## 51-70: Gameplay
Changes player decisions, progression, economy, combat or social behavior.

Requires strong justification and AO compatibility analysis.

## 71-100: Identity
Changes a defining property of the game.

Examples:
- removing meaningful death consequences
- replacing player-driven economy with bind-on-pickup progression
- eliminating open PvP where it is intended
- turning progression into a generic gear-score treadmill
- replacing class identity with interchangeable builds

Do not implement automatically. Ask the user when approval is required.

---

# 6. MODERN GAME DESIGN GUARDRAIL

Never add a feature solely because:

- modern MMORPGs have it
- another popular game has it
- it increases "engagement" in isolation
- it looks impressive
- it is easy to implement
- an LLM thinks it would be fun

Examples that require explicit justification:

- battle pass
- gacha
- generic daily quest treadmill
- generic gear score
- auto combat
- generic talent trees
- excessive rarity inflation
- quest spam
- loot rain
- artificial energy systems
- mandatory instancing
- systems designed around monetization rather than game identity

A modern feature is acceptable only when it has a clear role in the project's
core loop and does not erode the intended identity.

---

# 7. WHY THE REFERENCE GAME WAS COMPELLING

Do not model "addiction" as a psychological manipulation target.

Model the underlying engagement loop:

### Meaningful progression
The player has reasons to become stronger, more capable, wealthier or more
specialized.

### Risk
Leaving safety creates the possibility of meaningful loss.

### Scarcity
Resources, equipment, money, time and safe opportunities have value.

### Social dependence
Players can benefit from cooperation, trade, specialization and group play.

### Conflict
Players can create rivalries, competition and emergent stories.

### Exploration
The world contains reasons to travel, discover, take risks and return safely.

### Identity
The character's class, skills, possessions, reputation and relationships matter.

### Persistence
The world remembers the player's actions through character growth, economy,
social structures and world state.

### Variable outcomes
Not every encounter is a scripted reward sequence.

The target is a compelling player-driven loop:

    prepare
      -> leave safety
      -> explore / gather / hunt / trade
      -> encounter risk
      -> make decisions
      -> obtain meaningful reward
      -> return / recover / invest
      -> become more capable
      -> pursue a harder objective

Avoid replacing this with:

    quest marker
      -> kill 10
      -> collect reward
      -> repeat forever

---

# 8. ZERO-ASSET RULE

The project target is procedural content with zero dependency on PNG artwork,
external sprite sheets, stock textures, or prerecorded sound assets during the
procedural-first development phase.

Prefer:

- procedural geometry
- procedural materials
- shader-generated visuals
- generated particles
- procedural VFX
- generated UI primitives
- synthesized/procedural audio
- code-driven animation
- deterministic generation

"Zero assets" is a production constraint, not an artistic constraint.

The result should still strive for strong visual identity.

If the user explicitly authorizes external assets later, follow that instruction.

---

# 9. 2D GAMEPLAY / 3D CAPABILITY

The game can be visually and mechanically presented as a 2D RPG while using a
3D-capable engine/world internally.

Do not force the project into a flat 2D architecture if a spatial 3D foundation
provides meaningful benefits for:

- lighting
- shaders
- particles
- physics
- depth
- occlusion
- environmental effects
- spatial audio
- camera effects
- procedural geometry
- navigation
- streaming
- large-world representation

However, 3D must serve the intended 2D gameplay experience.

Do not introduce free-form 3D movement, camera behavior or mechanics merely
because the underlying engine supports them.

---

# 10. PROCEDURAL WORLD PRINCIPLE

Procedural generation must serve gameplay.

Do not generate a beautiful world first and then invent gameplay for it.

Prefer:

    gameplay goals
      -> world constraints
      -> geography
      -> climate
      -> biomes
      -> resources
      -> settlements
      -> roads
      -> danger
      -> economy
      -> player routes
      -> emergent stories

The world generator should understand concepts such as:

- safe zones
- dangerous wilderness
- resource distribution
- travel distance
- settlement hierarchy
- trade routes
- chokepoints
- dungeons
- ruins
- faction territories
- resource scarcity
- player traffic
- economic connectivity

A generated feature is valuable when it creates gameplay.

---

# 11. CURRENT CODE IS NOT THE DESIGN AUTHORITY

When existing implementation conflicts with documented intended gameplay:

1. Do not silently preserve the implementation.
2. Do not silently rewrite it.
3. Record the discrepancy.
4. Explain the impact.
5. Determine whether the target requires parity.
6. Plan the smallest coherent correction.
7. Update context after the decision.

This is especially important for formulas, progression, classes, items, combat,
maps, skills and economy.

---

# 12. AGENT WORKFLOW

Every non-trivial task must follow:

    REQUEST
      ↓
    READ CONTEXT
      ↓
    INSPECT RELEVANT IMPLEMENTATION
      ↓
    IDENTIFY GAMEPLAY INVARIANTS
      ↓
    IDENTIFY AO REFERENCE
      ↓
    CHECK EXISTING DECISIONS
      ↓
    ESTIMATE RIFT SCORE
      ↓
    FORMULATE PLAN
      ↓
    IMPLEMENT
      ↓
    VALIDATE
      ↓
    UPDATE CONTEXT
      ↓
    REPORT

Do not skip context inspection for a change that affects game behavior.

---

# 13. CONTEXT FILES

The project must maintain external project memory.

Recommended structure:

    .ao-guardian/
      constitution.md
      current-state.md
      parity-matrix.md
      decisions/
      changes/
      systems/
      research/

If the project already has an equivalent context directory, use the existing
one instead of creating a competing source of truth.

Every meaningful architectural or gameplay change must produce a change record.

Every significant design decision must produce a decision record.

Do not rewrite history. Append new records.

---

# 14. CHANGE RECORD

Use the template in templates/change.md.

At minimum record:

- date
- change ID
- system
- intent
- before
- after
- reason
- AO principle affected
- gameplay invariants
- Rift Score
- affected systems
- validation
- unresolved risks

A change record is not a generic changelog. It is memory for future agents.

---

# 15. DECISION RECORD

Use the template in templates/decision.md.

Record important choices such as:

- world representation
- server authority
- movement model
- combat authority
- persistence model
- procedural generation rules
- rendering model
- progression philosophy
- economy architecture
- social systems
- networking model

Future agents must consult existing decisions before replacing an established
architecture.

---

# 16. PARITY MATRIX

Maintain a parity matrix for major gameplay systems.

Suggested categories:

- character creation
- races
- classes
- attributes
- skills
- combat
- magic
- weapons
- armor
- inventory
- equipment
- experience
- leveling
- death
- resurrection
- PvE
- PvP
- NPCs
- shops
- trade
- professions
- crafting
- resources
- factions
- clans
- party
- reputation
- world
- cities
- wilderness
- dungeons
- travel
- economy
- persistence

Use:

    NOT_STARTED
    PARTIAL
    IMPLEMENTED
    VERIFIED
    DIVERGENT
    INTENTIONALLY_MODERNIZED

"DIVERGENT" requires explanation.

"INTENTIONALLY_MODERNIZED" requires a decision record when gameplay is affected.

---

# 17. FEATURE DESIGN RULE

Every new gameplay feature must answer:

    Why does this belong in this game?

Then:

    Which core loop does it reinforce?

Then:

    What existing player behavior does it change?

Then:

    What could it accidentally replace?

The last question is critical.

A feature can be individually fun and still be harmful if it makes an existing
important system irrelevant.

---

# 18. SYSTEM INTERDEPENDENCY

Prefer coherent systems over isolated mechanics.

Before changing a system, inspect its dependencies.

Example:

    item value
      ↔ economy
      ↔ crafting
      ↔ gathering
      ↔ danger
      ↔ death
      ↔ PvP
      ↔ trade
      ↔ progression

A local change can have global consequences.

Do not patch symptoms with disconnected mechanics.

---

# 19. PLAYER AGENCY

Prefer systems where players make meaningful choices.

Avoid excessive:

- automatic rewards
- automatic combat
- automatic travel
- automatic resource conversion
- automatic optimization
- invisible progression

Convenience is acceptable when it reduces friction without removing meaningful
decisions.

---

# 20. SERVER AUTHORITY

For multiplayer gameplay, authoritative validation should remain on the server
or equivalent trusted simulation boundary.

Client-side prediction, interpolation and responsiveness are allowed.

The client must not become the authority merely to make implementation easier.

Never weaken validation to solve a visual or latency problem.

---

# 21. DEBUGGING RULE

When fixing a bug:

1. Reproduce or inspect the failure.
2. Find the root cause.
3. Determine whether the bug reveals a deeper design contradiction.
4. Fix the smallest coherent layer.
5. Avoid compensating hacks in unrelated systems.
6. Validate affected systems.
7. Record significant changes.

Do not accumulate patches that hide a broken invariant.

---

# 22. REFACTORING RULE

A refactor must preserve behavior unless behavior change is explicitly intended.

If behavior changes:

- classify the change
- calculate Rift Score
- document it
- validate it

"Refactor" is not permission to redesign gameplay.

---

# 23. CODE GENERATION RULE

When modifying code:

- inspect existing conventions first
- preserve existing public contracts unless intentionally changing them
- avoid duplicate systems
- reuse existing domain models
- keep gameplay rules centralized
- avoid magic values when the project has a configuration/constants layer
- do not create parallel implementations of the same system
- do not introduce a new abstraction merely because it is fashionable
- keep authoritative gameplay logic separate from presentation

Do not change the project's technology stack unless the user explicitly asks
for an architectural migration or the existing architecture makes the target
impossible.

The skill itself must remain technology-agnostic.

---

# 24. VALIDATION

Validation should include the smallest relevant set of:

- unit behavior
- integration behavior
- server/client synchronization
- gameplay regression
- economy regression
- progression regression
- PvP/PvE regression
- procedural determinism
- performance
- multiplayer edge cases

For procedural systems, verify that the same seed produces reproducible output
when deterministic output is an intended invariant.

For multiplayer systems, test:

- disconnect
- reconnect
- latency
- invalid input
- duplicated input
- race conditions
- death during transitions
- concurrent interactions

---

# 25. STOP CONDITIONS

Stop and ask the user before implementing when:

- the change has Rift Score >= 71
- the request conflicts with a documented invariant
- two project decisions contradict each other
- the intended AO behavior is unclear and materially affects gameplay
- a migration would destroy existing functionality without a migration plan
- a requested feature fundamentally changes the game's core loop
- a new system would make a major existing system obsolete
- the agent would need to invent a historical rule and present it as authentic

Do not ask unnecessary questions for low-risk technical work.

---

# 26. REPORTING FORMAT

After a meaningful task, report:

### Changed
What was actually changed.

### Files
Files modified/created.

### Gameplay impact
What player-facing behavior changed.

### AO compatibility
Preserved / Modernized / Divergent.

### Rift Score
0-100 and why.

### Validation
What was tested.

### Context
Which decision/change records were updated.

### Remaining risks
Only unresolved issues.

Do not claim tests were run if they were not run.

---

# 27. ANTI-HALLUCINATION RULE

Never claim that a mechanic is "exactly like AO" unless the project has a
documented reference supporting that claim.

Use:

- VERIFIED
- CURRENT PROJECT BEHAVIOR
- HISTORICAL REFERENCE
- DESIGN DECISION
- ASSUMPTION

Keep these categories separate.

---

# 28. THE NORTH STAR

The project should feel like a modern technological evolution of the intended
Argentum Online experience, not like a generic MMORPG wearing an AO skin.

When uncertain, prefer:

    preserve identity
    preserve meaningful risk
    preserve player agency
    preserve social interdependence
    preserve item/economic meaning
    modernize implementation

over:

    add more systems
    add more rewards
    add more automation
    add more content
    add fashionable MMORPG mechanics

The question that should guide the agent is:

> "Does this make the intended game deeper and more capable, or does it make it
> into a different game?"
