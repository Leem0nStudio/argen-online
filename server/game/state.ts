// ============================================================
// Game State — Centralized in-memory game state
// ============================================================

import type { PlayerState, InventoryItem, GroundItem, ChatMessage, ActiveBuff } from "../../shared/types.js";
import type { MonsterAIState } from "../../shared/types.js";

// ---- Player State ----

export interface ActivePlayer extends PlayerState {
  inventory: InventoryItem[];
}

const activePlayers = new Map<string, ActivePlayer>();
const deadPlayers = new Set<string>();

export const Players = {
  get(id: string): ActivePlayer | undefined {
    return activePlayers.get(id);
  },

  set(player: ActivePlayer): void {
    activePlayers.set(player.id, player);
    deadPlayers.delete(player.id);
  },

  delete(id: string): ActivePlayer | undefined {
    const player = activePlayers.get(id);
    activePlayers.delete(id);
    return player;
  },

  isDead(id: string): boolean {
    return deadPlayers.has(id);
  },

  markDead(id: string): void {
    deadPlayers.add(id);
  },

  clearDead(id: string): void {
    deadPlayers.delete(id);
  },

  all(): IterableIterator<ActivePlayer> {
    return activePlayers.values();
  },

  onMap(mapId: string): ActivePlayer[] {
    return Array.from(activePlayers.values()).filter(p => p.mapId === mapId);
  },

  allIds(): string[] {
    return Array.from(activePlayers.keys());
  },

  count(): number {
    return activePlayers.size;
  },
};

// ---- Ground Items ----

const groundItems = new Map<string, GroundItem>();

export const Ground = {
  get(id: string): GroundItem | undefined {
    return groundItems.get(id);
  },

  set(item: GroundItem): void {
    groundItems.set(item.id, item);
  },

  delete(id: string): boolean {
    return groundItems.delete(id);
  },

  onMap(mapId: string): GroundItem[] {
    return Array.from(groundItems.values()).filter(i => i.mapId === mapId);
  },
};

// ---- Chat ----

const chatHistory: ChatMessage[] = [];

export const Chat = {
  add(msg: ChatMessage): void {
    chatHistory.push(msg);
    if (chatHistory.length > 100) chatHistory.shift();
  },

  recent(limit = 20, isPlayerActive: (playerId: string) => boolean): ChatMessage[] {
    return chatHistory
      .filter(m => m.type === "system" || isPlayerActive(m.playerId))
      .slice(-limit);
  },
};

// ---- Monster State ----

export interface Monster {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  x: number;
  y: number;
  mapId: string;
  xpReward: number;
  loot: string[];
  respawnTime: number;
  lastDeath: number;
  // AI
  aiState: MonsterAIState;
  spawnX: number;
  spawnY: number;
  targetId: string | null;
  lastAiTick: number;
  idleEnd: number;
  patrolTargetX: number;
  patrolTargetY: number;
  aggroRange: number;
  attackRange: number;
  chaseSpeed: number;
  patrolSpeed: number;
  lastAutoAttack: number;
  // Buffs (for poison, etc)
  buffs?: ActiveBuff[];
}

const monsters = new Map<string, Monster>();

export const Monsters = {
  get(id: string): Monster | undefined {
    return monsters.get(id);
  },

  set(monster: Monster): void {
    monsters.set(monster.id, monster);
  },

  all(): IterableIterator<Monster> {
    return monsters.entries();
  },

  onMap(mapId: string): Monster[] {
    return Array.from(monsters.values()).filter(m => m.mapId === mapId && m.hp > 0);
  },

  count(): number {
    return monsters.size;
  },
};

// ---- Attack Cooldowns ----

const lastAttackTimes = new Map<string, number>();

export const AttackCooldowns = {
  get(attackerId: string): number {
    return lastAttackTimes.get(attackerId) ?? 0;
  },

  set(attackerId: string, time: number): void {
    lastAttackTimes.set(attackerId, time);
  },
};

// ---- Spawning State ----

const spawnedMaps = new Set<string>();

export const SpawnState = {
  hasSpawned(mapId: string): boolean {
    return spawnedMaps.has(mapId);
  },

  markSpawned(mapId: string): void {
    spawnedMaps.add(mapId);
  },
};
