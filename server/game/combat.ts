// ============================================================
// Combat System — Damage, defense, crits, death
// ============================================================

import type { PlayerState, DamageEvent } from "../../shared/types.js";
import { MapZone } from "../../shared/types.js";
import { MAPS } from "../../shared/maps.js";
import { ITEMS } from "../../shared/items.js";
import {
  BASE_DAMAGE, CRIT_CHANCE_BASE, CRIT_MULTIPLIER,
  ATTACK_COOLDOWN_MS, ATTACK_RANGE, GOLD_LOSS_ON_DEATH_PCT,
  PVP_CRIMINAL_DURATION_MS,
} from "../../shared/constants.js";
import { Players, Monsters, AttackCooldowns, Ground, type ActivePlayer, type Monster } from "./state.js";
import { sharedXpOnKill } from "./party.js";
import { gainReputationForKill } from "./reputation.js";
import { onMonsterKill } from "./quest.js";
import { addReputation } from "../db/database.js";
import { getWorldMap } from "./world.js";
import { v4 as uuidv4 } from "uuid";

// ---- Stats ----

export function getEffectiveStrength(player: PlayerState): number {
  let str = player.stats.strength;
  const now = Date.now();
  for (const b of player.buffs ?? []) {
    if (b.expiresAt > now && b.type === "strength") {
      str = Math.floor(str * (1 + b.value / 100));
    }
  }
  return str;
}

export function getArmorDefense(player: PlayerState): number {
  let defense = 0;
  for (const slot of ["armor", "shield", "boots", "ring"]) {
    const itemId = (player.equipment as Record<string, string | null>)[slot];
    if (itemId) {
      const item = ITEMS[itemId];
      if (item?.stats?.defense) defense += item.stats.defense;
    }
  }
  return defense;
}

export function getAttackDamage(attacker: PlayerState): number {
  const weaponSlot = attacker.equipment.weapon;
  let weaponDamage = 0;
  if (weaponSlot) {
    const item = ITEMS[weaponSlot];
    if (item?.stats?.damage) weaponDamage = item.stats.damage;
  }
  const baseDmg = BASE_DAMAGE + getEffectiveStrength(attacker) + weaponDamage;
  const variance = Math.floor(Math.random() * 4) - 2;
  return Math.max(1, baseDmg + variance);
}

export function isCritical(attacker: PlayerState): boolean {
  const dex = attacker.stats.dexterity;
  return Math.random() < (CRIT_CHANCE_BASE + dex * 0.005);
}

// ---- Buff Checks ----

export function hasDodge(player: PlayerState): boolean {
  const now = Date.now();
  return (player.buffs ?? []).some(b => b.type === "dodge" && b.expiresAt > now);
}

export function hasInvuln(player: PlayerState): boolean {
  const now = Date.now();
  return (player.buffs ?? []).some(b => b.type === "invuln" && b.expiresAt > now);
}

export function absorbShieldDamage(player: PlayerState, damage: number): number {
  const now = Date.now();
  if (!player.buffs) return damage;
  for (const b of player.buffs) {
    if (b.type === "shield_absorb" && b.expiresAt > now && (b.shieldHp ?? 0) > 0) {
      const absorbed = Math.min(damage, b.shieldHp!);
      b.shieldHp = (b.shieldHp ?? 0) - absorbed;
      damage -= absorbed;
      if (damage <= 0) return 0;
    }
  }
  return damage;
}

export function cleanBuffs(player: PlayerState): void {
  if (!player.buffs) return;
  const now = Date.now();
  player.buffs = player.buffs.filter(b => b.expiresAt > now);
}

// ---- PvP criminality ----

/** A player is criminal while the flag is active. Criminals are fair game. */
export function isCriminal(player: PlayerState, now = Date.now()): boolean {
  return (player.criminalUntil ?? 0) > now;
}

/** Attacking an innocent player marks the aggressor as criminal and dents faction rep. */
function markCriminalIfInnocent(attacker: ActivePlayer, defender: PlayerState, now: number): void {
  if (!isCriminal(defender, now)) {
    attacker.criminalUntil = now + PVP_CRIMINAL_DURATION_MS;
    try {
      const wm = getWorldMap();
      const kingdom = wm.getKingdomAt(attacker.x, attacker.y) ?? wm.world.kingdoms[0]?.name;
      if (kingdom) {
        const next = addReputation(attacker.id, kingdom, -5);
        if (!attacker.reputation) attacker.reputation = {};
        attacker.reputation[kingdom] = next;
      }
    } catch {}
  }
}

