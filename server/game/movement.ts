// ============================================================
// Movement — Player movement, collision, teleportation
// Supports both legacy handcrafted maps AND procedural world
// ============================================================

import type { Direction } from "../../shared/types.js";
import { RESPAWN_GOLD_COST } from "../../shared/constants.js";
import { MAPS, T } from "../../shared/maps.js";
import { WT } from "../../shared/world-gen.js";
import { Players, SpawnState } from "./state.js";
import { spawnMonstersForMap } from "./monster-ai.js";
import { getWorldMap } from "./world.js";

const SETTLEMENT_BLOCKED = new Set<number>([
  WT.wall, WT.lava,
  WT.deepOcean, WT.ocean,
  WT.mountain, WT.highMountain, WT.snowPeak,
]);

export function canMoveTo(mapId: string, x: number, y: number): boolean {
  // ---- Procedural world ----
  if (mapId === "world") {
    const wm = getWorldMap();
    return wm.isWalkable(x, y);
  }

  // ---- Procedural settlement / dungeon maps ----
  if (mapId.startsWith("settlement_") || mapId.startsWith("poi_")) {
    const map = getWorldMap().getMap(mapId);
    if (!map) return false;
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false;
    const tile = map.tiles[y]?.[x];
    if (tile === undefined) return false;
    return !SETTLEMENT_BLOCKED.has(tile);
  }

  // ---- Legacy handcrafted maps ----
  const map = MAPS[mapId];
  if (!map) return false;
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false;
  const tile = map.tiles[y]?.[x];
  if (tile === undefined) return false;
  if (tile === T.water || tile === T.wall || tile === T.tree || tile === T.lava || tile === T.deadTree || tile === T.thorn) return false;
  return true;
}

export function movePlayer(id: string, x: number, y: number, direction: Direction) {
  const player = Players.get(id);
  if (!player || Players.isDead(id)) return null;
  if (!canMoveTo(player.mapId, x, y)) return null;

  // ---- Procedural world: check for settlement / POI entrance ----
  if (player.mapId === "world") {
    const wm = getWorldMap();
    const settlement = wm.getSettlementAt(x, y);
    if (settlement) {
      const targetMapId = wm.getSettlementMapId(settlement);
      const map = wm.getMap(targetMapId);
      const spawnX = map?.spawns[0]?.x ?? Math.floor((map?.width ?? 30) / 2);
      const spawnY = map?.spawns[0]?.y ?? Math.floor((map?.height ?? 30) / 2);
      player.mapId = targetMapId;
      player.x = spawnX;
      player.y = spawnY;
      player.direction = direction;

      if (!SpawnState.hasSpawned(targetMapId)) {
        spawnMonstersForMap(targetMapId);
        SpawnState.markSpawned(targetMapId);
      }

      return { teleported: true, mapId: targetMapId, x: spawnX, y: spawnY };
    }
    const poi = wm.getPOIAt(x, y);
    if (poi) {
      const targetMapId = wm.getPOIMapId(poi);
      const map = wm.getMap(targetMapId);
      const spawnX = map?.spawns[0]?.x ?? Math.floor((map?.width ?? 24) / 2);
      const spawnY = map?.spawns[0]?.y ?? Math.floor((map?.height ?? 24) / 2);
      player.mapId = targetMapId;
      player.x = spawnX;
      player.y = spawnY;
      player.direction = direction;

      if (!SpawnState.hasSpawned(targetMapId)) {
        spawnMonstersForMap(targetMapId);
        SpawnState.markSpawned(targetMapId);
      }

      return { teleported: true, mapId: targetMapId, x: spawnX, y: spawnY };
    }
  }

  // ---- Settlement / dungeon map: check for exit to world ----
  if (player.mapId.startsWith("settlement_") || player.mapId.startsWith("poi_")) {
    const wm = getWorldMap();
    const map = MAPS[player.mapId] ?? wm.getMap(player.mapId);
    if (map) {
      for (const conn of map.connections ?? []) {
        if (conn.targetMapId === "world" &&
            x >= conn.triggerX && x < conn.triggerX + conn.triggerW &&
            y >= conn.triggerY && y < conn.triggerY + conn.triggerH) {
          player.mapId = "world";
          player.x = conn.targetX;
          player.y = conn.targetY;
          player.direction = direction;
          return { teleported: true, mapId: "world", x: conn.targetX, y: conn.targetY };
        }
      }
    }
  }

  // ---- Legacy map connections ----
  for (const conn of MAPS[player.mapId]?.connections ?? []) {
    if (x >= conn.triggerX && x < conn.triggerX + conn.triggerW &&
        y >= conn.triggerY && y < conn.triggerY + conn.triggerH) {
      player.mapId = conn.targetMapId;
      player.x = conn.targetX;
      player.y = conn.targetY;
      player.direction = direction;

      if (!SpawnState.hasSpawned(conn.targetMapId)) {
        spawnMonstersForMap(conn.targetMapId);
        SpawnState.markSpawned(conn.targetMapId);
      }

      return { teleported: true, mapId: conn.targetMapId, x: conn.targetX, y: conn.targetY };
    }
  }

  player.x = x;
  player.y = y;
  player.direction = direction;
  player.isMoving = true;
  return { teleported: false };
}

export function stopPlayer(id: string, x: number, y: number, direction: Direction) {
  const player = Players.get(id);
  if (!player) return;
  player.x = x;
  player.y = y;
  player.direction = direction;
  player.isMoving = false;
}

export function respawnPlayer(id: string) {
  const player = Players.get(id);
  if (!player) return;
  Players.clearDead(id);
  player.stats.hp = player.stats.maxHp;
  player.stats.mp = player.stats.maxMp;

  // Respawn in the procedural world
  try {
    const wm = getWorldMap();
    const capital = wm.settlements.find(s => s.type === "capital") ?? wm.settlements[0];
    if (capital) {
      const targetMapId = wm.getSettlementMapId(capital);
      const map = wm.getMap(targetMapId);
      player.mapId = targetMapId;
      player.x = map?.spawns[0]?.x ?? 15;
      player.y = map?.spawns[0]?.y ?? 15;
    } else {
      player.mapId = "world";
      player.x = 2048;
      player.y = 2048;
    }
  } catch {
    // Fallback to legacy spawn
    player.mapId = "rucci";
    player.x = 15;
    player.y = 15;
  }

  player.gold = Math.max(0, player.gold - RESPAWN_GOLD_COST);
  player.buffs = [];
}
