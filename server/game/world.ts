// ============================================================
// Server World State — Holds the WorldMapManager instance
// ============================================================

import { WorldMapManager } from "../../shared/world-map.js";
import { logger } from "../utils/logger.js";

let worldMapManager: WorldMapManager | null = null;
const WORLD_SEED = Number(process.env.WORLD_SEED ?? 42);

export function initWorld(seed: number = WORLD_SEED): WorldMapManager {
  logger.info({ seed }, "🌍 Generating world");
  const start = Date.now();
  worldMapManager = new WorldMapManager(seed, 64, 64);
  logger.info({ duration: Date.now() - start, settlements: worldMapManager.settlements.length, pois: worldMapManager.pois.length, roads: worldMapManager.world.roads.length }, "🌍 World generated");
  return worldMapManager;
}

export function getWorldMap(): WorldMapManager {
  if (!worldMapManager) {
    throw new Error("World not initialized. Call initWorld() first.");
  }
  return worldMapManager;
}

/** Find the best spawn point — the first capital settlement */
export function getSpawnPoint(): { wx: number; wy: number; mapId: string } {
  const wm = getWorldMap();
  const capital = wm.settlements.find(s => s.type === "capital") ?? wm.settlements[0];
  if (capital) {
    const mapId = wm.getSettlementMapId(capital);
    const map = wm.getMap(mapId);
    const spawnX = map?.spawns[0]?.x ?? Math.floor((map?.width ?? 30) / 2);
    const spawnY = map?.spawns[0]?.y ?? Math.floor((map?.height ?? 30) / 2);
    return { wx: spawnX, wy: spawnY, mapId };
  }
  // Fallback: world coordinates near center
  return { wx: 2048, wy: 2048, mapId: "world" };
}

/** Serialize world data for client (excluding heavy tile data) */
export function getWorldDataForClient() {
  const wm = getWorldMap();
  return {
    seed: wm.world.seed,
    width: wm.world.width,
    height: wm.world.height,
    settlements: wm.settlements,
    kingdoms: wm.world.kingdoms,
    pois: wm.pois,
    roads: wm.world.roads.slice(0, 500), // Limit road data for initial send
  };
}
