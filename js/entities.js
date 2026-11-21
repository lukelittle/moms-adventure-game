/* =====================================================================
   ODYSSEY — Entities
   The hero, enemies, bosses, NPCs, pickups, projectiles and push blocks,
   plus the small physics helpers they all share.
   Positions (x, y) are the centre of an entity's FEET in pixels inside
   the 256x176 play area. `z` is height above the ground (for jumping).
   ===================================================================== */

const TILE = 16, COLS = 16, ROWS = 11, VIEW_W = 256, VIEW_H = 176;

// ---------------------------------------------------------------------
// Physics helpers
// ---------------------------------------------------------------------
const SOLID = new Set('TBRM~hrnFS#WCtQxXLcOG'.split(''));
const LOW = new Set(['F', 'B', 'R']);     // low obstacles the hero can jump over

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DIRS = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

function tileAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return null;
  return G.room.tiles[ty][tx];
}
function tileAtPx(x, y) { return tileAt(Math.floor(x / TILE), Math.floor(y / TILE)); }

/** Does tile `ch` block entity `e`? */
function tileBlocks(ch, e) {
  if (ch === 'd') return !G.room.doorsOpen;
  if (ch === 'p') return !(e.isPlayer || e.flying || e.isProjectile || e.isBlock);
  if (ch === '~') return !(e.flying || e.isProjectile);
  if (e.isProjectile) return SOLID.has(ch) && !LOW.has(ch);
  if (LOW.has(ch) && e.isPlayer && e.z > 3) return false;
  return SOLID.has(ch);
}

/** Would a w x h box centred at (x, y) collide with anything? */
function boxBlocked(x, y, w, h, e) {
  const x0 = Math.floor((x - w / 2) / TILE), x1 = Math.floor((x + w / 2 - 0.001) / TILE);
  const y0 = Math.floor((y - h / 2) / TILE), y1 = Math.floor((y + h / 2 - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) {
        if (e.isPlayer && G.edgeOpen(tx, ty)) continue;
        return true;
      }
      if (!e.isPlayer && !e.isProjectile && !e.flyFree && (tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1)) return true;
      if (tileBlocks(G.room.tiles[ty][tx], e)) return true;
    }
  if (!e.isProjectile) {
    const box = { x: x - w / 2, y: y - h / 2, w, h };
    for (const o of G.ents) if (o.solid && o !== e && !o.dead && ov(box, o.box())) return true;
  }
  return false;
}

/** Move an entity, sliding along walls. The hero also gets "corner
    nudging" so it slips into doorways without pixel-perfect aim. */
function moveEntity(e, dx, dy) {
  let hitX = false, hitY = false;
  const step = (axis, d, other) => {
    const n = Math.max(1, Math.ceil(Math.abs(d) / 3));
    const s = d / n;
    for (let i = 0; i < n; i++) {
      const nx = axis === 'x' ? e.x + s : e.x, ny = axis === 'y' ? e.y + s : e.y;
      if (!boxBlocked(nx, ny, e.w, e.h, e)) { e.x = nx; e.y = ny; continue; }
      if (e.isPlayer && !other) {
        // try sliding around a corner
        for (let off = 1; off <= 7; off++) {
          let done = false;
          for (const sg of [-1, 1]) {
            const tx = axis === 'x' ? nx : e.x + sg * off, ty = axis === 'y' ? ny : e.y + sg * off;
            if (!boxBlocked(tx, ty, e.w, e.h, e) && !boxBlocked(axis === 'x' ? e.x : e.x + sg, axis === 'y' ? e.y : e.y + sg, e.w, e.h, e)) {
              const m = Math.min(1, Math.abs(s));
              if (axis === 'x') e.y += sg * m; else e.x += sg * m;
              done = true; break;
            }
          }
          if (done) break;
        }
      }
      return true;
    }
    return false;
  };
  if (dx) hitX = step('x', dx, dy);
  if (dy) hitY = step('y', dy, dx);
  return { hitX, hitY };
}

function shadow(g, x, y, w) {
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath(); g.ellipse(Math.round(x), Math.round(y) + 1, w / 2, w / 5 + 1, 0, 0, Math.PI * 2); g.fill();
}

/** Spawn a small burst of square particles. */
function burst(x, y, color, n = 8, speed = 60, life = 0.4) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * rand(0.4, 1);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: life * rand(0.6, 1), max: life, color, size: Math.random() < 0.5 ? 2 : 1 });
  }
}
function puff(x, y) { burst(x, y, '#ffffff', 10, 50, 0.45); burst(x, y, '#c8c8d8', 6, 30, 0.5); }

// ---------------------------------------------------------------------
// Base entity
// ---------------------------------------------------------------------
class Entity {
  constructor(x, y) {
    this.x = x; this.y = y; this.z = 0;
    this.w = 10; this.h = 8;
    this.dead = false; this.flash = 0; this.t = 0;
  }
  box() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  body() { return { x: this.x - 6, y: this.y - 13 - this.z, w: 12, h: 16 }; }
  update(dt) { }
  draw(g) { }
}

// ---------------------------------------------------------------------
// The hero
// ---------------------------------------------------------------------
class Player extends Entity {
  constructor(x, y) {
    super(x, y);
    this.isPlayer = true;
    this.w = 10; this.h = 8;
    this.face = 'down';
    this.state = 'walk';      // walk | attack | spin | roll | fall | hurt | hold | dead
    this.st = 0;              // time left in the current state
    this.vz = 0;
    this.inv = 0;             // invulnerability timer
    this.anim = 0;
    this.push = 0;            // how long we've been pushing against something
    this.safe = { x, y };     // last safe ground spot (for pits)
    this.hang = 0;
    this.jdx = 0; this.jdy = 0;
    this.kbx = 0; this.kby = 0;
    this.spinCool = 0; this.rollCool = 0;
    this.swordHits = new Set();
    this.holdItem = null;
  }
  get airborne() { return this.z > 0 || this.vz > 0 || this.hang > 0; }

