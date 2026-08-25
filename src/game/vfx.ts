import * as PIXI from "pixi.js";

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
    if (type === 2 || type === 9 || type === 7) { // water, lava, tree
      this.tiles.push({ graphics: g, x, y, type, phase: Math.random() * Math.PI * 2 });
    }
  }

  update(time: number) {
    for (const t of this.tiles) {
      const wave = Math.sin(time * 0.002 + t.phase);
      if (t.type === 2) {
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
      } else if (t.type === 9) {
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
      } else if (t.type === 7) {
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
) {
  container.removeChildren();

  const bodyColor = color;

  // Shadow
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x000000, 0.2);
  shadow.drawEllipse(0, 14, 10, 4);
  shadow.endFill();
  container.addChild(shadow);

  // Body
  const body = new PIXI.Graphics();
  body.beginFill(bodyColor);
  body.drawRoundedRect(-9, -10, 18, 22, 5);
  body.endFill();
  // Belt
  body.beginFill(0x553311);
  body.drawRect(-9, 4, 18, 3);
  body.endFill();
  // Belt buckle
  body.beginFill(0xccaa44);
  body.drawRect(-2, 4, 4, 3);
  body.endFill();
  container.addChild(body);

  // Head
  const head = new PIXI.Graphics();
  head.beginFill(0xffcc99);
  head.drawCircle(0, -16, 8);
  head.endFill();
  container.addChild(head);

  // Hair (varies by class)
  const hair = new PIXI.Graphics();
  const hairColors: Record<string, number> = {
    warrior: 0x553311, mage: 0x2222aa, archer: 0x886622, paladin: 0xcccccc,
  };
  hair.beginFill(hairColors[charClass] ?? 0x553311);
  if (charClass === "warrior") {
    // Short spiky hair
    hair.moveTo(-6, -20); hair.lineTo(-3, -26); hair.lineTo(0, -22);
    hair.lineTo(3, -26); hair.lineTo(6, -20);
    hair.lineTo(6, -18); hair.lineTo(-6, -18);
    hair.closePath();
  } else if (charClass === "mage") {
    // Pointy hat silhouette
    hair.moveTo(-8, -18); hair.lineTo(0, -32); hair.lineTo(8, -18);
    hair.closePath();
  } else if (charClass === "paladin") {
    // Helmet
    hair.drawRoundedRect(-8, -24, 16, 8, 3);
    hair.drawRect(-1, -26, 2, 4);
  } else {
    // Simple hood
    hair.drawRoundedRect(-7, -23, 14, 6, 2);
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

  // Feet
  const feet = new PIXI.Graphics();
  feet.beginFill(0x332211);
  feet.drawRoundedRect(-7, 12, 6, 4, 2);
  feet.drawRoundedRect(1, 12, 6, 4, 2);
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

const MONSTER_VISUALS: Record<string, { bodyColor: number; eyeColor: number; shape: string }> = {
  Goblin: { bodyColor: 0x44aa44, eyeColor: 0xffff00, shape: "goblin" },
  Lobo: { bodyColor: 0x666666, eyeColor: 0xff4444, shape: "wolf" },
  Esqueleto: { bodyColor: 0xddddcc, eyeColor: 0xff0000, shape: "skeleton" },
  Ogro: { bodyColor: 0x886644, eyeColor: 0xff2222, shape: "ogre" },
};

export function drawEnhancedMonster(container: PIXI.Container, name: string, hpPct: number) {
  container.removeChildren();
  const vis = MONSTER_VISUALS[name] ?? { bodyColor: 0xaa3333, eyeColor: 0xff0000, shape: "default" };

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
