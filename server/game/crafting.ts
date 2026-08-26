// ============================================================
// Crafting — Consume materials, produce items (server authority)
// ============================================================

import { RECIPES, type Recipe } from "../../shared/crafting.js";
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

  const recipe = getRecipe(recipeId);
  if (!recipe) return { ok: false, message: "Receta desconocida" };

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
    for (let s = 0; s < 20; s++) { if (!usedSlots.has(s)) { hasFree = true; break; } }
    if (!hasFree) return { ok: false, message: "Inventario lleno" };
  }

  // Consume ingredients
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

  // Produce result
  const existing = player.inventory.find(i => i.itemId === recipe.resultItemId);
  if (existing) {
    existing.quantity += recipe.resultQuantity;
  } else {
    const usedSlots = new Set(player.inventory.map(i => i.slot));
    let slot = -1;
    for (let s = 0; s < 20; s++) { if (!usedSlots.has(s)) { slot = s; break; } }
    player.inventory.push({ itemId: recipe.resultItemId, quantity: recipe.resultQuantity, slot });
  }

  return { ok: true, message: `¡Craftaste ${recipe.name}!` };
}
