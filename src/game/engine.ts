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

  camera = { x: 0, y: 0 };
  currentMap: GameMap | null = null;
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

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.app.ticker.add(this.update);
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
  };

  handleKeyDown = (e: KeyboardEvent) => this.keys.add(e.key.toLowerCase());
  handleKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  moveFromJoystick(dx: number, dy: number, direction: Direction) {
    if (!this.localPlayer || !this.currentMap) return;
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

  loadMap(mapId: string) {
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
        const color = TILE_COLORS[tileId] ?? 0x222222;

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
    this.updateCamera();
    this.drawLocalPlayer();
  }

  updateLocalPlayer(player: PlayerState) {
    if (!this.localPlayer) return;
    const oldLevel = this.localPlayer.level;
    this.localPlayer = { ...player };
    this.updateCamera();
    if (player.level > oldLevel) this.playLevelUpEffect();
  }

  addOtherPlayer(player: PlayerState) {
    if (this.otherPlayers.has(player.id)) { this.updateOtherPlayer(player); return; }
    const container = new PIXI.Container();
    drawEnhancedCharacter(container, CLASS_COLORS[player.characterClass] ?? 0xcccccc, false, player.characterClass, player.stats.hp / player.stats.maxHp, player.username, player.level);
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
    drawEnhancedCharacter(container, CLASS_COLORS[player.characterClass] ?? 0xcccccc, false, player.characterClass, player.stats.hp / player.stats.maxHp, player.username, player.level);
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
    const colors: Record<string, number> = { merchant: 0xccaa44, quest: 0x4488cc, dialog: 0x44aa66 };
    drawEnhancedCharacter(container, colors[npc.type] ?? 0xcccccc, false, "warrior", 1, npc.name, 1, npc.name);

    const icons: Record<string, string> = { merchant: "💰", quest: "❗", dialog: "💬" };
    const indicator = new PIXI.Text(icons[npc.type] ?? "?", { fontSize: 16 });
    indicator.anchor.set(0.5);
    indicator.y = -36;
    container.addChild(indicator);

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

  updateCamera() {
    if (!this.localPlayer) return;
    const targetX = -(this.localPlayer.x * TILE_SIZE + TILE_SIZE / 2) + this.screenW / 2;
    const targetY = -(this.localPlayer.y * TILE_SIZE + TILE_SIZE / 2) + this.screenH / 2;
    this.camera.x += (targetX - this.camera.x) * 0.15;
    this.camera.y += (targetY - this.camera.y) * 0.15;
    this.worldContainer.x = this.camera.x;
    this.worldContainer.y = this.camera.y;
  }

  // ---- Update Loop ----

  update = () => {
    if (this.destroyed || !this.localPlayer || !this.currentMap) return;

    this.animTime = Date.now();
    this.ambientTiles.update(this.animTime);
    this.particles.update(0.016);
    this.shake.update(0.016);

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
    if (!this.currentMap) return false;
    if (x < 0 || x >= this.currentMap.width || y < 0 || y >= this.currentMap.height) return false;
    const tile = this.currentMap.tiles[y]?.[x];
    if (tile === undefined) return false;
    return tile !== T.water && tile !== T.wall && tile !== T.tree &&
           tile !== T.deadTree && tile !== T.thorn && tile !== T.lava;
  }

  // ---- Local Player ----

  private localPlayerGfx: PIXI.Container | null = null;

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
    );
    this.localPlayerGfx.x = this.localPlayer.x * TILE_SIZE + TILE_SIZE / 2;
    this.localPlayerGfx.y = this.localPlayer.y * TILE_SIZE + TILE_SIZE / 2;
  }
}