// ---- Player vs Player ----

export function tryAttack(attackerId: string, defenderId: string): DamageEvent | null {
  const now = Date.now();
  if (now - AttackCooldowns.get(attackerId) < ATTACK_COOLDOWN_MS) return null;

  const attacker = Players.get(attackerId);
  if (!attacker || Players.isDead(attackerId)) return null;

  cleanBuffs(attacker);

  // PvP
  const defender = Players.get(defenderId);
  if (defender) {
    if (Players.isDead(defenderId)) return null;
    if (attacker.mapId !== defender.mapId) return null;
    const dist = Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
    if (dist > ATTACK_RANGE) return null;
    const map = MAPS[defender.mapId];
    if (map?.zone === MapZone.City) return null;

    if (hasDodge(defender) || hasInvuln(defender)) {
      AttackCooldowns.set(attackerId, now);
      markCriminalIfInnocent(attacker, defender, now);
      return { attackerId, defenderId, damage: 0, isCrit: false, timestamp: now };
    }

    AttackCooldowns.set(attackerId, now);
    markCriminalIfInnocent(attacker, defender, now);
    let damage = getAttackDamage(attacker);
    const defense = getArmorDefense(defender);
    damage = Math.max(1, damage - defense);
    damage = absorbShieldDamage(defender, damage);
    const crit = isCritical(attacker);
    if (crit) damage = Math.floor(damage * CRIT_MULTIPLIER);
    defender.stats.hp -= damage;

    if (defender.stats.hp <= 0) {
      defender.stats.hp = 0;
      Players.markDead(defenderId);
      const goldDrop = Math.floor(defender.gold * GOLD_LOSS_ON_DEATH_PCT);
      defender.gold -= goldDrop;
      attacker.gold += goldDrop; // the victor loots the fallen
      // Drop one random inventory item to the ground (AO-style)
      if (defender.inventory.length > 0) {
        const idx = Math.floor(Math.random() * defender.inventory.length);
        const item = defender.inventory[idx];
        const dropQty = Math.min(item.quantity, Math.max(1, Math.ceil(item.quantity * 0.5)));
        Ground.set({
          id: uuidv4(),
          itemId: item.itemId,
          quantity: dropQty,
          x: defender.x,
          y: defender.y,
          mapId: defender.mapId,
        });
        item.quantity -= dropQty;
        if (item.quantity <= 0) defender.inventory = defender.inventory.filter(i => i.slot !== item.slot);
      }
    }

    return { attackerId, defenderId, damage, isCrit: crit, timestamp: now };
  }

  // PvE
  const monster = Monsters.get(defenderId);
  if (monster) {
    return attackMonster(attackerId, defenderId);
  }

  return null;
}

// ---- Player vs Monster ----

export function attackMonster(playerId: string, monsterId: string): DamageEvent | null {
  const player = Players.get(playerId);
  const monster = Monsters.get(monsterId);
  if (!player || !monster) return null;
  if (player.mapId !== monster.mapId) return null;
  if (Players.isDead(playerId)) return null;

  const dist = Math.abs(player.x - monster.x) + Math.abs(player.y - monster.y);
  if (dist > ATTACK_RANGE) return null;

  const now = Date.now();
  if (now - AttackCooldowns.get(playerId) < ATTACK_COOLDOWN_MS) return null;
  AttackCooldowns.set(playerId, now);

  let damage = getAttackDamage(player);
  const crit = isCritical(player);
  if (crit) damage = Math.floor(damage * CRIT_MULTIPLIER);

  monster.hp -= damage;
  if (monster.aiState !== "attack" && monster.aiState !== "chase") {
    monster.targetId = playerId;
    monster.aiState = "chase";
  }

  const event: DamageEvent = { attackerId: playerId, defenderId: monsterId, damage, isCrit: crit, timestamp: now };

  if (monster.hp <= 0) {
    const rewards = killMonster(player, monster, now);
    event.xpGained = rewards.xpGained;
    event.levelUp = rewards.levelUp;
  }

  return event;
}

