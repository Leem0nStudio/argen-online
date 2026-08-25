// ============================================================
// Shared Types — Client ↔ Server
// ============================================================

export enum CharacterClass {
  Warrior = "warrior",
  Mage = "mage",
  Archer = "archer",
  Paladin = "paladin",
}

export enum Direction {
  Up = "up",
  Down = "down",
  Left = "left",
  Right = "right",
}

export enum MapZone {
  City = "city",
  Wilderness = "wilderness",
  Dungeon = "dungeon",
}

export enum ItemSlot {
  Weapon = "weapon",
  Armor = "armor",
  Shield = "shield",
  Head = "head",
  Boots = "boots",
  Ring = "ring",
}

// ---- Skills System ----

export type SkillTarget = "self" | "single" | "aoe" | "none";

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  manaCost: number;
  cooldownMs: number;
  range: number; // 0 = self
  damage: number; // 0 = non-damage skill
  healAmount: number; // 0 = non-heal skill
  target: SkillTarget;
  aoeRadius: number; // 0 = no AoE
  buffType?: string; // "strength" | "dodge" | "invuln" | "shield_absorb"
  buffValue?: number;
  buffDurationMs?: number;
}

export const SKILLS: Record<string, SkillDef[]> = {
  warrior: [
    { id: "shield_bash", name: "Golpe de Escudo", icon: "🛡️", description: "Aturde al enemigo por 2s", manaCost: 15, cooldownMs: 8000, range: 2, damage: 10, healAmount: 0, target: "single", aoeRadius: 0, buffType: "stun", buffValue: 2000, buffDurationMs: 2000 },
    { id: "war_cry", name: "Grito de Guerra", icon: "📯", description: "Fuerza +50% por 5s", manaCost: 20, cooldownMs: 15000, range: 0, damage: 0, healAmount: 0, target: "self", aoeRadius: 0, buffType: "strength", buffValue: 50, buffDurationMs: 5000 },
    { id: "whirlwind", name: "Tornado", icon: "🌀", description: "Daño a todos enemigos cercanos", manaCost: 25, cooldownMs: 10000, range: 0, damage: 15, healAmount: 0, target: "aoe", aoeRadius: 2, buffType: undefined, buffValue: undefined, buffDurationMs: undefined },
  ],
  mage: [
    { id: "fireball", name: "Bola de Fuego", icon: "🔥", description: "Daño mágico a distancia", manaCost: 15, cooldownMs: 3000, range: 5, damage: 20, healAmount: 0, target: "single", aoeRadius: 0 },
    { id: "ice_shield", name: "Escudo de Hielo", icon: "🧊", description: "Absorbe 30 de daño", manaCost: 20, cooldownMs: 12000, range: 0, damage: 0, healAmount: 0, target: "self", aoeRadius: 0, buffType: "shield_absorb", buffValue: 30, buffDurationMs: 15000 },
    { id: "heal", name: "Curación", icon: "💚", description: "Restaura 40% HP", manaCost: 30, cooldownMs: 15000, range: 0, damage: 0, healAmount: 0, target: "self", aoeRadius: 0, buffType: "heal_pct", buffValue: 40, buffDurationMs: 0 },
  ],
  archer: [
    { id: "power_shot", name: "Tiro Poderoso", icon: "🎯", description: "Disparo fuerte a distancia", manaCost: 15, cooldownMs: 4000, range: 5, damage: 25, healAmount: 0, target: "single", aoeRadius: 0 },
    { id: "poison_arrow", name: "Flecha Venenosa", icon: "☠️", description: "Daño + veneno por 5s", manaCost: 20, cooldownMs: 8000, range: 4, damage: 10, healAmount: 0, target: "single", aoeRadius: 0, buffType: "poison", buffValue: 5, buffDurationMs: 5000 },
    { id: "dodge", name: "Esquivar", icon: "💨", description: "Esquiva 100% por 3s", manaCost: 15, cooldownMs: 10000, range: 0, damage: 0, healAmount: 0, target: "self", aoeRadius: 0, buffType: "dodge", buffValue: 100, buffDurationMs: 3000 },
  ],
  paladin: [
    { id: "smite", name: "Castigar", icon: "⚡", description: "Daño sagrado + cura 20%", manaCost: 15, cooldownMs: 5000, range: 2, damage: 18, healAmount: 0, target: "single", aoeRadius: 0, buffType: "self_heal_pct", buffValue: 20, buffDurationMs: 0 },
    { id: "holy_light", name: "Luz Sagrada", icon: "✨", description: "Cura 50 HP", manaCost: 25, cooldownMs: 8000, range: 0, damage: 0, healAmount: 50, target: "self", aoeRadius: 0 },
    { id: "divine_shield", name: "Escudo Divino", icon: "👼", description: "Invulnerable 3s", manaCost: 30, cooldownMs: 20000, range: 0, damage: 0, healAmount: 0, target: "self", aoeRadius: 0, buffType: "invuln", buffValue: 1, buffDurationMs: 3000 },
  ],
};

export interface ActiveBuff {
  type: string;
  value: number;
  expiresAt: number;
  shieldHp?: number;
}

export interface CooldownState {
  [skillId: string]: number; // timestamp when cooldown ends
}

// ---- Player Types ----

export interface PlayerStats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
  slot: number;
}

export interface Equipment {
  weapon: string | null;
  armor: string | null;
  shield: string | null;
  head: string | null;
  boots: string | null;
  ring: string | null;
}

