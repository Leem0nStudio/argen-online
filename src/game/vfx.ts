import * as PIXI from "pixi.js";
import { T } from "@shared/maps";

const TILE_SIZE = 32;

// ============================================================
// Particle System
// ============================================================

interface Particle {
  sprite: PIXI.Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
  fadeOut: boolean;
  shrink: boolean;
  startScale: number;
}

export class ParticleSystem {
  container: PIXI.Container;
  particles: Particle[] = [];

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Container();
    parent.addChild(this.container);
  }

  emit(x: number, y: number, opts: {
    count?: number; color?: number; size?: number;
    speed?: number; spread?: number; life?: number;
    gravity?: number; fadeOut?: boolean; shrink?: boolean;
    startAngle?: number; endAngle?: number;
  } = {}) {
    const {
      count = 8, color = 0xffaa00, size = 3,
      speed = 1.5, spread = Math.PI * 2, life = 0.6,
      gravity = 0, fadeOut = true, shrink = false,
      startAngle = 0, endAngle = Math.PI * 2,
    } = opts;

    for (let i = 0; i < count; i++) {
      const angle = startAngle + Math.random() * spread;
      const spd = speed * (0.5 + Math.random() * 0.5);
      const g = new PIXI.Graphics();
      g.beginFill(color);
      g.drawCircle(0, 0, size * (0.5 + Math.random() * 0.5));
      g.endFill();
      g.x = x;
      g.y = y;

      const p: Particle = {
        sprite: g, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        life, maxLife: life, gravity, fadeOut, shrink, startScale: 1,
      };
      this.particles.push(p);
      this.container.addChild(g);
    }
  }

  // Burst of sparkles (for level up, pickup, crit)
  burst(x: number, y: number, color: number, count = 12) {
    this.emit(x, y, {
      count, color, size: 2.5, speed: 2, life: 0.8,
      gravity: -0.5, fadeOut: true, shrink: true,
    });
  }

  // Blood splatter
  blood(x: number, y: number) {
    this.emit(x, y, {
      count: 6, color: 0xcc2222, size: 2, speed: 1.2,
      life: 0.4, gravity: 1, fadeOut: true,
      spread: Math.PI,
    });
  }

  // Gold sparkle (for gold drop)
  goldSparkle(x: number, y: number) {
    this.emit(x, y, {
      count: 5, color: 0xffdd44, size: 1.5, speed: 0.8,
      life: 0.6, gravity: -0.3, fadeOut: true, shrink: true,
    });
  }

  // Heal effect (green sparkles going up)
  healEffect(x: number, y: number) {
    this.emit(x, y, {
      count: 8, color: 0x44ff44, size: 2, speed: 0.6,
      life: 0.8, gravity: -1, fadeOut: true, shrink: true,
      startAngle: -Math.PI * 0.8, endAngle: -Math.PI * 0.2,
    });
  }

  // Water splash
  waterSplash(x: number, y: number) {
    this.emit(x, y, {
      count: 4, color: 0x4488cc, size: 2, speed: 1,
      life: 0.5, gravity: 1.5, fadeOut: true,
      startAngle: -Math.PI * 0.9, endAngle: -Math.PI * 0.1,
    });
  }

  // Death skull effect
  deathEffect(x: number, y: number) {
    this.emit(x, y, {
      count: 20, color: 0xff4444, size: 3, speed: 2.5,
      life: 1, gravity: 0.5, fadeOut: true, shrink: true,
    });
    // Second wave
    setTimeout(() => {
      this.emit(x, y - 10, {
        count: 10, color: 0xaa0000, size: 2, speed: 1.5,
        life: 0.8, gravity: -0.3, fadeOut: true,
      });
    }, 100);
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.container.removeChild(p.sprite);
        p.sprite.destroy();
        this.particles.splice(i, 1);
        continue;
      }
      p.vx *= 0.98;
      p.vy += p.gravity * dt;
      p.sprite.x += p.vx;
      p.sprite.y += p.vy;
      const ratio = p.life / p.maxLife;
      if (p.fadeOut) p.sprite.alpha = ratio;
      if (p.shrink) p.sprite.scale.set(p.startScale * ratio);
    }
  }

  destroy() {
    for (const p of this.particles) {
      this.container.removeChild(p.sprite);
      p.sprite.destroy();
    }
    this.particles = [];
  }
}

// ============================================================
// Screen Shake
// ============================================================

export class ScreenShake {
  private intensity = 0;
  private duration = 0;
  private elapsed = 0;
  private target: PIXI.Container;

