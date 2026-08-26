// ============================================================
// Quest — Player quest progress (in-memory, AO-inspired)
// ============================================================

import { Players } from "./state.js";
import { QUESTS, type QuestDef } from "../../shared/quests.js";
import { getWorldMap } from "./world.js";
import { grantXp } from "./combat.js";
import { addReputation } from "../db/database.js";

interface PlayerQuest {
  questId: string;
  progress: number;
  completed: boolean;
}

const activeQuests = new Map<string, PlayerQuest>(); // playerId -> quest

export function getQuestDef(questId: string): QuestDef | undefined {
  return QUESTS.find(q => q.id === questId);
}

export function getActiveQuest(playerId: string): (PlayerQuest & { def: QuestDef }) | null {
  const pq = activeQuests.get(playerId);
  if (!pq) return null;
  const def = getQuestDef(pq.questId);
  if (!def) return null;
  return { ...pq, def };
}

export function acceptQuest(playerId: string, questId: string): { ok: boolean; message: string } {
  if (activeQuests.has(playerId)) return { ok: false, message: "Ya tienes una misión activa. Usa /quest abandonar" };
  const def = getQuestDef(questId);
  if (!def) return { ok: false, message: "Misión desconocida" };
  activeQuests.set(playerId, { questId, progress: 0, completed: false });
  return { ok: true, message: `Aceptaste: ${def.name} — ${def.description}` };
}

export function abandonQuest(playerId: string): { ok: boolean; message: string } {
  if (!activeQuests.has(playerId)) return { ok: false, message: "No tienes misión activa" };
  activeQuests.delete(playerId);
  return { ok: true, message: "Misión abandonada" };
}

export function onMonsterKill(playerId: string, monsterName: string): { completedNow?: QuestDef } | null {
  const pq = activeQuests.get(playerId);
  if (!pq || pq.completed) return null;
  const def = getQuestDef(pq.questId);
  if (!def || def.targetMonster !== monsterName) return null;
  pq.progress += 1;
  if (pq.progress >= def.required) {
    pq.completed = true;
    return { completedNow: def };
  }
  return {};
}

export function claimReward(playerId: string): { ok: boolean; message: string } {
  const pq = activeQuests.get(playerId);
  if (!pq) return { ok: false, message: "Sin misión activa" };
  if (!pq.completed) {
    const def = getQuestDef(pq.questId)!;
    return { ok: false, message: `Progreso ${pq.progress}/${def.required}` };
  }
  const def = getQuestDef(pq.questId)!;
  const player = Players.get(playerId);
  if (!player) return { ok: false, message: "Jugador no encontrado" };

  // Rewards
  const leveledUp = grantXp(player as any, def.rewardXp);
  player.gold += def.rewardGold;
  // Reputation with killer's kingdom
  try {
    const wm = getWorldMap();
    const kingdom = wm.getKingdomAt(player.x, player.y) ?? wm.world.kingdoms[0]?.name;
    if (kingdom) {
      const next = addReputation(playerId, kingdom, def.rewardRep);
      if (!player.reputation) player.reputation = {};
      player.reputation[kingdom] = next;
    }
  } catch {}

  activeQuests.delete(playerId);
  return { ok: true, message: `¡Completada ${def.name}! +${def.rewardXp} XP +${def.rewardGold} oro +${def.rewardRep} rep${leveledUp ? " ¡Subiste de nivel!" : ""}` };
}

export function removePlayer(playerId: string): void {
  activeQuests.delete(playerId);
}