export interface PlayerState {
  id: string;
  username: string;
  characterClass: string;
  level: number;
  experience: number;
  statPoints: number;
  skillUnlocks: string[]; // unlocked skill slots: ["Q","W","E"]
  gold: number;
  x: number;
  y: number;
  mapId: string;
  direction: Direction;
  isMoving: boolean;
  stats: PlayerStats;
  inventory: InventoryItem[];
  equipment: Equipment;
  buffs?: ActiveBuff[];
  cooldowns?: CooldownState;
}

// ---- Items ----

export interface ItemDef {
  id: string;
  name: string;
  type: "weapon" | "armor" | "consumable" | "material" | "shield";
  slot?: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  buyPrice: number;
  sellPrice: number;
  stats?: {
    damage?: number;
    defense?: number;
    hp?: number;
    mp?: number;
  };
  stackable: boolean;
  description: string;
}

// ---- NPCs ----

export interface NPCData {
  id: string;
  name: string;
  x: number;
  y: number;
  type: "merchant" | "quest" | "dialog";
  dialogue: string[];
  shopItems?: string[];
}

// ---- Maps ----

export interface MapConnection {
  targetMapId: string;
  targetX: number;
  targetY: number;
  triggerX: number;
  triggerY: number;
  triggerW: number;
  triggerH: number;
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  zone: MapZone;
  tiles: number[][];
  decorations: number[][];
  spawns: { x: number; y: number }[];
  connections: MapConnection[];
  npcs: NPCData[];
}

// ---- Combat / Items / Chat ----

export interface GroundItem {
  id: string;
  itemId: string;
  quantity: number;
  x: number;
  y: number;
  mapId: string;
}

export interface DamageEvent {
  attackerId: string;
  defenderId: string;
  damage: number;
  isCrit: boolean;
  timestamp: number;
  /** Present when the defender was a monster that died from this hit */
  xpGained?: number;
  levelUp?: boolean;
}

export interface SkillEvent {
  casterId: string;
  skillId: string;
  targetId?: string;
  damage?: number;
  heal?: number;
  aoe?: boolean;
  aoeRadius?: number;
  buffApplied?: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  username: string;
  message: string;
  timestamp: number;
  type: "local" | "system" | "global";
}

// ---- Monster AI ----

export type MonsterAIState = "idle" | "patrol" | "chase" | "attack" | "flee" | "return";

export interface MonsterData {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  mapId: string;
  aiState?: MonsterAIState;
  targetId?: string;
}

// ---- Utility ----

export function xpForLevel(level: number): number {
  return level * 100;
}

// ---- Socket Event Maps ----

export interface ClientEvents {
  "auth:register": (data: { username: string; password: string; characterClass: string }) => void;
  "auth:login": (data: { username: string; password: string }) => void;
  "player:move": (data: { x: number; y: number; direction: Direction }) => void;
  "player:stop": (data: { x: number; y: number; direction: Direction }) => void;
  "player:respawn": () => void;
  "chat:send": (message: string) => void;
  "combat:attack": (targetId: string) => void;
  "skill:use": (data: { skillId: string; targetId?: string }) => void;
  "item:pickup": (groundItemId: string) => void;
  "item:equip": (inventorySlot: number) => void;
  "item:use": (inventorySlot: number) => void;
  "item:drop": (inventorySlot: number, quantity: number) => void;
  "npc:interact": (npcId: string) => void;
  "npc:buy": (itemId: string, quantity: number) => void;
  "npc:sell": (inventorySlot: number, quantity: number) => void;
  "world:request": (data: { wx: number; wy: number; radius: number }) => void;
  "stat:allocate": (data: { stat: "strength" | "dexterity" | "intelligence" | "constitution" }) => void;
}

export interface ServerEvents {
  "auth:success": (player: PlayerState) => void;
  "auth:error": (message: string) => void;
  "player:update": (player: PlayerState) => void;
  "player:move": (data: { id: string; x: number; y: number; direction: Direction; isMoving: boolean }) => void;
  "player:leave": (id: string) => void;
  "players:list": (players: PlayerState[]) => void;
  "chat:message": (msg: ChatMessage) => void;
  "combat:damage": (event: DamageEvent) => void;
  "combat:death": (data: { killerId: string; victimId: string }) => void;
  "skill:effect": (event: SkillEvent) => void;
  "groundItems:update": (items: GroundItem[]) => void;
  "npc:interact": (data: { npcId: string; dialogue: string; shopItems?: ItemDef[] }) => void;
  "world:state": (state: { players: PlayerState[]; groundItems: GroundItem[]; mapId: string }) => void;
  "monsters:update": (monsters: MonsterData[]) => void;
  "world:data": (data: WorldMetaData) => void;
  "world:chunk": (data: { rx: number; ry: number; tiles: number[][] }) => void;
  "player:levelup": (data: { level: number; statPoints: number; newUnlocks: string[] }) => void;
  "map:data": (map: GameMap) => void;
}

// ---- World Generation Types ----

export interface WorldSettlement {
  id: string;
  name: string;
  wx: number;
  wy: number;
  type: "capital" | "city" | "town" | "village";
  kingdom: string;
  population: number;
  radius: number;
}

export interface WorldKingdom {
  id: string;
  name: string;
  capitalId: string;
  color: number;
}

export interface WorldPOI {
  id: string;
  type: "dungeon" | "ruins" | "mine" | "shrine" | "cave";
  name: string;
  wx: number;
  wy: number;
}

export interface WorldRoad {
  wx: number;
  wy: number;
  fromSettlement: string;
  toSettlement: string;
}

export interface WorldMetaData {
  seed: number;
  width: number;
  height: number;
  settlements: WorldSettlement[];
  kingdoms: WorldKingdom[];
  pois: WorldPOI[];
  roads: WorldRoad[];
}
