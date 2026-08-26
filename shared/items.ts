import type { ItemDef } from "./types";

export const ITEMS: Record<string, ItemDef> = {
  rusty_sword: {
    id: "rusty_sword", name: "Espada Oxidada", type: "weapon", slot: "weapon",
    rarity: "common", buyPrice: 25, sellPrice: 5,
    stats: { damage: 3 }, stackable: false, description: "Una vieja espada, pero funcional."
  },
  iron_sword: {
    id: "iron_sword", name: "Espada de Hierro", type: "weapon", slot: "weapon",
    rarity: "uncommon", buyPrice: 80, sellPrice: 20,
    stats: { damage: 7 }, stackable: false, description: "Una espada sólida de hierro."
  },
  steel_sword: {
    id: "steel_sword", name: "Espada de Acero", type: "weapon", slot: "weapon",
    rarity: "rare", buyPrice: 200, sellPrice: 60,
    stats: { damage: 12 }, stackable: false, description: "Acero templado, afilada y letal."
  },
  oak_bow: {
    id: "oak_bow", name: "Arco de Roble", type: "weapon", slot: "weapon",
    rarity: "common", buyPrice: 40, sellPrice: 10,
    stats: { damage: 5 }, stackable: false, description: "Un arco simple pero confiable."
  },
  mage_staff: {
    id: "mage_staff", name: "Bastón Mágico", type: "weapon", slot: "weapon",
    rarity: "uncommon", buyPrice: 100, sellPrice: 30,
    stats: { damage: 8 }, stackable: false, description: "Un bastón que pulsa con energía arcana."
  },
  flame_blade: {
    id: "flame_blade", name: "Hoja Ardiente", type: "weapon", slot: "weapon",
    rarity: "epic", buyPrice: 500, sellPrice: 150,
    stats: { damage: 18 }, stackable: false, description: "Una espada envuelta en llamas eternas."
  },
  leather_armor: {
    id: "leather_armor", name: "Armadura de Cuero", type: "armor", slot: "armor",
    rarity: "common", buyPrice: 50, sellPrice: 12,
    stats: { defense: 3 }, stackable: false, description: "Protección básica pero ligera."
  },
  chainmail: {
    id: "chainmail", name: "Cota de Malla", type: "armor", slot: "armor",
    rarity: "uncommon", buyPrice: 150, sellPrice: 45,
    stats: { defense: 7 }, stackable: false, description: "Malla de eslabones interconectados."
  },
  plate_armor: {
    id: "plate_armor", name: "Armadura de Placas", type: "armor", slot: "armor",
    rarity: "rare", buyPrice: 350, sellPrice: 100,
    stats: { defense: 12 }, stackable: false, description: "Placas de acero grueso. Pesa, pero protege."
  },
  wooden_shield: {
    id: "wooden_shield", name: "Escudo de Madera", type: "shield", slot: "shield",
    rarity: "common", buyPrice: 30, sellPrice: 8,
    stats: { defense: 2 }, stackable: false, description: "Un escudo rústico de madera."
  },
  health_potion: {
    id: "health_potion", name: "Poción de Vida", type: "consumable",
    rarity: "common", buyPrice: 15, sellPrice: 5,
    stats: { hp: 30 }, stackable: true, description: "Restaura 30 HP."
  },
  mana_potion: {
    id: "mana_potion", name: "Poción de Maná", type: "consumable",
    rarity: "common", buyPrice: 15, sellPrice: 5,
    stats: { mp: 25 }, stackable: true, description: "Restaura 25 MP."
  },
  bandage: {
    id: "bandage", name: "Venda", type: "consumable",
    rarity: "common", buyPrice: 5, sellPrice: 1,
    stats: { hp: 10 }, stackable: true, description: "Una venda simple. Cura un poco."
  },
  iron_ore: {
    id: "iron_ore", name: "Mineral de Hierro", type: "material",
    rarity: "common", buyPrice: 8, sellPrice: 3,
    stackable: true, description: "Materia prima para forjar armas."
  },
  wood: {
    id: "wood", name: "Madera", type: "material",
    rarity: "common", buyPrice: 5, sellPrice: 2,
    stackable: true, description: "Madera de roble fresca."
  },
  gold_nugget: {
    id: "gold_nugget", name: "Nugget de Oro", type: "material",
    rarity: "uncommon", buyPrice: 50, sellPrice: 25,
    stackable: true, description: "Un pequeño lingote de oro puro."
  },
  iron_pickaxe: {
    id: "iron_pickaxe", name: "Pico de Hierro", type: "weapon", slot: "weapon",
    rarity: "common", buyPrice: 40, sellPrice: 10,
    stats: { damage: 2 }, stackable: false, description: "Necesario para minar mineral. Se equipa como arma."
  },
  wood_axe: {
    id: "wood_axe", name: "Hacha de Leñador", type: "weapon", slot: "weapon",
    rarity: "common", buyPrice: 35, sellPrice: 8,
    stats: { damage: 2 }, stackable: false, description: "Necesaria para talar madera."
  },
};
