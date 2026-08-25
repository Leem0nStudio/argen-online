// ============================================================
// Game Engine — Thin orchestrator re-exporting focused modules
// ============================================================

// Re-export everything from focused modules for backward compatibility
export { Players, Ground, Chat as ChatState, Monsters, AttackCooldowns, SpawnState } from "./state.js";
export type { ActivePlayer, Monster } from "./state.js";
export { canMoveTo, movePlayer, stopPlayer, respawnPlayer } from "./movement.js";
export { getEffectiveStrength, getArmorDefense, getAttackDamage, isCritical, hasDodge, hasInvuln, absorbShieldDamage, cleanBuffs, tryAttack, attackMonster, monsterAttackPlayer, grantXp } from "./combat.js";
export { useSkill } from "./skills.js";
export { pickupItem, dropItem, equipItem, useConsumable, dropMonsterLoot } from "./inventory.js";
export { addChatMessage, addSystemMessage, getNearbyMessages } from "./chat.js";
export { getNPC, npcBuyItem, npcSellItem } from "./npc.js";
export { spawnMonstersForMap, respawnMonsters, getMonstersAsData, tickMonsterAI } from "./monster-ai.js";