  update(dt) {
    const S = G.save;
    this.t += dt;
    this.inv = Math.max(0, this.inv - dt);
    this.spinCool = Math.max(0, this.spinCool - dt);
    this.rollCool = Math.max(0, this.rollCool - dt);
    this.flash = Math.max(0, this.flash - dt);
    if (this.state === 'hold' || this.state === 'dead') return;

    // ---- falling into a pit ----
    if (this.state === 'fall') {
      this.st -= dt;
      if (this.st <= 0) {
        this.x = this.safe.x; this.y = this.safe.y; this.z = 0;
        this.state = 'walk';
        this.damage(1, true);
        this.inv = Math.max(this.inv, 1.2);
      }
      return;
    }
    // ---- knocked back after being hurt ----
    if (this.state === 'hurt') {
      this.st -= dt;
      moveEntity(this, this.kbx * dt, this.kby * dt);
      this.kbx *= 0.9; this.kby *= 0.9;
      if (this.st <= 0) this.state = 'walk';
      this.physicsZ(dt);
      this.checkGround();
      return;
    }

    const ix = Input.dx, iy = Input.dy;
    const moving = ix !== 0 || iy !== 0;
    if (moving && (this.state === 'walk')) this.setFace(ix, iy);

    // ---- start actions ----
    if (this.state === 'walk' && !this.airborne) {
      if (Input.pressed('attack')) {
        if (!G.tryInteract()) this.startAttack();
      } else if (Input.pressed('spin')) {
        if (this.spinCool <= 0) {
          this.state = 'spin'; this.st = 0.42; this.swordHits.clear(); this.spinCool = 0.5;
          Sound.sfx.spin();
          if (S.items.sunsword) G.fireBeam(true);
        }
      } else if (Input.pressed('roll')) {
        if (this.rollCool <= 0) {
          this.state = 'roll'; this.st = 0.32; this.rollCool = 0.15;
          const d = moving ? [ix, iy] : DIRS[this.face];
          this.jdx = d[0]; this.jdy = d[1];
          Sound.sfx.roll();
        }
      } else if (Input.pressed('jump')) {
        this.vz = S.items.boots ? 150 : 112;
        this.jdx = ix; this.jdy = iy;
        Sound.sfx.jump();
      }
    } else {
      // swallow presses made mid-action so they don't fire later
      Input.pressed('attack'); Input.pressed('spin'); Input.pressed('roll'); Input.pressed('jump');
    }

    // ---- movement ----
    let vx = 0, vy = 0;
    if (this.state === 'roll') {
      vx = this.jdx * 150; vy = this.jdy * 150;
      this.st -= dt;
      if (Math.random() < 0.5) G.parts.push({ x: this.x + rand(-3, 3), y: this.y + 2, vx: 0, vy: -10, life: 0.3, max: 0.3, color: '#e8dcc0', size: 2 });
      if (this.st <= 0) { this.state = 'walk'; }
    } else if (this.state === 'attack') {
      this.st -= dt;
      this.doSword(false);
      if (this.st <= 0) this.state = 'walk';
    } else if (this.state === 'spin') {
      this.st -= dt;
      vx = ix * 30; vy = iy * 30;
      this.doSword(true);
      if (this.st <= 0) this.state = 'walk';
    } else if (this.hang > 0) {
      vx = this.jdx * 60; vy = this.jdy * 60;
    } else if (this.airborne) {
      const sp = S.items.boots ? 88 : 72;
      // you can steer in the air, but momentum from the takeoff direction helps
      const ax = ix || this.jdx, ay = iy || this.jdy;
      const l = Math.hypot(ax, ay) || 1;
      vx = ax / l * sp; vy = ay / l * sp;
      if (ix || iy) { this.jdx = ix; this.jdy = iy; }
    } else {
      vx = ix * 72; vy = iy * 72;
    }

    const res = moveEntity(this, vx * dt, vy * dt);
    if (moving && this.state === 'walk') this.anim += dt; else this.anim = 0;

    // ---- pushing blocks, boulders and locked doors ----
    const cardinal = (ix === 0) !== (iy === 0);
    if (this.state === 'walk' && !this.airborne && cardinal && (res.hitX || res.hitY)) {
      this.push += dt;
      if (this.push > 0.3) { G.tryPush(this, ix, iy); this.push = 0; }
    } else this.push = 0;

    this.physicsZ(dt);
    this.checkGround();
  }

  setFace(ix, iy) {
    // keep the current facing on diagonals if it still matches, otherwise pick the dominant axis
    const fx = ix > 0 ? 'right' : ix < 0 ? 'left' : null;
    const fy = iy > 0 ? 'down' : iy < 0 ? 'up' : null;
    if (fx && fy) { if (this.face !== fx && this.face !== fy) this.face = Math.abs(ix) >= Math.abs(iy) ? fx : fy; }
    else this.face = fx || fy;
  }

  physicsZ(dt) {
    if (this.hang > 0) {
      this.hang -= dt;
      if (!boxBlocked(this.x, this.y, this.w, this.h, Object.assign({}, this, { z: 0 })) || this.hang <= 0) {
        if (this.hang <= 0 && boxBlocked(this.x, this.y, this.w, this.h, Object.assign({}, this, { z: 0 }))) {
          this.x = this.safe.x; this.y = this.safe.y;
        }
        this.hang = 0; this.z = 0;
        Sound.sfx.land();
      }
      return;
    }
    if (this.z > 0 || this.vz > 0) {
      const grav = G.save.items.boots ? 560 : 610;
      this.vz -= grav * dt;
      this.z += this.vz * dt;
      if (this.z <= 0) {
        this.z = 0; this.vz = 0;
        // landed on top of a fence or bush? keep gliding until clear
        if (boxBlocked(this.x, this.y, this.w, this.h, this)) {
          this.hang = 0.3; this.z = 4;
          if (!this.jdx && !this.jdy) { const d = DIRS[this.face]; this.jdx = d[0]; this.jdy = d[1]; }
        } else Sound.sfx.land();
      }
    }
  }

