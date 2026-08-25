// ============================================================
// Enhanced Maps — Unique terrain per zone, decorations, transitions
// ============================================================

import type { GameMap } from "./types";
import { MapZone } from "./types";

// ---- Tile Types ----
export const T = {
  grass: 0,
  path: 1,
  water: 2,
  wall: 3,
  floor: 4,
  darkFloor: 5,
  sand: 6,
  tree: 7,
  stone: 8,
  lava: 9,
  bridge: 10,
  sandBeach: 11,
  stonePath: 12,
  darkGrass: 13,
  swamp: 14,
  rocky: 15,
  flowerGrass: 16,
  gate: 17,
  stairs: 18,
  dirt: 19,
  deadTree: 20,
  thorn: 21,
  campfire: 22,
  signpost: 23,
  torch: 24,
  well: 25,
  fountain: 26,
  rubble: 27,
  moss: 28,
} as const;

// ---- Decoration IDs (stored in decorations grid) ----
export const D = {
  none: -1,
  torch: 0,
  signpost: 1,
  rock: 2,
  campfire: 3,
  flower_red: 4,
  flower_yellow: 5,
  mushroom: 6,
  barrel: 7,
  crate: 8,
  bone: 9,
  skull: 10,
  web: 11,
  gravestone: 12,
  lantern: 13,
  barrel_broken: 14,
  market_stall: 15,
  anvil: 16,
  bookshelf: 17,
  chest: 18,
  carpet_red: 19,
  flag: 20,
  bench: 21,
  weapon_rack: 22,
  potion_shelf: 23,
} as const;

// ---- Utility ----

function genGrid(w: number, h: number, fill: number): number[][] {
  return Array.from({ length: h }, () => Array(w).fill(fill));
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ---- Noise helper for organic terrain ----
function simpleNoise(w: number, h: number, scale: number, seed: number): number[][] {
  const rng = seededRandom(seed);
  const grid = genGrid(w, h, 0);
  // Generate random points
  const gw = Math.ceil(w / scale) + 2;
  const gh = Math.ceil(h / scale) + 2;
  const points: number[][] = Array.from({ length: gh }, () =>
    Array.from({ length: gw }, () => rng())
  );
  // Bilinear interpolation
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = x / scale;
      const fy = y / scale;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const dx = fx - ix;
      const dy = fy - iy;
      const v00 = points[iy]?.[ix] ?? 0.5;
      const v10 = points[iy]?.[ix + 1] ?? 0.5;
      const v01 = points[iy + 1]?.[ix] ?? 0.5;
      const v11 = points[iy + 1]?.[ix + 1] ?? 0.5;
      const v = v00 * (1 - dx) * (1 - dy) + v10 * dx * (1 - dy) + v01 * (1 - dx) * dy + v11 * dx * dy;
      grid[y][x] = v;
    }
  }
  return grid;
}

// ---- City: Ciudad de Rucci ----

