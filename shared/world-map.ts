// ============================================================
// WorldMapManager — Bridges procedural world with existing GameMap API
// Generates chunks on demand, creates virtual settlement maps,
// and provides seamless movement across the continent.
// ============================================================

import type { GameMap, MapConnection, NPCData } from "./types.js";
import { MapZone } from "./types.js";
import { WorldGenerator, CHUNK_SIZE, WT, type Settlement, type POI, type WorldData } from "./world-gen.js";
import { SeededRandom } from "./noise.js";

// ---- Tile IDs that are walkable in the procedural world ----
const WALKABLE_TILES: Set<number> = new Set([
  WT.beach, WT.sand, WT.grass, WT.darkGrass, WT.flowerGrass,
  WT.plains, WT.forest, WT.denseForest, WT.swamp, WT.tundra,
  WT.savanna, WT.hills, WT.rockyHills, WT.desert, WT.jungle,
  WT.taiga, WT.coral, WT.river, WT.lake,
  WT.dirtRoad, WT.stoneRoad, WT.townFloor, WT.path, WT.bridge,
  WT.cave, WT.ruins, WT.ironDeposit, WT.goldDeposit, WT.crystalDeposit,
]);

const NON_WALKABLE_TILES: Set<number> = new Set([
  WT.deepOcean, WT.ocean, WT.shallowWater, WT.mountain,
  WT.highMountain, WT.snowPeak, WT.wall, WT.lava,
]);

// ---- NPC definitions for procedural settlements ----
const SETTLEMENT_NPC_TEMPLATES = {
  capital: [
    { type: "merchant" as const, nameSuffix: "Herrero", dialogue: ["¡Bienvenido a mi forja!", "Tengo las mejores armas del reino."], shopItems: ["rusty_sword", "iron_sword", "oak_bow", "mage_staff"] },
    { type: "merchant" as const, nameSuffix: "Alquimista", dialogue: ["Mis pociones son las mejores.", "¿Te algo te duele?"], shopItems: ["health_potion", "mana_potion", "bandage"] },
    { type: "merchant" as const, nameSuffix: "Armero", dialogue: ["Protección de calidad aquí.", "No salgas sin armadura."], shopItems: ["leather_armor", "chainmail", "plate_armor"] },
    { type: "banker" as const, nameSuffix: "Banquero", dialogue: ["El banco real guarda tu oro.", "Deposita aquí, es más seguro que cargarlo."] },
    { type: "quest" as const, nameSuffix: "Sabio", dialogue: ["Joven aventurero...", "Las criaturas se han vuelto agresivas.", "Ten cuidado afuera."] },
    { type: "dialog" as const, nameSuffix: "Guardia", dialogue: ["¡No pases sin cuidado!", "Los campos fuera son peligrosos."] },
  ],
  city: [
    { type: "merchant" as const, nameSuffix: "Mercader", dialogue: ["Vendo de todo aquí.", "¿Qué necesitas?"], shopItems: ["rusty_sword", "health_potion", "leather_armor", "iron_ore"] },
    { type: "merchant" as const, nameSuffix: "Curandero", dialogue: ["Cuido a los heridos.", "¿Necesitas una poción?"], shopItems: ["health_potion", "mana_potion", "bandage"] },
    { type: "banker" as const, nameSuffix: "Recaudador", dialogue: ["Sucursal del banco real.", "Guarda tus ganancias conmigo."] },
    { type: "dialog" as const, nameSuffix: "Guardia", dialogue: ["La ciudad es segura.", "Pero afuera cuidado."] },
  ],
  town: [
    { type: "merchant" as const, nameSuffix: "Comerciante", dialogue: ["Pocos productos, pero de calidad.", "¿Te interesa algo?"], shopItems: ["health_potion", "bandage", "iron_ore"] },
    { type: "dialog" as const, nameSuffix: "Anciano", dialogue: ["Esta tierra tiene una larga historia.", "Los bosques están llenos de peligros."] },
  ],
  village: [
    { type: "dialog" as const, nameSuffix: "Aldeano", dialogue: ["Somos una aldea tranquila.", "Ten cuidado si vas al bosque."] },
  ],
};

export class WorldMapManager {
  private generator: WorldGenerator;
  private worldData: WorldData;
  private chunkCache = new Map<string, number[][]>();
  private settlementMaps = new Map<string, GameMap>();
  private settlementByPos = new Map<string, Settlement>();
  private dungeonMaps = new Map<string, GameMap>();
  private poiByPos = new Map<string, POI>();

