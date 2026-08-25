// ============================================================
// Procedural Noise Library — Deterministic from seed
// Simplex 2D, FBM, Ridged, Domain Warping, Cellular (Voronoi)
// ============================================================

// ---- Seeded RNG (Mulberry32) ----
export class SeededRandom {
  private s: number;
  constructor(seed: number) {
    this.s = seed | 0;
  }
  /** Returns [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Returns [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  /** Returns integer [min, max] */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

// ---- Simplex 2D Noise ----
// Attempt at a clean implementation based on Stefan Gustavson's work

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

// Gradient vectors for 2D
const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function buildPermTable(seed: number): Uint8Array {
  const rng = new SeededRandom(seed);
  const p = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = base[i];
    base[i] = base[j];
    base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255];
  return p;
}

function dot2(g: number[], x: number, y: number): number {
  return g[0] * x + g[1] * y;
}

function simplex2D(x: number, y: number, perm: Uint8Array): number {
  // Skew input space
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  // Unskew back
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;

  let i1: number, j1: number;
  if (x0 > y0) { i1 = 1; j1 = 0; }
  else { i1 = 0; j1 = 1; }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0, n1 = 0, n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    const gi0 = perm[ii + perm[jj]] % 8;
    t0 *= t0;
    n0 = t0 * t0 * dot2(GRAD2[gi0], x0, y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 8;
    t1 *= t1;
    n1 = t1 * t1 * dot2(GRAD2[gi1], x1, y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 8;
    t2 *= t2;
    n2 = t2 * t2 * dot2(GRAD2[gi2], x2, y2);
  }

  return 70.0 * (n0 + n1 + n2); // Scale to [-1, 1]
}

// ---- Multi-octave FBM ----

export interface FBMParams {
  octaves?: number;   // default 6
  lacunarity?: number; // default 2.0
  gain?: number;       // default 0.5
  frequency?: number;  // default 0.01
}

export function fbm(
  x: number, y: number,
  perm: Uint8Array,
  params: FBMParams = {},
): number {
  const { octaves = 6, lacunarity = 2.0, gain = 0.5, frequency = 0.01 } = params;
  let amplitude = 1.0;
  let frequency_ = frequency;
  let sum = 0;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * simplex2D(x * frequency_, y * frequency_, perm);
    maxAmp += amplitude;
    amplitude *= gain;
    frequency_ *= lacunarity;
  }
  return sum / maxAmp; // Normalize to [-1, 1]
}

// ---- Ridged Noise (for mountain chains) ----

export function ridgedNoise(
  x: number, y: number,
  perm: Uint8Array,
  params: FBMParams = {},
): number {
  const { octaves = 5, lacunarity = 2.0, gain = 0.5, frequency = 0.005 } = params;
  let amplitude = 1.0;
  let frequency_ = frequency;
  let sum = 0;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    let v = simplex2D(x * frequency_, y * frequency_, perm);
    v = 1.0 - Math.abs(v); // Ridge: invert absolute value
    v = v * v;              // Sharpen ridges
    sum += amplitude * v;
    maxAmp += amplitude;
    amplitude *= gain;
    frequency_ *= lacunarity;
  }
  return sum / maxAmp; // [0, 1]
}

// ---- Domain Warping ----

export function domainWarp(
  x: number, y: number,
  perm: Uint8Array,
  warpStrength: number = 40.0,
  scale: number = 0.003,
): [number, number] {
  const wx = fbm(x, y, perm, { octaves: 4, frequency: scale, gain: 0.5 }) * warpStrength;
  const wy = fbm(x + 500, y + 500, perm, { octaves: 4, frequency: scale, gain: 0.5 }) * warpStrength;
  return [x + wx, y + wy];
}

// ---- Cellular / Voronoi Noise ----

export interface VoronoiResult {
  distance: number;     // Distance to nearest point
  distance2: number;    // Distance to second nearest
  cellId: number;       // Which cell this belongs to
  pointX: number;       // X of nearest point
  pointY: number;       // Y of nearest point
}

export function voronoi2D(
  x: number, y: number,
  perm: Uint8Array,
  cellSize: number = 64,
): VoronoiResult {
  const ix = Math.floor(x / cellSize);
  const iy = Math.floor(y / cellSize);

  let minDist = Infinity;
  let minDist2 = Infinity;
  let cellId = 0;
  let nearestX = 0;
  let nearestY = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      // Deterministic point position within cell
      const h1 = perm[(cx * 374761393 + cy * 668265263) & 255] / 255.0;
      const h2 = perm[(cx * 1274126177 + cy * 2654435761) & 255] / 255.0;
      const px = (cx + h1) * cellSize;
      const py = (cy + h2) * cellSize;
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);

      if (dist < minDist) {
        minDist2 = minDist;
        minDist = dist;
        cellId = (cx * 73856093) ^ (cy * 19349663);
        nearestX = px;
        nearestY = py;
      } else if (dist < minDist2) {
        minDist2 = dist;
      }
    }
  }

  return { distance: minDist, distance2: minDist2, cellId, pointX: nearestX, pointY: nearestY };
}

// ---- Noise Generator Bundle ----

export interface NoiseGen {
  perm: Uint8Array;
  fbm: (x: number, y: number, params?: FBMParams) => number;
  ridged: (x: number, y: number, params?: FBMParams) => number;
  warp: (x: number, y: number, strength?: number, scale?: number) => [number, number];
  voronoi: (x: number, y: number, cellSize?: number) => VoronoiResult;
  simple: (x: number, y: number, frequency?: number) => number;
  random: SeededRandom;
}

export function createNoise(seed: number): NoiseGen {
  const perm = buildPermTable(seed);
  const random = new SeededRandom(seed + 12345);
  return {
    perm,
    fbm: (x, y, params) => fbm(x, y, perm, params),
    ridged: (x, y, params) => ridgedNoise(x, y, perm, params),
    warp: (x, y, strength, scale) => domainWarp(x, y, perm, strength, scale),
    voronoi: (x, y, cellSize) => voronoi2D(x, y, perm, cellSize),
    simple: (x, y, frequency = 0.01) => simplex2D(x, y, perm),
    random,
  };
}