function makeCity(): number[][] {
  const w = 30, h = 30;
  const tiles = genGrid(w, h, T.grass);

  // Outer walls
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y <= 1 || y >= h - 2 || x <= 1 || x >= w - 2) {
        tiles[y][x] = T.wall;
      }
    }
  }

  // Main streets — cross pattern with stone path
  const midX = Math.floor(w / 2);
  const midY = Math.floor(h / 2);
  for (let x = 2; x < w - 2; x++) {
    tiles[midY][x] = T.stonePath;
    tiles[midY - 1][x] = T.stonePath;
    if (midY + 1 < h - 2) tiles[midY + 1][x] = T.stonePath;
  }
  for (let y = 2; y < h - 2; y++) {
    tiles[y][midX] = T.stonePath;
    tiles[y][midX - 1] = T.stonePath;
    if (midX + 1 < w - 2) tiles[y][midX + 1] = T.stonePath;
  }

  // Market square (center)
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      tiles[midY + dy][midX + dx] = T.stonePath;
    }
  }

  // Fountain in center of market
  tiles[midY][midX] = T.fountain;

  // Buildings — 4 quadrants with unique shapes
  const buildings = [
    // NW: Weapon shop & Armor shop
    { x: 3, y: 3, w: 7, h: 5, floor: T.floor },
    { x: 11, y: 3, w: 5, h: 5, floor: T.floor },
    // NE: Alchemist & Guild hall
    { x: 18, y: 3, w: 6, h: 5, floor: T.floor },
    { x: 25, y: 3, w: 4, h: 5, floor: T.floor },
    // SW: Inn & Blacksmith
    { x: 3, y: 18, w: 7, h: 5, floor: T.floor },
    { x: 11, y: 18, w: 5, h: 6, floor: T.floor },
    // SE: Temple & Library
    { x: 18, y: 18, w: 6, h: 6, floor: T.floor },
    { x: 25, y: 18, w: 4, h: 5, floor: T.floor },
  ];

  for (const b of buildings) {
    // Walls
    for (let dy = 0; dy < b.h; dy++) {
      for (let dx = 0; dx < b.w; dx++) {
        const ty = b.y + dy;
        const tx = b.x + dx;
        if (ty >= 0 && ty < h && tx >= 0 && tx < w) {
          if (dy === 0 || dy === b.h - 1 || dx === 0 || dx === b.w - 1) {
            tiles[ty][tx] = T.wall;
          } else {
            tiles[ty][tx] = b.floor;
          }
        }
      }
    }
    // Door (south side, center)
    const doorX = b.x + Math.floor(b.w / 2);
    const doorY = b.y + b.h - 1;
    if (doorY < h && doorX < w) {
      tiles[doorY][doorX] = T.gate;
    }
  }

  // Gate exits (N, S, E, W)
  tiles[1][midX] = T.gate;       // North gate
  tiles[h - 2][midX] = T.gate;   // South gate
  tiles[midY][1] = T.gate;       // West gate
  tiles[midY][w - 2] = T.gate;   // East gate

  // Connecting paths to gates
  for (let x = midX - 1; x <= midX + 1; x++) {
    tiles[2][x] = T.stonePath;
    tiles[h - 3][x] = T.stonePath;
  }
  for (let y = midY - 1; y <= midY + 1; y++) {
    tiles[y][2] = T.stonePath;
    tiles[y][w - 3] = T.stonePath;
  }

  // Garden patches in corners
  const gardenFill = (bx: number, by: number, bw: number, bh: number) => {
    for (let dy = 0; dy < bh; dy++) {
      for (let dx = 0; dx < bw; dx++) {
        const ty = by + dy, tx = bx + dx;
        if (ty > 1 && ty < h - 2 && tx > 1 && tx < w - 2) {
          tiles[ty][tx] = T.flowerGrass;
        }
      }
    }
  };
  gardenFill(3, 14, 4, 3);
  gardenFill(23, 14, 4, 3);

  // Well in NW garden area
  tiles[15][5] = T.well;

  return tiles;
}

function makeCityDecorations(): number[][] {
  const w = 30, h = 30;
  const deco = genGrid(w, h, D.none);

  // Market stalls around fountain
  deco[12][13] = D.market_stall;
  deco[12][16] = D.market_stall;
  deco[17][13] = D.market_stall;
  deco[17][16] = D.market_stall;

  // Torch posts along main streets
  for (let x = 4; x < 28; x += 4) {
    deco[14][x] = D.torch;
    deco[15][x] = D.torch;
  }
  for (let y = 4; y < 28; y += 4) {
    deco[y][14] = D.torch;
    deco[y][15] = D.torch;
  }

  // Building interiors
  deco[4][4] = D.weapon_rack;
  deco[5][5] = D.anvil;
  deco[19][4] = D.barrel;
  deco[20][5] = D.barrel;
  deco[4][20] = D.potion_shelf;
  deco[5][21] = D.bookshelf;
  deco[19][20] = D.bookshelf;
  deco[20][21] = D.chest;

  // Lanterns near gates
  deco[3][15] = D.lantern;
  deco[26][15] = D.lantern;
  deco[15][3] = D.lantern;
  deco[15][26] = D.lantern;

  // Benches in market
  deco[13][12] = D.bench;
  deco[16][17] = D.bench;

  // Flags
  deco[2][14] = D.flag;
  deco[2][15] = D.flag;
  deco[27][14] = D.flag;
  deco[27][15] = D.flag;

  // Signs
  deco[3][15] = D.signpost;
  deco[26][15] = D.signpost;

  return deco;
}

// ---- Campo Norte: Dense Forest ----

