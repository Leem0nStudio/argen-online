// ============================================================
// Inventory System — Pickup, drop, equip, use consumables
// ============================================================

import { v4 as uuidv4 } from "uuid";
import type { GroundItem, InventoryItem } from "../../shared/types.js";
import { MAX_INVENTORY_SLOTS } from "../../shared/constants.js";
import { ITEMS } from "../../shared/items.js";
import { Players, Ground } from "./state.js";

function findFreeSlot(inventory: InventoryItem[]): number {
  const usedSlots = new Set(inventory.map(i => i.slot));
  for (let s = 0; s < MAX_INVENTORY_SLOTS; s++) {
    if (!usedSlots.has(s)) return s;
  }
  return -1;
}

export function pickupItem(playerId: string, groundItemId: string): boolean {
  const player = Players.get(playerId);
  const item = Ground.get(groundItemId);
  if (!player || !item || item.mapId !== player.mapId) return false;
  if (player.x !== item.x || player.y !== item.y) return false;

  const itemDef = ITEMS[item.itemId];
  if (!itemDef) return false;

  const existing = player.inventory.find(i => i.itemId === item.itemId && itemDef.stackable);
  if (existing) {
    existing.quantity += item.quantity;
  } else {
    const newSlot = findFreeSlot(player.inventory);
    if (newSlot === -1) return false;
    player.inventory.push({ itemId: item.itemId, quantity: item.quantity, slot: newSlot });
  }

  Ground.delete(groundItemId);
  return true;
}

export function dropItem(playerId: string, inventorySlot: number, quantity: number): GroundItem | null {
  const player = Players.get(playerId);
  if (!player) return null;

  const invItem = player.inventory.find(i => i.slot === inventorySlot);
  if (!invItem || invItem.quantity < quantity) return null;

  const drop: GroundItem = {
    id: uuidv4(), itemId: invItem.itemId, quantity,
    x: player.x, y: player.y, mapId: player.mapId,
  };

  Ground.set(drop);
  invItem.quantity -= quantity;
  if (invItem.quantity <= 0) {
    player.inventory = player.inventory.filter(i => i.slot !== inventorySlot);
  }
  return drop;
}

export function equipItem(playerId: string, inventorySlot: number): boolean {
  const player = Players.get(playerId);
  if (!player) return false;

  const invItem = player.inventory.find(i => i.slot === inventorySlot);
  if (!invItem) return false;

  const itemDef = ITEMS[invItem.itemId];
  if (!itemDef || !itemDef.slot) return false;

  const slot = itemDef.slot as keyof typeof player.equipment;
  const currentEquipped = player.equipment[slot];
  if (currentEquipped) {
    // Need free slot to stash currently equipped item — otherwise would lose it
    const inventoryWithoutEquipping = player.inventory.filter(i => i.slot !== inventorySlot);
    const newSlot = findFreeSlot(inventoryWithoutEquipping);
    if (newSlot === -1) return false;
    player.inventory = inventoryWithoutEquipping;
    player.inventory.push({ itemId: currentEquipped, quantity: 1, slot: newSlot });
  } else {
    player.inventory = player.inventory.filter(i => i.slot !== inventorySlot);
  }

  (player.equipment as unknown as Record<string, string | null>)[slot] = invItem.itemId;
  return true;
}

export function useConsumable(playerId: string, inventorySlot: number): boolean {
  const player = Players.get(playerId);
  if (!player) return false;

  const invItem = player.inventory.find(i => i.slot === inventorySlot);
  if (!invItem) return false;

  const itemDef = ITEMS[invItem.itemId];
  if (!itemDef) return false;

  // Antorcha: otorga buff de luz 5 min, sin curar
  if (invItem.itemId === "torch") {
    if (!player.buffs) player.buffs = [];
    // Evita stack infinito: extiende duración si ya tiene
    const now = Date.now();
    const existing = player.buffs.find(b => b.type === "torch_light");
    if (existing) existing.expiresAt = now + 5 * 60 * 1000;
    else player.buffs.push({ type: "torch_light", value: 1, expiresAt: now + 5 * 60 * 1000 });
    invItem.quantity -= 1;
    if (invItem.quantity <= 0) player.inventory = player.inventory.filter(i => i.slot !== inventorySlot);
    return true;
  }

  // Farol es shield, no consumible — si está en inventario y se "usa", lo equipa y no se consume
  if (invItem.itemId === "lantern") {
    // Equipar farol si no está equipado
    if (player.equipment.shield !== "lantern") {
      // Reusa equipItem logic: necesita slot libre si hay shield previo
      const cur = player.equipment.shield;
      if (cur) {
        const invWithout = player.inventory.filter(i => i.slot !== inventorySlot);
        const ns = findFreeSlot(invWithout);
        if (ns === -1) return false;
        player.inventory = invWithout;
        player.inventory.push({ itemId: cur, quantity: 1, slot: ns });
      } else {
        player.inventory = player.inventory.filter(i => i.slot !== inventorySlot);
      }
      (player.equipment as unknown as Record<string, string | null>).shield = "lantern";
    }
    return true;
  }

  if (itemDef.type !== "consumable") return false;

  if (itemDef.stats?.hp) {
    player.stats.hp = Math.min(player.stats.maxHp, player.stats.hp + itemDef.stats.hp);
  }
  if (itemDef.stats?.mp) {
    player.stats.mp = Math.min(player.stats.maxMp, player.stats.mp + itemDef.stats.mp);
  }

  invItem.quantity -= 1;
  if (invItem.quantity <= 0) {
    player.inventory = player.inventory.filter(i => i.slot !== inventorySlot);
  }
  return true;
}

export function dropMonsterLoot(monster: { loot: string[]; x: number; y: number; mapId: string }): void {
  if (monster.loot.length > 0) {
    const lootId = monster.loot[Math.floor(Math.random() * monster.loot.length)];
    Ground.set({
      id: uuidv4(), itemId: lootId, quantity: 1,
      x: monster.x, y: monster.y, mapId: monster.mapId,
    });
  }
}