  constructor(target: PIXI.Container) {
    this.target = target;
  }

  trigger(intensity: number, duration: number) {
    this.intensity = intensity;
    this.duration = duration;
    this.elapsed = 0;
  }

  update(dt: number) {
    if (this.elapsed >= this.duration) return;
    this.elapsed += dt;
    const progress = this.elapsed / this.duration;
    const shake = this.intensity * (1 - progress);
    this.target.x += (Math.random() - 0.5) * shake * 2;
    this.target.y += (Math.random() - 0.5) * shake * 2;
  }
}

// ============================================================
// Ambient Tile Animations (water shimmer, torch flicker)
// ============================================================

interface AnimatedTile {
  graphics: PIXI.Graphics;
  x: number;
  y: number;
  type: number;
  phase: number;
}

export class AmbientTiles {
  tiles: AnimatedTile[] = [];

  addTile(g: PIXI.Graphics, x: number, y: number, type: number) {
    if (type === T.water || type === T.lava || type === T.tree || type === T.swamp) {
      this.tiles.push({ graphics: g, x, y, type, phase: Math.random() * Math.PI * 2 });
    }
  }

  update(time: number) {
    for (const t of this.tiles) {
      const wave = Math.sin(time * 0.002 + t.phase);
      if (t.type === T.water || t.type === T.swamp) {
        // Water shimmer
        const baseColor = 0x1a4a7a;
        const highlight = 0x2a6a9a;
        const r1 = (baseColor >> 16) & 0xff;
        const g1 = (baseColor >> 8) & 0xff;
        const b1 = baseColor & 0xff;
        const r2 = (highlight >> 16) & 0xff;
        const g2 = (highlight >> 8) & 0xff;
        const b2 = highlight & 0xff;
        const mix = (wave + 1) * 0.5;
        const r = Math.round(r1 + (r2 - r1) * mix);
        const g = Math.round(g1 + (g2 - g1) * mix);
        const b = Math.round(b1 + (b2 - b1) * mix);
        const color = (r << 16) | (g << 8) | b;
        t.graphics.clear();
        t.graphics.beginFill(color);
        t.graphics.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
        t.graphics.endFill();
        // Highlight stripe
        t.graphics.beginFill(0x4488bb, 0.2 * wave);
        t.graphics.drawRect(2 + wave * 4, 8, TILE_SIZE - 8, 2);
        t.graphics.endFill();
      } else if (t.type === T.lava) {
        // Lava glow
        const baseColor = 0xcc3300;
        const glow = 0xff6600;
        const r1 = (baseColor >> 16) & 0xff;
        const g1 = (baseColor >> 8) & 0xff;
        const b1 = baseColor & 0xff;
        const r2 = (glow >> 16) & 0xff;
        const g2 = (glow >> 8) & 0xff;
        const b2 = glow & 0xff;
        const mix = (wave + 1) * 0.5;
        const r = Math.round(r1 + (r2 - r1) * mix);
        const g = Math.round(g1 + (g2 - g1) * mix);
        const b = Math.round(b1 + (b2 - b1) * mix);
        const color = (r << 16) | (g << 8) | b;
        t.graphics.clear();
        t.graphics.beginFill(color);
        t.graphics.drawRect(0, 0, TILE_SIZE, TILE_SIZE);
        t.graphics.endFill();
        // Ember glow
        t.graphics.beginFill(0xff8800, 0.15 + 0.1 * wave);
        t.graphics.drawCircle(TILE_SIZE / 2 + wave * 3, TILE_SIZE / 2, 6);
        t.graphics.endFill();
      } else if (t.type === T.tree) {
        // Tree sway
        t.graphics.y = t.y * TILE_SIZE + wave * 1.5;
      }
    }
  }

  clear() {
    this.tiles = [];
  }
}

// ============================================================
// Enhanced Character Drawing
// ============================================================