function makeForest(): number[][] {
  const w = 35, h = 25;
  const tiles = genGrid(w, h, T.grass);
  const noise = simpleNoise(w, h, 6, 42);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = noise[y][x];

      if (n > 0.65) {
        tiles[y][x] = T.tree;
      } else if (n > 0.55) {
        tiles[y][x] = T.darkGrass;
      } else if (n < 0.2) {
        tiles[y][x] = T.water;
      } else if (n < 0.28) {
        tiles[y][x] = T.sandBeach;
      }
    }
  }

  // Main path from south (city connection) winding north
  const midX = Math.floor(w / 2);
  for (let y = h - 2; y >= 1; y--) {
    const xOff = Math.round(Math.sin(y * 0.5) * 2);
    const px = midX + xOff;
    if (px >= 1 && px < w - 1) {
      tiles[y][px] = T.path;
      if (px > 0) tiles[y][px - 1] = T.dirt;
      if (px < w - 1) tiles[y][px + 1] = T.dirt;
    }
  }

  // Clearing in center
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const ty = cy + dy, tx = cx + dx;
      if (ty >= 0 && ty < h && tx >= 0 && tx < w) {
        if (dx * dx + dy * dy <= 12) {
          tiles[ty][tx] = T.flowerGrass;
        }
      }
    }
  }

  // Dungeon entrance (stone platform)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 2; dx++) {
      tiles[3 + dy][w - 5 + dx] = T.stone;
    }
  }
  tiles[3][w - 4] = T.stairs;
  tiles[3][w - 3] = T.stairs;

  // Connect path to dungeon
  for (let x = cx; x < w - 5; x++) {
    if (tiles[3][x] === T.tree || tiles[3][x] === T.darkGrass) {
      tiles[3][x] = T.dirt;
    }
  }

  // Entry/exit markers
  tiles[h - 2][midX] = T.signpost;
  tiles[1][midX] = T.signpost;

  // Pond in east
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const ty = 10 + dy, tx = 28 + dx;
      if (ty >= 0 && ty < h && tx >= 0 && tx < w && dx * dx + dy * dy <= 8) {
        tiles[ty][tx] = T.water;
        if (dx * dx + dy * dy <= 10 && dx * dx + dy * dy > 8) {
          tiles[ty][tx] = T.sandBeach;
        }
      }
    }
  }

  // Clear border trees so paths connect
  for (let x = 0; x < w; x++) {
    if (tiles[h - 2][x] !== T.path && tiles[h - 2][x] !== T.dirt) {
      tiles[h - 2][x] = T.darkGrass;
    }
  }
  for (let y = 0; y < h; y++) {
    if (tiles[y][midX] === T.tree) tiles[y][midX] = T.darkGrass;
  }

  return tiles;
}

function makeForestDecorations(): number[][] {
  const w = 35, h = 25;
  const deco = genGrid(w, h, D.none);
  const rng = seededRandom(101);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = rng();
      if (r < 0.03 && deco[y][x] === D.none) {
        const roll = rng();
        if (roll < 0.3) deco[y][x] = D.mushroom;
        else if (roll < 0.5) deco[y][x] = D.rock;
        else if (roll < 0.7) deco[y][x] = D.bone;
      }
    }
  }

  // Campfire in clearing
  deco[Math.floor(h / 2)][Math.floor(w / 2)] = D.campfire;

  // Torch near dungeon
  deco[2][w - 6] = D.torch;
  deco[4][w - 6] = D.torch;

  return deco;
}

// ---- Campo Sur: Swamp ----

function makeSwamp(): number[][] {
  const w = 35, h = 25;
  const tiles = genGrid(w, h, T.darkGrass);
  const noise = simpleNoise(w, h, 5, 77);
  const waterNoise = simpleNoise(w, h, 4, 99);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = noise[y][x];
      const wn = waterNoise[y][x];

      if (wn > 0.6) {
        tiles[y][x] = T.water;
      } else if (wn > 0.52) {
        tiles[y][x] = T.swamp;
      } else if (n > 0.7) {
        tiles[y][x] = T.deadTree;
      } else if (n > 0.6) {
        tiles[y][x] = T.moss;
      } else if (n < 0.25 && wn < 0.5) {
        tiles[y][x] = T.thorn;
      } else {
        tiles[y][x] = T.swamp;
      }
    }
  }

  // Murky paths
  const midX = Math.floor(w / 2);
  for (let y = h - 2; y >= 1; y--) {
    const xOff = Math.round(Math.sin(y * 0.7) * 3);
    const px = midX + xOff;
    for (let dx = -1; dx <= 1; dx++) {
      const tx = px + dx;
      if (tx >= 1 && tx < w - 1 && tiles[y][tx] !== T.water) {
        tiles[y][tx] = T.dirt;
      }
    }
  }

  // Bridges over water sections
  for (let y = 0; y < h; y++) {
    if (tiles[y][midX] === T.water || tiles[y][midX + 1] === T.water) {
      tiles[y][midX] = T.bridge;
      if (midX + 1 < w) tiles[y][midX + 1] = T.bridge;
    }
  }

  // Small islands with dead trees
  const islands = [[8, 6], [25, 10], [12, 15], [28, 18]];
  for (const [ix, iy] of islands) {
    if (iy >= 0 && iy < h && ix >= 0 && ix < w) {
      tiles[iy][ix] = T.deadTree;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ty = iy + dy, tx = ix + dx;
          if (ty >= 0 && ty < h && tx >= 0 && tx < w && !(dy === 0 && dx === 0)) {
            if (tiles[ty][tx] === T.water) tiles[ty][tx] = T.swamp;
          }
        }
      }
    }
  }

  // Entry markers
  tiles[h - 2][midX] = D.signpost as unknown as number;
  tiles[1][midX] = D.signpost as unknown as number;

  // Clear entry/exit
  tiles[h - 2][midX] = T.dirt;
  tiles[1][midX] = T.dirt;

  return tiles;
}