  constructor(seed: number, worldWidth = 32, worldHeight = 32) {
    this.generator = new WorldGenerator(seed, worldWidth, worldHeight);
    this.worldData = this.generator.generateWorld();
    this.buildSettlementMaps();
    this.buildSettlementLookup();
    this.buildDungeonMaps();
    this.buildPoiLookup();
  }

  // ---- Accessors ----

  get world(): WorldData { return this.worldData; }
  get settlements(): Settlement[] { return this.worldData.settlements; }
  get pois(): POI[] { return this.worldData.pois; }

  // ---- Get tile at world coordinates ----

  getTile(wx: number, wy: number): number {
    const chunk = this.getChunkTiles(wx, wy);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const ly = ((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk[ly][lx];
  }

  isWalkable(wx: number, wy: number): boolean {
    const tile = this.getTile(wx, wy);
    return WALKABLE_TILES.has(tile);
  }

  getBiome(wx: number, wy: number): string {
    return this.generator.classifyBiome(wx, wy);
  }

  getElevation(wx: number, wy: number): number {
    return this.generator.getElevation(wx, wy);
  }

  // ---- Chunk generation (cached) ----

  getChunkTiles(wx: number, wy: number): number[][] {
    const rx = Math.floor(wx / CHUNK_SIZE);
    const ry = Math.floor(wy / CHUNK_SIZE);
    const key = `${rx},${ry}`;
    if (this.chunkCache.has(key)) return this.chunkCache.get(key)!;

    const region = this.generator.generateChunkRegion(rx, ry);
    this.chunkCache.set(key, region.tile);
    return region.tile;
  }

  // ---- Settlement maps (small town zones) ----

  private buildSettlementMaps() {
    for (const settlement of this.worldData.settlements) {
      const size = settlement.type === "capital" ? 30 : settlement.type === "city" ? 24 : settlement.type === "town" ? 18 : 14;
      const mapId = settlement.id;
      const tiles = this.generateSettlementTiles(settlement, size);
      const decorations = this.generateSettlementDecorations(settlement, size);
      const npcs = this.generateSettlementNPCs(settlement, size);

      this.settlementMaps.set(mapId, {
        id: mapId,
        name: settlement.name,
        width: size,
        height: size,
        tileSize: 32,
        zone: MapZone.City,
        tiles,
        decorations,
        spawns: [{ x: Math.floor(size / 2), y: Math.floor(size / 2) }],
        connections: [
          // Exit to world at the same position
          {
            targetMapId: "world",
            targetX: settlement.wx,
            targetY: settlement.wy + 1,
            triggerX: Math.floor(size / 2) - 1,
            triggerY: 0,
            triggerW: 3,
            triggerH: 1,
          },
        ],
        npcs,
      });
    }
  }

  private generateSettlementTiles(settlement: Settlement, size: number): number[][] {
    const n = this.generator;
    const grid: number[][] = Array.from({ length: size }, () =>
      Array(size).fill(WT.grass)
    );

    // Determine biome for the settlement's location
    const baseBiome = this.generator.classifyBiome(settlement.wx, settlement.wy);

    // Choose ground tile based on biome
    const groundTile =
      baseBiome.includes("desert") ? WT.sand :
      baseBiome.includes("jungle") ? WT.darkGrass :
      baseBiome.includes("tundra") ? WT.tundra :
      baseBiome.includes("swamp") ? WT.darkGrass :
      WT.grass;

    // Fill with ground
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        grid[y][x] = groundTile;
      }
    }

    // Wall border
    for (let x = 0; x < size; x++) {
      grid[0][x] = WT.wall;
      grid[size - 1][x] = WT.wall;
    }
    for (let y = 0; y < size; y++) {
      grid[y][0] = WT.wall;
      grid[y][size - 1] = WT.wall;
    }

    // North gate — carve opening matching the exit trigger zone
    const gateMid = Math.floor(size / 2);
    grid[0][gateMid - 1] = WT.path;
    grid[0][gateMid] = WT.path;
    grid[0][gateMid + 1] = WT.path;

    // Main roads (cross pattern)
    const mid = Math.floor(size / 2);
    for (let x = 1; x < size - 1; x++) {
      grid[mid][x] = WT.path;
      grid[mid - 1][x] = WT.path;
      if (mid + 1 < size - 1) grid[mid + 1][x] = WT.path;
    }
    for (let y = 1; y < size - 1; y++) {
      grid[y][mid] = WT.path;
      grid[y][mid - 1] = WT.path;
      if (mid + 1 < size - 1) grid[y][mid + 1] = WT.path;
    }

    // Central square
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const ty = mid + dy, tx = mid + dx;
        if (ty > 0 && ty < size - 1 && tx > 0 && tx < size - 1) {
          grid[ty][tx] = WT.path;
        }
      }
    }

    // Buildings
    const buildingCount = settlement.type === "capital" ? 8 : settlement.type === "city" ? 5 : settlement.type === "town" ? 3 : 2;
    const rng = new SeededRandom(settlement.wx * 31 + settlement.wy * 17);
    for (let b = 0; b < buildingCount; b++) {
      const bw = 4 + Math.floor(rng.next() * 3);
      const bh = 3 + Math.floor(rng.next() * 3);
      const bx = 2 + Math.floor(rng.next() * (size - bw - 4));
      const by = 2 + Math.floor(rng.next() * (size - bh - 4));

      // Only place if far enough from center
      const dcx = Math.abs(bx + bw / 2 - mid);
      const dcy = Math.abs(by + bh / 2 - mid);
      if (dcx < 4 && dcy < 4) continue;

      for (let dy = 0; dy < bh; dy++) {
        for (let dx = 0; dx < bw; dx++) {
          const ty = by + dy, tx = bx + dx;
          if (ty > 0 && ty < size - 1 && tx > 0 && tx < size - 1) {
            grid[ty][tx] = (dy === 0 || dy === bh - 1 || dx === 0 || dx === bw - 1) ? WT.wall : WT.townFloor;
          }
        }
      }
      // Door
      const doorX = bx + Math.floor(bw / 2);
      const doorY = by + bh - 1;
      if (doorY < size - 1 && doorX < size - 1) grid[doorY][doorX] = WT.path;
    }

    // Gate at top
    grid[0][mid] = WT.path;

    return grid;
  }

  private generateSettlementDecorations(_settlement: Settlement, size: number): number[][] {
    return Array.from({ length: size }, () => Array(size).fill(-1));
  }

  private generateSettlementNPCs(settlement: Settlement, size: number): NPCData[] {
    const templates = SETTLEMENT_NPC_TEMPLATES[settlement.type] ?? SETTLEMENT_NPC_TEMPLATES.village;
    const mid = Math.floor(size / 2);
    const npcs: NPCData[] = [];

    templates.forEach((tmpl, i) => {
      const angle = (i / templates.length) * Math.PI * 2;
      const r = 5 + Math.floor(i * 1.5);
      const nx = Math.max(2, Math.min(size - 3, mid + Math.round(Math.cos(angle) * r)));
      const ny = Math.max(2, Math.min(size - 3, mid + Math.round(Math.sin(angle) * r)));

      npcs.push({
        id: `${settlement.id}_npc_${i}`,
        name: `${settlement.name} ${tmpl.nameSuffix}`,
        x: nx,
        y: ny,
        type: tmpl.type,
        dialogue: tmpl.dialogue,
        shopItems: (tmpl as any).shopItems,
      });
    });

    return npcs;
  }

  private buildSettlementLookup() {
    for (const settlement of this.worldData.settlements) {
      this.settlementByPos.set(`${settlement.wx},${settlement.wy}`, settlement);
    }
  }

  private buildPoiLookup() {
    for (const poi of this.worldData.pois) {
      this.poiByPos.set(`${poi.wx},${poi.wy}`, poi);
    }
  }

  private buildDungeonMaps() {
    for (const poi of this.worldData.pois) {
      const size = poi.type === "dungeon" ? 28 : poi.type === "ruins" ? 24 : poi.type === "cave" ? 20 : poi.type === "mine" ? 22 : 18;
      const tiles = this.generateDungeonTiles(poi, size);
      const decorations = Array.from({ length: size }, () => Array(size).fill(-1));
      const zone = poi.type === "dungeon" || poi.type === "cave" ? MapZone.Dungeon : MapZone.Wilderness;

      this.dungeonMaps.set(poi.id, {
        id: poi.id,
        name: poi.name,
        width: size,
        height: size,
        tileSize: 32,
        zone,
        tiles,
        decorations,
        spawns: [{ x: Math.floor(size / 2), y: size - 2 }],
        connections: [
          {
            targetMapId: "world",
            targetX: poi.wx,
            targetY: poi.wy + 1,
            triggerX: Math.floor(size / 2) - 1,
            triggerY: 0,
            triggerW: 3,
            triggerH: 1,
          },
        ],
        npcs: [],
      });
    }
  }

  private generateDungeonTiles(poi: POI, size: number): number[][] {
    const grid: number[][] = Array.from({ length: size }, () => Array(size).fill(WT.cave));
    const rng = new SeededRandom(poi.wx * 71 + poi.wy * 53 + 999);

    // Walls border with north gate
    for (let x = 0; x < size; x++) {
      grid[0][x] = WT.wall;
      grid[size - 1][x] = WT.wall;
    }
    for (let y = 0; y < size; y++) {
      grid[y][0] = WT.wall;
      grid[y][size - 1] = WT.wall;
    }
    const gateMid = Math.floor(size / 2);
    grid[0][gateMid - 1] = WT.path;
    grid[0][gateMid] = WT.path;
    grid[0][gateMid + 1] = WT.path;

    // Carve random rooms/corridors (simple cellular)
    const roomCount = poi.type === "dungeon" ? 6 : poi.type === "cave" ? 4 : 3;
    for (let r = 0; r < roomCount; r++) {
      const rw = 5 + Math.floor(rng.next() * 4);
      const rh = 4 + Math.floor(rng.next() * 4);
      const rx = 2 + Math.floor(rng.next() * (size - rw - 4));
      const ry = 2 + Math.floor(rng.next() * (size - rh - 4));
      for (let dy = 0; dy < rh; dy++) {
        for (let dx = 0; dx < rw; dx++) {
          const tx = rx + dx, ty = ry + dy;
          const isWall = dy === 0 || dy === rh - 1 || dx === 0 || dx === rw - 1;
          grid[ty][tx] = isWall ? WT.wall : (poi.type === "cave" ? WT.cave : poi.type === "ruins" ? WT.ruins : WT.townFloor);
        }
      }
      // door
      const doorX = rx + Math.floor(rw / 2);
      const doorY = ry + rh - 1;
      if (doorY < size - 1) grid[doorY][doorX] = WT.path;
    }

    // Central path cross
    const mid = Math.floor(size / 2);
    for (let x = 1; x < size - 1; x++) {
      if (grid[mid][x] === WT.cave) grid[mid][x] = WT.path;
    }
    for (let y = 1; y < size - 1; y++) {
      if (grid[y][mid] === WT.cave) grid[y][mid] = WT.path;
    }

    // Scatter lava/deposits for mines
    if (poi.type === "mine") {
      for (let i = 0; i < 6; i++) {
        const x = 2 + Math.floor(rng.next() * (size - 4));
        const y = 2 + Math.floor(rng.next() * (size - 4));
        if (grid[y][x] === WT.cave) grid[y][x] = rng.next() > 0.5 ? WT.ironDeposit : WT.goldDeposit;
      }
    }

    return grid;
  }

  /** Get chunk coordinates from world position */
  chunkCoordsAt(wx: number, wy: number): { rx: number; ry: number } {
    return { rx: Math.floor(wx / CHUNK_SIZE), ry: Math.floor(wy / CHUNK_SIZE) };
  }

  /** Check if chunk coords are within world bounds */
  isChunkInBounds(rx: number, ry: number): boolean {
    return rx >= 0 && ry >= 0 && rx < this.worldData.width && ry < this.worldData.height;
  }

  // ---- API compatible with old MAPS usage ----

  /** Get a GameMap for a given map ID */
  getMap(mapId: string): GameMap | undefined {
    // Settlement maps
    if (mapId.startsWith("settlement_")) {
      return this.settlementMaps.get(mapId);
    }
    // Dungeon / POI maps
    if (mapId.startsWith("poi_")) {
      return this.dungeonMaps.get(mapId);
    }
    // World map (virtual — generated on demand)
    if (mapId === "world") {
      return this.getWorldMap();
    }
    return undefined;
  }

  /** POI helpers */
  getPOIAt(wx: number, wy: number): POI | undefined {
    return this.poiByPos.get(`${wx},${wy}`);
  }

  getPOIMapId(poi: POI): string {
    return poi.id;
  }

  /** Check if a tile at world coordinates is walkable */
  canMoveToGlobal(wx: number, wy: number): boolean {
    // Check if entering a settlement
    const settlement = this.settlementByPos.get(`${wx},${wy}`);
    if (settlement) return false; // Must use gate

    return this.isWalkable(wx, wy);
  }

  /** Check if position is at a settlement entrance */
  getSettlementAt(wx: number, wy: number): Settlement | undefined {
    return this.settlementByPos.get(`${wx},${wy}`);
  }

  /** Check if position is a settlement gate */
  getSettlementGate(wx: number, wy: number): Settlement | undefined {
    // Check 4 directions around position
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const s = this.settlementByPos.get(`${wx + dx},${wy + dy}`);
        if (s) return s;
      }
    }
    return undefined;
  }

  /** Get settlement map ID */
  getSettlementMapId(settlement: Settlement): string {
    return settlement.id;
  }

  /** Generate a virtual "world" map (empty tile grid for client reference) */
  private getWorldMap(): GameMap {
    return {
      id: "world",
      name: "Continente de Argentum",
      width: CHUNK_SIZE,
      height: CHUNK_SIZE,
      tileSize: 32,
      zone: MapZone.Wilderness,
      tiles: Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(WT.grass) as number[]),
      decorations: Array.from({ length: CHUNK_SIZE }, () => Array(CHUNK_SIZE).fill(-1) as number[]),
      spawns: [],
      connections: [],
      npcs: [],
    };
  }

  /** Get nearby settlements for a position */
  getNearbySettlements(wx: number, wy: number, radius: number): Settlement[] {
    return this.worldData.settlements.filter(s => {
      const dx = s.wx - wx;
      const dy = s.wy - wy;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    });
  }

  /** Get kingdom at position */
  getKingdomAt(wx: number, wy: number): string | null {
    return this.generator.getKingdomAt(wx, wy, this.worldData.settlements);
  }

  /** Get biome color for rendering */
  getBiomeColor(wx: number, wy: number): number {
    const tile = this.getTile(wx, wy);
    return TILE_COLOR_MAP[tile] ?? 0x2d5a1e;
  }
}

