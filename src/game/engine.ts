// Register Canvas2D renderer as fallback for Pixi.js v7
// These imports register canvas-based renderers when WebGL is unavailable
import "@pixi/canvas-renderer";
import "@pixi/canvas-graphics";
import "@pixi/canvas-display";
import "@pixi/canvas-text";
import "@pixi/canvas-sprite";

import * as PIXI from "pixi.js";
import type { PlayerState, GroundItem, GameMap, NPCData, MonsterData } from "@shared/types";
import { MapZone, Direction } from "@shared/types";
import { MAPS } from "@shared/maps";
import { ITEMS } from "@shared/items";
import { ParticleSystem, ScreenShake, AmbientTiles, drawEnhancedCharacter, drawEnhancedMonster, drawEnhancedItem } from "./vfx";

const TILE_SIZE = 32;

const TILE_COLORS: Record<number, number> = {
  0: 0x2d5a1e, 1: 0x8b7355, 2: 0x1a4a7a, 3: 0x3a3a3a,
  4: 0x6b5b4a, 5: 0x3a2a2a, 6: 0xc2a645, 7: 0x1a3a0e,
  8: 0x5a5a5a, 9: 0xcc3300,
};

const CLASS_COLORS: Record<string, number> = {
  warrior: 0xcc4444, mage: 0x4444cc, archer: 0x44aa44, paladin: 0xccaa44,
};

export class GameEngine {
  app: PIXI.Application;
  worldContainer: PIXI.Container;
  tileContainer: PIXI.Container;
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
    // Ensure canvas has explicit dimensions before Pixi.js touches it
    const w = window.innerWidth || 800;
    const h = window.innerHeight || 600;
    canvas.width = w;
    canvas.height = h;

    // Build options — Pixi v7 auto-detects renderer; with @pixi/canvas-renderer
    // installed, it will fall back to Canvas2D if WebGL is unavailable
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
      // Last resort: force Canvas2D
      console.warn("[GameEngine] Auto-detect failed, forcing Canvas2D:", e);
      try {
        (PIXI as any).settings.PREFER_ENV = 0; // WEBGL_LEGACY fallback path
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
    this.entityContainer = new PIXI.Container();
    this.uiContainer = new PIXI.Container();
    this.fxContainer = new PIXI.Container();

    this.worldContainer.addChild(this.tileContainer);
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
    if (tile === 2) {
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

        if (tileId === 0) {
          g.lineStyle(1, 0x3a7a2e, 0.4);
          const seed = (x * 7 + y * 13) % 5;
          for (let i = 0; i < seed; i++) {
            const gx = 4 + ((x * 17 + i * 11) % 24);
            const gy = 4 + ((y * 19 + i * 7) % 24);
            g.moveTo(gx, gy + 4); g.lineTo(gx + 1, gy);
          }
          g.lineStyle(0);
        } else if (tileId === 1) {
          g.beginFill(0x9a8365, 0.3);
          g.drawCircle(8 + (x * 3) % 12, 8 + (y * 5) % 16, 2);
          g.drawCircle(20 + (x * 7) % 8, 20 + (y * 3) % 8, 1.5);
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
    return tile !== 2 && tile !== 3 && tile !== 7 && tile !== 9;
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