export function drawEnhancedCharacter(
  container: PIXI.Container,
  color: number,
  isLocal: boolean,
  charClass: string,
  hpPct: number,
  name: string,
  level: number,
  username?: string,
  race?: string,
  equipment?: { weapon?: string | null; armor?: string | null; shield?: string | null; head?: string | null; boots?: string | null; ring?: string | null },
) {
  const equipSig = equipment ? `${equipment.weapon ?? ""}|${equipment.armor ?? ""}|${equipment.shield ?? ""}|${equipment.head ?? ""}` : "";
  const sig = `${username || name}|${level}|${charClass}|${race ?? ""}|${equipSig}|${isLocal ? 1 : 0}|${color}|${Math.round(hpPct * 20)}`;
  if ((container as any)._vfxSig === sig) return;
  (container as any)._vfxSig = sig;
  container.removeChildren();

  // Race modifiers
  const raceMods: Record<string, { skin: number; scale: number; hair: number }> = {
    humano: { skin: 0xffcc99, scale: 1, hair: 0x553311 },
    elfo: { skin: 0xffe8cc, scale: 1.04, hair: 0xdddd77 },
    elfo_oscuro: { skin: 0xc8b8d0, scale: 1.04, hair: 0xeeeeff },
    enano: { skin: 0xd8a080, scale: 0.88, hair: 0x8a4422 },
    gnomo: { skin: 0xffd8b0, scale: 0.78, hair: 0xcc8855 },
  };
  const rm = raceMods[race ?? "humano"] ?? raceMods.humano;
  const bodyColorBase = color;
  const skinColor = rm.skin;
  const s = rm.scale;

  // Armor tint overrides body color
  const armorColors: Record<string, number> = { leather_armor: 0x8a5a2a, chainmail: 0x7a8a8a, plate_armor: 0xc0c8d0 };
  const bodyColor = equipment?.armor && armorColors[equipment.armor] ? armorColors[equipment.armor] : bodyColorBase;

  // Shadow (scaled)
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x000000, 0.2);
  shadow.drawEllipse(0, 14 * s, 10 * s, 4 * s);
  shadow.endFill();
  container.addChild(shadow);

  // Body (scaled + armor tint)
  const body = new PIXI.Graphics();
  body.beginFill(bodyColor);
  body.drawRoundedRect(-9 * s, -10 * s, 18 * s, 22 * s, 5 * s);
  body.endFill();
  // Belt
  body.beginFill(0x553311);
  body.drawRect(-9 * s, 4 * s, 18 * s, 3 * s);
  body.endFill();
  body.beginFill(0xccaa44);
  body.drawRect(-2 * s, 4 * s, 4 * s, 3 * s);
  body.endFill();
  container.addChild(body);

  // Head (race skin)
  const head = new PIXI.Graphics();
  head.beginFill(skinColor);
  head.drawCircle(0, -16, 8 * s);
  head.endFill();
  container.addChild(head);
  // Head equipment (helmet)
  if (equipment?.head) {
    const helm = new PIXI.Graphics();
    const helmColors: Record<string, number> = { leather_armor: 0x6a4a2a, chainmail: 0x8a8a8a, plate_armor: 0xc0c8d0 };
    helm.beginFill(helmColors[equipment.head] ?? 0x7a6a4a);
    helm.drawRoundedRect(-8 * s, -24 * s, 16 * s, 8 * s, 3 * s);
    helm.endFill();
    container.addChild(helm);
  }

  // Hair / helmet (class + race)
  const hair = new PIXI.Graphics();
  const classHair: Record<string, number> = { warrior: rm.hair, mage: 0x2222aa, archer: rm.hair, paladin: 0xcccccc };
  hair.beginFill(classHair[charClass] ?? rm.hair);
  if (charClass === "warrior") {
    hair.moveTo(-6 * s, -20 * s); hair.lineTo(-3 * s, -26 * s); hair.lineTo(0, -22 * s);
    hair.lineTo(3 * s, -26 * s); hair.lineTo(6 * s, -20 * s);
    hair.lineTo(6 * s, -18 * s); hair.lineTo(-6 * s, -18 * s);
    hair.closePath();
  } else if (charClass === "mage") {
    hair.moveTo(-8 * s, -18 * s); hair.lineTo(0, -32 * s); hair.lineTo(8 * s, -18 * s);
    hair.closePath();
  } else if (charClass === "paladin") {
    hair.drawRoundedRect(-8 * s, -24 * s, 16 * s, 8 * s, 3 * s);
    hair.drawRect(-1 * s, -26 * s, 2 * s, 4 * s);
  } else {
    hair.drawRoundedRect(-7 * s, -23 * s, 14 * s, 6 * s, 2 * s);
  }
  hair.endFill();
  container.addChild(hair);

  // Eyes
  const eyes = new PIXI.Graphics();
  eyes.beginFill(isLocal ? 0x000000 : 0x111111);
  eyes.drawCircle(-3, -17, 1.5);
  eyes.drawCircle(3, -17, 1.5);
  eyes.endFill();
  // Eye whites
  eyes.beginFill(0xffffff);
  eyes.drawCircle(-3, -17.5, 0.5);
  eyes.drawCircle(3, -17.5, 0.5);
  eyes.endFill();
  container.addChild(eyes);

  // Feet (boots tint)
  const feet = new PIXI.Graphics();
  const bootsColors: Record<string, number> = { leather_armor: 0x5a3a1a, chainmail: 0x4a4a4a, plate_armor: 0x8a8a8a };
  const bootCol = equipment?.boots && bootsColors[equipment.boots] ? bootsColors[equipment.boots] : 0x332211;
  feet.beginFill(bootCol);
  feet.drawRoundedRect(-7 * s, 12 * s, 6 * s, 4 * s, 2 * s);
  feet.drawRoundedRect(1 * s, 12 * s, 6 * s, 4 * s, 2 * s);
  feet.endFill();
  container.addChild(feet);

  // Class emblem
  const emblems: Record<string, () => void> = {
    warrior: () => {
      const sword = new PIXI.Graphics();
      sword.beginFill(0xcccccc);
      sword.drawRect(-1, -8, 2, 10);
      sword.drawRect(-4, -1, 8, 2);
      sword.endFill();
      container.addChild(sword);
    },
    mage: () => {
      const star = new PIXI.Graphics();
      star.beginFill(0x4488ff, 0.8);
      // Manual 5-point star
      const pts = 5; const outer = 3; const inner = 1.5;
      star.moveTo(0, -outer);
      for (let i = 1; i <= pts * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (i * Math.PI) / pts - Math.PI / 2;
        star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      star.closePath();
      star.endFill();
      container.addChild(star);
    },
    archer: () => {
      const bow = new PIXI.Graphics();
      bow.lineStyle(1.5, 0x886622);
      bow.arc(-5, -2, 6, -1.2, 1.2);
      bow.moveTo(-5, -7); bow.lineTo(-5, 3);
      container.addChild(bow);
    },
    paladin: () => {
      const shield = new PIXI.Graphics();
      shield.beginFill(0xccaa44, 0.8);
      shield.moveTo(-5, -6); shield.lineTo(5, -6); shield.lineTo(3, 2); shield.lineTo(-3, 2);
      shield.closePath();
      shield.endFill();
      container.addChild(shield);
    },
  };
  emblems[charClass]?.();

  // Equipment visuals (weapon/shield) — zero-asset geometry
  if (equipment?.weapon) {
    const w = new PIXI.Graphics();
    const weaponColors: Record<string, number> = { rusty_sword: 0x7a7a7a, iron_sword: 0x9a9a9a, steel_sword: 0xccdddd, oak_bow: 0x8a5a1a, mage_staff: 0x5a3a8a, flame_blade: 0xff4422, iron_pickaxe: 0x6a6a6a, wood_axe: 0x6a4a2a };
    const col = weaponColors[equipment.weapon] ?? 0xcccccc;
    if (equipment.weapon.includes("bow")) {
      w.lineStyle(1.5 * s, 0x8a5a1a);
      w.arc(10 * s, -2 * s, 7 * s, -1.0, 1.0);
      w.moveTo(10 * s, -8 * s); w.lineTo(10 * s, 4 * s);
    } else if (equipment.weapon.includes("staff")) {
      w.lineStyle(2 * s, col);
      w.moveTo(10 * s, -12 * s); w.lineTo(10 * s, 8 * s);
      w.beginFill(0x44aaff, 0.7); w.drawCircle(10 * s, -14 * s, 3 * s); w.endFill();
    } else {
      // Sword / axe / pickaxe
      w.beginFill(col);
      w.drawRect(9 * s, -10 * s, 2.5 * s, 14 * s);
      w.endFill();
      w.beginFill(0x553311);
      w.drawRect(8 * s, 0 * s, 4.5 * s, 3 * s);
      w.endFill();
      if (equipment.weapon.includes("axe") || equipment.weapon.includes("pickaxe")) {
        w.beginFill(0x8a8a8a);
        w.drawRect(6 * s, -12 * s, 8 * s, 4 * s);
        w.endFill();
      }
    }
    container.addChild(w);
  }
  if (equipment?.shield) {
    const sh = new PIXI.Graphics();
    const shieldColors: Record<string, number> = { wooden_shield: 0x8a5a2a, chainmail: 0x7a7a7a };
    sh.beginFill(shieldColors[equipment.shield] ?? 0x8a5a2a, 0.9);
    sh.drawRoundedRect(-14 * s, -6 * s, 7 * s, 10 * s, 2 * s);
    sh.endFill();
    container.addChild(sh);
  }

  // Name
  const nameText = new PIXI.Text(username || name, {
    fontSize: 10,
    fill: isLocal ? 0xffffff : 0xe0d5c1,
    fontWeight: isLocal ? "bold" : "normal",
    dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1,
  });
  nameText.anchor.set(0.5);
  nameText.y = 18;
  container.addChild(nameText);

  // Level
  const levelText = new PIXI.Text(`Lv.${level}`, {
    fontSize: 8, fill: 0xd4a843,
    dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1,
  });
  levelText.anchor.set(0.5);
  levelText.y = 30;
  container.addChild(levelText);

  // HP bar
  const hpBg = new PIXI.Graphics();
  hpBg.beginFill(0x222222, 0.8);
  hpBg.drawRoundedRect(-12, -34, 24, 4, 2);
  hpBg.endFill();
  container.addChild(hpBg);

  const hpFill = new PIXI.Graphics();
  hpFill.beginFill(hpPct > 0.3 ? 0x22aa22 : hpPct > 0.15 ? 0xccaa22 : 0xcc3333);
  hpFill.drawRoundedRect(-12, -34, Math.max(0, 24 * hpPct), 4, 2);
  hpFill.endFill();
  container.addChild(hpFill);

  // Selection ring for local player
  if (isLocal) {
    const ring = new PIXI.Graphics();
    ring.lineStyle(1.5, 0xffffff, 0.4);
    ring.drawEllipse(0, 14, 12, 5);
    container.addChild(ring);
  }
}

