// Register Canvas2D renderer as fallback for Pixi.js v7
import "@pixi/canvas-renderer";
import "@pixi/canvas-graphics";
import "@pixi/canvas-display";
import "@pixi/canvas-text";
import "@pixi/canvas-sprite";

import * as PIXI from "pixi.js";
import type { PlayerState, GroundItem, GameMap, NPCData, MonsterData } from "@shared/types";
import { MapZone, Direction } from "@shared/types";
import { MAPS, T, D, DECORATION_RENDER } from "@shared/maps";
import { WT, CHUNK_SIZE } from "@shared/world-gen";
import { ITEMS } from "@shared/items";
import { ParticleSystem, ScreenShake, AmbientTiles, drawEnhancedCharacter, drawEnhancedMonster, drawEnhancedItem } from "./vfx";

const TILE_SIZE = 32;

// All tile colors — matches T constants
const TILE_COLORS: Record<number, number> = {
  [T.grass]: 0x2d5a1e,
  [T.path]: 0x8b7355,
  [T.water]: 0x1a4a7a,
  [T.wall]: 0x3a3a3a,
  [T.floor]: 0x6b5b4a,
  [T.darkFloor]: 0x3a2a2a,
  [T.sand]: 0xc2a645,
  [T.tree]: 0x1a3a0e,
  [T.stone]: 0x5a5a5a,
  [T.lava]: 0xcc3300,
  [T.bridge]: 0x8b6914,
  [T.sandBeach]: 0xd4b865,
  [T.stonePath]: 0x7a7a6a,
  [T.darkGrass]: 0x1f4a15,
  [T.swamp]: 0x2a3a1a,
  [T.rocky]: 0x6a5a4a,
  [T.flowerGrass]: 0x3a6a2a,
  [T.gate]: 0x8b6914,
  [T.stairs]: 0x5a5a4a,
  [T.dirt]: 0x7a6040,
  [T.deadTree]: 0x3a2a1a,
  [T.thorn]: 0x2a3a20,
  [T.campfire]: 0x8a4a1a,
  [T.signpost]: 0x6a5a3a,
  [T.torch]: 0x5a5a4a,
  [T.well]: 0x6a6a6a,
  [T.fountain]: 0x4a8a9a,
  [T.rubble]: 0x5a4a3a,
  [T.moss]: 0x2a4a2a,
};

const CLASS_COLORS: Record<string, number> = {
  warrior: 0xcc4444, mage: 0x4444cc, archer: 0x44aa44, paladin: 0xccaa44,
};

// Procedural world tile colors — vibrant, AO-inspired but modern
const WT_COLORS: Record<number, number> = {
  [WT.deepOcean]: 0x0a1e3a, [WT.ocean]: 0x123a6a, [WT.shallowWater]: 0x2d5d8a,
  [WT.beach]: 0xe2c27a, [WT.sand]: 0xd0b060, [WT.grass]: 0x2f6b1e,
  [WT.darkGrass]: 0x214d14, [WT.flowerGrass]: 0x3d8a2a, [WT.plains]: 0x4f8a33,
  [WT.forest]: 0x183a0a, [WT.denseForest]: 0x0c2a06, [WT.swamp]: 0x2f3d1a,
  [WT.tundra]: 0x9ab0c0, [WT.savanna]: 0x9ab54a, [WT.hills]: 0x6b7a4e,
  [WT.rockyHills]: 0x7a6a52, [WT.mountain]: 0x6a6a6a, [WT.highMountain]: 0x8a8a8a,
  [WT.snowPeak]: 0xf2f8ff, [WT.desert]: 0xe0b85a, [WT.jungle]: 0x0c4a0a,
  [WT.taiga]: 0x2f4a32, [WT.coral]: 0xffaa88, [WT.river]: 0x2f6eaa,
  [WT.lake]: 0x225a8a, [WT.dirtRoad]: 0x8a7050, [WT.stoneRoad]: 0x8a8a7a,
  [WT.townFloor]: 0x6b5b4a, [WT.wall]: 0x3a3a3a, [WT.path]: 0x8b7355,
  [WT.bridge]: 0x8b6914, [WT.cave]: 0x2a1a1a, [WT.ruins]: 0x4a4a4a,
  [WT.lava]: 0xcc3300, [WT.ironDeposit]: 0x7a6a5a, [WT.goldDeposit]: 0xd4aa20,
  [WT.crystalDeposit]: 0x88c0dd,
};

// World tiles that block movement
const WT_BLOCKED = new Set<number>([
  WT.deepOcean, WT.ocean, WT.shallowWater, WT.mountain, WT.highMountain,
  WT.snowPeak, WT.wall, WT.lava,
]);

export class GameEngine {
  app: PIXI.Application;
  worldContainer: PIXI.Container;
  tileContainer: PIXI.Container;
  decoContainer: PIXI.Container;
  entityContainer: PIXI.Container;
  uiContainer: PIXI.Container;
  fxContainer: PIXI.Container;

  particles: ParticleSystem;
  shake: ScreenShake;
  ambientTiles: AmbientTiles;
  // Lighting
  lightContainer: PIXI.Container;
  dayOverlay: PIXI.Graphics;
  lightGfx: PIXI.Graphics;
  worldTime = 0.25; // noon
  isDay = true;
  private lightFlickerPhase = 0;

  camera = { x: 0, y: 0 };
  currentMap: GameMap | null = null;
  // Procedural world mode
  isWorldMode = false;
  worldChunks = new Map<string, number[][]>();
  worldChunkGfx = new Map<string, PIXI.Graphics>();
  localPlayer: PlayerState | null = null;
  otherPlayers: Map<string, PIXI.Container> = new Map();
  groundItemSprites: Map<string, PIXI.Container> = new Map();
  monsterSprites: Map<string, PIXI.Container> = new Map();
  npcSprites: Map<string, PIXI.Container> = new Map();

  tileGraphics: PIXI.Graphics[] = [];
  screenW = 0;
  screenH = 0;
  keys: Set<string> = new Set();
  lastMoveTime = 0;
  MOVE_INTERVAL = 150;
  private lastFootstepTile = "";
  private animTime = 0;
  private destroyed = false;