  checkGround() {
    if (this.z > 0 || this.hang > 0) return;
    const ch = tileAtPx(this.x, this.y);
    if (ch === 'p' && this.state !== 'fall') {
      this.state = 'fall'; this.st = 0.6;
      Sound.sfx.fall();
      return;
    }
    // remember a safe spot: all four corners on solid ground
    const b = this.box();
    const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]];
    if (corners.every(([cx, cy]) => { const c = tileAtPx(cx, cy); return c && c !== 'p'; })) {
      this.safe.x = this.x; this.safe.y = this.y;
    }
    G.checkTileTriggers(this);
  }

  startAttack() {
    this.state = 'attack'; this.st = 0.26; this.swordHits.clear();
    Sound.sfx.sword();
    if (G.save.items.sunsword) G.fireBeam(false);
  }

  swordRect() {
    const x = this.x, y = this.y;
    switch (this.face) {
      case 'right': return { x: x + 2, y: y - 16, w: 19, h: 18 };
      case 'left': return { x: x - 21, y: y - 16, w: 19, h: 18 };
      case 'up': return { x: x - 9, y: y - 32, w: 18, h: 20 };
      default: return { x: x - 9, y: y - 6, w: 18, h: 18 };
    }
  }

  doSword(spin) {
    if (!spin && this.st < 0.04) return;
    const r = spin ? { x: this.x - 23, y: this.y - 30, w: 46, h: 42 } : this.swordRect();
    G.swordHit(r, spin ? 2 : 1, this);
  }

  /** Called by enemies, projectiles and pits. */
  damage(n, silent) {
    if (G.state !== 'play') return;
    G.save.hp = Math.max(0, G.save.hp - n);
    this.flash = 0.2;
    if (!silent) Sound.sfx.hurt();
    if (navigator.vibrate) navigator.vibrate(60);
    G.shake = 0.15;
    if (G.save.hp <= 0) G.playerDied();
  }

  hurt(n, sx, sy) {
    if (this.inv > 0 || this.state === 'roll' || this.state === 'fall' || this.state === 'dead' || this.state === 'hold') return false;
    this.inv = 1.1;
    const a = Math.atan2(this.y - sy, this.x - sx);
    this.kbx = Math.cos(a) * 150; this.kby = Math.sin(a) * 150;
    if (this.state !== 'walk' || this.z <= 0) { this.state = 'hurt'; this.st = 0.18; }
    this.damage(n);
    return true;
  }

  draw(g) {
    const S = Art.sprites;
    if (this.state === 'fall') {
      const k = Math.max(0, this.st / 0.6);
      const img = S.hero.down0;
      const sz = Math.round(16 * k);
      if (sz > 1) g.drawImage(img, Math.round(this.x - sz / 2), Math.round(this.y - sz + 4 - (1 - k) * -6), sz, sz);
      return;
    }
    shadow(g, this.x, this.y + 2, this.z > 0 ? 8 : 10);
    if (this.inv > 0 && Math.floor(this.inv * 14) % 2 === 0 && this.state !== 'hurt') return;
    const set = this.flash > 0 ? S.heroWhite : S.hero;
    const frame = Math.floor(this.anim * 7) % 2;
    let face = this.face;
    const px = Math.round(this.x - 8), py = Math.round(this.y - 12 - this.z);

    if (this.state === 'roll') {
      // tumble: rotate the sprite in crisp 90 degree steps
      const k = Math.floor((1 - this.st / 0.32) * 4) % 4;
      g.save(); g.translate(Math.round(this.x), Math.round(this.y - 5)); g.rotate(k * Math.PI / 2 * (this.jdx < 0 ? -1 : 1));
      g.drawImage(set[face + '0'], -8, -8); g.restore();
      return;
    }
    if (this.state === 'spin') {
      const p = 1 - this.st / 0.42;
      const order = ['down', 'left', 'up', 'right'];
      face = order[Math.floor(p * 8) % 4];
    }

    // sword behind the body when facing up
    const swordBehind = (this.state === 'attack' && face === 'up');
    if (swordBehind) this.drawSword(g, face);
    if (this.state === 'hold') {
      g.drawImage(set.down0, px, py);
    } else {
      g.drawImage(set[face + (this.state === 'walk' ? frame : 0)], px, py);
    }
    if (this.state === 'attack' && !swordBehind) this.drawSword(g, face);
    if (this.state === 'spin') this.drawSpin(g);
  }

  drawSword(g, face) {
    const p = 1 - this.st / 0.26;                  // 0..1 through the swing
    const base = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[face];
    const sweep = (face === 'left' || face === 'up' ? 1 : -1);
    const a = base + sweep * (0.9 - p * 1.8);
    const hx = this.x + Math.cos(base) * 4, hy = this.y - 6 - this.z + Math.sin(base) * 3;
    this.blade(g, hx, hy, a, 13);
    // swoosh trail
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
    g.beginPath(); g.arc(hx, hy, 13, Math.min(a, base + sweep * 0.9), Math.max(a, base + sweep * 0.9)); g.stroke();
  }

  drawSpin(g) {
    const p = 1 - this.st / 0.42;
    const a = p * Math.PI * 2.2 + Math.PI / 2;
    const hx = this.x, hy = this.y - 6 - this.z;
    g.strokeStyle = G.save.items.sunsword ? 'rgba(255,240,130,0.7)' : 'rgba(255,255,255,0.6)';
    g.lineWidth = 3;
    g.beginPath(); g.arc(hx, hy, 15, a - 2.2, a); g.stroke();
    this.blade(g, hx, hy, a, 15);
  }

  blade(g, hx, hy, a, len) {
    const sun = G.save.items.sunsword;
    const ca = Math.cos(a), sa = Math.sin(a);
    // hilt
    g.fillStyle = '#c08a18';
    g.fillRect(Math.round(hx + ca * 2 - 1), Math.round(hy + sa * 2 - 1), 3, 3);
    for (let i = 4; i < len; i++) {
      const x = Math.round(hx + ca * i), y = Math.round(hy + sa * i);
      g.fillStyle = '#1a1c2c'; g.fillRect(x - 1, y - 1, 3, 3);
    }
    for (let i = 4; i < len; i++) {
      const x = Math.round(hx + ca * i), y = Math.round(hy + sa * i);
      g.fillStyle = sun ? '#fff27a' : '#e4ecf4'; g.fillRect(x, y, 1, 1);
      g.fillStyle = sun ? '#ffffff' : '#ffffff'; if (i % 3 === 0) g.fillRect(x, y, 1, 1);
    }
  }
}

// ---------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------
class Enemy extends Entity {
  constructor(x, y) {
    super(x, y);
    this.isEnemy = true;
    this.hp = 2; this.inv = 0;
    this.kb = 0; this.kbx = 0; this.kby = 0;
    this.contact = 1;
  }
  hit(dmg, sx, sy) {
    if (this.inv > 0 || this.dead) return false;
    this.hp -= dmg;
    this.inv = 0.3; this.flash = 0.15;
    const a = Math.atan2(this.y - sy, this.x - sx);
    this.kb = 0.14; this.kbx = Math.cos(a) * 170; this.kby = Math.sin(a) * 170;
    Sound.sfx.hit();
    burst(this.x, this.y - 6, '#ffffff', 4, 40, 0.2);
    if (this.hp <= 0) this.die();
    return true;
  }
  die() {
    this.dead = true;
    Sound.sfx.kill();
    puff(this.x, this.y - 6 - this.z);
    G.dropLoot(this.x, this.y);
    G.onEnemyKilled(this);
  }
  /** Shared per-frame bookkeeping. Returns true while being knocked back. */
  pre(dt) {
    this.t += dt;
    this.inv = Math.max(0, this.inv - dt);
    this.flash = Math.max(0, this.flash - dt);
    if (this.kb > 0) {
      this.kb -= dt;
      moveEntity(this, this.kbx * dt, this.kby * dt);
      return true;
    }
    return false;
  }
  touch() {
    const p = G.player;
    if (p.z > 6 && !this.flying) return;      // jumped over it
    if (ov(this.body(), p.body())) p.hurt(this.contact, this.x, this.y);
  }
  sprite(set) { return (this.flash > 0 ? Art.sprites[set + 'White'] : Art.sprites[set]); }
}