function makeSwampDecorations(): number[][] {
  const w = 35, h = 25;
  const deco = genGrid(w, h, D.none);
  const rng = seededRandom(200);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rng() < 0.04 && deco[y][x] === D.none) {
        const roll = rng();
        if (roll < 0.3) deco[y][x] = D.bone;
        else if (roll < 0.5) deco[y][x] = D.skull;
        else if (roll < 0.6) deco[y][x] = D.mushroom;
      }
    }
  }

  deco[h - 3][Math.floor(w / 2)] = D.signpost;
  return deco;
}

// ---- Campo Oeste: Rocky Hills ----

function makeHills(): number[][] {
  const w = 25, h = 30;
  const tiles = genGrid(w, h, T.grass);
  const noise = simpleNoise(w, h, 5, 55);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = noise[y][x];

      if (n > 0.72) {
        tiles[y][x] = T.wall;  // cliff face
      } else if (n > 0.6) {
        tiles[y][x] = T.rocky;
      } else if (n > 0.5) {
        tiles[y][x] = T.stone;
      } else if (n < 0.3) {
        tiles[y][x] = T.darkGrass;
      } else if (n < 0.2) {
        tiles[y][x] = T.water; // small mountain pools
      }
    }
  }

  // Winding mountain path
  const midX = Math.floor(w / 2);
  for (let y = h - 2; y >= 1; y--) {
    const xOff = Math.round(Math.sin(y * 0.4) * 3 + Math.cos(y * 0.8) * 1.5);
    const px = Math.max(2, Math.min(w - 3, midX + xOff));
    tiles[y][px] = T.stonePath;
    if (px > 1) tiles[y][px - 1] = T.dirt;
    if (px < w - 2) tiles[y][px + 1] = T.dirt;
  }

  // Mountain pass clearing
  const passY = Math.floor(h / 2);
  for (let dx = -3; dx <= 3; dx++) {
    const px = midX + dx;
    if (px >= 0 && px < w) {
      tiles[passY][px] = T.stonePath;
      if (passY > 0) tiles[passY - 1][px] = T.stonePath;
      if (passY < h - 1) tiles[passY + 1][px] = T.stonePath;
    }
  }

  // Entry/exit
  tiles[h - 2][midX] = T.stonePath;
  tiles[1][midX] = T.stonePath;

  // Clear cliff walls on paths
  for (let y = 0; y < h; y++) {
    if (tiles[y][midX] === T.wall || tiles[y][midX] === T.rocky) {
      tiles[y][midX] = T.stonePath;
    }
  }

  return tiles;
}

function makeHillsDecorations(): number[][] {
  const w = 25, h = 30;
  const deco = genGrid(w, h, D.none);
  const rng = seededRandom(300);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rng() < 0.03 && deco[y][x] === D.none) {
        deco[y][x] = D.rock;
      }
    }
  }

  // Torch in mountain pass
  deco[Math.floor(h / 2) - 1][Math.floor(w / 2) - 1] = D.torch;
  deco[Math.floor(h / 2) + 1][Math.floor(w / 2) + 1] = D.torch;

  return deco;
}

// ---- Campo Este: Open Plains ----

