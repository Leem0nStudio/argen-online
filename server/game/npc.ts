// ============================================================
// NPC System — Dialogue, shops, buy/sell
// ============================================================

import type { NPCData } from "../../shared/types.js";
import { MAPS } from "../../shared/maps.js";
import { ITEMS } from "../../shared/items.js";
import { MAX_INVENTORY_SLOTS } from "../../shared/constants.js";
import { Players } from "./state.js";
import { getWorldMap } from "./world.js";

const STOCK_MAX = 10;
const STOCK_RESUPPLY_MS = 10 * 60 * 1000;
const globalStocks = new Map<string, { qty: number; lastRestock: number }>();

function getStock(itemId: string): number {
  let entry = globalStocks.get(itemId);
  if (!entry) { entry = { qty: STOCK_MAX, lastRestock: Date.now() }; globalStocks.set(itemId, entry); return entry.qty; }
  if (Date.now() - entry.lastRestock > STOCK_RESUPPLY_MS) { entry.qty = STOCK_MAX; entry.lastRestock = Date.now(); }
  return entry.qty;
}

function decStock(itemId: string, qty: number): boolean {
  let entry = globalStocks.get(itemId);
  if (!entry) { entry = { qty: STOCK_MAX, lastRestock: Date.now() }; globalStocks.set(itemId, entry); }
  if (Date.now() - entry.lastRestock > STOCK_RESUPPLY_MS) { entry.qty = STOCK_MAX; entry.lastRestock = Date.now(); }
  if (entry.qty < qty) return false;
  entry.qty -= qty;
  return true;
}

function discountFor(playerId: string): number {
  const p = Players.get(playerId);
  if (!p) return 0;
  let kingdom: string | undefined;
  try { const wm = getWorldMap(); kingdom = wm.getKingdomAt(p.x, p.y) ?? wm.world.kingdoms[0]?.name; } catch {}
  if (!kingdom) return 0;
  const rep = p.reputation?.[kingdom] ?? 0;
  if (rep >= 200) return 0.15;
  if (rep >= 100) return 0.10;
  if (rep >= 50) return 0.05;
  return 0;
}

export function getNPC(mapId: string, npcId: string): NPCData | undefined {
  // Legacy maps
  const legacyMap = MAPS[mapId];
  if (legacyMap) {
    return legacyMap.npcs.find(n => n.id === npcId);
  }
  // Procedural settlement maps
  try {
    const wm = getWorldMap();
    const settlementMap = wm.getMap(mapId);
    if (settlementMap) {
      return settlementMap.npcs.find(n => n.id === npcId);
    }
  } catch { /* world not ready */ }
  return undefined;
}

export function npcBuyItem(playerId: string, itemId: string, quantity: number): boolean {
  const player = Players.get(playerId);
  if (!player) return false;

  const itemDef = ITEMS[itemId];
  if (!itemDef) return false;

  // Stock check (global scarcity)
  if (getStock(itemId) < quantity) return false;

  const discount = discountFor(playerId);
  const unitPrice = Math.max(1, Math.ceil(itemDef.buyPrice * (1 - discount)));
  const totalCost = unitPrice * quantity;
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

  if (!decStock(itemId, quantity)) return false; // should succeed after check
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