class Slime extends Enemy {
  constructor(x, y, blue) {
    super(x, y);
    this.blue = blue;
    this.hp = blue ? 3 : 2;
    this.w = 12; this.h = 8;
    this.state = 'rest'; this.st = rand(0.3, 1.2);
    this.vx = 0; this.vy = 0;
  }
  update(dt) {
    if (this.pre(dt)) return;
    this.st -= dt;
    if (this.state === 'rest') {
      if (this.st <= 0) {
        this.state = 'hop'; this.st = 0.45;
        const p = G.player;
        let a = Math.random() * Math.PI * 2;
        if (dist(this, p) < 110 && Math.random() < 0.75) a = Math.atan2(p.y - this.y, p.x - this.x);
        const sp = this.blue ? 50 : 40;
        this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
      }
    } else {
      moveEntity(this, this.vx * dt, this.vy * dt);
      this.z = Math.sin((1 - this.st / 0.45) * Math.PI) * 5;
      if (this.st <= 0) { this.state = 'rest'; this.st = rand(0.6, 1.3); this.z = 0; }
    }
    this.touch();
  }
  draw(g) {
    shadow(g, this.x, this.y + 2, 12);
    const fr = this.state === 'hop' ? 0 : Math.floor(this.t * 3) % 2;
    g.drawImage(this.sprite(this.blue ? 'slimeBlue' : 'slime')[fr], Math.round(this.x - 8), Math.round(this.y - 13 - this.z));
  }
  body() { return { x: this.x - 7, y: this.y - 8 - this.z, w: 14, h: 11 }; }
}

class Bat extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hp = 1; this.flying = true;
    this.state = 'perch'; this.st = 0; this.z = 2;
    this.hx = x; this.hy = y;
  }
  update(dt) {
    if (this.pre(dt)) return;
    const p = G.player;
    this.st -= dt;
    if (this.state === 'perch') {
      this.z = 2;
      if (dist(this, p) < 72) { this.state = 'fly'; this.st = 2; Sound.sfx.screech(); }
    } else if (this.state === 'fly') {
      this.z = Math.min(10, this.z + dt * 30);
      const a = Math.atan2(p.y - this.y, p.x - this.x) + Math.sin(this.t * 6) * 0.9;
      moveEntity(this, Math.cos(a) * 46 * dt, Math.sin(a) * 46 * dt);
      if (this.st <= 0) { this.state = 'rest'; this.st = 1.3; }
    } else {
      moveEntity(this, Math.cos(this.t * 2) * 12 * dt, Math.sin(this.t * 3) * 12 * dt);
      if (this.st <= 0) { this.state = 'fly'; this.st = 2; }
    }
    this.touch();
  }
  draw(g) {
    shadow(g, this.x, this.y + 2, 8);
    const fr = this.state === 'perch' ? Math.floor(this.t * 2) % 2 : Math.floor(this.t * 10) % 2;
    g.drawImage(this.sprite('bat')[fr], Math.round(this.x - 8), Math.round(this.y - 14 - this.z));
  }
  body() { return { x: this.x - 6, y: this.y - 10 - this.z, w: 12, h: 9 }; }
}

class Skeleton extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.hp = 3;
    this.dir = ['up', 'down', 'left', 'right'][Math.random() * 4 | 0];
    this.state = 'walk'; this.st = rand(1, 2.5); this.cool = rand(1, 2);
  }
  update(dt) {
    if (this.pre(dt)) return;
    const p = G.player;
    this.st -= dt; this.cool -= dt;
    if (this.state === 'walk') {
      const d = DIRS[this.dir];
      const r = moveEntity(this, d[0] * 26 * dt, d[1] * 26 * dt);
      if (r.hitX || r.hitY || this.st <= 0) { this.dir = ['up', 'down', 'left', 'right'][Math.random() * 4 | 0]; this.st = rand(1, 2.5); }
      const dx = p.x - this.x, dy = p.y - this.y;
      if (this.cool <= 0 && Math.hypot(dx, dy) < 120 && (Math.abs(dx) < 10 || Math.abs(dy) < 10)) {
        this.state = 'windup'; this.st = 0.65;
        this.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      }
    } else if (this.state === 'windup') {
      if (this.st <= 0) {
        const d = DIRS[this.dir];
        G.ents.push(new Projectile(this.x + d[0] * 6, this.y - 6 + d[1] * 6, d[0] * 80, d[1] * 80, 'bone'));
        Sound.sfx.throw();
        this.state = 'walk'; this.st = rand(1, 2); this.cool = rand(2, 3);
      }
    }
    this.touch();
  }
  draw(g) {
    shadow(g, this.x, this.y + 2, 10);
    const fr = this.state === 'walk' ? Math.floor(this.t * 5) % 2 : 0;
    const shake = this.state === 'windup' ? (Math.floor(this.t * 30) % 2) : 0;
    g.drawImage(this.sprite('skel')[fr], Math.round(this.x - 8 + shake), Math.round(this.y - 12));
    if (this.state === 'windup') {
      // raised bone = "I'm about to throw!"
      g.drawImage(Art.icons.bone, Math.round(this.x - 4), Math.round(this.y - 22));
      if (Math.floor(this.t * 10) % 2) { g.fillStyle = '#ff4040'; g.fillRect(Math.round(this.x - 1), Math.round(this.y - 28), 2, 4); }
    }
  }
}

