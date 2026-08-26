import { describe, it, expect } from "vitest";
import { PARTY_MAX_MEMBERS, CLAN_MAX_MEMBERS, TRADE_RANGE, GATHER_COOLDOWN_MS, GROUND_MAX_ITEMS } from "../shared/constants.js";

describe("constants centralization", () => {
  it("social limits", () => {
    expect(PARTY_MAX_MEMBERS).toBe(5);
    expect(CLAN_MAX_MEMBERS).toBe(8);
    expect(TRADE_RANGE).toBe(5);
  });
  it("gather/ground", () => {
    expect(GATHER_COOLDOWN_MS).toBe(3000);
    expect(GROUND_MAX_ITEMS).toBe(200);
  });
});
