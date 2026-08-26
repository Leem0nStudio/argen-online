// ============================================================
// Bank — Deposit/withdraw gold and items (server authority)
// ============================================================

import { MAX_INVENTORY_SLOTS } from "../../shared/constants.js";
import { ITEMS as ITEM_DEFS } from "../../shared/items.js";
import { Players } from "./state.js";
import {
  getBankGold, setBankGold, getBankItems, bankDepositItem, bankWithdrawItem,
} from "../db/database.js";

export function depositGold(playerId: string, amount: number): boolean {
  const player = Players.get(playerId);
  if (!player || !Number.isFinite(amount) || amount <= 0) return false;
  if (player.gold < amount) return false;
  player.gold -= amount;
  setBankGold(playerId, getBankGold(playerId) + amount);
  return true;
}

export function withdrawGold(playerId: string, amount: number): boolean {
  const player = Players.get(playerId);
  if (!player || !Number.isFinite(amount) || amount <= 0) return false;
  const stored = getBankGold(playerId);
  if (stored < amount) return false;
  setBankGold(playerId, stored - amount);
  player.gold += amount;
  return true;
}

export function getBankSummary(playerId: string): { gold: number; items: { itemId: string; name: string; quantity: number }[] } {
  const items = getBankItems(playerId).map(i => ({
    itemId: i.itemId,
    name: ITEM_DEFS[i.itemId]?.name ?? i.itemId,
    quantity: i.quantity,
  }));
  return { gold: getBankGold(playerId), items };
}

export function depositItem(playerId: string, slot: number, quantity: number): boolean {
  const player = Players.get(playerId);
  if (!player) return false;
  const inv = player.inventory.find(i => i.slot === slot);
  if (!inv || inv.quantity < quantity || quantity <= 0) return false;

  inv.quantity -= quantity;
  if (inv.quantity <= 0) {
    player.inventory = player.inventory.filter(i => i.slot !== slot);
  }
  return bankDepositItem(playerId, inv.itemId, quantity);
}

export function withdrawItem(playerId: string, itemId: string, quantity: number): boolean {
  const player = Players.get(playerId);
  if (!player) return false;
  if (!ITEM_DEFS[itemId]) return false;

  // Free inventory slot required
  const usedSlots = new Set(player.inventory.map(i => i.slot));
  let freeSlot = -1;
  for (let s = 0; s < MAX_INVENTORY_SLOTS; s++) {
    if (!usedSlots.has(s)) { freeSlot = s; break; }
  }
  if (freeSlot === -1) return false;

  const stackable = ITEM_DEFS[itemId].stackable;
  const existing = stackable ? player.inventory.find(i => i.itemId === itemId) : undefined;
  if (existing) {
    if (!bankWithdrawItem(playerId, itemId, quantity)) return false;
    existing.quantity += quantity;
    return true;
  }
  if (!bankWithdrawItem(playerId, itemId, quantity)) return false;
  player.inventory.push({ itemId, quantity, slot: freeSlot });
  return true;
}