// ---------------------------------------------------------------------
// Projectiles (bones, magic orbs, sun beams)
// ---------------------------------------------------------------------
class Projectile extends Entity {
  constructor(x, y, vx, vy, kind) {
    super(x, y);
    this.isProjectile = true;
    this.vx = vx; this.vy = vy; this.kind = kind;
    this.team = kind === 'beam' ? 'player' : 'enemy';
    this.w = 6; this.h = 6;
    this.life = 4;
    this.reflectable = kind === 'orb';
  }
  update(dt) {
    this.t += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    if (boxBlocked(nx, ny, this.w, this.h, this)) {
      // a sun beam can strike crystals
      if (this.kind === 'beam') G.beamHitTile(nx + Math.sign(this.vx) * 4, ny + Math.sign(this.vy) * 4);
      this.dead = true;
      burst(this.x, this.y, this.kind === 'beam' ? '#fff27a' : '#ffffff', 5, 40, 0.25);
      return;
    }
    if (nx < -8 || ny < -8 || nx > VIEW_W + 8 || ny > VIEW_H + 8) { this.dead = true; return; }
    this.x = nx; this.y = ny;
    const me = { x: this.x - 4, y: this.y - 4, w: 8, h: 8 };
    if (this.team === 'enemy') {
      if (ov(me, G.player.body())) {
        if (G.player.hurt(1, this.x - this.vx, this.y - this.vy)) this.dead = true;
      }
    } else {
      for (const e of G.ents) {
        if (!e.isEnemy || e.dead) continue;
        if (ov(me, e.body())) {
          if (this.kind === 'orb' && e.onOrb) { e.onOrb(this); this.dead = true; return; }
          if (this.kind === 'beam') { if (e.hit(1, this.x - this.vx, this.y - this.vy)) this.dead = true; else if (e.deflects) this.dead = true; return; }
        }
      }
    }
  }
  /** Bounce a magic orb back at the caster. */
  reflect(target) {
    if (!this.reflectable || this.team === 'player') return;
    const a = Math.atan2(target.y - 10 - this.y, target.x - this.x);
    this.vx = Math.cos(a) * 130; this.vy = Math.sin(a) * 130;
    this.team = 'player'; this.life = 3;
    Sound.sfx.reflect();
    burst(this.x, this.y, '#ffd040', 8, 60, 0.3);
  }
  draw(g) {
    const I = Art.icons;
    if (this.kind === 'bone') {
      g.save(); g.translate(Math.round(this.x), Math.round(this.y)); g.rotate(Math.floor(this.t * 12) * Math.PI / 2);
      g.drawImage(I.bone, -4, -2); g.restore();
    } else if (this.kind === 'orb') {
      shadow(g, this.x, this.y + 8, 6);
      g.drawImage(this.team === 'player' ? I.orbBack : I.orb, Math.round(this.x - 5), Math.round(this.y - 5));
    } else {
      const img = this.vx ? I.beamH : I.beamV;
      g.drawImage(img, Math.round(this.x - img.width / 2), Math.round(this.y - img.height / 2));
    }
  }
}

// ---------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------
class Boss extends Enemy {
  constructor(x, y) { super(x, y); this.isBoss = true; this.dying = 0; }
  hit(dmg, sx, sy) {
    if (this.inv > 0 || this.dead || this.dying) return false;
    this.hp -= dmg;
    this.inv = 0.45; this.flash = 0.2;
    Sound.sfx.bossHit();
    burst(this.x, this.y - 12 - this.z, '#ffffff', 8, 60, 0.3);
    if (this.hp <= 0) { this.dying = 2; Sound.stopMusic(); }
    return true;
  }
  /** Shared dying animation. Returns true while dying. */
  dyingUpdate(dt) {
    if (!this.dying) return false;
    this.dying -= dt;
    this.flash = Math.floor(this.dying * 12) % 2 ? 0.1 : 0;
    if (Math.random() < 0.4) burst(this.x + rand(-16, 16), this.y - rand(0, 24) - this.z, ['#ffffff', '#ffd040', '#ff6a40'][Math.random() * 3 | 0], 4, 50, 0.4);
    if (Math.random() < 0.1) Sound.sfx.hit();
    if (this.dying <= 0) {
      this.dead = true;
      puff(this.x, this.y - 10);
      Sound.sfx.kill();
      G.onBossDefeated(this);
    }
    return true;
  }
  knock() { }
}

/* King Slime — leaps at you and lands with a thud. Watch its shadow! */
class KingSlime extends Boss {
  constructor(x, y) {
    super(x, y);
    this.name = 'King Slime';
    this.hp = this.maxHp = 10;
    this.w = 30; this.h = 12;
    this.state = 'idle'; this.st = 1.5; this.jumps = 0; this.spawned = false;
  }
  update(dt) {
    this.t += dt; this.inv = Math.max(0, this.inv - dt); this.flash = Math.max(0, this.flash - dt);
    if (this.dyingUpdate(dt)) return;
    this.st -= dt;
    const p = G.player;
    switch (this.state) {
      case 'idle':
        if (this.st <= 0) { this.state = 'crouch'; this.st = 0.45; }
        break;
      case 'crouch':
        if (this.st <= 0) {
          this.state = 'jump'; this.st = 1.1; this.dur = 1.1;
          this.sx = this.x; this.sy = this.y;
          this.tx = clamp(p.x, 40, VIEW_W - 40); this.ty = clamp(p.y, 40, VIEW_H - 30);
          Sound.sfx.jump();
        }
        break;
      case 'jump': {
        const k = 1 - this.st / this.dur;
        this.x = this.sx + (this.tx - this.sx) * k;
        this.y = this.sy + (this.ty - this.sy) * k;
        this.z = Math.sin(k * Math.PI) * 70;
        if (this.st <= 0) {
          this.z = 0; this.state = 'land'; this.st = 0.4;
          Sound.sfx.stomp(); G.shake = 0.3;
          for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; G.parts.push({ x: this.x + Math.cos(a) * 14, y: this.y + Math.sin(a) * 6, vx: Math.cos(a) * 90, vy: Math.sin(a) * 40, life: 0.35, max: 0.35, color: '#8fe08f', size: 2 }); }
          if (p.z < 4 && Math.abs(p.x - this.x) < 30 && Math.abs(p.y - this.y) < 18) p.hurt(1, this.x, this.y);
          this.jumps++;
        }
        break;
      }
      case 'land':
        if (this.st <= 0) {
          if (!this.spawned && this.hp <= this.maxHp / 2) {
            this.spawned = true;
            G.ents.push(new Slime(this.x - 24, this.y, false), new Slime(this.x + 24, this.y, false));
          }
          if (this.jumps % 3 === 0) { this.state = 'tired'; this.st = 2.2; }
          else { this.state = 'idle'; this.st = 0.7; }
        }
        break;
      case 'tired':
        if (this.st <= 0) { this.state = 'idle'; this.st = 0.5; }
        break;
    }
    if (this.z < 8) this.touch();
  }
  hit(dmg, sx, sy) { if (this.z > 10) return false; return super.hit(dmg, sx, sy); }
  body() { return { x: this.x - 20, y: this.y - 26 - this.z, w: 40, h: 30 }; }
  draw(g) {
    // shadow grows as it falls back towards you
    const sw = this.state === 'jump' ? 20 + 20 * (1 - this.z / 70) : 40;
    if (this.state === 'jump') { shadow(g, this.tx, this.ty + 2, sw); }
    else shadow(g, this.x, this.y + 2, 40);
    const squish = this.state === 'crouch' || this.state === 'land' || this.state === 'tired';
    const set = this.flash > 0 ? Art.sprites.kingslimeWhite : Art.sprites.kingslime;
    const img = set[squish ? 1 : 0];
    const tx = this.state === 'jump' ? this.x : this.x;
    g.drawImage(img, Math.round(tx - 24), Math.round(this.y - 40 - this.z));
    g.drawImage(Art.sprites.crown, Math.round(tx - 4), Math.round(this.y - 28 - this.z + (squish ? 4 : 0) - 3));
    if (this.state === 'tired') { // sweat drops = "hit me now!"
      g.fillStyle = '#8fd0ff';
      const k = (this.t * 2) % 1;
      g.fillRect(Math.round(this.x + 14), Math.round(this.y - 30 + k * 8), 2, 3);
      g.fillRect(Math.round(this.x - 16), Math.round(this.y - 28 + ((k + 0.5) % 1) * 8), 2, 3);
    }
  }
}

