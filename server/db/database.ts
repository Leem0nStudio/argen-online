import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import type { PlayerState, InventoryItem, Equipment } from "../../shared/types.js";
import { Direction } from "../../shared/types.js";
import { getWorldMap } from "../game/world.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../game.db");

let db: Database.Database;

export function initDB() {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      character_class TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      experience INTEGER DEFAULT 0,
      stat_points INTEGER DEFAULT 0,
      skill_unlocks TEXT DEFAULT 'Q',
      gold INTEGER DEFAULT 100,
      x INTEGER DEFAULT 12,
      y INTEGER DEFAULT 12,
      map_id TEXT DEFAULT 'rucci',
      strength INTEGER DEFAULT 5,
      dexterity INTEGER DEFAULT 3,
      intelligence INTEGER DEFAULT 3,
      constitution INTEGER DEFAULT 5,
      max_hp INTEGER DEFAULT 100,
      max_mp INTEGER DEFAULT 50
    );

    CREATE TABLE IF NOT EXISTS inventory (
      player_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      slot INTEGER NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS equipment (
      player_id TEXT NOT NULL,
      slot TEXT NOT NULL,
      item_id TEXT,
      PRIMARY KEY (player_id, slot),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS bank (
      player_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      PRIMARY KEY (player_id, item_id),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS clans (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      leader_id TEXT NOT NULL,
      created_at INTEGER DEFAULT 0,
      FOREIGN KEY (leader_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS clan_members (
      clan_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      PRIMARY KEY (clan_id, player_id),
      FOREIGN KEY (clan_id) REFERENCES clans(id),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );

    CREATE TABLE IF NOT EXISTS reputation (
      player_id TEXT NOT NULL,
      kingdom TEXT NOT NULL,
      value INTEGER DEFAULT 0,
      PRIMARY KEY (player_id, kingdom),
      FOREIGN KEY (player_id) REFERENCES players(id)
    );
  `);

  // Migrations for existing DBs
  try { db.exec("ALTER TABLE players ADD COLUMN bank_gold INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE players ADD COLUMN race TEXT DEFAULT 'humano'"); } catch { /* already exists */ }
}

// ---- Bank ----

export function getBankGold(playerId: string): number {
  const row = db.prepare("SELECT bank_gold FROM players WHERE id = ?").get(playerId) as any;
  return row?.bank_gold ?? 0;
}

export function setBankGold(playerId: string, amount: number): void {
  db.prepare("UPDATE players SET bank_gold = ? WHERE id = ?").run(amount, playerId);
}

export function getBankItems(playerId: string): InventoryItem[] {
  return db.prepare("SELECT item_id AS itemId, quantity, -1 AS slot FROM bank WHERE player_id = ?").all(playerId) as unknown as InventoryItem[];
}

export function bankDepositItem(playerId: string, itemId: string, quantity: number): boolean {
  const row = db.prepare("SELECT quantity FROM bank WHERE player_id = ? AND item_id = ?").get(playerId, itemId) as any;
  if (row) {
    db.prepare("UPDATE bank SET quantity = quantity + ? WHERE player_id = ? AND item_id = ?").run(quantity, playerId, itemId);
  } else {
    db.prepare("INSERT INTO bank (player_id, item_id, quantity) VALUES (?, ?, ?)").run(playerId, itemId, quantity);
  }
  return true;
}

export function bankWithdrawItem(playerId: string, itemId: string, quantity: number): boolean {
  const row = db.prepare("SELECT quantity FROM bank WHERE player_id = ? AND item_id = ?").get(playerId, itemId) as any;
  if (!row || row.quantity < quantity) return false;
  if (row.quantity === quantity) {
    db.prepare("DELETE FROM bank WHERE player_id = ? AND item_id = ?").run(playerId, itemId);
  } else {
    db.prepare("UPDATE bank SET quantity = quantity - ? WHERE player_id = ? AND item_id = ?").run(quantity, playerId, itemId);
  }
  return true;
}

export function registerPlayer(username: string, password: string, characterClass: string, race: string = "humano"): string {
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 8);

  const stats: Record<string, { str: number; dex: number; int: number; con: number; hp: number; mp: number }> = {
    warrior: { str: 8, dex: 4, int: 2, con: 8, hp: 120, mp: 30 },
    mage: { str: 3, dex: 4, int: 10, con: 4, hp: 70, mp: 100 },
    archer: { str: 5, dex: 10, int: 3, con: 5, hp: 90, mp: 40 },
    paladin: { str: 7, dex: 4, int: 5, con: 7, hp: 110, mp: 60 },
  };

  const raceMods: Record<string, { str: number; dex: number; int: number; con: number; hp: number; mp: number }> = {
    humano: { str: 0, dex: 0, int: 0, con: 0, hp: 0, mp: 0 },
    elfo: { str: -1, dex: 2, int: 2, con: -1, hp: -5, mp: 10 },
    elfo_oscuro: { str: 1, dex: 1, int: 2, con: -2, hp: -10, mp: 15 },
    enano: { str: 2, dex: -2, int: -1, con: 3, hp: 15, mp: -10 },
    gnomo: { str: -2, dex: 2, int: 3, con: -1, hp: -10, mp: 20 },
  };

  const s = stats[characterClass] || stats.warrior;
  const rm = raceMods[race] || raceMods.humano;
  s.str += rm.str; s.dex += rm.dex; s.int += rm.int; s.con += rm.con; s.hp += rm.hp; s.mp += rm.mp;

  // Determine spawn location from procedural world
  let spawnMap = "rucci";
  let spawnX = 15;
  let spawnY = 15;
  try {
    const wm = getWorldMap();
    const capital = wm.settlements.find(s => s.type === "capital") ?? wm.settlements[0];
    if (capital) {
      spawnMap = wm.getSettlementMapId(capital);
      const map = wm.getMap(spawnMap);
      spawnX = map?.spawns[0]?.x ?? Math.floor((map?.width ?? 30) / 2);
      spawnY = map?.spawns[0]?.y ?? Math.floor((map?.height ?? 30) / 2);
    }
  } catch { /* world not ready yet, use defaults */ }

  db.prepare(`
    INSERT INTO players (id, username, password_hash, character_class, race, x, y, map_id, strength, dexterity, intelligence, constitution, max_hp, max_mp, gold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100)
  `).run(id, username, hash, characterClass, race, spawnX, spawnY, spawnMap, s.str, s.dex, s.int, s.con, s.hp, s.mp);

  // Default inventory: a health potion and bandage
  db.prepare(`INSERT INTO inventory (player_id, item_id, quantity, slot) VALUES (?, 'health_potion', 3, 0)`).run(id);
  db.prepare(`INSERT INTO inventory (player_id, item_id, quantity, slot) VALUES (?, 'bandage', 5, 1)`).run(id);

  return id;
}

export function authenticatePlayer(username: string, password: string): string | null {
  const row = db.prepare("SELECT id, password_hash FROM players WHERE username = ?").get(username) as any;
  if (!row) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;
  return row.id;
}

export function getPlayer(id: string): (PlayerState & { inventory: InventoryItem[] }) | null {
  const row = db.prepare(`
    SELECT id, username, character_class, race, level, experience, stat_points, skill_unlocks, gold, x, y, map_id,
           strength, dexterity, intelligence, constitution, max_hp, max_mp
    FROM players WHERE id = ?
  `).get(id) as any;
  if (!row) return null;

  const inventoryRows = db.prepare("SELECT item_id, quantity, slot FROM inventory WHERE player_id = ?").all(id) as any[];
  const equipmentRows = db.prepare("SELECT slot, item_id FROM equipment WHERE player_id = ?").all(id) as any[];

  const equipment: Equipment = {
    weapon: null, armor: null, shield: null, head: null, boots: null, ring: null,
  };
  for (const eq of equipmentRows) {
    (equipment as any)[eq.slot] = eq.item_id;
  }

  // Reputation
  const repRows = db.prepare("SELECT kingdom, value FROM reputation WHERE player_id = ?").all(id) as any[];
  const reputation: Record<string, number> = {};
  for (const r of repRows) reputation[r.kingdom] = r.value;

  return {
    id: row.id,
    username: row.username,
    characterClass: row.character_class,
    race: row.race ?? "humano",
    level: row.level,
    experience: row.experience,
    statPoints: row.stat_points ?? 0,
    skillUnlocks: row.skill_unlocks ? row.skill_unlocks.split(",") : ["Q"],
    gold: row.gold,
    x: row.x,
    y: row.y,
    mapId: row.map_id,
    direction: Direction.Down,
    isMoving: false,
    stats: {
      hp: row.max_hp,
      maxHp: row.max_hp,
      mp: row.max_mp,
      maxMp: row.max_mp,
      strength: row.strength,
      dexterity: row.dexterity,
      intelligence: row.intelligence,
      constitution: row.constitution,
    },
    inventory: inventoryRows.map((r: any) => ({
      itemId: r.item_id,
      quantity: r.quantity,
      slot: r.slot,
    })),
    equipment,
    reputation,
  };
}

export function savePlayer(player: PlayerState) {
  db.prepare(`
    UPDATE players SET level = ?, experience = ?, stat_points = ?, skill_unlocks = ?, gold = ?, x = ?, y = ?, map_id = ?,
      strength = ?, dexterity = ?, intelligence = ?, constitution = ?,
      max_hp = ?, max_mp = ?
    WHERE id = ?
  `).run(
    player.level, player.experience, player.statPoints ?? 0, (player.skillUnlocks ?? ["Q"]).join(","),
    player.gold, player.x, player.y, player.mapId,
    player.stats.strength, player.stats.dexterity, player.stats.intelligence, player.stats.constitution,
    player.stats.maxHp, player.stats.maxMp, player.id
  );
}

export function saveInventory(playerId: string, inventory: InventoryItem[]) {
  db.prepare("DELETE FROM inventory WHERE player_id = ?").run(playerId);
  const stmt = db.prepare("INSERT INTO inventory (player_id, item_id, quantity, slot) VALUES (?, ?, ?, ?)");
  for (const item of inventory) {
    stmt.run(playerId, item.itemId, item.quantity, item.slot);
  }
}

export function saveEquipment(playerId: string, equipment: Record<string, string | null>) {
  db.prepare("DELETE FROM equipment WHERE player_id = ?").run(playerId);
  const stmt = db.prepare("INSERT INTO equipment (player_id, slot, item_id) VALUES (?, ?, ?)");
  for (const [slot, itemId] of Object.entries(equipment)) {
    if (itemId) stmt.run(playerId, slot, itemId);
  }
}

export const savePlayerFull = (() => {
  let tx: ((p: PlayerState) => void) | null = null;
  return (player: PlayerState) => {
    if (!tx) {
      tx = db.transaction((p: PlayerState) => {
        db.prepare(`
          UPDATE players SET level = ?, experience = ?, stat_points = ?, skill_unlocks = ?, gold = ?, x = ?, y = ?, map_id = ?,
            strength = ?, dexterity = ?, intelligence = ?, constitution = ?,
            max_hp = ?, max_mp = ?
          WHERE id = ?
        `).run(
          p.level, p.experience, p.statPoints ?? 0, (p.skillUnlocks ?? ["Q"]).join(","),
          p.gold, p.x, p.y, p.mapId,
          p.stats.strength, p.stats.dexterity, p.stats.intelligence, p.stats.constitution,
          p.stats.maxHp, p.stats.maxMp, p.id
        );
        db.prepare("DELETE FROM inventory WHERE player_id = ?").run(p.id);
        const invStmt = db.prepare("INSERT INTO inventory (player_id, item_id, quantity, slot) VALUES (?, ?, ?, ?)");
        for (const item of p.inventory) invStmt.run(p.id, item.itemId, item.quantity, item.slot);
        db.prepare("DELETE FROM equipment WHERE player_id = ?").run(p.id);
        const eqStmt = db.prepare("INSERT INTO equipment (player_id, slot, item_id) VALUES (?, ?, ?)");
        for (const [slot, itemId] of Object.entries(p.equipment as Record<string, string | null>)) {
          if (itemId) eqStmt.run(p.id, slot, itemId);
        }
      });
    }
    (tx as (p: PlayerState) => void)(player);
  };
})();

// ---- Clans (persistent) ----

export function dbCreateClan(id: string, name: string, leaderId: string): void {
  db.prepare("INSERT INTO clans (id, name, leader_id, created_at) VALUES (?, ?, ?, ?)").run(id, name, leaderId, Date.now());
  db.prepare("INSERT INTO clan_members (clan_id, player_id) VALUES (?, ?)").run(id, leaderId);
}

export function dbAddClanMember(clanId: string, playerId: string): void {
  db.prepare("INSERT OR IGNORE INTO clan_members (clan_id, player_id) VALUES (?, ?)").run(clanId, playerId);
}

export function dbRemoveClanMember(clanId: string, playerId: string): void {
  db.prepare("DELETE FROM clan_members WHERE clan_id = ? AND player_id = ?").run(clanId, playerId);
}

export function dbDeleteClan(clanId: string): void {
  db.prepare("DELETE FROM clan_members WHERE clan_id = ?").run(clanId);
  db.prepare("DELETE FROM clans WHERE id = ?").run(clanId);
}

export function dbUpdateClanLeader(clanId: string, leaderId: string): void {
  db.prepare("UPDATE clans SET leader_id = ? WHERE id = ?").run(leaderId, clanId);
}

export function dbGetClans(): { id: string; name: string; leader_id: string; memberIds: string[] }[] {
  const clans = db.prepare("SELECT id, name, leader_id FROM clans").all() as any[];
  return clans.map(c => ({
    id: c.id, name: c.name, leader_id: c.leader_id,
    memberIds: (db.prepare("SELECT player_id FROM clan_members WHERE clan_id = ?").all(c.id) as any[]).map(r => r.player_id),
  }));
}

// ---- Reputation ----

export function addReputation(playerId: string, kingdom: string, amount: number): number {
  const cur = (db.prepare("SELECT value FROM reputation WHERE player_id = ? AND kingdom = ?").get(playerId, kingdom) as any)?.value ?? 0;
  const next = cur + amount;
  db.prepare("INSERT OR REPLACE INTO reputation (player_id, kingdom, value) VALUES (?, ?, ?)").run(playerId, kingdom, next);
  return next;
}

export function getReputation(playerId: string): Record<string, number> {
  const rows = db.prepare("SELECT kingdom, value FROM reputation WHERE player_id = ?").all(playerId) as any[];
  const out: Record<string, number> = {};
  for (const r of rows) out[r.kingdom] = r.value;
  return out;
}
