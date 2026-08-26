// ============================================================
// Gathering — Harvest materials from resource tiles (server authority)
// ============================================================

import { WT } from "../../shared/world-gen.js";
import { MAPS } from "../../shared/maps.js";
import { GATHER_COOLDOWN_MS, MAX_INVENTORY_SLOTS } from "../../shared/constants.js";
import { Players } from "./state.js";
import { getWorldMap } from "./world.js";

export { GATHER_COOLDOWN_MS };

// ---- Depletion (finito con respawn) ----
const depleted = new Map<string, number>(); // key -> expiresAt

const RESPAWN_MS: Record<number, number> = {
  [WT.ironDeposit]: 8 * 60 * 1000,
  [WT.goldDeposit]: 12 * 60 * 1000,
  [WT.forest]: 5 * 60 * 1000,
  [WT.denseForest]: 5 * 60 * 1000,
  [WT.taiga]: 5 * 60 * 1000,
  [WT.jungle]: 5 * 60 * 1000,
  [WT.swamp]: 5 * 60 * 1000,
};

const TOOL_REQUIRED: Record<number, string[]> = {
  [WT.ironDeposit]: ["iron_pickaxe"],
  [WT.goldDeposit]: ["iron_pickaxe"],
  [WT.forest]: ["wood_axe", "iron_pickaxe"],
  [WT.denseForest]: ["wood_axe", "iron_pickaxe"],
  [WT.taiga]: ["wood_axe", "iron_pickaxe"],
  [WT.jungle]: ["wood_axe", "iron_pickaxe"],
  [WT.swamp]: ["wood_axe", "iron_pickaxe"],
};

function hasTool(player: ReturnType<typeof Players.get>, required: string[]): boolean {
  if (!player) return false;
  // equipped weapon counts, plus inventory
  const equipped = Object.values(player.equipment).filter(Boolean) as string[];
  const invIds = player.inventory.map(i => i.itemId);
  const owned = new Set([...equipped, ...invIds]);
  return required.some(id => owned.has(id));
}

function isDepleted(mapId: string, x: number, y: number): boolean {
  const key = `${mapId}:${x}:${y}`;
  const exp = depleted.get(key);
  if (exp === undefined) return false;
  if (Date.now() > exp) { depleted.delete(key); return false; }
  return true;
}

function deplete(mapId: string, x: number, y: number, tile: number) {
  const ttl = RESPAWN_MS[tile] ?? 5 * 60 * 1000;
  depleted.set(`${mapId}:${x}:${y}`, Date.now() + ttl);
}

const lastGather = new Map<string, number>();

// What each tile yields: [itemId, chance of bonus second unit]
const YIELDS: Record<number, { itemId: string; bonusChance?: number }> = {
  [WT.ironDeposit]: { itemId: "iron_ore", bonusChance: 0.25 },
  [WT.goldDeposit]: { itemId: "gold_nugget", bonusChance: 0.15 },
  [WT.forest]: { itemId: "wood", bonusChance: 0.3 },
  [WT.denseForest]: { itemId: "wood", bonusChance: 0.5 },
  [WT.taiga]: { itemId: "wood", bonusChance: 0.3 },
  [WT.jungle]: { itemId: "wood", bonusChance: 0.4 },
  [WT.swamp]: { itemId: "wood", bonusChance: 0.25 },
};

/** Check the tile the player stands on and the 4 adjacent tiles — skip depleted */
function findResourceTile(mapId: string, x: number, y: number): { tile: number; x: number; y: number } | null {
  const candidates: [number, number][] = [[x, y], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];

  // Procedural world
  if (mapId === "world") {
    try {
      const wm = getWorldMap();
      for (const [cx, cy] of candidates) {
        if (isDepleted(mapId, cx, cy)) continue;
        const t = wm.getTile(cx, cy);
        if (YIELDS[t]) return { tile: t, x: cx, y: cy };
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

  const found = findResourceTile(player.mapId, player.x, player.y);
  if (found === null) {
    // Check if nearby resource is depleted (for better UX)
    const candidates: [number, number][] = [[player.x, player.y], [player.x + 1, player.y], [player.x - 1, player.y], [player.x, player.y + 1], [player.x, player.y - 1]];
    if (player.mapId === "world") {
      try {
        const wm = getWorldMap();
        for (const [cx, cy] of candidates) {
          if (isDepleted(player.mapId, cx, cy)) {
            const t = wm.getTile(cx, cy);
            if (YIELDS[t]) return { ok: false, message: "Este filón está agotado, vuelve en unos minutos.", quantity: 0 };
          }
        }
      } catch {}
    }
    return { ok: false, message: "No hay nada que recolectar aquí.", quantity: 0 };
  }
  // Herramienta requerida
  const required = TOOL_REQUIRED[found.tile];
  if (required && !hasTool(player, required)) {
    const need = required.includes("iron_pickaxe") && required.includes("wood_axe") ? "un hacha o pico" : required[0] === "iron_pickaxe" ? "un pico de hierro" : "un hacha";
    return { ok: false, message: `Necesitas ${need} para recolectar aquí.`, quantity: 0 };
  }
  const tile = found.tile;
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

  // Marcar agotamiento
  deplete(player.mapId, found.x, found.y, tile);

  const names: Record<string, string> = { iron_ore: "Mineral de Hierro", gold_nugget: "Nugget de Oro", wood: "Madera" };
  return {
    ok: true,
    message: `Recolectaste ${quantity}× ${names[yield_.itemId] ?? yield_.itemId}.`,
    itemId: yield_.itemId,
    quantity,
  };
}