/* Nightwing — a giant bat. It screeches before it swoops; after a swoop
   it rests near the ground, which is your chance to strike. */
class Nightwing extends Boss {
  constructor(x, y) {
    super(x, y);
    this.name = 'Nightwing';
    this.hp = this.maxHp = 10;
    this.flying = true; this.flyFree = false;
    this.w = 20; this.h = 10;
    this.state = 'circle'; this.st = 2.5; this.ang = 0; this.z = 24;
    this.cx = VIEW_W / 2; this.cy = VIEW_H / 2;
  }
  update(dt) {
    this.t += dt; this.inv = Math.max(0, this.inv - dt); this.flash = Math.max(0, this.flash - dt);
    if (this.dyingUpdate(dt)) { this.z = Math.max(0, this.z - dt * 20); return; }
    this.st -= dt;
    const p = G.player;
    const fast = this.hp <= this.maxHp / 2;
    switch (this.state) {
      case 'circle': {
        this.ang += dt * (fast ? 1.6 : 1.1);
        const tx = this.cx + Math.cos(this.ang) * 70, ty = this.cy + Math.sin(this.ang) * 30;
        this.x += (tx - this.x) * Math.min(1, dt * 3); this.y += (ty - this.y) * Math.min(1, dt * 3);
        this.z += (24 - this.z) * Math.min(1, dt * 3);
        if (this.st <= 0) { this.state = 'screech'; this.st = 0.7; Sound.sfx.screech(); }
        break;
      }
      case 'screech':
        if (this.st <= 0) {
          this.state = 'swoop'; this.st = 1.2;
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          const sp = fast ? 135 : 115;
          this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
        }
        break;
      case 'swoop': {
        this.z = Math.max(4, this.z - dt * 60);
        const r = moveEntity(this, this.vx * dt, this.vy * dt);
        if (r.hitX || r.hitY || this.st <= 0) { this.state = 'rest'; this.st = fast ? 1.3 : 1.7; }
        break;
      }
      case 'rest':
        this.z = 4 + Math.sin(this.t * 4) * 2;
        if (this.st <= 0) {
          this.state = 'circle'; this.st = rand(2, 3);
          this.ang = Math.atan2(this.y - this.cy, this.x - this.cx);
          if (fast && G.ents.filter(e => e instanceof Bat && !e.dead).length < 2) {
            G.ents.push(new Bat(rand(40, 216), 40), new Bat(rand(40, 216), 130));
          }
        }
        break;
    }
    if (this.z < 14) this.touch();
  }
  hit(dmg, sx, sy) { if (this.z > 14) return false; return super.hit(dmg, sx, sy); }
  body() { return { x: this.x - 18, y: this.y - 26 - this.z, w: 36, h: 22 }; }
  draw(g) {
    shadow(g, this.x, this.y + 2, 30);
    const set = this.flash > 0 ? Art.sprites.nightwingWhite : Art.sprites.nightwing;
    const fr = Math.floor(this.t * (this.state === 'rest' ? 4 : 9)) % 2;
    const shake = this.state === 'screech' ? (Math.floor(this.t * 40) % 2) * 2 : 0;
    g.drawImage(set[fr], Math.round(this.x - 24 + shake), Math.round(this.y - 40 - this.z));
    if (this.state === 'screech') {
      g.strokeStyle = 'rgba(255,80,80,0.8)'; g.lineWidth = 1;
      const r = 20 + (this.t * 60) % 14;
      g.beginPath(); g.arc(this.x, this.y - 18 - this.z, r, 0, Math.PI * 2); g.stroke();
    }
  }
}

/* Bone Lord — throws fans of bones, and later charges across the room.
   If it slams into a wall it is dazed for a moment. */
class BoneLord extends Boss {
  constructor(x, y) {
    super(x, y);
    this.name = 'Bone Lord';
    this.hp = this.maxHp = 12;
    this.w = 18; this.h = 10;
    this.state = 'walk'; this.st = 2; this.throws = 0;
  }
  update(dt) {
    this.t += dt; this.inv = Math.max(0, this.inv - dt); this.flash = Math.max(0, this.flash - dt);
    if (this.dyingUpdate(dt)) return;
    this.st -= dt;
    const p = G.player;
    const angry = this.hp <= this.maxHp / 2;
    switch (this.state) {
      case 'walk': {
        const a = Math.atan2(p.y - this.y, p.x - this.x);
        moveEntity(this, Math.cos(a) * 22 * dt, Math.sin(a) * 22 * dt);
        if (this.st <= 0) {
          if (angry && this.throws % 2 === 1) { this.state = 'chargeup'; this.st = 0.8; }
          else { this.state = 'windup'; this.st = 0.7; }
        }
        break;
      }
      case 'windup':
        if (this.st <= 0) {
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          const n = angry ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const b = a + (i - (n - 1) / 2) * 0.35;
            G.ents.push(new Projectile(this.x, this.y - 14, Math.cos(b) * 75, Math.sin(b) * 75, 'bone'));
          }
          Sound.sfx.throw();
          this.throws++;
          this.state = 'walk'; this.st = rand(1.8, 2.6);
        }
        break;
      case 'chargeup':
        if (this.st <= 0) {
          const a = Math.atan2(p.y - this.y, p.x - this.x);
          this.vx = Math.cos(a) * 150; this.vy = Math.sin(a) * 150;
          this.state = 'charge'; this.st = 2;
        }
        break;
      case 'charge': {
        const r = moveEntity(this, this.vx * dt, this.vy * dt);
        if (Math.random() < 0.5) G.parts.push({ x: this.x, y: this.y, vx: 0, vy: -10, life: 0.3, max: 0.3, color: '#c8c0b0', size: 2 });
        if (r.hitX || r.hitY || this.st <= 0) {
          this.state = 'dazed'; this.st = 1.8; this.throws++;
          Sound.sfx.stomp(); G.shake = 0.25;
        }
        break;
      }
      case 'dazed':
        if (this.st <= 0) { this.state = 'walk'; this.st = 2; }
        break;
    }
    this.touch();
  }
  body() { return { x: this.x - 12, y: this.y - 28, w: 24, h: 30 }; }
  draw(g) {
    shadow(g, this.x, this.y + 2, 24);
    const set = this.flash > 0 ? Art.sprites.bonelordWhite : Art.sprites.bonelord;
    const fr = (this.state === 'walk' || this.state === 'charge') ? Math.floor(this.t * 6) % 2 : 0;
    const shake = (this.state === 'windup' || this.state === 'chargeup') ? (Math.floor(this.t * 30) % 2) * 2 - 1 : 0;
    g.drawImage(set[fr], Math.round(this.x - 16 + shake), Math.round(this.y - 28));
    g.drawImage(Art.sprites.crown, Math.round(this.x - 4), Math.round(this.y - 33));
    if (this.state === 'windup') {
      g.drawImage(Art.icons.bone, Math.round(this.x - 14), Math.round(this.y - 38));
      g.drawImage(Art.icons.bone, Math.round(this.x + 6), Math.round(this.y - 38));
    }
    if (this.state === 'chargeup' && Math.floor(this.t * 10) % 2) {
      g.fillStyle = '#ff4040'; g.fillRect(Math.round(this.x - 1), Math.round(this.y - 44), 3, 7); g.fillRect(Math.round(this.x - 1), Math.round(this.y - 35), 3, 2);
    }
    if (this.state === 'dazed') stars(g, this.x, this.y - 34, this.t);
  }
}

