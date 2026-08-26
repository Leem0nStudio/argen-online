// ============================================================
// Crafting Recipes — Single source of truth (shared client/server)
// ============================================================

export interface Recipe {
  id: string;
  name: string;
  resultItemId: string;
  resultQuantity: number;
  ingredients: { itemId: string; quantity: number }[];
}

export const RECIPES: Recipe[] = [
  {
    id: "wooden_shield",
    name: "Escudo de Madera",
    resultItemId: "wooden_shield",
    resultQuantity: 1,
    ingredients: [{ itemId: "wood", quantity: 6 }],
  },
  {
    id: "iron_sword",
    name: "Espada de Hierro",
    resultItemId: "iron_sword",
    resultQuantity: 1,
    ingredients: [{ itemId: "iron_ore", quantity: 5 }],
  },
  {
    id: "chainmail",
    name: "Cota de Malla",
    resultItemId: "chainmail",
    resultQuantity: 1,
    ingredients: [
      { itemId: "iron_ore", quantity: 10 },
      { itemId: "gold_nugget", quantity: 2 },
    ],
  },
];