// ============================================================
// Enhanced Monster Drawing
// ============================================================

const MONSTER_VISUALS: Record<string, { bodyColor: number; eyeColor: number; shape: string; scale: number }> = {
  Goblin: { bodyColor: 0x44cc33, eyeColor: 0xffff00, shape: "goblin", scale: 0.92 },
  Lobo: { bodyColor: 0x5a5a5a, eyeColor: 0xff5533, shape: "wolf", scale: 1.02 },
  Esqueleto: { bodyColor: 0xe8e0d0, eyeColor: 0xff2222, shape: "skeleton", scale: 1.0 },
  Ogro: { bodyColor: 0x8a5a2a, eyeColor: 0xff1111, shape: "ogre", scale: 1.32 },
};

export function drawEnhancedMonster(container: PIXI.Container, name: string, hpPct: number) {
  const sig = `m|${name}|${Math.round(hpPct * 20)}`;
  if ((container as any)._vfxSig === sig) return;
  (container as any)._vfxSig = sig;
  container.removeChildren();
  const vis = (MONSTER_VISUALS[name] ?? { bodyColor: 0xaa3333, eyeColor: 0xff0000, shape: "default", scale: 1 }) as typeof MONSTER_VISUALS[string];
  container.scale.set(vis.scale ?? 1);

  // Shadow
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x000000, 0.25);
  shadow.drawEllipse(0, 10, 9, 3);
  shadow.endFill();
  container.addChild(shadow);

  const body = new PIXI.Graphics();
  body.beginFill(vis.bodyColor);

  if (vis.shape === "goblin") {
    body.drawRoundedRect(-8, -8, 16, 18, 4);
    body.endFill();
    // Ears
    body.beginFill(vis.bodyColor);
    body.moveTo(-8, -6); body.lineTo(-13, -10); body.lineTo(-6, -4);
    body.moveTo(8, -6); body.lineTo(13, -10); body.lineTo(6, -4);
    body.endFill();
  } else if (vis.shape === "wolf") {
    body.moveTo(-10, -4); body.lineTo(0, -10); body.lineTo(10, -4);
    body.lineTo(8, 6); body.lineTo(-8, 6);
    body.closePath();
    body.endFill();
    // Ears
    body.beginFill(vis.bodyColor);
    body.moveTo(-6, -8); body.lineTo(-9, -14); body.lineTo(-2, -8);
    body.moveTo(6, -8); body.lineTo(9, -14); body.lineTo(2, -8);
    body.endFill();
  } else if (vis.shape === "skeleton") {
    body.drawRoundedRect(-7, -10, 14, 20, 3);
    body.endFill();
    // Ribs
    body.lineStyle(1, 0x999999);
    for (let i = 0; i < 3; i++) {
      body.moveTo(-5, -4 + i * 4); body.lineTo(5, -4 + i * 4);
    }
  } else if (vis.shape === "ogre") {
    body.drawRoundedRect(-10, -8, 20, 20, 6);
    body.endFill();
    // Horns
    body.beginFill(0x553322);
    body.moveTo(-7, -8); body.lineTo(-10, -16); body.lineTo(-4, -8);
    body.moveTo(7, -8); body.lineTo(10, -16); body.lineTo(4, -8);
    body.endFill();
  } else {
    body.drawRoundedRect(-8, -8, 16, 16, 3);
    body.endFill();
  }
  container.addChild(body);

  // Eyes
  const eyes = new PIXI.Graphics();
  eyes.beginFill(vis.eyeColor);
  eyes.drawCircle(-3, -3, 2);
  eyes.drawCircle(3, -3, 2);
  eyes.endFill();
  // Pupils
  eyes.beginFill(0x000000);
  eyes.drawCircle(-3, -3, 0.8);
  eyes.drawCircle(3, -3, 0.8);
  eyes.endFill();
  container.addChild(eyes);

  // Weapon hint per monster
  const weapon = new PIXI.Graphics();
  if (vis.shape === "goblin") {
    weapon.beginFill(0x7a7a7a); weapon.drawRect(7, -4, 2, 8); weapon.endFill();
    weapon.beginFill(0xcc2222); weapon.drawCircle(8, -6, 1.5); weapon.endFill();
  } else if (vis.shape === "wolf") {
    // Claws
    weapon.lineStyle(1, 0xcccccc, 0.7);
    weapon.moveTo(-6, 4); weapon.lineTo(-9, 7);
    weapon.moveTo(6, 4); weapon.lineTo(9, 7);
    weapon.lineStyle(0);
  } else if (vis.shape === "skeleton") {
    weapon.beginFill(0xddccaa); weapon.drawRect(8, -8, 2, 12); weapon.endFill();
    weapon.beginFill(0xaaaaaa); weapon.moveTo(6, -8); weapon.lineTo(12, -8); weapon.lineTo(9, -12); weapon.closePath(); weapon.endFill();
  } else if (vis.shape === "ogre") {
    weapon.beginFill(0x5a3a1a); weapon.drawRect(10, -10, 3, 14); weapon.endFill();
    weapon.beginFill(0x6a6a6a); weapon.drawCircle(11.5, -12, 4); weapon.endFill();
  }
  container.addChild(weapon);

  // Name
  const nameText = new PIXI.Text(name, {
    fontSize: 9, fill: 0xcc6666,
    dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1,
  });
  nameText.anchor.set(0.5);
  nameText.y = 16;
  container.addChild(nameText);

  // HP bar
  const hpBg = new PIXI.Graphics();
  hpBg.beginFill(0x222222, 0.8);
  hpBg.drawRoundedRect(-12, -16, 24, 4, 2);
  hpBg.endFill();
  container.addChild(hpBg);

  const hpFill = new PIXI.Graphics();
  hpFill.beginFill(0xcc3333);
  hpFill.drawRoundedRect(-12, -16, Math.max(0, 24 * hpPct), 4, 2);
  hpFill.endFill();
  container.addChild(hpFill);
}

