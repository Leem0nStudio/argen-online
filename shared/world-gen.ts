// ============================================================
// World Generator — 9-layer procedural pipeline
// Seed → Tectonics → Continents → Hydrology → Climate →
// Biomes → Local Relief → Civilization → Roads → World Graph
// ============================================================

import { createNoise, type NoiseGen } from "./noise.js";

// ---- Tile IDs for the procedural world ----
export const WT = {
  // Ocean
  deepOcean: 0,
  ocean: 1,
  shallowWater: 2,
  beach: 3,

  // Low elevation
  sand: 4,
  grass: 5,
  darkGrass: 6,
  flowerGrass: 7,
  plains: 8,

  // Medium elevation
  forest: 9,
  denseForest: 10,
  swamp: 11,
  tundra: 12,
  savanna: 13,

  // Hills
  hills: 14,
  rockyHills: 15,

  // Mountains
  mountain: 16,
  highMountain: 17,
  snowPeak: 18,

  // Special biomes
  desert: 19,
  jungle: 20,
  taiga: 21,
  coral: 22,

  // Water features
  river: 23,
  lake: 24,

  // Roads
  dirtRoad: 25,
  stoneRoad: 26,

  // Settlements
  townFloor: 27,
  wall: 28,
  path: 29,
  bridge: 30,

  // Dungeon / special
  cave: 31,
  ruins: 32,
  lava: 33,

  // Minerals
  ironDeposit: 34,
  goldDeposit: 35,
  crystalDeposit: 36,
} as const;

export type WorldTile = typeof WT[keyof typeof WT];

// ---- Height classification ----
export const ELEVATION = {
  DEEP_OCEAN: -0.35,
  OCEAN: -0.15,
  SHALLOW: -0.05,
  BEACH: 0.02,
  LOWLAND: 0.20,
  MIDLAND: 0.45,
  HILLS: 0.60,
  MOUNTAIN: 0.72,
  HIGH_MOUNTAIN: 0.85,
  PEAK: 0.95,
} as const;

// ---- Biome thresholds ----
export const BIOME_THRESHOLDS = {
  DESERT_HUMIDITY: 0.25,
  SAVANNA_HUMIDITY: 0.40,
  GRASSLAND_HUMIDITY: 0.55,
  FOREST_HUMIDITY: 0.70,
  JUNGLE_HUMIDITY: 0.85,
  TUNDRA_TEMP: -0.3,
  TAIGA_TEMP: -0.1,
  TEMPERATE_TEMP: 0.2,
  WARM_TEMP: 0.5,
  HOT_TEMP: 0.7,
} as const;

// ---- World coordinates ----
export interface WorldPos {
  wx: number;
  wy: number;
}

// ---- Region for a chunk ----
export interface ChunkRegion {
  tiles: number[][];
  decorations: number[][];
  biomeMap: string[][];
  elevationMap: number[][];
}

// ---- Settlement ----
export interface Settlement {
  id: string;
  name: string;
  wx: number;
  wy: number;
  type: "capital" | "city" | "town" | "village";
  kingdom: string;
  population: number;
  radius: number;
}

// ---- Kingdom ----
export interface Kingdom {
  id: string;
  name: string;
  capitalId: string;
  color: number;
}

// ---- POI (Point of Interest) ----
export interface POI {
  id: string;
  type: "dungeon" | "ruins" | "mine" | "shrine" | "cave";
  name: string;
  wx: number;
  wy: number;
}

// ---- Road ----
export interface RoadSegment {
  wx: number;
  wy: number;
  fromSettlement: string;
  toSettlement: string;
}

// ---- Full World Data ----
export interface WorldData {
  seed: number;
  width: number;
  height: number;
  regions: RegionData[];
  settlements: Settlement[];
  kingdoms: Kingdom[];
  pois: POI[];
  roads: RoadSegment[];
}

export interface RegionData {
  rx: number;
  ry: number;
  /** Elevation for each tile within the region (chunk_size × chunk_size) */
  elevation: number[][];
  temperature: number[][];
  rainfall: number[][];
  biome: string[][];
  tile: number[][];
}

