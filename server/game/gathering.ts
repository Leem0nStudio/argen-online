// ============================================================
// Gathering — Harvest materials from resource tiles (server authority)
// ============================================================

import { WT } from "../../shared/world-gen.js";
import { MAPS } from "../../shared/maps.js";
import { GATHER_COOLDOWN_MS, MAX_INVENTORY_SLOTS } from "../../shared/constants.js";
import { Players } from "./state.js";
import { getWorldMap } from "./world.js";

export { GATHER_COOLDOWN_MS };

const lastGather = new Map<string, number>();

// What each tile yields: [itemId, chance of bonus second unit]
const YIELDS: Record<number, { itemId: string; bonusChance?: number }> = {
  [WT.ironDeposit]: { itemId: "iron_ore", bonusChance: 0.25 },
  [WT.goldDeposit]: { itemId: "gold_nugget", bonusChance: 0.15 },
  [WT.forest]: { itemId: "wood", bonusChance: 0.3 },
  [WT.denseForest]: { itemId: "wood", bonusChance: 0.5 },
  [WT.taiga]: { itemId: "wood", bonusChance: 0.3 },
  [WT.jungle]: { itemId: "wood", bonusChance: 0.4 },
};

/** Check the tile the player stands on and the 4 adjacent tiles */
function findResourceTile(mapId: string, x: number, y: number): number | null {
  const candidates: [number, number][] = [[x, y], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];

  // Procedural world
  if (mapId === "world") {
    try {
      const wm = getWorldMap();
      for (const [cx, cy] of candidates) {
        if (YIELDS[wm.getTile(cx, cy)]) return wm.getTile(cx, cy);
      }
    } catch { /* world not ready */ }
    return null;
  }

  // Settlement maps (procedural interiors)
  if (mapId.startsWith("settlement_")) return null; // no resources inside towns

  // Legacy static maps — no resource tiles defined there
  void MAPS;
  return null;
}

export function gather(playerId: string): { ok: boolean; message: string; itemId?: string; quantity: number } {
  const player = Players.get(playerId);
  if (!player) return { ok: false, message: "No estás en el mundo", quantity: 0 };

  const now = Date.now();
  if (now - (lastGather.get(playerId) ?? 0) < GATHER_COOLDOWN_MS) {
    return { ok: false, message: "Aún estás recolectando...", quantity: 0 };
  }
  lastGather.set(playerId, now);

  const tile = findResourceTile(player.mapId, player.x, player.y);
  if (tile === null) {
    return { ok: false, message: "No hay nada que recolectar aquí.", quantity: 0 };
  }

  const yield_ = YIELDS[tile];
  let quantity = 1;
  if (yield_.bonusChance && Math.random() < yield_.bonusChance) quantity = 2;

  // Add to inventory (stack or free slot)
  const existing = player.inventory.find(i => i.itemId === yield_.itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    const usedSlots = new Set(player.inventory.map(i => i.slot));
    let slot = -1;
    for (let s = 0; s < MAX_INVENTORY_SLOTS; s++) { if (!usedSlots.has(s)) { slot = s; break; } }
    if (slot === -1) return { ok: false, message: "Inventario lleno.", quantity: 0 };
    player.inventory.push({ itemId: yield_.itemId, quantity, slot });
  }

  const names: Record<string, string> = { iron_ore: "Mineral de Hierro", gold_nugget: "Nugget de Oro", wood: "Madera" };
  return {
    ok: true,
    message: `Recolectaste ${quantity}× ${names[yield_.itemId] ?? yield_.itemId}.`,
    itemId: yield_.itemId,
    quantity,
  };
}
