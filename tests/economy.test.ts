import { describe, it, expect } from "vitest";
import { RECIPES } from "../shared/crafting.js";
import { ITEMS } from "../shared/items.js";

describe("economia escasez", () => {
  it("recetas con goldCost", () => {
    const sword = RECIPES.find(r => r.id === "iron_sword");
    expect(sword?.goldCost).toBe(25);
    const shield = RECIPES.find(r => r.id === "wooden_shield");
    expect(shield?.goldCost).toBe(10);
  });
  it("tools existen", () => {
    expect(ITEMS["iron_pickaxe"]).toBeDefined();
    expect(ITEMS["wood_axe"]).toBeDefined();
    expect(ITEMS["iron_pickaxe"].type).toBe("weapon");
  });
  it("luces existen", () => {
    expect(ITEMS["torch"]).toBeDefined();
    expect(ITEMS["lantern"]).toBeDefined();
    expect(ITEMS["torch"].stackable).toBe(true);
    const torchR = RECIPES.find(r => r.id === "torch");
    expect(torchR?.goldCost).toBe(5);
    expect(torchR?.ingredients.find(i => i.itemId === "wood")?.quantity).toBe(2);
    const lanternR = RECIPES.find(r => r.id === "lantern");
    expect(lanternR?.goldCost).toBe(30);
  });
  it("bank fee 2%", () => {
    const fee = (a: number) => Math.ceil(a * 0.02);
    expect(fee(100)).toBe(2);
    expect(fee(50)).toBe(1);
    expect(fee(1)).toBe(1);
  });
  it("npc discount tiers", () => {
    const disc = (rep: number) => (rep >= 200 ? 0.15 : rep >= 100 ? 0.10 : rep >= 50 ? 0.05 : 0);
    expect(disc(0)).toBe(0);
    expect(disc(60)).toBe(0.05);
    expect(disc(120)).toBe(0.10);
    expect(disc(300)).toBe(0.15);
  });
});