function makePlains(): number[][] {
  const w = 25, h = 30;
  const tiles = genGrid(w, h, T.grass);
  const noise = simpleNoise(w, h, 7, 33);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = noise[y][x];

      if (n > 0.7) {
        tiles[y][x] = T.flowerGrass;
      } else if (n > 0.6) {
        tiles[y][x] = T.darkGrass;
      } else if (n < 0.15) {
        tiles[y][x] = T.sand;
      } else if (n < 0.22) {
        tiles[y][x] = T.water;
        // Beach ring
        if (n > 0.18) tiles[y][x] = T.sandBeach;
      }
    }
  }

  // Wide dirt road from west (city) eastward
  const midY = Math.floor(h / 2);
  for (let x = 1; x < w - 1; x++) {
    tiles[midY][x] = T.dirt;
    if (midY > 0) tiles[midY - 1][x] = T.dirt;
    if (midY < h - 1) tiles[midY + 1][x] = T.dirt;
  }

  // Scattered tree groves
  const groves = [[5, 8], [18, 12], [8, 22], [20, 22]];
  for (const [gx, gy] of groves) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const ty = gy + dy, tx = gx + dx;
        if (ty >= 0 && ty < h && tx >= 0 && tx < w) {
          if (dx * dx + dy * dy <= 5 && tiles[ty][tx] !== T.water && tiles[ty][tx] !== T.sand) {
            tiles[ty][tx] = (dx * dx + dy * dy <= 2) ? T.tree : T.darkGrass;
          }
        }
      }
    }
  }

  // Pond
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const ty = 8 + dy, tx = 12 + dx;
      if (ty >= 0 && ty < h && tx >= 0 && tx < w && dx * dx + dy * dy <= 7) {
        tiles[ty][tx] = T.water;
      }
      if (ty >= 0 && ty < h && tx >= 0 && tx < w && dx * dx + dy * dy > 7 && dx * dx + dy * dy <= 10) {
        tiles[ty][tx] = T.sandBeach;
      }
    }
  }

  // Entry/exit
  tiles[midY][1] = T.dirt;
  tiles[midY][w - 2] = T.dirt;

  return tiles;
}

function makePlainsDecorations(): number[][] {
  const w = 25, h = 30;
  const deco = genGrid(w, h, D.none);
  const rng = seededRandom(400);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rng() < 0.025 && deco[y][x] === D.none) {
        const roll = rng();
        if (roll < 0.35) deco[y][x] = D.flower_red;
        else if (roll < 0.6) deco[y][x] = D.flower_yellow;
        else if (roll < 0.8) deco[y][x] = D.rock;
      }
    }
  }

  // Campfire near pond
  deco[6][11] = D.campfire;

  // Signpost at entry
  deco[Math.floor(h / 2) - 1][2] = D.signpost;

  return deco;
}

// ---- Mazmorra Entrada ----

function makeDungeonEntrance(): number[][] {
  const w = 22, h = 22;
  const tiles = genGrid(w, h, T.wall);

  // Outer border walls
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y === 0 || y === h - 1 || x === 0 || x === w - 1) {
        tiles[y][x] = T.wall;
      }
    }
  }

  // Entrance chamber (large, well-lit)
  for (let y = 2; y < 10; y++) {
    for (let x = 2; x < 12; x++) {
      tiles[y][x] = T.floor;
    }
  }

  // Main corridor
  for (let y = 10; y < 14; y++) {
    for (let x = 5; x < 17; x++) {
      tiles[y][x] = T.darkFloor;
    }
  }

  // Side rooms
  const sideRooms = [
    { x: 2, y: 14, w: 6, h: 5 },   // SW room
    { x: 14, y: 14, w: 6, h: 5 },   // SE room
  ];
  for (const r of sideRooms) {
    for (let dy = 0; dy < r.h; dy++) {
      for (let dx = 0; dx < r.w; dx++) {
        tiles[r.y + dy][r.x + dx] = T.darkFloor;
      }
    }
  }

  // Corridors to side rooms
  for (let y = 10; y < 15; y++) {
    tiles[y][4] = T.darkFloor;
    tiles[y][17] = T.darkFloor;
  }

  // Stairs down (south)
  tiles[h - 3][10] = T.stairs;
  tiles[h - 3][11] = T.stairs;

  // Entry from west
  tiles[10][0] = T.gate;
  for (let x = 0; x < 6; x++) tiles[10][x] = T.darkFloor;

  // Stone floor pattern
  for (let y = 2; y < 10; y++) {
    for (let x = 2; x < 12; x++) {
      if ((x + y) % 4 === 0) tiles[y][x] = T.stone;
    }
  }

  return tiles;
}

function makeDungeonEntranceDecorations(): number[][] {
  const w = 22, h = 22;
  const deco = genGrid(w, h, D.none);

  // Torches along entrance chamber
  deco[2][2] = D.torch;
  deco[2][11] = D.torch;
  deco[8][2] = D.torch;
  deco[8][11] = D.torch;

  // Barrels and crates in entrance
  deco[3][3] = D.barrel;
  deco[3][4] = D.crate;
  deco[4][3] = D.crate;

  // Web in corners
  deco[14][2] = D.web;
  deco[14][19] = D.web;

  // Bone piles
  deco[7][6] = D.bone;
  deco[16][8] = D.bone;

  // Chest in side room
  deco[16][16] = D.chest;

  return deco;
}

// ---- Mazmorra Profunda ----