// ---- Chunk size for world generation ----
export const CHUNK_SIZE = 64;

// ============================================================
// World Generator Class
// ============================================================

export class WorldGenerator {
  private noise: NoiseGen;
  private seed: number;
  private worldWidth: number;
  private worldHeight: number;
  // Cache elevation in a flat lookup (generated on demand per chunk)
  private elevationCache = new Map<string, number[][]>();
  private temperatureCache = new Map<string, number[][]>();
  private rainfallCache = new Map<string, number[][]>();

  constructor(seed: number, worldWidth = 32, worldHeight = 32) {
    this.seed = seed;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.noise = createNoise(seed);
  }

  // ---- PHASE 1: Elevation ----

  getElevation(wx: number, wy: number): number {
    const rx = Math.floor(wx / CHUNK_SIZE);
    const ry = Math.floor(wy / CHUNK_SIZE);
    return this.getElevationChunk(rx, ry)[((wy % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE][((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE];
  }

  getElevationChunk(rx: number, ry: number): number[][] {
    const key = `${rx},${ry}`;
    if (this.elevationCache.has(key)) return this.elevationCache.get(key)!;

    const elev: number[][] = [];
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      elev[ly] = [];
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = rx * CHUNK_SIZE + lx;
        const wy = ry * CHUNK_SIZE + ly;
        elev[ly][lx] = this.computeElevation(wx, wy);
      }
    }
    this.elevationCache.set(key, elev);
    return elev;
  }

  private computeElevation(wx: number, wy: number): number {
    const n = this.noise;

    // 1. Continental macro — warped fbm + multi-island mask
    const [warpX, warpY] = n.warp(wx, wy, 80, 0.0008);
    const continental = n.fbm(warpX, warpY, {
      octaves: 4,
      frequency: 0.0007,
      lacunarity: 2.0,
      gain: 0.5,
    });
    // Island chain fbm (low freq) to create archipelago beyond central mass
    const islandField = n.fbm(wx, wy, { octaves: 2, frequency: 0.0004, gain: 0.6 });
    const islandMask = (islandField + 1) / 2; // 0..1

    // 2. Tectonic plates — voronoi 192 + edge ridge
    const plate = n.voronoi(wx, wy, 192);
    const edgeDist = plate.distance2 - plate.distance; // 0 at boundary
    const plateRidge = Math.exp(-edgeDist / 18) * 0.55; // mountain chains on boundaries
    const plateWarp = n.simple(wx, wy, 0.008) * 0.08;

    // 3. Ridged noise for sub-ridges inside plates
    const ridge = n.ridged(wx + plateWarp * 100, wy + plateWarp * 100, {
      octaves: 3,
      frequency: 0.003,
      lacunarity: 2.2,
      gain: 0.55,
    });

    // 4. Fine detail + geological voronoi texture
    const detail = n.fbm(wx, wy, {
      octaves: 3,
      frequency: 0.012,
      lacunarity: 2.0,
      gain: 0.4,
    });
    const vor = n.voronoi(wx, wy, 256);
    const voronoiFactor = vor.distance / 128;

    // Combine with tectonic bias
    let elevation =
      continental * 0.42 +
      islandMask * 0.10 +
      plateRidge * 0.22 +
      ridge * 0.13 +
      detail * 0.08 +
      voronoiFactor * 0.05;

    // Continental radial mask + island integration (multi-continental)
    const worldCx = this.worldWidth * CHUNK_SIZE / 2;
    const worldCy = this.worldHeight * CHUNK_SIZE / 2;
    const maxRadius = Math.min(worldCx, worldCy) * 0.88;
    const dx = (wx - worldCx) / maxRadius;
    const dy = (wy - worldCy) / maxRadius;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    const radial = distFromCenter < 0.55 ? 1.0 : distFromCenter > 1.15 ? 0.0 : 1.0 - (distFromCenter - 0.55) / 0.60;
    // Blend radial with islandMask to allow satellite islands far from center
    const mask = Math.max(radial, islandMask * 0.35 * radial + (1 - radial) * 0.15);
    elevation = elevation * (0.65 + mask * 0.35);

    return Math.max(-1, Math.min(1, elevation));
  }

  // ---- PHASE 2: Temperature ----

  getTemperature(wx: number, wy: number): number {
    const rx = Math.floor(wx / CHUNK_SIZE);
    const ry = Math.floor(wy / CHUNK_SIZE);
    const chunk = this.getTemperatureChunk(rx, ry);
    return chunk[wy & (CHUNK_SIZE - 1)][wx & (CHUNK_SIZE - 1)];
  }

  private getTemperatureChunk(rx: number, ry: number): number[][] {
    const key = `${rx},${ry}`;
    if (this.temperatureCache.has(key)) return this.temperatureCache.get(key)!;

    const temp: number[][] = [];
    const n = this.noise;
    const totalW = this.worldWidth * CHUNK_SIZE;
    const totalH = this.worldHeight * CHUNK_SIZE;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      temp[ly] = [];
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = rx * CHUNK_SIZE + lx;
        const wy = ry * CHUNK_SIZE + ly;

        // Latitude factor: warmer at equator (middle), colder at poles
        const latitude = (wy / totalH - 0.5) * 2; // [-1, 1]
        const latTemp = 1.0 - Math.abs(latitude) * 0.8;

        // Altitude penalty
        const elev = this.getElevationChunk(rx, ry)[ly][lx];
        const altPenalty = elev > 0.3 ? (elev - 0.3) * 1.5 : 0;

        // Noise variation
        const variation = n.fbm(wx, wy, {
          octaves: 3,
          frequency: 0.002,
          gain: 0.4,
        }) * 0.2;

        temp[ly][lx] = Math.max(-1, Math.min(1, latTemp - altPenalty + variation));
      }
    }
    this.temperatureCache.set(key, temp);
    return temp;
  }

