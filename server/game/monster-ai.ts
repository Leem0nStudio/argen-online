// ============================================================
// Monster AI — State machine (idle, patrol, chase, attack, flee, return)
// ============================================================

import { v4 as uuidv4 } from "uuid";
import type { MonsterData, MonsterAIState } from "../../shared/types.js";
import { MapZone } from "../../shared/types.js";
import { MAPS } from "../../shared/maps.js";
import {
  MONSTER_DEFS, MONSTERS_PER_WILDERNESS, MONSTERS_PER_DUNGEON,
  MONSTER_SPAWN_MARGIN, MONSTER_FLEE_HP_PCT, MONSTER_FLEE_DISENGAGE_PCT,
} from "../../shared/constants.js";
import { Players, Monsters, type Monster } from "./state.js";
import { canMoveTo } from "./movement.js";
import { monsterAttackPlayer } from "./combat.js";

function findNearestPlayer(monster: Monster) {
  let nearest = null;
  let nearestDist = Infinity;
  for (const player of Players.all()) {
    if (player.mapId !== monster.mapId || Players.isDead(player.id)) continue;
    const dist = Math.abs(player.x - monster.x) + Math.abs(player.y - monster.y);
    if (dist <= monster.aggroRange && dist < nearestDist) {
      nearest = player;
      nearestDist = dist;
    }
  }
  return nearest;
}

export function spawnMonstersForMap(mapId: string) {
  // Settlement maps are safe zones — no monsters
  if (mapId.startsWith("settlement_")) return;

  // Procedural world: spawn around player positions
  if (mapId === "world") {
    spawnWorldMonsters();
    return;
  }

  // Legacy handcrafted maps
  const map = MAPS[mapId];
  if (!map || map.zone === MapZone.City) return;

  const count = map.zone === MapZone.Dungeon ? MONSTERS_PER_DUNGEON : MONSTERS_PER_WILDERNESS;
  for (let i = 0; i < count; i++) {
    const def = MONSTER_DEFS[Math.floor(Math.random() * MONSTER_DEFS.length)];
    const x = MONSTER_SPAWN_MARGIN + Math.floor(Math.random() * (map.width - MONSTER_SPAWN_MARGIN * 2));
    const y = MONSTER_SPAWN_MARGIN + Math.floor(Math.random() * (map.height - MONSTER_SPAWN_MARGIN * 2));

    if (canMoveTo(mapId, x, y)) {
      const id = `monster_${uuidv4().slice(0, 8)}`;
      Monsters.set({
        id, name: def.name, hp: def.hp, maxHp: def.hp,
        damage: def.damage, x, y, mapId,
        xpReward: def.xp, loot: [...def.loot],
        respawnTime: def.respawn, lastDeath: 0,
        aiState: "idle", spawnX: x, spawnY: y,
        targetId: null, lastAiTick: Date.now(),
        idleEnd: Date.now() + 1000 + Math.random() * 3000,
        patrolTargetX: x, patrolTargetY: y,
        aggroRange: def.aggroRange, attackRange: def.attackRange,
        chaseSpeed: def.chaseSpeed, patrolSpeed: def.patrolSpeed,
        lastAutoAttack: 0,
      });
    }
  }
}

/** Spawn monsters in the procedural world around players */
function spawnWorldMonsters() {
  // Find players on the world map and spawn monsters near them
  const worldPlayers = Array.from(Players.all()).filter(p => p.mapId === "world" && !Players.isDead(p.id));
  const existingWorldMonsters = Monsters.onMap("world").filter(m => m.hp > 0);

  for (const player of worldPlayers) {
    const nearbyMonsters = existingWorldMonsters.filter(m => {
      const dist = Math.abs(m.x - player.x) + Math.abs(m.y - player.y);
      return dist < 30;
    });

    if (nearbyMonsters.length >= 6) continue; // Already enough monsters nearby

    const spawnCount = Math.max(0, 6 - nearbyMonsters.length);
    for (let i = 0; i < spawnCount; i++) {
      // Spawn at random position within 15 tiles of player
      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 12;
      const sx = Math.round(player.x + Math.cos(angle) * dist);
      const sy = Math.round(player.y + Math.sin(angle) * dist);

      if (canMoveTo("world", sx, sy)) {
        const def = MONSTER_DEFS[Math.floor(Math.random() * MONSTER_DEFS.length)];
        const id = `monster_${uuidv4().slice(0, 8)}`;
        Monsters.set({
          id, name: def.name, hp: def.hp, maxHp: def.hp,
          damage: def.damage, x: sx, y: sy, mapId: "world",
          xpReward: def.xp, loot: [...def.loot],
          respawnTime: def.respawn, lastDeath: 0,
          aiState: "idle", spawnX: sx, spawnY: sy,
          targetId: null, lastAiTick: Date.now(),
          idleEnd: Date.now() + 1000 + Math.random() * 3000,
          patrolTargetX: sx, patrolTargetY: sy,
          aggroRange: def.aggroRange, attackRange: def.attackRange,
          chaseSpeed: def.chaseSpeed, patrolSpeed: def.patrolSpeed,
          lastAutoAttack: 0,
        });
      }
    }
  }
}

