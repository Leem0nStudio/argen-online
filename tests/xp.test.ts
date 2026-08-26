import { describe, it, expect } from "vitest";
import { xpForLevel } from "../shared/constants.js";

describe("xpForLevel", () => {
  it("curve lvl*lvl*80+20", () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(360);
    expect(xpForLevel(5)).toBe(2100);
    expect(xpForLevel(10)).toBe(8200);
  });
  it("increasing", () => {
    let prev = 0;
    for (let l = 1; l <= 20; l++) {
      const cur = xpForLevel(l);
      expect(cur).toBeGreaterThan(prev);
      prev = cur;
    }
  });
});
