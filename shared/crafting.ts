// ============================================================
// Crafting Recipes — Single source of truth (shared client/server)
// ============================================================

export interface Recipe {
  id: string;
  name: string;
  resultItemId: string;
  resultQuantity: number;
  ingredients: { itemId: string; quantity: number }[];
  goldCost?: number;
}

export const RECIPES: Recipe[] = [
  {
    id: "wooden_shield",
    name: "Escudo de Madera",
    resultItemId: "wooden_shield",
    resultQuantity: 1,
    ingredients: [{ itemId: "wood", quantity: 6 }],
    goldCost: 10,
  },
  {
    id: "iron_sword",
    name: "Espada de Hierro",
    resultItemId: "iron_sword",
    resultQuantity: 1,
    ingredients: [{ itemId: "iron_ore", quantity: 5 }],
    goldCost: 25,
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
    goldCost: 60,
  },
  {
    id: "iron_pickaxe",
    name: "Pico de Hierro",
    resultItemId: "iron_pickaxe",
    resultQuantity: 1,
    ingredients: [{ itemId: "iron_ore", quantity: 3 }, { itemId: "wood", quantity: 2 }],
    goldCost: 15,
  },
  {
    id: "wood_axe",
    name: "Hacha de Leñador",
    resultItemId: "wood_axe",
    resultQuantity: 1,
    ingredients: [{ itemId: "wood", quantity: 3 }, { itemId: "iron_ore", quantity: 1 }],
    goldCost: 12,
  },
  {
    id: "torch",
    name: "Antorcha",
    resultItemId: "torch",
    resultQuantity: 3,
    ingredients: [{ itemId: "wood", quantity: 2 }, { itemId: "bandage", quantity: 1 }],
    goldCost: 5,
  },
  {
    id: "lantern",
    name: "Farol",
    resultItemId: "lantern",
    resultQuantity: 1,
    ingredients: [{ itemId: "iron_ore", quantity: 4 }, { itemId: "gold_nugget", quantity: 1 }, { itemId: "wood", quantity: 2 }],
    goldCost: 30,
  },
];