// ============================================================
// Enhanced Ground Item Drawing
// ============================================================

const ITEM_GLOW_COLORS: Record<string, number> = {
  common: 0xaaaaaa, uncommon: 0x44cc44, rare: 0x4488ff, epic: 0xaa44ff, legendary: 0xffaa00,
};

export function drawEnhancedItem(container: PIXI.Container, name: string, rarity: string = "common") {
  const sig = `i|${name}|${rarity}`;
  if ((container as any)._vfxSig === sig) return;
  (container as any)._vfxSig = sig;
  container.removeChildren();
  const glowColor = ITEM_GLOW_COLORS[rarity] ?? 0xffdd44;

  // Glow pulse ring
  const glow = new PIXI.Graphics();
  glow.beginFill(glowColor, 0.15);
  glow.drawCircle(0, 0, 10);
  glow.endFill();
  container.addChild(glow);

  // Core
  const core = new PIXI.Graphics();
  core.beginFill(glowColor, 0.6);
  core.drawCircle(0, 0, 5);
  core.endFill();
  core.beginFill(glowColor);
  core.drawCircle(0, 0, 3);
  core.endFill();
  container.addChild(core);

  // Name label
  const label = new PIXI.Text(name, {
    fontSize: 8, fill: glowColor,
    dropShadow: true, dropShadowColor: 0x000000, dropShadowDistance: 1,
  });
  label.anchor.set(0.5);
  label.y = 12;
  container.addChild(label);
}