function makeDeepDungeon(): number[][] {
  const w = 25, h = 25;
  const tiles = genGrid(w, h, T.wall);

  // Room layout — more complex
  const rooms = [
    { x: 2, y: 2, w: 6, h: 5, floor: T.darkFloor },    // Entry room
    { x: 10, y: 2, w: 7, h: 5, floor: T.floor },        // Armory
    { x: 18, y: 2, w: 5, h: 5, floor: T.darkFloor },    // Guard room
    { x: 2, y: 10, w: 6, h: 6, floor: T.darkFloor },    // Prison
    { x: 10, y: 9, w: 7, h: 7, floor: T.floor },        // Central hall
    { x: 18, y: 10, w: 5, h: 6, floor: T.darkFloor },   // Library
    { x: 2, y: 18, w: 6, h: 5, floor: T.lava },         // Lava room
    { x: 10, y: 18, w: 7, h: 5, floor: T.darkFloor },   // Throne room
    { x: 18, y: 18, w: 5, h: 5, floor: T.darkFloor },   // Treasure vault
  ];

  for (const r of rooms) {
    for (let dy = 0; dy < r.h; dy++) {
      for (let dx = 0; dx < r.w; dx++) {
        const ty = r.y + dy, tx = r.x + dx;
        if (ty >= 0 && ty < h && tx >= 0 && tx < w) {
          tiles[ty][tx] = r.floor;
        }
      }
    }
  }

  // Corridors connecting rooms
  const corridors = [
    // Horizontal corridors
    { x1: 8, x2: 10, y: 4 },    // Entry → Armory
    { x1: 17, x2: 18, y: 4 },   // Armory → Guard
    { x1: 8, x2: 10, y: 12 },   // Prison → Central
    { x1: 17, x2: 18, y: 12 },  // Central → Library
    { x1: 8, x2: 10, y: 20 },   // Lava → Throne
    { x1: 17, x2: 18, y: 20 },  // Throne → Vault
    // Vertical corridors
    { y1: 7, y2: 10, x: 5 },    // Entry → Prison
    { y1: 7, y2: 9, x: 13 },    // Armory → Central
    { y1: 7, y2: 10, x: 20 },   // Guard → Library
    { y1: 16, y2: 18, x: 5 },   // Prison → Lava
    { y1: 16, y2: 18, x: 13 },  // Central → Throne
    { y1: 16, y2: 18, x: 20 },  // Library → Vault
  ];

  for (const c of corridors) {
    if ("x1" in c && "x2" in c && "y" in c) {
      for (let x = c.x1; x <= c.x2; x++) {
        if (c.y >= 0 && c.y < h && x >= 0 && x < w) {
          tiles[c.y][x] = T.darkFloor;
        }
      }
    } else if ("y1" in c && "y2" in c && "x" in c) {
      for (let y = c.y1; y <= c.y2; y++) {
        if (y >= 0 && y < h && c.x >= 0 && c.x < w) {
          tiles[y][c.x] = T.darkFloor;
        }
      }
    }
  }

  // Lava pool in lava room
  for (let dy = 1; dy < 4; dy++) {
    for (let dx = 1; dx < 5; dx++) {
      tiles[18 + dy][2 + dx] = T.lava;
    }
  }
  // Stone walkway through lava
  tiles[19][4] = T.stone;
  tiles[20][4] = T.stone;
  tiles[21][4] = T.stone;

  // Stairs up (north)
  tiles[1][12] = T.stairs;

  // Throne in throne room
  tiles[19][13] = T.stone;
  tiles[20][13] = T.stone;

  // Treasure in vault
  tiles[20][20] = T.gold_nugget as unknown as number;
  tiles[20][20] = T.floor;

  return tiles;
}

function makeDeepDungeonDecorations(): number[][] {
  const w = 25, h = 25;
  const deco = genGrid(w, h, D.none);
  const rng = seededRandom(500);

  // Torches everywhere
  const torchPositions = [
    [3, 3], [3, 7], [8, 3], [8, 7],
    [11, 10], [11, 15], [15, 10], [15, 15],
    [3, 11], [3, 15],
    [19, 11], [19, 15], [22, 11], [22, 15],
  ];
  for (const [ty, tx] of torchPositions) {
    if (ty >= 0 && ty < h && tx >= 0 && tx < w) deco[ty][tx] = D.torch;
  }

  // Webs in prison
  deco[10][2] = D.web;
  deco[12][2] = D.web;
  deco[14][7] = D.web;

  // Bones and skulls
  deco[11][3] = D.bone;
  deco[13][5] = D.skull;
  deco[20][3] = D.gravestone;

  // Chests in treasure vault
  deco[19][20] = D.chest;
  deco[20][21] = D.chest;
  deco[21][20] = D.chest;

  // Books in library
  deco[11][19] = D.bookshelf;
  deco[12][19] = D.bookshelf;
  deco[13][19] = D.bookshelf;

  // Weapon rack in armory
  deco[3][13] = D.weapon_rack;
  deco[4][14] = D.weapon_rack;

  return deco;
}

