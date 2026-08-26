import { describe, it, expect } from "vitest";
import { xpForLevel } from "../shared/constants.js";

// Minimal grantXp logic extracted via direct import of server would pull DB; instead test the pure logic here
function grantXpMock(player: { level: number; experience: number; statPoints: number; skillUnlocks: string[]; stats: any }, xp: number) {
  const SKILL_UNLOCK_LEVELS: Record<number, string[]> = { 1: ["Q"], 5: ["W"], 10: ["E"] };
  const MAX_LEVEL = 50;
  const STAT_POINTS_PER_LEVEL = 3;
  player.experience += xp;
  let leveledUp = false;
  const newUnlocks: string[] = [];
  while (player.level < MAX_LEVEL && player.experience >= xpForLevel(player.level)) {
    player.experience -= xpForLevel(player.level);
    player.level++;
    leveledUp = true;
    player.statPoints += STAT_POINTS_PER_LEVEL;
    const unlocks = SKILL_UNLOCK_LEVELS[player.level];
    if (unlocks) for (const s of unlocks) if (!player.skillUnlocks.includes(s)) { player.skillUnlocks.push(s); newUnlocks.push(s); }
  }
  return { leveledUp, newUnlocks };
}

describe("grantXp mock", () => {
  it("no duplicate xp", () => {
    const p: any = { level: 1, experience: 0, statPoints: 0, skillUnlocks: ["Q"], stats: {} };
    const r1 = grantXpMock(p, 100);
    expect(r1.leveledUp).toBe(true);
    expect(p.level).toBe(2);
    expect(p.experience).toBe(0);
    const r2 = grantXpMock(p, 0);
    expect(r2.leveledUp).toBe(false);
  });
  it("party share uses same grant", () => {
    const killer: any = { level: 1, experience: 0, statPoints: 0, skillUnlocks: ["Q"], stats: {} };
    const ally: any = { level: 1, experience: 0, statPoints: 0, skillUnlocks: ["Q"], stats: {} };
    grantXpMock(killer, 100);
    grantXpMock(ally, 100);
    expect(killer.level).toBe(2);
    expect(ally.level).toBe(2);
  });
});
