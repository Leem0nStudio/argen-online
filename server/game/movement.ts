// ============================================================
// Movement — Player movement, collision, teleportation
// ============================================================

import type { Direction } from "../../shared/types.js";
import { MAPS } from "../../shared/maps.js";
import { Players, SpawnState } from "./state.js";
import { spawnMonstersForMap } from "./monster-ai.js";

export function canMoveTo(mapId: string, x: number, y: number): boolean {
  const map = MAPS[mapId];
  if (!map) return false;
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return false;
  const tile = map.tiles[y]?.[x];
  if (tile === undefined) return false;
  if (tile === 2 || tile === 3 || tile === 7 || tile === 9) return false;
  return true;
}

export function movePlayer(id: string, x: number, y: number, direction: Direction) {
  const player = Players.get(id);
  if (!player || Players.isDead(id)) return null;
  if (!canMoveTo(player.mapId, x, y)) return null;

  // Check map connections for teleportation
  for (const conn of MAPS[player.mapId]?.connections ?? []) {
    if (x >= conn.triggerX && x < conn.triggerX + conn.triggerW &&
        y >= conn.triggerY && y < conn.triggerY + conn.triggerH) {
      player.mapId = conn.targetMapId;
      player.x = conn.targetX;
      player.y = conn.targetY;
      player.direction = direction;

      // Ensure monsters are spawned on the new map
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
  player.mapId = "rucci";
  player.x = 12;
  player.y = 12;
  player.gold = Math.max(0, player.gold - 50);
  player.buffs = [];
}