// ============================================================
// Map Definitions
// ============================================================

export const MAPS: Record<string, GameMap> = {
  "rucci": {
    id: "rucci",
    name: "Ciudad de Rucci",
    width: 30, height: 30, tileSize: 32, zone: MapZone.City,
    tiles: makeCity(),
    decorations: makeCityDecorations(),
    spawns: [{ x: 15, y: 15 }],
    connections: [
      { targetMapId: "campo_norte", targetX: 17, targetY: 23, triggerX: 14, triggerY: 0, triggerW: 3, triggerH: 2 },
      { targetMapId: "campo_sur", targetX: 17, targetY: 1, triggerX: 14, triggerY: 28, triggerW: 3, triggerH: 2 },
      { targetMapId: "campo_oeste", targetX: 22, targetY: 15, triggerX: 0, triggerY: 14, triggerW: 2, triggerH: 3 },
      { targetMapId: "campo_este", targetX: 1, targetY: 15, triggerX: 28, triggerY: 14, triggerW: 2, triggerH: 3 },
    ],
    npcs: [
      {
        id: "merchant_armas", name: "Herrero Carlos", x: 5, y: 4,
        type: "merchant",
        dialogue: ["¡Bienvenido a mi forja!", "Tengo las mejores armas de Rucci.", "¿Qué necesitas?"],
        shopItems: ["rusty_sword", "iron_sword", "oak_bow", "mage_staff", "wooden_shield"],
      },
      {
        id: "merchant_pociones", name: "Alquimista Elena", x: 20, y: 4,
        type: "merchant",
        dialogue: ["Mis pociones son las mejores del reino.", "¿Te algo te duele?"],
        shopItems: ["health_potion", "mana_potion", "bandage"],
      },
      {
        id: "merchant_armadura", name: "Armero Diego", x: 5, y: 19,
        type: "merchant",
        dialogue: ["Protección de calidad aquí.", "No salgas sin una buena armadura."],
        shopItems: ["leather_armor", "chainmail", "plate_armor"],
      },
      {
        id: "merchant_materiales", name: "Minerador José", x: 20, y: 19,
        type: "merchant",
        dialogue: ["Vendo materiales de las minas.", "¡Todo fresco del subsuelo!"],
        shopItems: ["iron_ore", "wood"],
      },
      {
        id: "quest_giver", name: "Viejo Sabio", x: 15, y: 11,
        type: "quest",
        dialogue: [
          "Joven aventurero...",
          "Las criaturas del campo norte se han vuelto agresivas.",
          "Si puedes eliminarlas, la ciudad te lo agradecerá.",
          "Ten cuidado, el mundo exterior no perdona.",
        ],
      },
      {
        id: "info_npc", name: "Guardia Pedro", x: 15, y: 3,
        type: "dialog",
        dialogue: [
          "¡No pases sin cuidado!",
          "Los campos fuera de la ciudad son peligrosos.",
          "Al norte hay un bosque denso, al sur un pantano.",
          "Al oeste montañas rocosas, al este llanuras abiertas.",
          "La ciudad es segura, pero afuera... cuidado.",
        ],
      },
    ],
  },

  "campo_norte": {
    id: "campo_norte",
    name: "Bosque de los Susurros",
    width: 35, height: 25, tileSize: 32, zone: MapZone.Wilderness,
    tiles: makeForest(),
    decorations: makeForestDecorations(),
    spawns: [{ x: 17, y: 23 }],
    connections: [
      { targetMapId: "rucci", targetX: 15, targetY: 27, triggerX: 17, triggerY: 23, triggerW: 3, triggerH: 2 },
      { targetMapId: "mazmorra_entrance", targetX: 1, targetY: 10, triggerX: 30, triggerY: 3, triggerW: 3, triggerH: 2 },
    ],
    npcs: [],
  },

  "campo_sur": {
    id: "campo_sur",
    name: "Pantano de las Almas",
    width: 35, height: 25, tileSize: 32, zone: MapZone.Wilderness,
    tiles: makeSwamp(),
    decorations: makeSwampDecorations(),
    spawns: [{ x: 17, y: 1 }],
    connections: [
      { targetMapId: "rucci", targetX: 15, targetY: 1, triggerX: 17, triggerY: 1, triggerW: 3, triggerH: 2 },
    ],
    npcs: [],
  },

  "campo_oeste": {
    id: "campo_oeste",
    name: "Montañas de Khaz'rok",
    width: 25, height: 30, tileSize: 32, zone: MapZone.Wilderness,
    tiles: makeHills(),
    decorations: makeHillsDecorations(),
    spawns: [{ x: 12, y: 28 }],
    connections: [
      { targetMapId: "rucci", targetX: 1, targetY: 14, triggerX: 12, triggerY: 28, triggerW: 3, triggerH: 2 },
    ],
    npcs: [],
  },

  "campo_este": {
    id: "campo_este",
    name: "Llanuras de Esperanza",
    width: 25, height: 30, tileSize: 32, zone: MapZone.Wilderness,
    tiles: makePlains(),
    decorations: makePlainsDecorations(),
    spawns: [{ x: 1, targetY: 15 } as any],
    connections: [
      { targetMapId: "rucci", targetX: 28, targetY: 14, triggerX: 1, triggerY: 15, triggerW: 2, triggerH: 3 },
    ],
    npcs: [],
  },

  "mazmorra_entrance": {
    id: "mazmorra_entrance",
    name: "Catacumbas de Rucci",
    width: 22, height: 22, tileSize: 32, zone: MapZone.Dungeon,
    tiles: makeDungeonEntrance(),
    decorations: makeDungeonEntranceDecorations(),
    spawns: [{ x: 6, y: 5 }],
    connections: [
      { targetMapId: "campo_norte", targetX: 29, targetY: 3, triggerX: 0, triggerY: 10, triggerW: 1, triggerH: 1 },
      { targetMapId: "mazmorra_profunda", targetX: 12, targetY: 2, triggerX: 10, triggerY: 19, triggerW: 2, triggerH: 1 },
    ],
    npcs: [],
  },

  "mazmorra_profunda": {
    id: "mazmorra_profunda",
    name: "Trono de Khaz'rok",
    width: 25, height: 25, tileSize: 32, zone: MapZone.Dungeon,
    tiles: makeDeepDungeon(),
    decorations: makeDeepDungeonDecorations(),
    spawns: [{ x: 12, y: 3 }],
    connections: [
      { targetMapId: "mazmorra_entrance", targetX: 11, targetY: 18, triggerX: 12, triggerY: 0, triggerW: 2, triggerH: 1 },
    ],
    npcs: [],
  },
};

