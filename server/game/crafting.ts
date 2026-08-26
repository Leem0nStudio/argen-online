// ============================================================
// Crafting — Consume materials, produce items (server authority)
// ============================================================

import { RECIPES, type Recipe } from "../../shared/crafting.js";
import { MAX_INVENTORY_SLOTS } from "../../shared/constants.js";
import { Players } from "./state.js";

export function getRecipe(recipeId: string): Recipe | undefined {
  return RECIPES.find(r => r.id === recipeId);
}

function countItem(player: { inventory: { itemId: string; quantity: number }[] }, itemId: string): number {
  return player.inventory.filter(i => i.itemId === itemId).reduce((sum, i) => sum + i.quantity, 0);
}

export function craft(playerId: string, recipeId: string): { ok: boolean; message: string } {
  const player = Players.get(playerId);
  if (!player) return { ok: false, message: "No estás en el mundo" };

  // Estación requerida: solo en ciudades/settlements (banco de trabajo)
  if (!player.mapId.startsWith("settlement_")) {
    return { ok: false, message: "Necesitas un banco de trabajo (en la ciudad) para craftear." };
  }

  const recipe = getRecipe(recipeId);
  if (!recipe) return { ok: false, message: "Receta desconocida" };

  if ((recipe.goldCost ?? 0) > 0 && player.gold < recipe.goldCost!) {
    return { ok: false, message: `Oro insuficiente: necesitas ${recipe.goldCost} oro.` };
  }

  // Validate all ingredients present
  for (const ing of recipe.ingredients) {
    if (countItem(player, ing.itemId) < ing.quantity) {
      return { ok: false, message: `Faltan materiales para ${recipe.name}` };
    }
  }

  // Pre-check a free slot for the result (unless it stacks into an existing stack)
  const stacksIntoExisting = player.inventory.some(i => i.itemId === recipe.resultItemId);
  if (!stacksIntoExisting) {
    const usedSlots = new Set(player.inventory.map(i => i.slot));
    let hasFree = false;
    for (let s = 0; s < MAX_INVENTORY_SLOTS; s++) { if (!usedSlots.has(s)) { hasFree = true; break; } }
    if (!hasFree) return { ok: false, message: "Inventario lleno" };
  }

  // Consume ingredients + gold
  for (const ing of recipe.ingredients) {
    let remaining = ing.quantity;
    for (const inv of player.inventory) {
      if (inv.itemId !== ing.itemId || remaining <= 0) continue;
      const take = Math.min(remaining, inv.quantity);
      inv.quantity -= take;
      remaining -= take;
    }
    player.inventory = player.inventory.filter(i => i.quantity > 0);
  }
  if ((recipe.goldCost ?? 0) > 0) player.gold -= recipe.goldCost!;

  // Produce result
  const existing = player.inventory.find(i => i.itemId === recipe.resultItemId);
  if (existing) {
    existing.quantity += recipe.resultQuantity;
  } else {
    const usedSlots = new Set(player.inventory.map(i => i.slot));
    let slot = -1;
    for (let s = 0; s < MAX_INVENTORY_SLOTS; s++) { if (!usedSlots.has(s)) { slot = s; break; } }
    player.inventory.push({ itemId: recipe.resultItemId, quantity: recipe.resultQuantity, slot });
  }

  return { ok: true, message: `¡Craftaste ${recipe.name}!` };
}
