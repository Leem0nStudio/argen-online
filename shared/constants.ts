// ============================================================
// Game Constants — Single source of truth
// ============================================================

// ---- Rendering ----
export const TILE_SIZE = 32;

// ---- Server ----
export const TICK_RATE_MS = 50;         // 20 ticks/second
export const AI_TICK_INTERVAL = 4;       // Every 4 ticks = 200ms
export const MONSTER_BROADCAST_INTERVAL = 10; // Every 10 ticks = 500ms
export const REGEN_INTERVAL = 20;        // Every 20 ticks = 1s
export const RESPAWN_CHECK_INTERVAL = 20;

// ---- Movement ----
export const PLAYER_MOVE_INTERVAL_MS = 150;

// ---- Combat ----
export const BASE_DAMAGE = 5;
export const CRIT_CHANCE_BASE = 0.1;
export const CRIT_MULTIPLIER = 1.5;
export const ATTACK_COOLDOWN_MS = 800;
export const ATTACK_RANGE = 3;
export const MONSTER_AUTO_ATTACK_MS = 1200;
export const GOLD_LOSS_ON_DEATH_PCT = 0.1;
export const RESPAWN_GOLD_COST = 50;

// ---- PvP ----
export const PVP_CRIMINAL_DURATION_MS = 300_000; // 5 min de condición criminal

// ---- Buffs ----
export const POISON_TICK_INTERVAL = 4; // ticks

// ---- Chat ----
export const MAX_CHAT_LENGTH = 200;
export const CHAT_HISTORY_LIMIT = 100;
export const CHAT_DISPLAY_LIMIT = 50;

// ---- Inventory ----
export const MAX_INVENTORY_SLOTS = 20;

// ---- Race Modifiers (AO-inspired) ----
export const RACE_MODS: Record<string, { str: number; dex: number; int: number; con: number; hp: number; mp: number; desc: string }> = {
  humano:      { str: 0, dex: 0, int: 0, con: 0, hp: 0, mp: 0, desc: "Equilibrado" },
  elfo:        { str: -1, dex: 2, int: 2, con: -1, hp: -5, mp: 10, desc: "Ágil y mágico" },
  elfo_oscuro: { str: 1, dex: 1, int: 2, con: -2, hp: -10, mp: 15, desc: "Mago oscuro" },
  enano:       { str: 2, dex: -2, int: -1, con: 3, hp: 15, mp: -10, desc: "Fuerte y resistente" },
  gnomo:       { str: -2, dex: 2, int: 3, con: -1, hp: -10, mp: 20, desc: "Pequeño sabio" },
};

// ---- Class Base Stats ----
export const CLASS_BASE_STATS: Record<string, { str: number; dex: number; int: number; con: number; hp: number; mp: number }> = {
  warrior: { str: 8, dex: 4, int: 2, con: 8, hp: 120, mp: 30 },
  mage:    { str: 3, dex: 4, int: 10, con: 4, hp: 70, mp: 100 },
  archer:  { str: 5, dex: 10, int: 3, con: 5, hp: 90, mp: 40 },
  paladin: { str: 7, dex: 4, int: 5, con: 7, hp: 110, mp: 60 },
};

// ---- Level Up ----
export const LEVEL_HP_GAIN = 10;
export const LEVEL_MP_GAIN = 5;
export const LEVEL_STR_GAIN = 2;
export const LEVEL_DEX_GAIN = 1;
export const LEVEL_INT_GAIN = 1;
export const LEVEL_CON_GAIN = 2;

// ---- Monster Definitions ----
export const MONSTER_DEFS = [
  { name: "Goblin",     hp: 40,  damage: 5,  xp: 15,  loot: ["iron_ore", "bandage"],         respawn: 15000, aggroRange: 5, attackRange: 1, chaseSpeed: 600, patrolSpeed: 1200 },
  { name: "Lobo",       hp: 60,  damage: 8,  xp: 25,  loot: ["leather_armor", "health_potion"], respawn: 20000, aggroRange: 6, attackRange: 1, chaseSpeed: 400, patrolSpeed: 1000 },
  { name: "Esqueleto",  hp: 80,  damage: 12, xp: 40,  loot: ["iron_sword", "mana_potion"],    respawn: 30000, aggroRange: 5, attackRange: 2, chaseSpeed: 700, patrolSpeed: 1400 },
  { name: "Ogro",       hp: 150, damage: 20, xp: 75,  loot: ["steel_sword", "chainmail"],     respawn: 45000, aggroRange: 4, attackRange: 1, chaseSpeed: 900, patrolSpeed: 1600 },
] as const;

export const MONSTERS_PER_WILDERNESS = 4;
export const MONSTERS_PER_DUNGEON = 6;
export const MONSTER_SPAWN_MARGIN = 2;
export const MONSTER_FLEE_HP_PCT = 0.15;
export const MONSTER_FLEE_DISENGAGE_PCT = 1.2; // aggro range multiplier to stop fleeing

// ---- Map Config ----
export const DEFAULT_SPAWN_MAP = "rucci";
export const DEFAULT_SPAWN_X = 15;
export const DEFAULT_SPAWN_Y = 15;

// ---- XP ----
export function xpForLevel(level: number): number {
  return Math.floor(level * level * 80 + level * 20);
}
export const STAT_POINTS_PER_LEVEL = 3;

// ---- Skill Unlocks ----
export const SKILL_UNLOCK_LEVELS: Record<number, string[]> = {
  1: ["Q"],  // First skill available from level 1
  5: ["W"],  // Second skill at level 5
  10: ["E"], // Third skill at level 10
};
export const MAX_LEVEL = 50;

// ---- Client-only constants (non-numeric, safe for server import) ----
export const ALL_WILDERNESS_MAPS = ["campo_norte", "campo_sur", "campo_oeste", "campo_este", "mazmorra_entrance", "mazmorra_profunda"] as const;