function stars(g, x, y, t) {
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + i * 2.1;
    g.fillStyle = '#ffe040';
    g.fillRect(Math.round(x + Math.cos(a) * 9), Math.round(y + Math.sin(a) * 3), 2, 2);
  }
}

/* Malvoren — the sorcerer. His shadow shield blocks your sword, but his
   own magic orbs can be knocked back at him with a sword swing. When an
   orb hits him he falls dazed — then strike! */
class Malvoren extends Boss {
  constructor(x, y) {
    super(x, y);
    this.name = 'Malvoren';
    this.hp = this.maxHp = 10;
    this.w = 16; this.h = 10; this.flying = true;
    this.state = 'float'; this.st = 1.5; this.casts = 0; this.alpha = 1; this.z = 8;
    this.deflects = true; this.summoned = false;
  }
  update(dt) {
    this.t += dt; this.inv = Math.max(0, this.inv - dt); this.flash = Math.max(0, this.flash - dt);
    if (this.dyingUpdate(dt)) { this.alpha = Math.max(0, this.dying / 2); return; }
    this.st -= dt;
    const p = G.player;
    const angry = this.hp <= this.maxHp / 2;
    switch (this.state) {
      case 'float':
        this.z = 8 + Math.sin(this.t * 3) * 3;
        moveEntity(this, Math.cos(this.t * 0.9) * 18 * dt, Math.sin(this.t * 1.3) * 10 * dt);
        if (this.st <= 0) {
          if (this.casts >= 3) { this.state = 'vanish'; this.st = 0.45; this.casts = 0; }
          else { this.state = 'cast'; this.st = 0.9; Sound.sfx.magic(); }
        }
        break;
      case 'cast':
        if (this.st <= 0) {
          const a = Math.atan2(p.y - 8 - (this.y - 18), p.x - this.x);
          const n = angry ? 3 : 1;
          for (let i = 0; i < n; i++) {
            const b = a + (i - (n - 1) / 2) * 0.4;
            const o = new Projectile(this.x, this.y - 18, Math.cos(b) * 62, Math.sin(b) * 62, 'orb');
            o.life = 6;
            G.ents.push(o);
          }
          this.casts++;
          this.state = 'float'; this.st = angry ? 1.1 : 1.5;
          if (angry && !this.summoned) { this.summoned = true; G.ents.push(new Bat(40, 40), new Bat(216, 40)); }
        }
        break;
      case 'vanish':
        this.alpha = Math.max(0, this.st / 0.45);
        if (this.st <= 0) {
          // reappear somewhere away from the hero
          for (let i = 0; i < 20; i++) {
            const nx = rand(48, VIEW_W - 48), ny = rand(48, VIEW_H - 40);
            if (Math.hypot(nx - p.x, ny - p.y) > 80) { this.x = nx; this.y = ny; break; }
          }
          this.state = 'appear'; this.st = 0.45;
        }
        break;
      case 'appear':
        this.alpha = 1 - Math.max(0, this.st / 0.45);
        if (this.st <= 0) { this.alpha = 1; this.state = 'float'; this.st = 1; }
        break;
      case 'stunned':
        this.z = Math.max(0, this.z - dt * 40);
        if (this.st <= 0) { this.state = 'float'; this.st = 0.8; this.inv = 0.3; }
        break;
    }
    if (this.state !== 'vanish' && this.state !== 'appear' && this.state !== 'stunned') this.touch();
  }
  onOrb(orb) {
    if (this.dying) return;
    this.state = 'stunned'; this.st = 2.6; this.inv = 0;
    this.hp -= 1; this.flash = 0.2;
    Sound.sfx.bossHit(); G.shake = 0.2;
    burst(this.x, this.y - 16, '#ffd040', 14, 70, 0.4);
    if (this.hp <= 0) { this.dying = 2.5; Sound.stopMusic(); }
  }
  hit(dmg, sx, sy) {
    if (this.state !== 'stunned') {
      if (this.inv <= 0) { Sound.sfx.bump(); this.inv = 0.3; burst(this.x, this.y - 16, '#c040ff', 6, 40, 0.25); }
      return false;
    }
    if (this.inv > 0 || this.dying) return false;
    this.hp -= 1; this.inv = 0.4; this.flash = 0.2;
    Sound.sfx.bossHit();
    burst(this.x, this.y - 12, '#ffffff', 8, 60, 0.3);
    if (this.hp <= 0) { this.dying = 2.5; Sound.stopMusic(); }
    return true;
  }
  body() { return { x: this.x - 12, y: this.y - 30 - this.z, w: 24, h: 32 }; }
  draw(g) {
    g.globalAlpha = this.alpha;
    shadow(g, this.x, this.y + 2, 22);
    const img = this.flash > 0 ? Art.sprites.malvBigWhite : Art.sprites.malvBig;
    g.drawImage(img, Math.round(this.x - 16), Math.round(this.y - 30 - this.z));
    if (this.state === 'float' || this.state === 'cast') {
      // shadow shield
      g.strokeStyle = `rgba(190,80,255,${0.35 + Math.sin(this.t * 6) * 0.15})`; g.lineWidth = 1;
      g.beginPath(); g.ellipse(this.x, this.y - 14 - this.z, 20, 22, 0, 0, Math.PI * 2); g.stroke();
    }
    if (this.state === 'cast') {
      const k = 1 - this.st / 0.9;
      Art.blob(g, '#c040ff', this.x, this.y - 18 - this.z - 10, 2 + k * 4, 2 + k * 4);
      Art.blob(g, '#ffb0ff', this.x, this.y - 18 - this.z - 10, 1 + k * 2, 1 + k * 2);
    }
    if (this.state === 'stunned') stars(g, this.x, this.y - 34 - this.z, this.t);
    g.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------
// Friendly folk
// ---------------------------------------------------------------------
class NPC extends Entity {
  constructor(x, y, look, name, talk) {
    super(x, y);
    this.look = look; this.name = name; this.talk = talk;
    this.solid = true; this.face = 'down';
    this.w = 12; this.h = 10;
  }
  update(dt) {
    this.t += dt;
    // look at the hero when they come close
    const p = G.player;
    if (dist(this, p) < 40) {
      const dx = p.x - this.x, dy = p.y - this.y;
      this.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    } else this.face = 'down';
  }
  draw(g) {
    shadow(g, this.x, this.y + 2, 10);
    if (this.look === 'elder') {
      g.drawImage(Art.sprites.elder, Math.round(this.x - 8), Math.round(this.y - 12 + (Math.floor(this.t * 2) % 2)));
      return;
    }
    const set = Art.sprites['npc_' + this.look];
    g.drawImage(set[this.face + '0'], Math.round(this.x - 8), Math.round(this.y - 12));
  }
}

// ---------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------
class Pickup extends Entity {
  constructor(x, y, kind, opts = {}) {
    super(x, y);
    this.kind = kind; this.opts = opts;
    this.z = opts.pop ? 8 : 0; this.vz = opts.pop ? 60 : 0;
    this.life = opts.permanent ? Infinity : 9;
    this.delay = opts.pop ? 0.25 : 0;
  }
  update(dt) {
    this.t += dt; this.life -= dt; this.delay -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.z > 0 || this.vz > 0) {
      this.vz -= 300 * dt; this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = Math.abs(this.vz) > 40 ? -this.vz * 0.4 : 0; }
    }
    if (this.delay <= 0 && G.state === 'play' && ov(this.box2(), G.player.body())) {
      this.dead = true;
      G.collect(this);
    }
  }
  box2() { return { x: this.x - 6, y: this.y - 10, w: 12, h: 12 }; }
  draw(g) {
    if (this.life < 2 && Math.floor(this.t * 10) % 2) return;
    const I = Art.icons;
    const img = { coin: I.coin, coin5: I.coin5, heart: I.heartFull, key: I.key, container: I.container, d1: I.d1, d2: I.d2, d3: I.d3 }[this.kind];
    const bob = this.opts.permanent ? Math.sin(this.t * 3) * 2 : 0;
    shadow(g, this.x, this.y + 1, 6);
    if (this.opts.permanent && (this.kind === 'd1' || this.kind === 'd2' || this.kind === 'd3')) {
      g.fillStyle = 'rgba(255,255,200,0.25)';
      g.beginPath(); g.arc(this.x, this.y - 8 - bob, 10 + Math.sin(this.t * 4) * 2, 0, Math.PI * 2); g.fill();
    }
    g.drawImage(img, Math.round(this.x - img.width / 2), Math.round(this.y - img.height - this.z - bob));
  }
}

