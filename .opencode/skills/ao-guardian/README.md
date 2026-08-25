# AO-GUARDIAN

Project-development skill for an Argentum Online-inspired modern web MMORPG.

## Purpose

AO-GUARDIAN prevents AI agents from drifting from the project's intended game
identity while allowing modern technical implementation.

It is deliberately technology-agnostic.

## Install

Place this directory where your agent's skill system expects project skills.

The most important file is:

    SKILL.md

The rest of the directory provides references, workflows, rules and templates.

## Project context

If the project already contains a context/documentation system, AO-GUARDIAN
should use it rather than creating duplicate sources of truth.

Otherwise initialize:

    .ao-guardian/
      constitution.md
      current-state.md
      parity-matrix.md
      decisions/
      changes/
      systems/
      research/

## Important

This skill is a governance layer, not a framework.

It does not prescribe a programming language or rendering library.

It tells the agent what the project is trying to preserve, how to evaluate
changes, how to detect drift, and how to maintain project memory.