  onMove: ((x: number, y: number, dir: Direction) => void) | null = null;
  onStop: ((x: number, y: number, dir: Direction) => void) | null = null;
  onNPCClick: ((npcId: string) => void) | null = null;
  onItemPickup: ((itemId: string) => void) | null = null;
  onAttack: ((targetId: string) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    canvas.width = w;
    canvas.height = h;

    const opts = {
      view: canvas,
      width: w,
      height: h,
      backgroundColor: 0x0a0a0f,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    };

    let app: PIXI.Application;
    try {
      app = new PIXI.Application(opts);
    } catch (e) {
      console.warn("[GameEngine] Auto-detect failed, forcing Canvas2D:", e);
      try {
        (PIXI as any).settings.PREFER_ENV = 0;
        app = new PIXI.Application({ ...opts, forceCanvas: true } as any);
      } catch (e2) {
        console.error("[GameEngine] All renderers failed:", e2);
        throw new Error(
          "No se pudo inicializar el motor gráfico. Tu navegador necesita soporte WebGL o Canvas2D."
        );
      }
    }

    this.app = app;
    this.screenW = w;
    this.screenH = h;

    this.worldContainer = new PIXI.Container();
    this.tileContainer = new PIXI.Container();
    this.decoContainer = new PIXI.Container();
    this.entityContainer = new PIXI.Container();
    this.uiContainer = new PIXI.Container();
    this.fxContainer = new PIXI.Container();

    this.worldContainer.addChild(this.tileContainer);
    this.worldContainer.addChild(this.decoContainer);
    this.worldContainer.addChild(this.entityContainer);
    this.worldContainer.addChild(this.fxContainer);
    this.app.stage.addChild(this.worldContainer);

    this.particles = new ParticleSystem(this.fxContainer);
    this.shake = new ScreenShake(this.worldContainer);
    this.ambientTiles = new AmbientTiles();

    // Lighting overlay (screen-space)
    this.lightContainer = new PIXI.Container();
    this.dayOverlay = new PIXI.Graphics();
    this.lightGfx = new PIXI.Graphics();
    this.lightContainer.addChild(this.dayOverlay);
    this.lightContainer.addChild(this.lightGfx);
    this.app.stage.addChild(this.lightContainer);
    // Initially noon
    this.setWorldTime(0.25, true);

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.app.ticker.add(this.update);

    // FPS counter (toggle with "f" key or 3-finger tap)
    const fpsText = new PIXI.Text("FPS --", { fontSize: 12, fill: 0x22ff44, fontFamily: "monospace" });
    fpsText.position.set(8, (window.innerHeight || 600) - 24);
    fpsText.visible = false;
    this.uiContainer.addChild(fpsText);
    this.fpsText = fpsText;
    let frames = 0, last = performance.now();
    this.app.ticker.add(() => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        if (fpsText.visible) {
          const ents = this.entityContainer.children.length;
          const tiles = this.tileContainer.children.length;
          fpsText.text = `FPS ${frames} | entidades ${ents} | tiles ${tiles}`;
        }
        frames = 0; last = now;
      }
    });
    window.addEventListener("keydown", (e) => { if (e.key === "f") fpsText.visible = !fpsText.visible; });
    window.addEventListener("touchstart", (e) => {
      if (e.touches.length >= 3) fpsText.visible = !fpsText.visible;
    }, { passive: true });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.particles.destroy();
    this.app.destroy(false, { children: true });
  }

  handleResize = () => {
    this.screenW = window.innerWidth;
    this.screenH = window.innerHeight;
    this.app.renderer.resize(this.screenW, this.screenH);
    if (this.fpsText) this.fpsText.position.set(8, this.screenH - 24);
    // Resize overlay
    this.updateLighting();
  };

  setWorldTime(time: number, isDay: boolean) {
    this.worldTime = time;
    this.isDay = isDay;
    this.updateLighting();
  }

  private updateLighting() {
    if (!this.dayOverlay || !this.lightGfx) return;
    const time = this.worldTime;
    // Ambient: interpolate dawn/dusk
    let alpha = 0;
    let tint = 0x000000;
    if (this.isWorldMode) {
      if (time >= 0.15 && time < 0.25) { // dawn 0.55->0
        const p = (time - 0.15) / 0.10;
        alpha = 0.55 * (1 - p);
        tint = 0x112233;
      } else if (time >= 0.25 && time < 0.65) {
        alpha = 0; tint = 0x000000;
      } else if (time >= 0.65 && time < 0.75) {
        const p = (time - 0.65) / 0.10;
        alpha = 0.55 * p;
        tint = 0x1a0f2a;
      } else {
        alpha = 0.58; tint = 0x0d1a2e;
      }
    } else {
      // Indoor: dimmer at night
      alpha = this.isDay ? 0.18 : 0.42;
      tint = this.isDay ? 0x000000 : 0x1a1a2e;
    }

    this.dayOverlay.clear();
    if (alpha > 0.01) {
      this.dayOverlay.beginFill(tint, alpha);
      this.dayOverlay.drawRect(0, 0, this.screenW, this.screenH);
      this.dayOverlay.endFill();
    }

    // Point lights — radial falloff (screen-space)
    this.lightGfx.clear();
    if (alpha > 0.05) {
      this.lightFlickerPhase += 0.07;
      const flicker = 0.92 + Math.sin(this.lightFlickerPhase) * 0.08 + Math.sin(this.lightFlickerPhase * 1.7) * 0.04;
      const lights: { wx: number; wy: number; radius: number; color: number; alpha: number }[] = [];
      // Player light — radius depends on lantern/torch
      if (this.localPlayer) {
        const hasLantern = (this.localPlayer as any).equipment?.shield === "lantern";
        const hasTorch = (this.localPlayer.buffs ?? []).some((b: any) => b.type === "torch_light" && b.expiresAt > Date.now());
        const base = hasLantern ? 185 : hasTorch ? 145 : 72;
        const col = hasLantern ? 0xffe8a0 : hasTorch ? 0xffd080 : 0xffc080;
        lights.push({ wx: this.localPlayer.x, wy: this.localPlayer.y, radius: base * flicker, color: col, alpha: hasLantern ? 1.0 : hasTorch ? 0.9 : 0.55 });
      }
      for (const [, c] of this.otherPlayers) {
        // Approximate other player light — check if they have lantern/torch via stored data not available, use base 110
        const worldX = (c.x - 16) / 32;
        const worldY = (c.y - 16) / 32;
        lights.push({ wx: worldX, wy: worldY, radius: 110 * flicker, color: 0xffd080, alpha: 0.6 });
      }
      // Torches in settlement
      if (this.currentMap) {
        for (let y = 0; y < this.currentMap.height; y++) for (let x = 0; x < this.currentMap.width; x++) {
          const deco = this.currentMap.decorations[y]?.[x];
          // D.torch == 1 (check shared/maps)
          if (deco === 1) lights.push({ wx: x, wy: y, radius: 90 * flicker, color: 0xffaa44, alpha: 0.85 });
          if (deco === 7) lights.push({ wx: x, wy: y, radius: 100 * flicker, color: 0xff6600, alpha: 0.7 }); // campfire? approx
        }
      }
      // World torches: use decoContainer torches? fallback: no world torches

      for (const l of lights) {
        const sx = l.wx * 32 + 16 + this.camera.x;
        const sy = l.wy * 32 + 16 + this.camera.y;
        // Cull off-screen
        if (sx < -l.radius || sx > this.screenW + l.radius || sy < -l.radius || sy > this.screenH + l.radius) continue;
        // Radial gradient via concentric circles
        for (let i = 4; i >= 1; i--) {
          const r = (l.radius * i) / 4;
          const a = l.alpha * (0.18 / i) * flicker;
          this.lightGfx.beginFill(l.color, a);
          this.lightGfx.drawCircle(sx, sy, r);
          this.lightGfx.endFill();
        }
        // Core
        this.lightGfx.beginFill(l.color, l.alpha * 0.18);
        this.lightGfx.drawCircle(sx, sy, 12);
        this.lightGfx.endFill();
      }
      this.lightGfx.blendMode = PIXI.BLEND_MODES.ADD;
    } else {
      this.lightGfx.clear();
    }
  }

  handleKeyDown = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
  handleKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  moveFromJoystick(dx: number, dy: number, direction: Direction) {
    if (!this.localPlayer) return;
    const now = Date.now();
    if (now - this.lastMoveTime < this.MOVE_INTERVAL) return;
    const newX = this.localPlayer.x + dx;
    const newY = this.localPlayer.y + dy;
    if (this.canWalk(newX, newY)) {
      this.localPlayer.x = newX;
      this.localPlayer.y = newY;
      this.localPlayer.direction = direction;
      this.localPlayer.isMoving = true;
      this.lastMoveTime = now;
      this.onMove?.(newX, newY, direction);
      this.updateCamera();
      this.playFootstepFx(newX, newY);
    }
  }

  stopFromJoystick() {
    if (!this.localPlayer) return;
    if (this.localPlayer.isMoving) {
      this.localPlayer.isMoving = false;
      this.onStop?.(this.localPlayer.x, this.localPlayer.y, this.localPlayer.direction);
    }
  }

  /** Id of the closest visible monster (in tiles), or null */
  getNearestMonsterId(maxDist = 5): string | null {
    if (!this.localPlayer) return null;
    let best: string | null = null;
    let bestD = maxDist;
    for (const [id, c] of this.monsterSprites) {
      const dx = c.x / TILE_SIZE - this.localPlayer.x;
      const dy = c.y / TILE_SIZE - this.localPlayer.y;
      const d = Math.hypot(dx, dy);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }

  private playFootstepFx(x: number, y: number) {
    const key = `${x},${y}`;
    if (key === this.lastFootstepTile) return;
    this.lastFootstepTile = key;
    if (!this.currentMap) return;
    const tile = this.currentMap.tiles[y]?.[x];
    if (tile === T.water) {
      this.particles.waterSplash(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2);
    }
  }

  // ---- Combat VFX ----

  playHitEffect(targetId: string, isCrit: boolean) {
    const sprite = this.otherPlayers.get(targetId) || this.monsterSprites.get(targetId);
    const hitSprite = sprite || (this.localPlayer?.id === targetId ? this.localPlayerGfx : null);
    if (!hitSprite) return;
    const x = hitSprite.x;
    const y = hitSprite.y;

    this.particles.blood(x, y);
    if (isCrit) {
      this.particles.burst(x, y, 0xffaa00, 16);
      this.shake.trigger(6, 0.2);
    } else {
      this.shake.trigger(3, 0.12);
    }

    const flash = new PIXI.Graphics();
    flash.beginFill(0xffffff, 0.6);
    flash.drawCircle(0, 0, 14);
    flash.endFill();
    flash.x = x;
    flash.y = y;
    this.fxContainer.addChild(flash);
    setTimeout(() => { if (!this.destroyed) { this.fxContainer.removeChild(flash); flash.destroy(); } }, 80);
  }

  playDeathEffect(targetId: string) {
    const sprite = this.otherPlayers.get(targetId) || this.monsterSprites.get(targetId);
    if (sprite) {
      this.particles.deathEffect(sprite.x, sprite.y);
      this.shake.trigger(8, 0.3);
    }
  }

  playPickupEffect(x: number, y: number) {
    this.particles.goldSparkle(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2);
  }

  playLevelUpEffect() {
    if (!this.localPlayer) return;
    const x = this.localPlayer.x * TILE_SIZE + TILE_SIZE / 2;
    const y = this.localPlayer.y * TILE_SIZE + TILE_SIZE / 2;
    this.particles.burst(x, y, 0xffdd44, 24);
    this.particles.burst(x, y - 10, 0xff8800, 12);
  }

  playHealEffect() {
    if (!this.localPlayer) return;
    const x = this.localPlayer.x * TILE_SIZE + TILE_SIZE / 2;
    const y = this.localPlayer.y * TILE_SIZE + TILE_SIZE / 2;
    this.particles.healEffect(x, y);
  }

  // ---- Map ----

  registerMap(map: GameMap) {
    MAPS[map.id] = map;
    this.loadMap(map.id);
  }

  loadMap(mapId: string) {    // Procedural world — tiles arrive via loadWorldChunk
    if (mapId === "world") {
      this.isWorldMode = true;
      this.currentMap = null;
      this.worldChunks.clear();
      for (const gfx of this.worldChunkGfx.values()) gfx.destroy({ children: true });
      this.worldChunkGfx.clear();
      this.lastRequestedChunkX = Number.NaN;
      this.lastRequestedChunkY = Number.NaN;
      this.tileContainer.removeChildren();
      this.decoContainer.removeChildren();
      this.tileGraphics = [];
      this.ambientTiles.clear();
      this.clearNPCs();
      this.onRequestChunks?.(this.localPlayer?.x ?? 2048, this.localPlayer?.y ?? 2048);
      return;
    }
    this.isWorldMode = false;
    const map = MAPS[mapId];
    if (!map) {
      console.error(`[GameEngine] Map not found: ${mapId}`);
      return;
    }
    this.currentMap = map;
    this.tileContainer.removeChildren();
    this.decoContainer.removeChildren();
    this.tileGraphics = [];
    this.ambientTiles.clear();

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tileId = map.tiles[y]?.[x] ?? 0;
        const g = new PIXI.Graphics();
        const useWorldPalette = mapId.startsWith("settlement_") || mapId.startsWith("poi_");
        const color = (useWorldPalette ? WT_COLORS[tileId] : TILE_COLORS[tileId]) ?? TILE_COLORS[tileId] ?? 0x222222;

        g.beginFill(color);
        g.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
        g.endFill();

        // Tile detail overlays
        if (tileId === T.grass || tileId === T.darkGrass || tileId === T.flowerGrass) {
          // Grass blades
          g.lineStyle(1, 0x3a7a2e, 0.4);
          const seed = (x * 7 + y * 13) % 5;
          for (let i = 0; i < seed; i++) {
            const gx = 4 + ((x * 17 + i * 11) % 24);
            const gy = 4 + ((y * 19 + i * 7) % 24);
            g.moveTo(gx, gy + 4); g.lineTo(gx + 1, gy);
          }
          g.lineStyle(0);
          if (tileId === T.flowerGrass) {
            // Flower dots
            const fc = ((x * 3 + y * 7) % 3 === 0) ? 0xff4444 : 0xffdd44;
            g.beginFill(fc, 0.6);
            g.drawCircle(10 + (x * 5) % 12, 10 + (y * 3) % 12, 2);
            g.drawCircle(20 + (x * 7) % 8, 20 + (y * 5) % 8, 1.5);
            g.endFill();
          }
        } else if (tileId === T.path || tileId === T.dirt) {
          // Path pebbles
          g.beginFill(tileId === T.dirt ? 0x8a7050 : 0x9a8365, 0.3);
          g.drawCircle(8 + (x * 3) % 12, 8 + (y * 5) % 16, 2);
          g.drawCircle(20 + (x * 7) % 8, 20 + (y * 3) % 8, 1.5);
          g.endFill();
        } else if (tileId === T.stonePath) {
          // Stone path pattern
          g.beginFill(0x8a8a7a, 0.2);
          g.drawRect(1, 1, 14, 14);
          g.drawRect(17, 17, 14, 14);
          g.endFill();
          g.lineStyle(1, 0x6a6a5a, 0.3);
          g.moveTo(0, 16); g.lineTo(32, 16);
          g.moveTo(16, 0); g.lineTo(16, 32);
          g.lineStyle(0);
        } else if (tileId === T.bridge) {
          // Bridge planks
          g.lineStyle(1, 0x6a5010, 0.5);
          for (let i = 0; i < 4; i++) {
            g.moveTo(0, i * 8); g.lineTo(32, i * 8);
          }
          g.lineStyle(2, 0x5a4010, 0.3);
          g.moveTo(0, 0); g.lineTo(0, 32);
          g.moveTo(32, 0); g.lineTo(32, 32);
          g.lineStyle(0);
        } else if (tileId === T.water) {
          // Water detail
          g.beginFill(0x2a6a9a, 0.2);
          g.drawEllipse(16 + ((x * 7) % 8 - 4), 16 + ((y * 3) % 8 - 4), 6, 3);
          g.endFill();
        } else if (tileId === T.lava) {
          // Lava bubbles
          g.beginFill(0xff6600, 0.3);
          g.drawCircle(12 + (x * 5) % 8, 12 + (y * 7) % 8, 3);
          g.endFill();
        } else if (tileId === T.gate) {
          // Gate arch
          g.lineStyle(2, 0xaa8833, 0.6);
          g.drawRect(4, 2, 24, 28);
          g.lineStyle(0);
          g.beginFill(0x664422, 0.3);
          g.drawRect(8, 6, 16, 22);
          g.endFill();
        } else if (tileId === T.stairs) {
          // Staircase lines
          g.lineStyle(1, 0x4a4a3a, 0.5);
          for (let i = 0; i < 4; i++) {
            g.moveTo(4, 4 + i * 7); g.lineTo(28, 4 + i * 7);
          }
          g.lineStyle(0);
        } else if (tileId === T.swamp) {
          // Swamp bubbles
          g.beginFill(0x3a5a2a, 0.3);
          g.drawCircle(8 + (x * 5) % 16, 20 + (y * 3) % 8, 2);
          g.endFill();
        } else if (tileId === T.rocky) {
          // Rock texture
          g.beginFill(0x7a6a5a, 0.3);
          g.drawPolygon([-4, 8, 4, 0, 12, 6, 8, 14, 0, 12]);
          g.drawPolygon([18, 18, 26, 14, 30, 20, 24, 26]);
          g.endFill();
        } else if (tileId === T.deadTree) {
          // Dead tree trunk
          g.beginFill(0x4a3a2a, 0.5);
          g.drawRect(13, 8, 6, 20);
          g.endFill();
          g.lineStyle(2, 0x4a3a2a, 0.5);
          g.moveTo(16, 12); g.lineTo(8, 6);
          g.moveTo(16, 16); g.lineTo(24, 10);
          g.lineStyle(0);
        } else if (tileId === T.moss) {
          // Moss dots
          g.beginFill(0x3a6a3a, 0.3);
          g.drawCircle(8, 8, 3);
          g.drawCircle(24, 20, 4);
          g.drawCircle(16, 28, 2);
          g.endFill();
        } else if (tileId === T.thorn) {
          // Thorn bushes
          g.beginFill(0x1a2a1a, 0.5);
          g.drawCircle(16, 16, 10);
          g.endFill();
          g.lineStyle(1, 0x3a4a2a, 0.4);
          g.moveTo(10, 12); g.lineTo(8, 6);
          g.moveTo(22, 14); g.lineTo(26, 8);
          g.moveTo(14, 20); g.lineTo(10, 26);
          g.lineStyle(0);
        } else if (tileId === T.fountain) {
          // Fountain center
          g.beginFill(0x4a8aaa, 0.5);
          g.drawCircle(16, 16, 10);
          g.endFill();
          g.beginFill(0x6abacc, 0.3);
          g.drawCircle(16, 16, 6);
          g.endFill();
        } else if (tileId === T.well) {
          // Well
          g.beginFill(0x6a6a6a, 0.6);
          g.drawCircle(16, 16, 10);
          g.endFill();
          g.beginFill(0x2a4a6a, 0.5);
          g.drawCircle(16, 16, 6);
          g.endFill();
        } else if (tileId === T.sandBeach) {
          // Beach pebbles
          g.beginFill(0xc4b070, 0.2);
          g.drawCircle(10, 14, 2);
          g.drawCircle(22, 8, 1.5);
          g.drawCircle(18, 24, 2);
          g.endFill();
        }

        g.x = x * TILE_SIZE;
        g.y = y * TILE_SIZE;
        g.eventMode = "static";
        g.cursor = "pointer";

        this.tileContainer.addChild(g);
        this.tileGraphics.push(g);
        this.ambientTiles.addTile(g, x, y, tileId);
      }
    }

    // ---- Render decorations ----
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const decoId = map.decorations[y]?.[x] ?? D.none;
        if (decoId === D.none) continue;
        const render = DECORATION_RENDER[decoId];
        if (!render) continue;

        const g = new PIXI.Graphics();
        const cx = x * TILE_SIZE + TILE_SIZE / 2;
        const cy = y * TILE_SIZE + TILE_SIZE / 2;

        switch (render.shape) {
          case "torch": {
            // Torch post
            g.beginFill(0x553311);
            g.drawRect(-2, -8, 4, 16);
            g.endFill();
            // Flame
            g.beginFill(render.color, 0.8);
            g.drawCircle(0, -10, 4);
            g.endFill();
            g.beginFill(0xffcc00, 0.5);
            g.drawCircle(0, -12, 2);
            g.endFill();
            // Glow
            g.beginFill(render.color, 0.08);
            g.drawCircle(0, 0, 20);
            g.endFill();
            break;
          }
          case "signpost": {
            g.beginFill(0x553311);
            g.drawRect(-2, -4, 4, 16);
            g.endFill();
            g.beginFill(render.color);
            g.drawRect(-8, -10, 16, 8);
            g.endFill();
            break;
          }
          case "rock": {
            g.beginFill(render.color, 0.7);
            g.drawEllipse(0, 2, 6, 4);
            g.endFill();
            g.beginFill(0x777777, 0.5);
            g.drawEllipse(-2, 0, 4, 3);
            g.endFill();
            break;
          }
          case "campfire": {
            // Logs
            g.beginFill(0x5a3a1a);
            g.drawRect(-6, 2, 12, 3);
            g.drawRect(-4, 0, 8, 3);
            g.endFill();
            // Fire
            g.beginFill(0xff4400, 0.7);
            g.drawCircle(0, -2, 5);
            g.endFill();
            g.beginFill(0xffaa00, 0.5);
            g.drawCircle(0, -4, 3);
            g.endFill();
            // Glow
            g.beginFill(0xff4400, 0.06);
            g.drawCircle(0, 0, 24);
            g.endFill();
            break;
          }
          case "flower": {
            g.beginFill(render.color, 0.7);
            g.drawCircle(0, 0, 3);
            g.endFill();
            g.beginFill(0x44aa44, 0.5);
            g.drawRect(-1, 2, 2, 4);
            g.endFill();
            break;
          }
          case "mushroom": {
            g.beginFill(0x886633);
            g.drawRect(-2, 0, 4, 6);
            g.endFill();
            g.beginFill(render.color, 0.7);
            g.drawEllipse(0, -1, 5, 3);
            g.endFill();
            break;
          }
          case "barrel": {
            g.beginFill(render.color, 0.7);
            g.drawRoundedRect(-6, -6, 12, 12, 3);
            g.endFill();
            g.lineStyle(1, 0x5a3010, 0.5);
            g.drawRoundedRect(-6, -6, 12, 12, 3);
            g.lineStyle(0);
            break;
          }
          case "crate": {
            g.beginFill(render.color, 0.7);
            g.drawRect(-6, -6, 12, 12);
            g.endFill();
            g.lineStyle(1, 0x6a3a1a, 0.5);
            g.moveTo(-6, 0); g.lineTo(6, 0);
            g.moveTo(0, -6); g.lineTo(0, 6);
            g.lineStyle(0);
            break;
          }
          case "bone": {
            g.beginFill(render.color, 0.6);
            g.drawCircle(-3, -2, 2);
            g.drawCircle(3, 2, 2);
            g.endFill();
            g.lineStyle(1.5, render.color, 0.5);
            g.moveTo(-2, -1); g.lineTo(2, 1);
            g.lineStyle(0);
            break;
          }
          case "skull": {
            g.beginFill(render.color, 0.6);
            g.drawCircle(0, -2, 5);
            g.endFill();
            g.beginFill(0x222222, 0.5);
            g.drawCircle(-2, -3, 1.5);
            g.drawCircle(2, -3, 1.5);
            g.endFill();
            break;
          }
          case "web": {
            g.lineStyle(0.5, render.color, 0.3);
            for (let i = 0; i < 4; i++) {
              const a = (i * Math.PI) / 2;
              g.moveTo(0, 0);
              g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
            }
            g.lineStyle(0);
            break;
          }
          case "gravestone": {
            g.beginFill(render.color, 0.6);
            g.drawRoundedRect(-5, -8, 10, 14, 3);
            g.endFill();
            g.lineStyle(1, 0x666666, 0.4);
            g.moveTo(-3, -4); g.lineTo(3, -4);
            g.moveTo(-2, 0); g.lineTo(2, 0);
            g.lineStyle(0);
            break;
          }
          case "lantern": {
            g.beginFill(0x553311);
            g.drawRect(-1, -6, 2, 10);
            g.endFill();
            g.beginFill(render.color, 0.6);
            g.drawRoundedRect(-4, -8, 8, 6, 2);
            g.endFill();
            g.beginFill(render.color, 0.1);
            g.drawCircle(0, -2, 12);
            g.endFill();
            break;
          }
          case "stall": {
            // Market stall
            g.beginFill(0x8b6914);
            g.drawRect(-8, -4, 16, 12);
            g.endFill();
            g.beginFill(render.color, 0.6);
            g.drawRect(-10, -10, 20, 6);
            g.endFill();
            break;
          }
          case "anvil": {
            g.beginFill(render.color, 0.7);
            g.drawRect(-5, -2, 10, 6);
            g.drawRect(-3, -6, 6, 4);
            g.endFill();
            break;
          }
          case "bookshelf": {
            g.beginFill(render.color, 0.6);
            g.drawRect(-7, -8, 14, 16);
            g.endFill();
            // Books
            g.beginFill(0xcc4444, 0.4);
            g.drawRect(-5, -6, 3, 6);
            g.endFill();
            g.beginFill(0x4444cc, 0.4);
            g.drawRect(-1, -6, 3, 6);
            g.endFill();
            g.beginFill(0x44aa44, 0.4);
            g.drawRect(3, -6, 3, 6);
            g.endFill();
            break;
          }
          case "chest": {
            g.beginFill(render.color, 0.7);
            g.drawRoundedRect(-7, -5, 14, 10, 2);
            g.endFill();
            g.lineStyle(1, 0xaa8800, 0.5);
            g.drawRoundedRect(-7, -5, 14, 10, 2);
            g.lineStyle(0);
            g.beginFill(0xffdd44, 0.5);
            g.drawRect(-2, -1, 4, 2);
            g.endFill();
            break;
          }
          case "flag": {
            g.beginFill(0x553311);
            g.drawRect(-1, -10, 2, 18);
            g.endFill();
            g.beginFill(render.color, 0.7);
            g.moveTo(1, -10); g.lineTo(10, -7); g.lineTo(1, -4);
            g.closePath();
            g.endFill();
            break;
          }
          case "bench": {
            g.beginFill(render.color, 0.6);
            g.drawRect(-8, -2, 16, 4);
            g.endFill();
            g.beginFill(0x5a4a1a);
            g.drawRect(-7, 2, 3, 4);
            g.drawRect(4, 2, 3, 4);
            g.endFill();
            break;
          }
          case "weaponrack": {
            g.beginFill(0x553311);
            g.drawRect(-8, -6, 16, 2);
            g.endFill();
            // Swords
            g.lineStyle(1.5, 0xcccccc, 0.5);
            g.moveTo(-4, -6); g.lineTo(-4, 6);
            g.moveTo(0, -6); g.lineTo(0, 4);
            g.lineStyle(0);
            break;
          }
          case "potionshelf": {
            g.beginFill(0x553311);
            g.drawRect(-7, -6, 14, 12);
            g.endFill();
            g.beginFill(0x44aa44, 0.5);
            g.drawCircle(-3, -2, 2);
            g.endFill();
            g.beginFill(0x4444cc, 0.5);
            g.drawCircle(3, -2, 2);
            g.endFill();
            g.beginFill(0xcc4444, 0.5);
            g.drawCircle(0, 2, 2);
            g.endFill();
            break;
          }
          default: {
            g.beginFill(render.color, 0.5);
            g.drawCircle(0, 0, 3);
            g.endFill();
            break;
          }
        }

        g.x = cx;
        g.y = cy;
        this.decoContainer.addChild(g);
      }
    }

    this.clearNPCs();
    for (const npc of map.npcs) this.addNPC(npc);
  }

  // ---- Players ----

  setLocalPlayer(player: PlayerState) {
    this.localPlayer = player;
    this.loadMap(player.mapId);
    this.updateCamera(true);
    this.drawLocalPlayer();
  }

  updateLocalPlayer(player: PlayerState) {
    if (!this.localPlayer) return;
    const oldLevel = this.localPlayer.level;
    const oldMapId = this.localPlayer.mapId;
    const oldX = this.localPlayer.x, oldY = this.localPlayer.y;
    this.localPlayer = { ...player };
    if (player.mapId !== oldMapId) {
      this.loadMap(player.mapId);
      this.updateCamera(true);
    } else if (Math.abs(player.x - oldX) > 1 || Math.abs(player.y - oldY) > 1) {
      // Server corrected our position (teleport/respawn) — snap camera
      this.updateCamera(true);
    } else {
      this.updateCamera();
    }
    if (player.level > oldLevel) this.playLevelUpEffect();
  }

  addOtherPlayer(player: PlayerState) {
    if (this.otherPlayers.has(player.id)) { this.updateOtherPlayer(player); return; }
    const container = new PIXI.Container();
    drawEnhancedCharacter(container, this.playerColor(player), false, player.characterClass, player.stats.hp / player.stats.maxHp, player.username, player.level, player.username, (player as any).race, (player as any).equipment);
    container.x = player.x * TILE_SIZE + TILE_SIZE / 2;
    container.y = player.y * TILE_SIZE + TILE_SIZE / 2;
    container.eventMode = "static";
    container.cursor = "crosshair";
    container.on("pointerdown", () => this.onAttack?.(player.id));
    this.entityContainer.addChild(container);
    this.otherPlayers.set(player.id, container);
  }

  updateOtherPlayer(player: PlayerState) {
    const container = this.otherPlayers.get(player.id);
    if (!container) { this.addOtherPlayer(player); return; }
    container.x = player.x * TILE_SIZE + TILE_SIZE / 2;
    container.y = player.y * TILE_SIZE + TILE_SIZE / 2;
    drawEnhancedCharacter(container, this.playerColor(player), false, player.characterClass, player.stats.hp / player.stats.maxHp, player.username, player.level, player.username, (player as any).race, (player as any).equipment);
  }

  /** Criminals render red for everyone */
  private playerColor(player: PlayerState): number {
    if ((player.criminalUntil ?? 0) > Date.now()) return 0xcc2222;
    return CLASS_COLORS[player.characterClass] ?? 0xcccccc;
  }

  removeOtherPlayer(id: string) {
    const container = this.otherPlayers.get(id);
    if (container) {
      this.entityContainer.removeChild(container);
      container.destroy({ children: true });
      this.otherPlayers.delete(id);
    }
  }

  // ---- NPCs ----

  addNPC(npc: NPCData) {
    const container = new PIXI.Container();
    const npcColors: Record<string, number> = { merchant: 0xccaa44, banker: 0xd4aa20, quest: 0x4488cc, dialog: 0x44aa66 };
    const npcClass: Record<string, string> = { merchant: "warrior", banker: "paladin", quest: "mage", dialog: "archer" };
    drawEnhancedCharacter(container, npcColors[npc.type] ?? 0xcccccc, false, npcClass[npc.type] ?? "warrior", 1, npc.name, 1, npc.name);

    const icons: Record<string, string> = { merchant: "🛒", banker: "🏦", quest: "❗", dialog: "💬" };
    const indicator = new PIXI.Text(icons[npc.type] ?? "?", { fontSize: npc.type === "banker" ? 18 : 16 });
    indicator.anchor.set(0.5);
    indicator.y = npc.type === "quest" ? -42 : -36;
    container.addChild(indicator);
    // Banker gets coin overlay, merchant bag hint
    if (npc.type === "banker") {
      const coin = new PIXI.Graphics();
      coin.beginFill(0xd4aa20, 0.9); coin.drawCircle(0, -18, 4); coin.endFill();
      coin.beginFill(0xffdd44); coin.drawCircle(0, -18, 1.5); coin.endFill();
      container.addChild(coin);
    }

    let bobPhase = Math.random() * Math.PI * 2;
    this.app.ticker.add(() => {
      if (this.destroyed) return;
      bobPhase += 0.03;
      container.children.forEach(c => { if (c !== indicator) c.y = Math.sin(bobPhase) * 1.5; });
      indicator.y = -36 + Math.sin(bobPhase * 1.5) * 2;
    });

    container.x = npc.x * TILE_SIZE + TILE_SIZE / 2;
    container.y = npc.y * TILE_SIZE + TILE_SIZE / 2;
    container.eventMode = "static";
    container.cursor = "pointer";
    container.on("pointerdown", () => this.onNPCClick?.(npc.id));
    this.entityContainer.addChild(container);
    this.npcSprites.set(npc.id, container);
  }

  clearNPCs() {
    for (const [id, sprite] of this.npcSprites) {
      this.entityContainer.removeChild(sprite);
      sprite.destroy({ children: true });
    }
    this.npcSprites.clear();
  }

  // ---- Monsters ----

  updateMonsters(monsters: MonsterData[]) {
    for (const [id, sprite] of this.monsterSprites) {
      if (!monsters.find(m => m.id === id)) {
        this.entityContainer.removeChild(sprite);
        sprite.destroy({ children: true });
        this.monsterSprites.delete(id);
      }
    }
    for (const monster of monsters) {
      let container = this.monsterSprites.get(monster.id);
      if (!container) {
        container = new PIXI.Container();
        drawEnhancedMonster(container, monster.name, monster.hp / monster.maxHp);
        container.eventMode = "static";
        container.cursor = "crosshair";
        container.on("pointerdown", () => this.onAttack?.(monster.id));
        this.entityContainer.addChild(container);
        this.monsterSprites.set(monster.id, container);
      } else {
        drawEnhancedMonster(container, monster.name, monster.hp / monster.maxHp);
      }
      container.x = monster.x * TILE_SIZE + TILE_SIZE / 2;
      container.y = monster.y * TILE_SIZE + TILE_SIZE / 2;
    }
  }

  // ---- Ground Items ----

  updateGroundItems(items: GroundItem[]) {
    for (const [id, sprite] of this.groundItemSprites) {
      if (!items.find(i => i.id === id)) {
        this.entityContainer.removeChild(sprite);
        sprite.destroy({ children: true });
        this.groundItemSprites.delete(id);
      }
    }
    for (const item of items) {
      let container = this.groundItemSprites.get(item.id);
      if (!container) {
        container = new PIXI.Container();
        const itemDef = ITEMS[item.itemId];
        drawEnhancedItem(container, itemDef?.name ?? item.itemId, itemDef?.rarity ?? "common");
        container.x = item.x * TILE_SIZE + TILE_SIZE / 2;
        container.y = item.y * TILE_SIZE + TILE_SIZE / 2;
        container.eventMode = "static";
        container.cursor = "pointer";
        container.on("pointerdown", () => this.onItemPickup?.(item.id));
        this.entityContainer.addChild(container);
        this.groundItemSprites.set(item.id, container);
        this.particles.goldSparkle(container.x, container.y);
      }
      const t = Date.now() * 0.003;
      container.y = item.y * TILE_SIZE + TILE_SIZE / 2 + Math.sin(t + item.x) * 2;
    }
  }

  // ---- Camera ----

  updateCamera(snap = false) {
    if (!this.localPlayer) return;
    const targetX = -(this.localPlayer.x * TILE_SIZE + TILE_SIZE / 2) + this.screenW / 2;
    const targetY = -(this.localPlayer.y * TILE_SIZE + TILE_SIZE / 2) + this.screenH / 2;
    if (snap) {
      this.camera.x = targetX;
      this.camera.y = targetY;
    } else {
      this.camera.x += (targetX - this.camera.x) * 0.15;
      this.camera.y += (targetY - this.camera.y) * 0.15;
    }
    this.worldContainer.x = this.camera.x;
    this.worldContainer.y = this.camera.y;
  }

  // ---- Update Loop ----

  update = () => {
    if (this.destroyed || !this.localPlayer) return;
    if (!this.currentMap && !this.isWorldMode) return;

    this.animTime = Date.now();
    this.ambientTiles.update(this.animTime);
    this.particles.update(0.016);
    this.shake.update(0.016);
    this.updateLighting();

    // Stream new world chunks when the player crosses a chunk boundary
    if (this.isWorldMode) {
      const crx = Math.floor(this.localPlayer.x / CHUNK_SIZE);
      const cry = Math.floor(this.localPlayer.y / CHUNK_SIZE);
      if (crx !== this.lastRequestedChunkX || cry !== this.lastRequestedChunkY) {
        this.lastRequestedChunkX = crx;
        this.lastRequestedChunkY = cry;
        this.cullDistantChunks(crx, cry);
        this.onRequestChunks?.(this.localPlayer.x, this.localPlayer.y);
      }
      this.updateCamera();
    }

    const now = Date.now();
    if (now - this.lastMoveTime < this.MOVE_INTERVAL) return;

    let dx = 0, dy = 0;
    let direction = this.localPlayer.direction;

    if (this.keys.has("w") || this.keys.has("arrowup")) { dy = -1; direction = Direction.Up; }
    else if (this.keys.has("s") || this.keys.has("arrowdown")) { dy = 1; direction = Direction.Down; }
    else if (this.keys.has("a") || this.keys.has("arrowleft")) { dx = -1; direction = Direction.Left; }
    else if (this.keys.has("d") || this.keys.has("arrowright")) { dx = 1; direction = Direction.Right; }

    if (dx !== 0 || dy !== 0) {
      const newX = this.localPlayer.x + dx;
      const newY = this.localPlayer.y + dy;
      if (this.canWalk(newX, newY)) {
        this.localPlayer.x = newX;
        this.localPlayer.y = newY;
        this.localPlayer.direction = direction;
        this.localPlayer.isMoving = true;
        this.lastMoveTime = now;
        this.onMove?.(newX, newY, direction);
        this.updateCamera();
        this.playFootstepFx(newX, newY);
      }
    } else if (this.localPlayer.isMoving) {
      this.localPlayer.isMoving = false;
      this.onStop?.(this.localPlayer.x, this.localPlayer.y, this.localPlayer.direction);
    }

    this.drawLocalPlayer();
  };

  canWalk(x: number, y: number): boolean {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (this.isWorldMode) {
      if (!this.localPlayer) return false;
      const chunk = this.worldChunks.get(`${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`);
      if (!chunk) return false; // Chunk not loaded yet
      const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const tile = chunk[ly]?.[lx];
      if (tile === undefined) return false;
      return !WT_BLOCKED.has(tile);
    }
    if (!this.currentMap) return false;
    const settlementMode = this.currentMap.id.startsWith("settlement_") || this.currentMap.id.startsWith("poi_");
    if (x < 0 || x >= this.currentMap.width || y < 0 || y >= this.currentMap.height) return false;
    const tile = this.currentMap.tiles[y]?.[x];
    if (tile === undefined) return false;
    if (settlementMode) return !WT_BLOCKED.has(tile);
    return tile !== T.water && tile !== T.wall && tile !== T.tree &&
           tile !== T.deadTree && tile !== T.thorn && tile !== T.lava;
  }

  /** Receive a procedural world chunk from the server */
  loadWorldChunk(rx: number, ry: number, tiles: number[][]) {
    const key = `${rx},${ry}`;
    if (this.worldChunks.has(key)) return;
    this.worldChunks.set(key, tiles);

    // Draw ALL tiles into a single Graphics object (huge perf win vs per-tile objects)
    const ox = rx * CHUNK_SIZE;
    const oy = ry * CHUNK_SIZE;
    const g = new PIXI.Graphics();
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tileId = tiles[ly]?.[lx] ?? WT.ocean;
        const color = WT_COLORS[tileId] ?? 0x222222;
        const px = lx * TILE_SIZE;
        const py = ly * TILE_SIZE;
        g.beginFill(color);
        g.drawRect(px, py, TILE_SIZE, TILE_SIZE);
        g.endFill();

        // Rich detail overlays per tile — zero-asset procedural
        const wx = ox + lx, wy = oy + ly;
        if (tileId === WT.grass || tileId === WT.darkGrass || tileId === WT.flowerGrass || tileId === WT.plains) {
          g.lineStyle(1, 0x3a7a2e, 0.32);
          const seedCount = (wx * 7 + wy * 13) % 4;
          for (let i = 0; i < seedCount; i++) {
            const gx = px + 4 + ((wx * 17 + i * 11) % 24);
            const gy = py + 4 + ((wy * 19 + i * 7) % 24);
            g.moveTo(gx, gy + 4); g.lineTo(gx + 1, gy);
          }
          g.lineStyle(0);
          if (tileId === WT.flowerGrass && (wx + wy) % 3 === 0) {
            g.beginFill((wx % 2 === 0) ? 0xff5a4a : 0xffdd44, 0.65);
            g.drawCircle(px + 10 + (wx * 5) % 12, py + 10 + (wy * 3) % 12, 2);
            g.endFill();
          }
        } else if (tileId === WT.forest || tileId === WT.denseForest || tileId === WT.taiga || tileId === WT.jungle) {
          // Canopy + trunk hint + shade
          g.beginFill(tileId === WT.jungle ? 0x0c5a0c : tileId === WT.denseForest ? 0x0a2a05 : 0x2a5a18, 0.55);
          g.drawCircle(px + TILE_SIZE / 2 + ((wx * 3) % 5) - 2, py + TILE_SIZE / 2 + ((wy * 7) % 5) - 2, tileId === WT.denseForest ? 10 : 9);
          g.endFill();
          // Trunk dot
          g.beginFill(0x5a3a1a, 0.5);
          g.drawRect(px + 14 + ((wx * 5) % 4), py + 20 + ((wy * 3) % 4), 4, 6);
          g.endFill();
        } else if (tileId === WT.mountain || tileId === WT.highMountain || tileId === WT.snowPeak) {
          g.lineStyle(2, 0xffffff, tileId === WT.snowPeak ? 0.38 : 0.16);
          g.moveTo(px + 4, py + TILE_SIZE - 4); g.lineTo(px + TILE_SIZE / 2, py + 4); g.lineTo(px + TILE_SIZE - 4, py + TILE_SIZE - 4);
          g.lineStyle(0);
          // Rock facets
          g.beginFill(0xffffff, 0.07);
          g.drawPolygon([px + 8, py + 12, px + 12, py + 8, px + 20, py + 14, px + 16, py + 20]);
          g.endFill();
        } else if (tileId === WT.dirtRoad || tileId === WT.stoneRoad || tileId === WT.path) {
          g.beginFill(tileId === WT.stoneRoad ? 0x8a8a7a : 0x9a8060, 0.28);
          g.drawCircle(px + 8 + (wx * 3) % 12, py + 8 + (wy * 5) % 16, 2);
          g.drawCircle(px + 20 + (wx * 7) % 10, py + 20 + (wy * 3) % 10, 1.5);
          g.endFill();
          // Center line
          if (tileId === WT.stoneRoad) {
            g.lineStyle(1, 0x6a6a5a, 0.18);
            g.moveTo(px + 2, py + TILE_SIZE / 2); g.lineTo(px + TILE_SIZE - 2, py + TILE_SIZE / 2);
            g.lineStyle(0);
          }
        } else if (tileId === WT.beach || tileId === WT.sand) {
          g.beginFill(0xc8b47a, 0.22);
          g.drawCircle(px + 6 + (wx * 5) % 12, py + 8 + (wy * 7) % 12, 1.5);
          g.drawCircle(px + 20 + (wx * 3) % 10, py + 22 + (wy * 5) % 10, 1.2);
          g.endFill();
          // Wave fringe
          if (tileId === WT.beach) {
            g.lineStyle(1, 0xffffff, 0.12);
            g.moveTo(px, py + 6 + (wx % 4)); g.lineTo(px + TILE_SIZE, py + 4 + (wy % 5));
            g.lineStyle(0);
          }
        } else if (tileId === WT.desert) {
          // Dune stripes
          g.lineStyle(1, 0xc8a85a, 0.18);
          g.moveTo(px + 4 + (wx % 6), py + 8); g.lineTo(px + 20 + (wx % 6), py + 12);
          g.moveTo(px + 8, py + 20 + (wy % 6)); g.lineTo(px + 24, py + 24 + (wy % 4));
          g.lineStyle(0);
        } else if (tileId === WT.tundra || tileId === WT.savanna) {
          const col = tileId === WT.tundra ? 0xaac0d0 : 0x9a9a6a;
          g.beginFill(col, 0.18);
          g.drawCircle(px + 8 + (wx * 7) % 16, py + 10 + (wy * 5) % 16, 2);
          g.drawCircle(px + 22 + (wx * 3) % 8, py + 20 + (wy * 7) % 8, 1.5);
          g.endFill();
        } else if (tileId === WT.hills || tileId === WT.rockyHills) {
          // Contour + rocks
          g.lineStyle(1, 0xffffff, 0.07);
          g.moveTo(px + 4, py + 12); g.lineTo(px + 12, py + 8); g.lineTo(px + 20, py + 12);
          g.lineStyle(0);
          g.beginFill(0x6a5a40, 0.22);
          g.drawCircle(px + 10 + (wx * 5) % 12, py + 18 + (wy * 3) % 8, 2.5);
          g.drawCircle(px + 22 + (wx * 7) % 8, py + 10 + (wy * 5) % 8, 1.8);
          g.endFill();
        } else if (tileId === WT.swamp) {
          g.beginFill(0x3a5a2a, 0.32);
          g.drawCircle(px + 8 + (wx * 5) % 16, py + 20 + (wy * 3) % 8, 2.2);
          g.drawCircle(px + 18 + (wx * 3) % 12, py + 12 + (wy * 7) % 10, 1.5);
          g.endFill();
          // Lily pad
          g.beginFill(0x4a8a3a, 0.28);
          g.drawEllipse(px + 16 + (wx % 4), py + 16 + (wy % 4), 5, 3);
          g.endFill();
        } else if (tileId === WT.river || tileId === WT.lake || tileId === WT.shallowWater) {
          g.beginFill(0x3a7ab0, 0.22);
          g.drawEllipse(px + 16 + ((wx * 3) % 6) - 3, py + 16 + ((wy * 5) % 6) - 3, 7, 3);
          g.endFill();
          // Flow highlight
          g.lineStyle(1, 0x6aa0d0, 0.14);
          g.moveTo(px + 4, py + 16 + (wx % 3)); g.lineTo(px + TILE_SIZE - 4, py + 16 + (wy % 3));
          g.lineStyle(0);
        } else if (tileId === WT.ironDeposit) {
          g.beginFill(0x5a4a3a, 0.45);
          g.drawCircle(px + 10 + (wx * 7) % 12, py + 12 + (wy * 5) % 12, 3);
          g.drawCircle(px + 20 + (wx * 3) % 10, py + 20 + (wy * 7) % 8, 2);
          g.endFill();
          // Sparkle
          g.beginFill(0xaa9988, 0.5);
          g.drawCircle(px + 16 + (wx % 3), py + 16 + (wy % 3), 1);
          g.endFill();
        } else if (tileId === WT.goldDeposit) {
          g.beginFill(0x8a6a10, 0.38);
          g.drawCircle(px + 12 + (wx * 5) % 10, py + 14 + (wy * 7) % 10, 3.5);
          g.endFill();
          g.beginFill(0xffdd44, 0.55);
          g.drawCircle(px + 14 + (wx % 4), py + 14 + (wy % 4), 1.2);
          g.endFill();
        } else if (tileId === WT.deepOcean || tileId === WT.ocean) {
          // Depth shimmer
          g.beginFill(0x1a4a7a, 0.12);
          g.drawEllipse(px + 16 + (wx % 4), py + 16 + (wy % 4), 12, 4);
          g.endFill();
        }
      }
    }
    g.x = ox * TILE_SIZE;
    g.y = oy * TILE_SIZE;
    this.tileContainer.addChild(g);
    this.worldChunkGfx.set(key, g);
  }

  /** Destroy chunks farther than KEEP_RADIUS from the player's chunk */
  cullDistantChunks(prx: number, pry: number, keepRadius = 3) {
    for (const [key, gfx] of this.worldChunkGfx) {
      const [crx, cry] = key.split(",").map(Number);
      if (Math.abs(crx - prx) > keepRadius || Math.abs(cry - pry) > keepRadius) {
        gfx.destroy({ children: true });
        this.worldChunkGfx.delete(key);
        this.worldChunks.delete(key);
      }
    }
  }

  onRequestChunks: ((wx: number, wy: number) => void) | null = null;

  // ---- Local Player ----

  private fpsText: PIXI.Text | null = null;
  private localPlayerGfx: PIXI.Container | null = null;
  private lastRequestedChunkX = Number.NaN;
  private lastRequestedChunkY = Number.NaN;

  drawLocalPlayer() {
    if (!this.localPlayer) return;
    if (!this.localPlayerGfx) {
      this.localPlayerGfx = new PIXI.Container();
      this.entityContainer.addChild(this.localPlayerGfx);
    }
    drawEnhancedCharacter(
      this.localPlayerGfx, CLASS_COLORS[this.localPlayer.characterClass] ?? 0xcccccc,
      true, this.localPlayer.characterClass,
      this.localPlayer.stats.hp / this.localPlayer.stats.maxHp,
      this.localPlayer.username, this.localPlayer.level, this.localPlayer.username,
      (this.localPlayer as any).race, (this.localPlayer as any).equipment,
    );
    this.localPlayerGfx.x = this.localPlayer.x * TILE_SIZE + TILE_SIZE / 2;
    this.localPlayerGfx.y = this.localPlayer.y * TILE_SIZE + TILE_SIZE / 2;
  }
}