/* An item for sale in Wynn's shop. Walk onto it to buy it. */
class ShopItem extends Entity {
  constructor(x, y, item, price) {
    super(x, y);
    this.item = item; this.price = price; this.cool = 0;
  }
  update(dt) {
    this.t += dt;
    if (this.item === 'container' && G.save.flags.boughtContainer) { this.dead = true; return; }
    const over = ov({ x: this.x - 6, y: this.y - 10, w: 12, h: 12 }, G.player.body());
    if (over && !this.cool && G.state === 'play') { this.cool = 1; G.buy(this); }
    if (!over) this.cool = 0;
  }
  draw(g) {
    const img = Art.icons[this.item];
    shadow(g, this.x, this.y + 1, 8);
    g.drawImage(img, Math.round(this.x - img.width / 2), Math.round(this.y - img.height - 1 + Math.sin(this.t * 3)));
    const s = String(this.price);
    Art.text(g, s, Math.round(this.x - s.length * 2), Math.round(this.y + 5), G.save.coins >= this.price ? '#fff27a' : '#ff8080');
  }
}

// ---------------------------------------------------------------------
// Push block
// ---------------------------------------------------------------------
class Block extends Entity {
  constructor(tx, ty) {
    super(tx * TILE + 8, ty * TILE + 8);
    this.tx = tx; this.ty = ty;
    this.solid = true; this.isBlock = true;
    this.w = 16; this.h = 16;
    this.slide = 0;
  }
  box() { return { x: this.x - 8, y: this.y - 8, w: 16, h: 16 }; }
  /** Try to slide one tile in direction (dx, dy). */
  push(dx, dy) {
    if (this.slide > 0) return false;
    const nx = this.tx + dx, ny = this.ty + dy;
    const ch = tileAt(nx, ny);
    if (!ch || nx <= 0 || ny <= 0 || nx >= COLS - 1 || ny >= ROWS - 1) return false;
    if (ch !== 'p' && tileBlocks(ch, this)) return false;
    const target = { x: nx * TILE + 1, y: ny * TILE + 1, w: 14, h: 14 };
    for (const o of G.ents) if (o !== this && !o.dead && (o.solid || o.isEnemy) && ov(target, o.box ? (o.solid ? o.box() : o.body()) : o)) return false;
    this.fromX = this.x; this.fromY = this.y;
    this.tx = nx; this.ty = ny; this.slide = 0.25;
    Sound.sfx.push();
    return true;
  }
  update(dt) {
    if (this.slide > 0) {
      this.slide -= dt;
      const k = 1 - Math.max(0, this.slide) / 0.25;
      this.x = this.fromX + (this.tx * TILE + 8 - this.fromX) * k;
      this.y = this.fromY + (this.ty * TILE + 8 - this.fromY) * k;
      if (this.slide <= 0) {
        this.x = this.tx * TILE + 8; this.y = this.ty * TILE + 8;
        // a block pushed into a pit fills it
        if (tileAt(this.tx, this.ty) === 'p') {
          G.setTile(this.tx, this.ty, '.');
          this.dead = true; puff(this.x, this.y);
        }
        G.checkPlates();
      }
    }
  }
  draw(g) { g.drawImage(Art.sprites.block, Math.round(this.x - 8), Math.round(this.y - 8)); }
}