// ---- All decoration tiles (for rendering) ----

export const DECORATION_RENDER: Record<number, { color: number; shape: string; size?: number }> = {
  [D.torch]: { color: 0xff8800, shape: "torch", size: 4 },
  [D.signpost]: { color: 0x8b6914, shape: "signpost" },
  [D.rock]: { color: 0x666666, shape: "rock" },
  [D.campfire]: { color: 0xff4400, shape: "campfire" },
  [D.flower_red]: { color: 0xff4444, shape: "flower" },
  [D.flower_yellow]: { color: 0xffdd44, shape: "flower" },
  [D.mushroom]: { color: 0xdd6633, shape: "mushroom" },
  [D.barrel]: { color: 0x8b4513, shape: "barrel" },
  [D.crate]: { color: 0xa0522d, shape: "crate" },
  [D.bone]: { color: 0xddddcc, shape: "bone" },
  [D.skull]: { color: 0xeeeecc, shape: "skull" },
  [D.web]: { color: 0xcccccc, shape: "web" },
  [D.gravestone]: { color: 0x888888, shape: "gravestone" },
  [D.lantern]: { color: 0xffcc00, shape: "lantern" },
  [D.market_stall]: { color: 0xcc4444, shape: "stall" },
  [D.anvil]: { color: 0x555555, shape: "anvil" },
  [D.bookshelf]: { color: 0x663322, shape: "bookshelf" },
  [D.chest]: { color: 0xdaa520, shape: "chest" },
  [D.carpet_red]: { color: 0xcc2222, shape: "carpet" },
  [D.flag]: { color: 0x4444cc, shape: "flag" },
  [D.bench]: { color: 0x8b6914, shape: "bench" },
  [D.weapon_rack]: { color: 0x999999, shape: "weaponrack" },
  [D.potion_shelf]: { color: 0x44aa44, shape: "potionshelf" },
};

// ---- Helpers ----

export function getMap(id: string): GameMap | undefined {
  return MAPS[id];
}

export function getAllMaps(): GameMap[] {
  return Object.values(MAPS);
}

/** Get the decoration at a tile position */
export function getDecoration(mapId: string, x: number, y: number): number {
  const map = MAPS[mapId];
  if (!map) return D.none;
  return map.decorations[y]?.[x] ?? D.none;
}

/** Check if a tile is walkable */
export function isWalkable(tileId: number): boolean {
  return tileId !== T.water && tileId !== T.wall && tileId !== T.tree &&
         tileId !== T.deadTree && tileId !== T.thorn && tileId !== T.lava;
}
