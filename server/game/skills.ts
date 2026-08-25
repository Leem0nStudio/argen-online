// ============================================================
// Skill System — Skill execution, buff application
// ============================================================

import type { SkillEvent } from "../../shared/types.js";
import { SKILLS, MapZone } from "../../shared/types.js";
import { MAPS } from "../../shared/maps.js";
import { Players, Monsters, type ActivePlayer } from "./state.js";
import { getEffectiveStrength, getArmorDefense, cleanBuffs, hasInvuln, grantXp, killMonster } from "./combat.js";

function getTargetX(targetId: string): number {
  const m = Monsters.get(targetId);
  if (m) return m.x;
  const p = Players.get(targetId);
  if (p) return p.x;
  return 0;
}

function getTargetY(targetId: string): number {
  const m = Monsters.get(targetId);
  if (m) return m.y;
  const p = Players.get(targetId);
  if (p) return p.y;
  return 0;
}

export function useSkill(playerId: string, skillId: string, targetId?: string): SkillEvent | null {
  const player = Players.get(playerId);
  if (!player || Players.isDead(playerId)) return null;

  cleanBuffs(player);

  const classSkills = SKILLS[player.characterClass];
  if (!classSkills) return null;
  const skill = classSkills.find(s => s.id === skillId);
  if (!skill) return null;

  const now = Date.now();
  const cdEnd = (player.cooldowns ?? {})[skillId] ?? 0;
  if (now < cdEnd) return null;
  if (player.stats.mp < skill.manaCost) return null;

  // Range check for single-target
  if (skill.target === "single" && targetId) {
    const dist = Math.abs(player.x - getTargetX(targetId)) +
                 Math.abs(player.y - getTargetY(targetId));
    if (dist > skill.range) return null;
  }

  // Consume mana and set cooldown
  player.stats.mp -= skill.manaCost;
  if (!player.cooldowns) player.cooldowns = {};
  player.cooldowns[skillId] = now + skill.cooldownMs;

  const event: SkillEvent = { casterId: playerId, skillId };

  // ---- Self buffs / heals ----
  if (skill.target === "self" || skill.target === "none") {
    if (skill.buffType === "heal_pct") {
      const heal = Math.floor(player.stats.maxHp * skill.buffValue! / 100);
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
      event.heal = heal;
    } else if (skill.healAmount > 0) {
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + skill.healAmount);
      event.heal = skill.healAmount;
    } else if (skill.buffType && skill.buffDurationMs) {
      if (!player.buffs) player.buffs = [];
      player.buffs.push({
        type: skill.buffType,
        value: skill.buffValue ?? 0,
        expiresAt: now + skill.buffDurationMs,
        shieldHp: skill.buffType === "shield_absorb" ? skill.buffValue : undefined,
      });
      event.buffApplied = skill.buffType;
    }
    return event;
  }

  // ---- AoE damage ----
  if (skill.target === "aoe") {
    event.aoe = true;
    event.aoeRadius = skill.aoeRadius;
    event.damage = skill.damage;
    for (const [, monster] of Monsters.all()) {
      if (monster.mapId !== player.mapId || monster.hp <= 0) continue;
      const dist = Math.abs(player.x - monster.x) + Math.abs(player.y - monster.y);
      if (dist <= skill.aoeRadius) {
        const totalDmg = skill.damage + Math.floor(getEffectiveStrength(player) * 0.5);
        monster.hp -= totalDmg;
        if (monster.hp <= 0) {
          killMonster(player, monster, now);
        }
      }
    }
    return event;
  }

  // ---- Single target damage ----
  if (skill.target === "single" && targetId) {
    event.targetId = targetId;
    event.damage = skill.damage;

    const dmgMonster = Monsters.get(targetId);
    if (dmgMonster && dmgMonster.mapId === player.mapId && dmgMonster.hp > 0) {
      const totalDmg = skill.damage + Math.floor(getEffectiveStrength(player) * 0.3);
      dmgMonster.hp -= totalDmg;
      if (dmgMonster.hp <= 0) {
        killMonster(player, dmgMonster, now);
      }
    }

    const dmgPlayer = Players.get(targetId);
    if (dmgPlayer && dmgPlayer.mapId === player.mapId && !Players.isDead(targetId)) {
      const map = MAPS[dmgPlayer.mapId];
      if (map?.zone !== MapZone.City) {
        let totalDmg = skill.damage + Math.floor(getEffectiveStrength(player) * 0.3);
        totalDmg = Math.max(1, totalDmg - getArmorDefense(dmgPlayer));
        if (!hasInvuln(dmgPlayer)) {
          dmgPlayer.stats.hp -= totalDmg;
          event.damage = totalDmg;
          if (dmgPlayer.stats.hp <= 0) {
            dmgPlayer.stats.hp = 0;
            Players.markDead(targetId);
          }
        } else {
          event.damage = 0;
        }
      }
    }

    // Self heal from smite
    if (skill.buffType === "self_heal_pct" && skill.buffValue) {
      const heal = Math.floor(player.stats.maxHp * skill.buffValue / 100);
      player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + heal);
      event.heal = heal;
    }

    // Poison
    if (skill.buffType === "poison" && targetId) {
      const target = Players.get(targetId) ?? Monsters.get(targetId);
      if (target) {
        if (!target.buffs) target.buffs = [];
        target.buffs.push({ type: "poison", value: skill.buffValue ?? 5, expiresAt: now + (skill.buffDurationMs ?? 5000) });
      }
    }

    return event;
  }

  return event;
}
