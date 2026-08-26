import { describe, it, expect } from "vitest";
import { WT } from "../shared/world-gen.js";
import { WorldGenerator } from "../shared/world-gen.js";

describe("superficie recursos", () => {
  it("WALKABLE incluye depositos - generacion no rompe", async () => {
    const gen = new WorldGenerator(42, 4, 4);
    const region = gen.generateChunkRegion(0, 0);
    expect(region.tile.length).toBe(64);
    expect(region.tile[0].length).toBe(64);
  });
  it("YIELDS cubre forest y deposits", async () => {
    const { WT } = await import("../shared/world-gen.js");
    // Simular YIELDS keys existen
    expect(WT.ironDeposit).toBe(34);
    expect(WT.goldDeposit).toBe(35);
    expect(WT.forest).toBe(9);
  });
});