export function respawnMonsters() {
  const now = Date.now();
  for (const [, monster] of Monsters.all()) {
    if (monster.hp <= 0 && now - monster.lastDeath > monster.respawnTime) {
      monster.hp = monster.maxHp;
      const map = MAPS[monster.mapId];
      if (map) {
        // Legacy map: random position within map bounds
        monster.x = MONSTER_SPAWN_MARGIN + Math.floor(Math.random() * (map.width - MONSTER_SPAWN_MARGIN * 2));
        monster.y = MONSTER_SPAWN_MARGIN + Math.floor(Math.random() * (map.height - MONSTER_SPAWN_MARGIN * 2));
      } else if (monster.mapId === "world") {
        // Procedural world: respawn near original spawn point
        monster.x = monster.spawnX + Math.floor(Math.random() * 10) - 5;
        monster.y = monster.spawnY + Math.floor(Math.random() * 10) - 5;
      }
      monster.spawnX = monster.x;
      monster.spawnY = monster.y;
      monster.aiState = "idle";
      monster.idleEnd = now + 1000 + Math.random() * 3000;
      monster.targetId = null;
    }
  }
}

export function getMonstersAsData(mapId: string): MonsterData[] {
  return Monsters.onMap(mapId).map(m => ({
    id: m.id, name: m.name, hp: m.hp, maxHp: m.maxHp,
    x: m.x, y: m.y, mapId: m.mapId,
    aiState: m.aiState, targetId: m.targetId ?? undefined,
  }));
}