  // ---- PHASE 3: Rainfall ----

  getRainfall(wx: number, wy: number): number {
    const rx = Math.floor(wx / CHUNK_SIZE);
    const ry = Math.floor(wy / CHUNK_SIZE);
    const chunk = this.getRainfallChunk(rx, ry);
    return chunk[wy & (CHUNK_SIZE - 1)][wx & (CHUNK_SIZE - 1)];
  }

  private getRainfallChunk(rx: number, ry: number): number[][] {
    const key = `${rx},${ry}`;
    if (this.rainfallCache.has(key)) return this.rainfallCache.get(key)!;

    const rain: number[][] = [];
    const n = this.noise;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      rain[ly] = [];
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = rx * CHUNK_SIZE + lx;
        const wy = ry * CHUNK_SIZE + ly;

        // Base rainfall from noise
        const baseRain = (n.fbm(wx, wy, {
          octaves: 4,
          frequency: 0.0015,
          gain: 0.5,
        }) + 1) / 2; // [0, 1]

        // Wind: moisture from one direction (east)
        const windFactor = (n.fbm(wx * 0.5, wy * 0.3, {
          octaves: 2,
          frequency: 0.001,
          gain: 0.5,
        }) + 1) / 2;

        // Rain shadow: mountains block rain
        const elev = this.getElevationChunk(rx, ry)[ly][lx];
        const isMountain = elev > ELEVATION.MOUNTAIN;
        const rainShadow = isMountain ? 0.3 : 1.0;

        // Combine
        const rainfall = baseRain * 0.6 + windFactor * 0.4;
        rain[ly][lx] = Math.max(0, Math.min(1, rainfall * rainShadow));
      }
    }
    this.rainfallCache.set(key, rain);
    return rain;
  }

  // ---- PHASE 4: Biome Classification ----

  classifyBiome(wx: number, wy: number): string {
    const elev = this.getElevation(wx, wy);
    const temp = this.getTemperature(wx, wy);
    const rain = this.getRainfall(wx, wy);
    const B = BIOME_THRESHOLDS;

    // Ocean early out
    if (elev < ELEVATION.SHALLOW) return "deep_ocean";
    if (elev < ELEVATION.BEACH) return "ocean";
    if (elev < ELEVATION.BEACH + 0.02) return "beach";

    // Mountains dominate regardless of climate
    if (elev > ELEVATION.PEAK) return "snow_peak";
    if (elev > ELEVATION.HIGH_MOUNTAIN) return "high_mountain";
    if (elev > ELEVATION.MOUNTAIN) return "mountain";
    if (elev > ELEVATION.HILLS && rain < 0.25) return "rocky_hills";

    // New: Wetland — high rain + temperate + low elev
    if (rain > 0.78 && temp > -0.05 && temp < 0.35 && elev > ELEVATION.BEACH && elev < ELEVATION.LOWLAND) return "wetland";
    // New: Boreal forest — cold humid + mid elev
    if (temp > B.TUNDRA_TEMP && temp < B.TAIGA_TEMP + 0.05 && rain > 0.45 && rain < 0.75 && elev < ELEVATION.HILLS) return "boreal_forest";
    // New: Cold desert — cold dry
    if (temp < B.TAIGA_TEMP && rain < 0.28) return "cold_desert";

    // Tundra
    if (temp < B.TUNDRA_TEMP) {
      if (elev > ELEVATION.HILLS) return "snow_peak";
      return "tundra";
    }
    // Taiga
    if (temp < B.TAIGA_TEMP) {
      if (rain > 0.5) return "taiga";
      return "tundra";
    }
    // Hot zones
    if (temp > B.HOT_TEMP) {
      if (rain > 0.6) return "jungle";
      if (rain > B.SAVANNA_HUMIDITY) return "savanna";
      return "desert";
    }
    // Warm zones
    if (temp > B.WARM_TEMP) {
      if (rain > 0.7) return "jungle";
      if (rain > B.FOREST_HUMIDITY) return "forest";
      if (rain > B.GRASSLAND_HUMIDITY) return "savanna";
      return "desert";
    }
    // Temperate zones with wetland/boreal already handled
    if (temp > B.TEMPERATE_TEMP) {
      if (elev > ELEVATION.HILLS) return "hills";
      if (rain > B.JUNGLE_HUMIDITY) return "dense_forest";
      if (rain > B.FOREST_HUMIDITY) return "forest";
      if (rain > B.GRASSLAND_HUMIDITY) return "grassland";
      if (rain > B.SAVANNA_HUMIDITY) return "plains";
      return "drylands";
    }
    // Cool zones
    if (rain > 0.6) return "forest";
    if (rain > 0.4) return "grassland";
    return "tundra";
  }

  // ---- PHASE 5: Tile Classification ----

  classifyTile(wx: number, wy: number): number {
    const biome = this.classifyBiome(wx, wy);
    const elev = this.getElevation(wx, wy);
    const n = this.noise;
    const variation = (n.simple(wx, wy, 0.05) + 1) / 2; // [0,1]

    // Check for rivers (done separately in hydrology)
    // For now, classify by biome + elevation

    // Local relief: slope via elevation gradient (cheap central diff)
    const slope = Math.abs(this.getElevation(wx + 1, wy) - this.getElevation(wx - 1, wy)) +
                  Math.abs(this.getElevation(wx, wy + 1) - this.getElevation(wx, wy - 1));

    switch (biome) {
      case "deep_ocean": return WT.deepOcean;
      case "ocean": return WT.ocean;
      case "beach": return slope > 0.08 ? WT.sand : WT.beach;
      case "tundra": return variation > 0.55 ? WT.tundra : WT.savanna;
      case "taiga": return variation > 0.6 ? WT.taiga : WT.tundra;
      case "boreal_forest": return variation > 0.5 ? WT.forest : WT.taiga;
      case "cold_desert": return variation > 0.6 ? WT.desert : WT.sand;
      case "wetland": return variation > 0.5 ? WT.swamp : WT.darkGrass;
      case "desert": return variation > 0.65 ? WT.desert : WT.sand;
      case "savanna": return variation > 0.7 ? WT.savanna : WT.plains;
      case "jungle": return slope > 0.06 ? WT.denseForest : WT.jungle;
      case "dense_forest": return WT.denseForest;
      case "forest": return variation > 0.5 ? WT.forest : WT.darkGrass;
      case "grassland": return variation > 0.6 ? WT.flowerGrass : WT.grass;
      case "plains": return slope > 0.07 ? WT.hills : WT.plains;
      case "drylands": return variation > 0.5 ? WT.sand : WT.grass;
      case "hills": return slope > 0.09 ? WT.rockyHills : WT.hills;
      case "rocky_hills": return variation > 0.5 ? WT.rockyHills : WT.hills;
      case "mountain": return WT.mountain;
      case "high_mountain": return WT.highMountain;
      case "snow_peak": return WT.snowPeak;
      default: return WT.grass;
    }
  }

  // ---- Rivers (Flow Accumulation) ----

  computeRiverMap(rx: number, ry: number): boolean[][] {
    const elev = this.getElevationChunk(rx, ry);
    const chunk = Array.from({ length: CHUNK_SIZE }, () =>
      Array(CHUNK_SIZE).fill(false)
    );

    // Flow accumulation: each cell flows to its lowest neighbor
    // We only compute river paths where accumulation is high enough
    const accumulation = Array.from({ length: CHUNK_SIZE }, () =>
      Array(CHUNK_SIZE).fill(0)
    );

    // Initialize with 1 per cell
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        accumulation[ly][lx] = 1;
      }
    }

    // Simple flow: for each cell, add its accumulation to its lowest neighbor
    // Process in elevation order (highest first)
    const cells: { lx: number; ly: number; e: number }[] = [];
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        cells.push({ lx, ly, e: elev[ly][lx] });
      }
    }
    cells.sort((a, b) => b.e - a.e);

    for (const cell of cells) {
      const { lx, ly } = cell;
      let lowestLx = lx;
      let lowestLy = ly;
      let lowestE = elev[ly][lx];

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = lx + dx;
          const ny = ly + dy;
          if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_SIZE) continue;
          if (elev[ny][nx] < lowestE) {
            lowestE = elev[ny][nx];
            lowestLx = nx;
            lowestLy = ny;
          }
        }
      }

      // If flow goes to a neighbor
      if (lowestLx !== lx || lowestLy !== ly) {
        accumulation[lowestLy][lowestLx] += accumulation[ly][lx];
      }
    }

    // Mark cells with high accumulation as rivers
    const riverThreshold = CHUNK_SIZE * 2;
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        if (accumulation[ly][lx] > riverThreshold && elev[ly][lx] > ELEVATION.BEACH) {
          chunk[ly][lx] = true;
        }
      }
    }

    return chunk;
  }

  // ---- PHASE 6: Civilization Scoring ----

  scoreSettlement(wx: number, wy: number): number {
    const elev = this.getElevation(wx, wy);
    const temp = this.getTemperature(wx, wy);
    const rain = this.getRainfall(wx, wy);
    const biome = this.classifyBiome(wx, wy);

    // Penalize ocean/mountains
    if (elev < ELEVATION.BEACH) return -1;
    if (elev > ELEVATION.MOUNTAIN) return -1;

    let score = 0;

    // Water access (not in ocean, near moderate elevation)
    if (elev > ELEVATION.BEACH && elev < ELEVATION.HILLS) score += 0.3;

    // Temperature: temperate is best
    const tempScore = 1.0 - Math.abs(temp - 0.3) * 1.5;
    score += tempScore * 0.3;

    // Rainfall: moderate is best
    if (rain > 0.3 && rain < 0.8) score += 0.2;

    // Biome preference
    const goodBiomes = ["forest", "grassland", "plains", "savanna"];
    if (goodBiomes.includes(biome)) score += 0.2;

    return score;
  }

  generateSettlements(): Settlement[] {
    const settlements: Settlement[] = [];
    const n = this.noise;
    const totalW = this.worldWidth * CHUNK_SIZE;
    const totalH = this.worldHeight * CHUNK_SIZE;

    // Sample settlement candidates at regular intervals
    const gridSize = 48; // Every 48 tiles
    const candidates: { wx: number; wy: number; score: number }[] = [];

    for (let wy = 4; wy < totalH - 4; wy += gridSize) {
      for (let wx = 4; wx < totalW - 4; wx += gridSize) {
        // Jitter position
        const jx = wx + Math.floor(n.random.range(-8, 8));
        const jy = wy + Math.floor(n.random.range(-8, 8));
        const score = this.scoreSettlement(jx, jy);
        if (score > 0.3) {
          candidates.push({ wx: jx, wy: jy, score });
        }
      }
    }

    // Sort by score, pick top N
    candidates.sort((a, b) => b.score - a.score);
    const kingdomNames = [
      "Valdris", "Aethon", "Koranth", "Sylvanis", "Drakenmoor",
      "Thornwall", "Elaria", "Khaz'rok", "Rucci", "Nocturne",
    ];
    const settlementNames = [
      "Rucci", "Valdris", "Thornwall", "Koranth", "Elaria",
      "Aethon", "Sylvanis", "Drakenmoor", "Khaz'rok", "Nocturne",
      "Mistwood", "Ironhold", "Goldhaven", "Shadowmere", "Brightlake",
      "Stonebridge", "Windrest", "Darkhollow", "Sunhaven", "Frostkeep",
    ];

    let nameIdx = 0;
    let kingdomIdx = 0;
    const maxSettlements = Math.min(candidates.length, 12);
    const minDist = 60; // Minimum distance between settlements

    for (const cand of candidates) {
      if (settlements.length >= maxSettlements) break;

      // Check minimum distance from existing settlements
      const tooClose = settlements.some(s => {
        const dx = s.wx - cand.wx;
        const dy = s.wy - cand.wy;
        return Math.sqrt(dx * dx + dy * dy) < minDist;
      });
      if (tooClose) continue;

      const isCapital = settlements.length === 0 || (settlements.length > 0 && cand.score > 0.65 && settlements.filter(s => s.type === "capital").length < 3);
      const type = isCapital ? "capital" : cand.score > 0.55 ? "city" : cand.score > 0.45 ? "town" : "village";

      const kingdom = kingdomNames[kingdomIdx % kingdomNames.length];
      if (type === "capital") kingdomIdx++;

      settlements.push({
        id: `settlement_${settlements.length}`,
        name: settlementNames[nameIdx % settlementNames.length],
        wx: cand.wx,
        wy: cand.wy,
        type,
        kingdom,
        population: type === "capital" ? 500 : type === "city" ? 200 : type === "town" ? 80 : 20,
        radius: type === "capital" ? 6 : type === "city" ? 4 : type === "town" ? 3 : 2,
      });
      nameIdx++;
    }

    return settlements;
  }

  // ---- PHASE 7: Kingdoms (Voronoi partition) ----

  generateKingdoms(settlements: Settlement[]): Kingdom[] {
    const capitals = settlements.filter(s => s.type === "capital");
    if (capitals.length === 0) return [];

    const kingdomColors = [
      0xcc3333, 0x3366cc, 0x33aa33, 0xccaa33,
      0x9933cc, 0x33cccc, 0xcc6633, 0x666699,
    ];

    return capitals.map((c, i) => ({
      id: `kingdom_${i}`,
      name: c.kingdom,
      capitalId: c.id,
      color: kingdomColors[i % kingdomColors.length],
    }));
  }

  // Get kingdom at position
  getKingdomAt(wx: number, wy: number, settlements: Settlement[]): string | null {
    let nearest: Settlement | null = null;
    let nearestDist = Infinity;

    for (const s of settlements) {
      if (s.type !== "capital" && s.type !== "city") continue;
      const dx = s.wx - wx;
      const dy = s.wy - wy;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = s;
      }
    }

    return nearest?.kingdom ?? null;
  }

  // ---- PHASE 8: Roads (A* pathfinding on cost grid) ----

  getMoveCost(wx: number, wy: number): number {
    const elev = this.getElevation(wx, wy);
    const biome = this.classifyBiome(wx, wy);

    if (elev < ELEVATION.BEACH) return Infinity; // Water
    if (elev > ELEVATION.HIGH_MOUNTAIN) return 50; // Very hard
    if (elev > ELEVATION.MOUNTAIN) return 20;

    switch (biome) {
      case "desert": return 3;
      case "swamp": return 8;
      case "jungle": return 5;
      case "dense_forest": return 4;
      case "forest": return 3;
      case "hills": return 5;
      case "grassland": return 1;
      case "plains": return 1;
      case "savanna": return 2;
      case "tundra": return 4;
      case "taiga": return 3;
      default: return 2;
    }
  }

  findRoadPath(
    startX: number, startY: number,
    endX: number, endY: number,
  ): { wx: number; wy: number }[] {
    // Direct-line heuristic pathfinding with step-1 granularity
    // We sample points along the direct line and then refine nearby
    const path: { wx: number; wy: number }[] = [];
    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(Math.ceil(dist / 3), 20);

    // First pass: collect points along direct line that are walkable
    const validPoints: { wx: number; wy: number }[] = [{ wx: startX, wy: startY }];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      let px = Math.round(startX + dx * t);
      let py = Math.round(startY + dy * t);
      // Try to find walkable point nearby if blocked
      if (this.getMoveCost(px, py) === Infinity) {
        let found = false;
        for (let r = 1; r <= 6 && !found; r++) {
          for (const [ox, oy] of [[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,-r],[r,-r],[-r,r]]) {
            if (this.getMoveCost(px+ox, py+oy) < Infinity) {
              px += ox; py += oy; found = true; break;
            }
          }
        }
        if (!found) continue; // Skip this segment
      }
      validPoints.push({ wx: px, wy: py });
    }
    // Ensure endpoint is included
    const last = validPoints[validPoints.length - 1];
    if (last.wx !== endX || last.wy !== endY) {
      if (this.getMoveCost(endX, endY) < Infinity) {
        validPoints.push({ wx: endX, wy: endY });
      }
    }
    return validPoints;
  }

  generateRoads(settlements: Settlement[]): RoadSegment[] {
    const roads: RoadSegment[] = [];
    const connected = new Set<string>();

    // Connect each settlement to its nearest neighbor
    for (let i = 0; i < settlements.length; i++) {
      let nearestIdx = -1;
      let nearestDist = Infinity;

      for (let j = 0; j < settlements.length; j++) {
        if (i === j) continue;
        const pairKey = [Math.min(i, j), Math.max(i, j)].join(",");
        if (connected.has(pairKey)) continue;

        const dx = settlements[i].wx - settlements[j].wx;
        const dy = settlements[i].wy - settlements[j].wy;
        const dist = dx * dx + dy * dy;
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = j;
        }
      }

      if (nearestIdx >= 0) {
        const pairKey = [Math.min(i, nearestIdx), Math.max(i, nearestIdx)].join(",");
        connected.add(pairKey);

        const path = this.findRoadPath(
          settlements[i].wx, settlements[i].wy,
          settlements[nearestIdx].wx, settlements[nearestIdx].wy,
        );

        for (const pt of path) {
          roads.push({
            wx: pt.wx,
            wy: pt.wy,
            fromSettlement: settlements[i].id,
            toSettlement: settlements[nearestIdx].id,
          });
        }
      }
    }

    return roads;
  }

  // ---- PHASE 9: POIs ----

  generatePOIs(settlements: Settlement[]): POI[] {
    const pois: POI[] = [];
    const n = this.noise;
    const totalW = this.worldWidth * CHUNK_SIZE;
    const totalH = this.worldHeight * CHUNK_SIZE;

    // Scan for good POI locations
    const poiTypes: POI["type"][] = ["dungeon", "ruins", "mine", "shrine", "cave"];
    const poiNames: Record<POI["type"], string[]> = {
      dungeon: ["Mazmorra Olvidada", "Catacumbas Oscuras", "Túnel Profundo", "Cripta Ancestral"],
      ruins: ["Ruinas Antiguas", "Templo Perdido", "Fortaleza Abandonada", "Ciudad en Ruinas"],
      mine: ["Mina de Hierro", "Mina de Oro", "Mina de Cristal", "Cantera Profunda"],
      shrine: ["Sagrario", "Altar Antiguo", "Santuario", "Fuente de Poder"],
      cave: ["Cueva Oscura", "Caverna del Dragón", "Gruta Profunda", "Cueva de Cristal"],
    };

    let poiCount = 0;
    for (let attempt = 0; attempt < 500 && pois.length < 30; attempt++) {
      const wx = n.random.int(4, totalW - 4);
      const wy = n.random.int(4, totalH - 4);

      const elev = this.getElevation(wx, wy);
      const biome = this.classifyBiome(wx, wy);

      // POIs should be on land, not too close to settlements
      if (elev < ELEVATION.BEACH) continue;
      if (elev > ELEVATION.PEAK) continue;

      const tooClose = settlements.some(s => {
        const dx = s.wx - wx;
        const dy = s.wy - wy;
        return Math.sqrt(dx * dx + dy * dy) < 30;
      });
      if (tooClose) continue;

      const type = poiTypes[poiCount % poiTypes.length];
      const names = poiNames[type];
      pois.push({
        id: `poi_${poiCount}`,
        type,
        name: names[poiCount % names.length],
        wx,
        wy,
      });
      poiCount++;
    }

    return pois;
  }

  // ---- Generate full world ----

  generateWorld(): WorldData {
    console.log(`[WorldGen] Generating world with seed ${this.seed}...`);

    // Step 1-3: Elevation, Temperature, Rainfall are computed lazily per-chunk

    // Step 4-5: Biomes and tiles are classified on demand

    // Step 6: Settlements
    const settlements = this.generateSettlements();
    console.log(`[WorldGen] Generated ${settlements.length} settlements`);

    // Step 7: Kingdoms
    const kingdoms = this.generateKingdoms(settlements);
    console.log(`[WorldGen] Generated ${kingdoms.length} kingdoms`);

    // Step 8: Roads
    const roads = this.generateRoads(settlements);
    console.log(`[WorldGen] Generated ${roads.length} road segments`);

    // Step 9: POIs
    const pois = this.generatePOIs(settlements);
    console.log(`[WorldGen] Generated ${pois.length} POIs`);

    return {
      seed: this.seed,
      width: this.worldWidth,
      height: this.worldHeight,
      regions: [], // Generated on demand
      settlements,
      kingdoms,
      pois,
      roads,
    };
  }

  // ---- Generate a chunk region (used for rendering and game logic) ----

  generateChunkRegion(rx: number, ry: number): RegionData {
    const elev = this.getElevationChunk(rx, ry);
    const temp = this.getTemperatureChunk(rx, ry);
    const rain = this.getRainfallChunk(rx, ry);
    const rivers = this.computeRiverMap(rx, ry);

    const biome: string[][] = [];
    const tile: number[][] = [];

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      biome[ly] = [];
      tile[ly] = [];
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = rx * CHUNK_SIZE + lx;
        const wy = ry * CHUNK_SIZE + ly;
        biome[ly][lx] = this.classifyBiome(wx, wy);
        tile[ly][lx] = this.classifyTile(wx, wy);
      }
    }

    // Override rivers
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        if (rivers[ly][lx]) {
          tile[ly][lx] = WT.river;
        }
      }
    }

    // ---- Surface deposits (scarcity): hierro/oro en colinas/montañas, determinístico por seed
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const base = tile[ly][lx];
        if (base === WT.rockyHills || base === WT.mountain || base === WT.hills || base === WT.highMountain) {
          const wx = rx * CHUNK_SIZE + lx;
          const wy = ry * CHUNK_SIZE + ly;
          const rn = (this.noise.simple(wx, wy, 999) + 1) / 2; // 0..1
          // ~3% hierro, ~0.8% oro, wilderness bias via ridged noise
          if (rn > 0.985) tile[ly][lx] = WT.goldDeposit;
          else if (rn > 0.93) tile[ly][lx] = WT.ironDeposit;
        }
      }
    }

    return { rx, ry, elevation: elev, temperature: temp, rainfall: rain, biome, tile };
  }
}
