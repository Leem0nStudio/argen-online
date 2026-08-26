// ============================================================
// Reputation — Faction standing per kingdom (AO-inspired)
// ============================================================

import { Players } from "./state.js";
import { getWorldMap } from "./world.js";
import { addReputation as dbAddRep } from "../db/database.js";

export function gainReputationForKill(killerId: string, monsterMapId: string, killerWx?: number, killerWy?: number): string | null {
  const killer = Players.get(killerId);
  if (!killer) return null;
  let kingdom: string | null = null;
  try {
    const wm = getWorldMap();
    // Prefer killer position if provided, else use mapId heuristics (settlement/dungeon → its kingdom)
    if (killerWx !== undefined && killerWy !== undefined) {
      kingdom = wm.getKingdomAt(killerWx, killerWy);
    } else if (monsterMapId !== "world") {
      const map = wm.getMap(monsterMapId);
      // settlement/dungeon maps carry their settlement's kingdom implicitly via name match; fallback to first kingdom
      kingdom = wm.world.kingdoms[0]?.name ?? null;
      void map;
    } else {
      kingdom = wm.getKingdomAt(killer.x, killer.y);
    }
  } catch { return null; }
  if (!kingdom) return null;

  const amount = 1 + Math.floor(Math.random() * 2); // 1-2
  const next = dbAddRep(killerId, kingdom, amount);
  // Sync to in-memory player for immediate broadcast
  if (!killer.reputation) killer.reputation = {};
  killer.reputation[kingdom] = next;
  return kingdom;
}
