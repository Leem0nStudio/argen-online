// ============================================================
// NPC System — Dialogue, shops, buy/sell
// ============================================================

import type { NPCData } from "../../shared/types.js";
import { MAPS } from "../../shared/maps.js";
import { ITEMS } from "../../shared/items.js";
import { MAX_INVENTORY_SLOTS } from "../../shared/constants.js";
import { Players } from "./state.js";

export function getNPC(mapId: string, npcId: string): NPCData | undefined {
  const map = MAPS[mapId];
  if (!map) return undefined;
  return map.npcs.find(n => n.id === npcId);
}

export function npcBuyItem(playerId: string, itemId: string, quantity: number): boolean {
  const player = Players.get(playerId);
  if (!player) return false;

  const itemDef = ITEMS[itemId];
  if (!itemDef) return false;

  const totalCost = itemDef.buyPrice * quantity;
  if (player.gold < totalCost) return false;

  const existing = player.inventory.find(i => i.itemId === itemId && itemDef.stackable);

  if (!existing) {
    const usedSlots = new Set(player.inventory.map(i => i.slot));
    let newSlot = -1;
    for (let s = 0; s < MAX_INVENTORY_SLOTS; s++) {
      if (!usedSlots.has(s)) { newSlot = s; break; }
    }
    if (newSlot === -1) return false;
    player.inventory.push({ itemId, quantity, slot: newSlot });
  } else {
    existing.quantity += quantity;
  }

  player.gold -= totalCost;
  return true;
}

export function npcSellItem(playerId: string, inventorySlot: number, quantity: number): boolean {
  const player = Players.get(playerId);
  if (!player) return false;

  const invItem = player.inventory.find(i => i.slot === inventorySlot);
  if (!invItem || invItem.quantity < quantity) return false;

  const itemDef = ITEMS[invItem.itemId];
  if (!itemDef) return false;

  const sellPrice = itemDef.sellPrice * quantity;
  player.gold += sellPrice;

  invItem.quantity -= quantity;
  if (invItem.quantity <= 0) {
    player.inventory = player.inventory.filter(i => i.slot !== inventorySlot);
  }
  return true;
}
