import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";
import type { PlayerState, InventoryItem, Equipment } from "../../shared/types.js";
import { Direction } from "../../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "../../game.db");

let db: Database.Database;

export function initDB() {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      character_class TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      experience INTEGER DEFAULT 0,
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
  `);
}

export function registerPlayer(username: string, password: string, characterClass: string): string {
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 8);

  const stats: Record<string, { str: number; dex: number; int: number; con: number; hp: number; mp: number }> = {
    warrior: { str: 8, dex: 4, int: 2, con: 8, hp: 120, mp: 30 },
    mage: { str: 3, dex: 4, int: 10, con: 4, hp: 70, mp: 100 },
    archer: { str: 5, dex: 10, int: 3, con: 5, hp: 90, mp: 40 },
    paladin: { str: 7, dex: 4, int: 5, con: 7, hp: 110, mp: 60 },
  };

  const s = stats[characterClass] || stats.warrior;

  db.prepare(`
    INSERT INTO players (id, username, password_hash, character_class, strength, dexterity, intelligence, constitution, max_hp, max_mp, gold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 100)
  `).run(id, username, hash, characterClass, s.str, s.dex, s.int, s.con, s.hp, s.mp);

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
    SELECT id, username, character_class, level, experience, gold, x, y, map_id,
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

  return {
    id: row.id,
    username: row.username,
    characterClass: row.character_class,
    level: row.level,
    experience: row.experience,
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
  };
}

export function savePlayer(player: PlayerState) {
  db.prepare(`
    UPDATE players SET level = ?, experience = ?, gold = ?, x = ?, y = ?, map_id = ?,
      strength = ?, dexterity = ?, intelligence = ?, constitution = ?,
      max_hp = ?, max_mp = ?
    WHERE id = ?
  `).run(
    player.level, player.experience, player.gold, player.x, player.y, player.mapId,
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