export function tickMonsterAI(): { events: { type: string; data: any }[] } {
  const events: { type: string; data: any }[] = [];
  const now = Date.now();

  for (const [id, monster] of Monsters.all()) {
    if (monster.hp <= 0) continue;

    const timeSinceLastTick = now - monster.lastAiTick;
    monster.lastAiTick = now;

    switch (monster.aiState) {
      case "idle": {
        if (now < monster.idleEnd) break;
        const target = findNearestPlayer(monster);
        if (target) {
          monster.targetId = target.id;
          monster.aiState = "chase";
          break;
        }
        const range = 5;
        const map = MAPS[monster.mapId];
        const maxX = map ? map.width - 2 : monster.spawnX + 20;
        const maxY = map ? map.height - 2 : monster.spawnY + 20;
        const minX = map ? 1 : monster.spawnX - 20;
        const minY = map ? 1 : monster.spawnY - 20;
        monster.patrolTargetX = Math.max(minX, Math.min(maxX,
          monster.spawnX + Math.floor(Math.random() * range * 2) - range));
        monster.patrolTargetY = Math.max(minY, Math.min(maxY,
          monster.spawnY + Math.floor(Math.random() * range * 2) - range));
        monster.aiState = "patrol";
        break;
      }

      case "patrol": {
        const target = findNearestPlayer(monster);
        if (target) {
          monster.targetId = target.id;
          monster.aiState = "chase";
          break;
        }
        if (timeSinceLastTick < monster.patrolSpeed) break;
        const dx = Math.sign(monster.patrolTargetX - monster.x);
        const dy = Math.sign(monster.patrolTargetY - monster.y);
        const newX = monster.x + dx;
        const newY = monster.y + dy;
        if (canMoveTo(monster.mapId, newX, newY) && (dx !== 0 || dy !== 0)) {
          monster.x = newX;
          monster.y = newY;
        } else if (dx !== 0 || dy !== 0) {
          monster.aiState = "idle";
          monster.idleEnd = now + 1000 + Math.random() * 2000;
        }
        if (monster.x === monster.patrolTargetX && monster.y === monster.patrolTargetY) {
          monster.aiState = "idle";
          monster.idleEnd = now + 1000 + Math.random() * 3000;
        }
        break;
      }

      case "chase": {
        const targetPlayer = Players.get(monster.targetId ?? "");
        if (!targetPlayer || Players.isDead(monster.targetId!) || targetPlayer.mapId !== monster.mapId) {
          monster.targetId = null;
          monster.aiState = "return";
          break;
        }
        const dist = Math.abs(targetPlayer.x - monster.x) + Math.abs(targetPlayer.y - monster.y);
        if (dist <= monster.attackRange) {
          monster.aiState = "attack";
          break;
        }
        if (dist > monster.aggroRange + 3) {
          monster.targetId = null;
          monster.aiState = "return";
          break;
        }
        if (timeSinceLastTick < monster.chaseSpeed) break;
        const chaseDx = Math.sign(targetPlayer.x - monster.x);
        const chaseDy = Math.sign(targetPlayer.y - monster.y);
        const preferX = Math.abs(targetPlayer.x - monster.x) >= Math.abs(targetPlayer.y - monster.y);
        const chaseNewX = preferX ? monster.x + chaseDx : monster.x;
        const chaseNewY = !preferX ? monster.y + chaseDy : monster.y;
        if (canMoveTo(monster.mapId, chaseNewX, chaseNewY)) {
          monster.x = chaseNewX;
          monster.y = chaseNewY;
        } else {
          const altX = chaseNewX !== monster.x ? monster.x : monster.x + chaseDx;
          const altY = chaseNewY !== monster.y ? monster.y : monster.y + chaseDy;
          if (canMoveTo(monster.mapId, altX, altY)) {
            monster.x = altX;
            monster.y = altY;
          }
        }
        break;
      }

      case "attack": {
        const attackTarget = Players.get(monster.targetId ?? "");
        if (!attackTarget || Players.isDead(monster.targetId!) || attackTarget.mapId !== monster.mapId) {
          monster.targetId = null;
          monster.aiState = "return";
          break;
        }
        const attackDist = Math.abs(attackTarget.x - monster.x) + Math.abs(attackTarget.y - monster.y);
        if (attackDist > monster.attackRange) {
          monster.aiState = "chase";
          break;
        }
        if (now - monster.lastAutoAttack >= 1200) {
          monster.lastAutoAttack = now;
          const result = monsterAttackPlayer(id);
          if (result) {
            events.push({ type: "monster_attack", data: { monsterId: id, ...result } });
          }
        }
        break;
      }

      case "return": {
        const returnDist = Math.abs(monster.spawnX - monster.x) + Math.abs(monster.spawnY - monster.y);
        if (returnDist <= 1) {
          monster.x = monster.spawnX;
          monster.y = monster.spawnY;
          monster.aiState = "idle";
          monster.idleEnd = now + 1000 + Math.random() * 2000;
          break;
        }
        if (timeSinceLastTick < monster.patrolSpeed) break;
        const retDx = Math.sign(monster.spawnX - monster.x);
        const retDy = Math.sign(monster.spawnY - monster.y);
        const retNewX = monster.x + retDx;
        const retNewY = monster.y + retDy;
        if (canMoveTo(monster.mapId, retNewX, retNewY)) {
          monster.x = retNewX;
          monster.y = retNewY;
        }
        break;
      }

      case "flee": {
        monster.aiState = "return";
        break;
      }
    }

    // Low HP flee logic
    if (monster.hp > 0 && monster.hp < monster.maxHp * MONSTER_FLEE_HP_PCT &&
        monster.aiState !== "flee" && monster.aiState !== "return") {
      const fleeTarget = findNearestPlayer(monster);
      if (fleeTarget) {
        monster.targetId = fleeTarget.id;
        monster.aiState = "flee";
      }
    }

    if (monster.aiState === "flee" && timeSinceLastTick >= monster.chaseSpeed) {
      const fleeFrom = findNearestPlayer(monster);
      if (fleeFrom) {
        const fDx = Math.sign(monster.x - fleeFrom.x);
        const fDy = Math.sign(monster.y - fleeFrom.y);
        const fNewX = monster.x + (fDx || (Math.random() > 0.5 ? 1 : -1));
        const fNewY = monster.y + (fDy || (Math.random() > 0.5 ? 1 : -1));
        if (canMoveTo(monster.mapId, fNewX, fNewY)) {
          monster.x = fNewX;
          monster.y = fNewY;
        }
        const fleeDist = Math.abs(fleeFrom.x - monster.x) + Math.abs(fleeFrom.y - monster.y);
        if (fleeDist > monster.aggroRange * MONSTER_FLEE_DISENGAGE_PCT) {
          monster.aiState = "return";
          monster.targetId = null;
        }
      } else {
        monster.aiState = "return";
        monster.targetId = null;
      }
    }
  }

  return { events };
}
