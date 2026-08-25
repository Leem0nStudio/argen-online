// ============================================================
// Game Loop — Server tick loop, HP/MP regen, AI, broadcasting
// ============================================================

import type { Server } from "socket.io";
import type { ClientEvents, ServerEvents } from "../../shared/types.js";
import {
  TICK_RATE_MS, AI_TICK_INTERVAL, MONSTER_BROADCAST_INTERVAL,
  REGEN_INTERVAL, RESPAWN_CHECK_INTERVAL, POISON_TICK_INTERVAL,
  ALL_WILDERNESS_MAPS,
} from "../../shared/constants.js";
import { Players } from "../game/state.js";
import { tickMonsterAI, respawnMonsters, getMonstersAsData } from "../game/monster-ai.js";
import { addSystemMessage } from "../game/chat.js";

type GameServer = Server<ClientEvents, ServerEvents>;

export function startGameLoop(io: GameServer) {
  let tick = 0;

  setInterval(() => {
    tick++;

    // ---- HP/MP Regen + Buff cleanup every second ----
    if (tick % REGEN_INTERVAL === 0) {
      const now = Date.now();
      for (const player of Players.all()) {
        if (Players.isDead(player.id)) continue;

        // Clean expired buffs + poison tick
        if (player.buffs) {
          const active = player.buffs.filter(b => b.expiresAt > now);
          const expired = player.buffs.filter(b => b.expiresAt <= now);
          player.buffs = active;

          // Poison damage
          if (tick % (REGEN_INTERVAL * POISON_TICK_INTERVAL / REGEN_INTERVAL) === 0) {
            for (const buff of active) {
              if (buff.type === "poison" && buff.value > 0) {
                player.stats.hp = Math.max(0, player.stats.hp - buff.value);
                if (player.stats.hp <= 0) {
                  player.stats.hp = 0;
                  Players.markDead(player.id);
                }
              }
            }
          }
        }

        // Regen
        if (player.stats.hp < player.stats.maxHp) {
          player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + 1);
        }
        if (player.stats.mp < player.stats.maxMp) {
          player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + 1);
        }
      }
    }

    // ---- Monster AI tick every 200ms ----
    if (tick % AI_TICK_INTERVAL === 0) {
      const { events: aiEvents } = tickMonsterAI();
      for (const evt of aiEvents) {
        if (evt.type === "monster_attack") {
          const { monsterId, playerId, damage } = evt.data;
          const victim = Players.get(playerId);
          if (victim) {
            if (damage > 0) {
              io.emit("combat:damage", {
                attackerId: monsterId, defenderId: playerId,
                damage, isCrit: false, timestamp: Date.now(),
              });
            }
            if (victim.stats.hp <= 0) {
              io.emit("combat:death", { killerId: monsterId, victimId: playerId });
              io.emit("chat:message", addSystemMessage(`Un monstruo ha matado a ${victim.username}!`));
            }
          }
        }
      }
    }

    // ---- Monster respawn every second ----
    if (tick % RESPAWN_CHECK_INTERVAL === 0) {
      respawnMonsters();
    }

    // ---- Broadcast monster positions every 500ms ----
    if (tick % MONSTER_BROADCAST_INTERVAL === 0) {
      for (const mapId of ALL_WILDERNESS_MAPS) {
        const mapMonsters = getMonstersAsData(mapId);
        if (mapMonsters.length > 0) {
          io.emit("monsters:update", mapMonsters);
        }
      }
    }
  }, TICK_RATE_MS);
}