// ---- Tile → Color mapping for rendering ----

const TILE_COLOR_MAP: Record<number, number> = {
  [WT.deepOcean]: 0x0a1a3a,
  [WT.ocean]: 0x1a3a6a,
  [WT.shallowWater]: 0x2a5a8a,
  [WT.beach]: 0xd4b865,
  [WT.sand]: 0xc2a645,
  [WT.grass]: 0x2d5a1e,
  [WT.darkGrass]: 0x1f4a15,
  [WT.flowerGrass]: 0x3a7a2a,
  [WT.plains]: 0x4a8a3a,
  [WT.forest]: 0x1a3a0e,
  [WT.denseForest]: 0x0e2a08,
  [WT.swamp]: 0x2a3a1a,
  [WT.tundra]: 0x8a9aaa,
  [WT.savanna]: 0x8a9a3a,
  [WT.hills]: 0x5a6a4a,
  [WT.rockyHills]: 0x6a5a4a,
  [WT.mountain]: 0x5a5a5a,
  [WT.highMountain]: 0x7a7a7a,
  [WT.snowPeak]: 0xeeeeff,
  [WT.desert]: 0xd4aa45,
  [WT.jungle]: 0x0e4a0e,
  [WT.taiga]: 0x2a4a3a,
  [WT.coral]: 0xffaa88,
  [WT.river]: 0x2a6aaa,
  [WT.lake]: 0x1a5a8a,
  [WT.dirtRoad]: 0x8a7050,
  [WT.stoneRoad]: 0x7a7a6a,
  [WT.townFloor]: 0x6b5b4a,
  [WT.wall]: 0x3a3a3a,
  [WT.path]: 0x8b7355,
  [WT.bridge]: 0x8b6914,
  [WT.cave]: 0x2a1a1a,
  [WT.ruins]: 0x4a4a4a,
  [WT.lava]: 0xcc3300,
  [WT.ironDeposit]: 0x8a7a6a,
  [WT.goldDeposit]: 0xd4aa20,
  [WT.crystalDeposit]: 0x88aacc,
};

export let worldMap: WorldMapManager | null = null;

export function initWorld(seed: number): WorldMapManager {
  worldMap = new WorldMapManager(seed);
  return worldMap;
}