/**
 * Centralized monster death: grants XP to the killer (shared with nearby
 * party members), drops loot on the ground and resets the monster state for
 * respawn. All kill paths (melee, single-target skills, AoE) must go through here.
 */
export function killMonster(killer: ActivePlayer, monster: Monster, now = Date.now()): { xpGained: number; levelUp: boolean } {
  // Party-shared XP (solo kills behave exactly as before)
  const { distributions } = sharedXpOnKill(killer.id, monster.xpReward, grantXp, monster);
  const xpGained = monster.xpReward;
  const levelUp = distributions.some(d => d.leveledUp);
  // Reputation for all members who shared the kill + quest progress
  for (const d of distributions) {
    try {
      const p = Players.get(d.playerId);
      if (p) gainReputationForKill(d.playerId, monster.mapId, p.x, p.y);
      onMonsterKill(d.playerId, monster.name);
    } catch {}
  }

  // Drop loot — one random item from the loot table
  if (monster.loot.length > 0) {
    const lootId = monster.loot[Math.floor(Math.random() * monster.loot.length)];
    Ground.set({
      id: uuidv4(), itemId: lootId, quantity: 1,
      x: monster.x, y: monster.y, mapId: monster.mapId,
    });
  }

  monster.lastDeath = now;
  monster.hp = 0;
  monster.targetId = null;
  monster.aiState = "idle";

  return { xpGained, levelUp };
}

// ---- Monster vs Player ----

export function monsterAttackPlayer(monsterId: string): { playerId: string; damage: number } | null {
  const monster = Monsters.get(monsterId);
  if (!monster || monster.hp <= 0) return null;

  let nearest: PlayerState | null = null;
  let nearestDist = Infinity;

  for (const player of Players.all()) {
    if (player.mapId !== monster.mapId || Players.isDead(player.id)) continue;
    const dist = Math.abs(player.x - monster.x) + Math.abs(player.y - monster.y);
    if (dist < nearestDist && dist <= monster.attackRange) {
      nearest = player;
      nearestDist = dist;
    }
  }

  if (!nearest) return null;

  if (hasDodge(nearest) || hasInvuln(nearest)) {
    return { playerId: nearest.id, damage: 0 };
  }

  const defense = getArmorDefense(nearest);
  let damage = Math.max(1, monster.damage - defense);
  damage = absorbShieldDamage(nearest, damage);
  nearest.stats.hp -= damage;

  if (nearest.stats.hp <= 0) {
    nearest.stats.hp = 0;
    Players.markDead(nearest.id);
  }

  return { playerId: nearest.id, damage };
}

// ---- Level Up ----

import { xpForLevel, STAT_POINTS_PER_LEVEL, SKILL_UNLOCK_LEVELS, MAX_LEVEL } from "../../shared/constants.js";

export interface LevelUpResult {
  leveledUp: boolean;
  levelsGained: number;
  newLevel: number;
  statPointsGained: number;
  totalStatPoints: number;
  newUnlocks: string[]; // skill slot keys unlocked
}

export function grantXp(player: ActivePlayer, xp: number): LevelUpResult {
  player.experience += xp;
  let levelsGained = 0;
  let statPointsGained = 0;
  const newUnlocks: string[] = [];
  const startLevel = player.level;

  while (player.level < MAX_LEVEL && player.experience >= xpForLevel(player.level)) {
    player.experience -= xpForLevel(player.level);
    player.level++;
    player.stats.maxHp += 8 + Math.floor(player.stats.constitution * 0.5);
    player.stats.maxMp += 4 + Math.floor(player.stats.intelligence * 0.3);
    player.stats.hp = player.stats.maxHp; // Full heal on level up
    player.stats.mp = player.stats.maxMp;
    levelsGained++;
    statPointsGained += STAT_POINTS_PER_LEVEL;
    player.statPoints += STAT_POINTS_PER_LEVEL;

    // Check for new skill unlocks
    const unlocks = SKILL_UNLOCK_LEVELS[player.level];
    if (unlocks) {
      for (const slot of unlocks) {
        if (!player.skillUnlocks.includes(slot)) {
          player.skillUnlocks.push(slot);
          newUnlocks.push(slot);
        }
      }
    }
  }

  return {
    leveledUp: levelsGained > 0,
    levelsGained,
    newLevel: player.level,
    statPointsGained,
    totalStatPoints: player.statPoints,
    newUnlocks,
  };
}
