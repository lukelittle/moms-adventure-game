/* =====================================================================
   ODYSSEY — Game
   Main loop, rooms and transitions, interactions, HUD, dialog boxes,
   menus and saving. Depends on: maps.js, audio.js, input.js, art.js,
   entities.js (loaded first by index.html).
   ===================================================================== */

const W = 256, H = 200, HUD = 24;
const SAVE_KEY = 'odyssey-save-v1';

/** All live game state. Entities reach the world through this object. */
const G = {
  state: 'title',        // title | play | dialog | scroll | fade | dying | gameover | pause | ending
  save: null,
  areaId: 'over',
  room: null,
  player: null,
  ents: [],
  parts: [],
  shake: 0,
  t: 0,
  scroll: null,
  fade: null,
  regionName: '',
  checkpoint: null,
  warpLock: true,
  msgCool: 0,
};

// ---------------------------------------------------------------------
// Save data
// ---------------------------------------------------------------------
function newSave() {
  return {
    v: 1,
    hp: 6, maxHp: 6, coins: 0,
    keys: {}, items: {}, relics: {}, flags: {},
    checkpoint: { area: 'over', room: '1,2', x: 7.5 * 16 + 8, y: 6 * 16 + 8 },
    time: 0,
  };
}
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1) return s; } catch (e) { /* ignore */ }
  return null;
}
function writeSave() {
  if (!G.save) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.save)); } catch (e) { /* storage full or blocked */ }
}

/** Per-room persistent flags (opened chests, unlocked doors...). */
function flagKey(name) { return G.areaId + '|' + G.room.key + '|' + name; }
function flag(name) { return !!G.save.flags[flagKey(name)]; }
function setFlag(name) { G.save.flags[flagKey(name)] = true; }

// ---------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------
function areaOf(id) { return AREAS[id]; }
function neighborKey(key, dx, dy) { const [x, y] = key.split(',').map(Number); return (x + dx) + ',' + (y + dy); }

/** Build the live version of a room: tiles, enemies, NPCs, blocks... */
function buildRoom(areaId, key) {
  const area = areaOf(areaId), def = area.rooms[key];
  G.areaId = areaId;
  const room = {
    areaId, key, area, def, theme: area.theme,
    tiles: def.map.map(r => r.split('')),
    bg: Art.mk(VIEW_W, VIEW_H), frame: 0, dirty: true, animT: 0,
    solved: false, doorsOpen: false, trap: false,
  };
  G.room = room;
  G.ents = [];
  G.parts = [];
  room.solved = flag('solved');
  const S = G.save;
  const plates = [], blocks = [];
  const groundCh = '.';

  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const ch = room.tiles[y][x];
      const cx = x * TILE + 8, cy = y * TILE + 10;
      const put = c => { room.tiles[y][x] = c; };
      switch (ch) {
        case '1': case '2': case '3':
          put(groundCh);
          if (def.solve === 'clear' && room.solved) break;
          if (ch === '1') G.ents.push(new Slime(cx, cy, area.dungeon && areaId !== 'd1'));
          if (ch === '2') G.ents.push(new Bat(cx, cy));
          if (ch === '3') G.ents.push(new Skeleton(cx, cy));
          break;
        case 'b': put(groundCh); blocks.push(new Block(x, y)); break;
        case 'o': plates.push([x, y]); break;
        case 'Z':
          put(groundCh);
          if (!flag('boss')) G.ents.push(makeBoss(def.boss, cx, cy));
          break;
        case 'K':
          put(groundCh);
          if (!flag('key@' + x + ',' + y)) G.ents.push(new Pickup(cx, cy + 2, 'key', { permanent: true, flag: 'key@' + x + ',' + y }));
          break;
        case 'L': if (flag('L@' + x + ',' + y)) put(groundCh); break;
        case 'G': if (flag('G@' + x + ',' + y)) put(groundCh); break;
        case 'c': if (flag('chest')) put('O'); break;
        case 'x': if (room.solved) put('X'); break;
        case 'C': if (S.flags.castleOpen) put('A'); break;
      }
    }

  // blocks: if the puzzle is already solved, leave them resting on the plates
  if (def.solve === 'plates' && room.solved) blocks.forEach((b, i) => { if (plates[i]) { b.tx = plates[i][0]; b.ty = plates[i][1]; b.x = b.tx * TILE + 8; b.y = b.ty * TILE + 8; } });
  G.ents.push(...blocks);

  (def.npcs || []).forEach(n => G.ents.push(new NPC(n.x * TILE + 8, n.y * TILE + 10, n.look, n.name, n.talk)));
  (def.shop || []).forEach(s => G.ents.push(new ShopItem(s.x * TILE + 8, s.y * TILE + 10, s.item, s.price)));

  // the rescued elder
  if (areaId === 'castle' && key === '0,0' && S.flags.malvorenDefeated) G.ents.push(new NPC(128, 80, 'elder', 'Elder Rowan', 'elder'));
  if (areaId === 'over' && key === '1,2' && S.flags.rescued) G.ents.push(new NPC(8 * TILE + 8, 1 * TILE + 10, 'elder', 'Elder Rowan', 'elder'));

  // boss leftovers (heart container & relic) if they weren't picked up
  if (def.boss && flag('boss') && area.relic) {
    if (!S.relics[area.relic]) G.ents.push(new Pickup(128, 92, area.relic, { permanent: true }));
    if (!flag('container')) G.ents.push(new Pickup(96, 92, 'container', { permanent: true, flag: 'container' }));
  }
  if (def.reward === 'key' && room.solved && !flag('rewardKey')) G.ents.push(new Pickup(128, 92, 'key', { permanent: true, flag: 'rewardKey' }));

  room.doorsOpen = room.solved;
  if (def.solve === 'boss' && !room.solved) { room.trap = true; room.doorsOpen = true; }
  room.animated = room.tiles.some(r => r.some(c => c === '~' || c === 't' || c === 'Q' || c === 'C'));
  return room;
}

function makeBoss(kind, x, y) {
  switch (kind) {
    case 'kingslime': return new KingSlime(x, y);
    case 'nightwing': return new Nightwing(x, y);
    case 'bonelord': return new BoneLord(x, y);
    case 'malvoren': return new Malvoren(x, y);
  }
}

function renderBg() {
  const r = G.room;
  r.bg.getContext('2d').clearRect(0, 0, VIEW_W, VIEW_H);
  Art.renderRoom(r.bg, r.tiles, r.theme, r.frame);
  r.dirty = false;
}

G.setTile = (x, y, ch) => { G.room.tiles[y][x] = ch; G.room.dirty = true; };

/** Is there a room beyond the edge the hero is walking out of? */
G.edgeOpen = (tx, ty) => {
  if (G.state !== 'play') return false;
  const dx = tx < 0 ? -1 : tx >= COLS ? 1 : 0, dy = ty < 0 ? -1 : ty >= ROWS ? 1 : 0;
  return !!G.room.area.rooms[neighborKey(G.room.key, dx, dy)];
};

/** Called whenever the hero arrives in a room. */
function enterRoom() {
  const r = G.room, def = r.def;
  G.checkpoint = { area: G.areaId, room: r.key, x: G.player.x, y: G.player.y };
  G.save.checkpoint = G.checkpoint;
  writeSave();
  Sound.playMusic(def.music || 'field');
  const name = r.area.dungeon ? r.area.name : def.name;
  if (name && name !== G.regionName) { G.regionName = name; showBanner(name); }
  G.warpLock = true;
  if (r.trap) {
    const boss = G.ents.find(e => e.isBoss);
    if (boss) r.bossName = boss.name;
  }
}

/** Put the hero in a room (no animation). */
function placeInRoom(areaId, key, x, y) {
  buildRoom(areaId, key);
  G.player.x = x; G.player.y = y; G.player.z = 0; G.player.vz = 0; G.player.hang = 0;
  G.player.safe = { x, y };
  if (G.player.state !== 'hold') G.player.state = 'walk';
  renderBg();
  enterRoom();
}

// ---- Scrolling between screens ----
function checkEdges() {
  const p = G.player;
  let dir = null;
  if (p.x < 3) dir = [-1, 0]; else if (p.x > VIEW_W - 3) dir = [1, 0];
  else if (p.y < 5) dir = [0, -1]; else if (p.y > VIEW_H - 3) dir = [0, 1];
  if (!dir) return;
  const nk = neighborKey(G.room.key, dir[0], dir[1]);
  if (!G.room.area.rooms[nk]) return;
  const oldBg = G.room.bg;
  const from = { x: p.x, y: p.y };
  buildRoom(G.areaId, nk);
  renderBg();
  if (dir[0] === -1) p.x = VIEW_W - 7; if (dir[0] === 1) p.x = 7;
  if (dir[1] === -1) p.y = VIEW_H - 6; if (dir[1] === 1) p.y = 9;
  p.safe = { x: p.x, y: p.y };
  if (p.state !== 'walk') p.state = 'walk';
  p.z = 0; p.vz = 0; p.hang = 0;
  G.scroll = { dir, t: 0, oldBg, from, to: { x: p.x, y: p.y } };
  G.state = 'scroll';
}

// ---- Fading warps (dungeon doors, stairs, respawn) ----
function fadeTo(fn, holdMsg) {
  G.state = 'fade';
  G.fade = { t: 0, fn, done: false };
}
function warpTo(areaId, key, tx, ty) {
  Sound.sfx.door();
  fadeTo(() => placeInRoom(areaId, key, tx * TILE + 8, ty * TILE + 8));
}

// ---------------------------------------------------------------------
// Interactions (called from entities.js)
// ---------------------------------------------------------------------
function frontPoint(p) {
  const d = DIRS[p.face];
  return { x: p.x + d[0] * 12, y: p.y - 4 + d[1] * (d[1] < 0 ? 10 : 12) };
}

/** What would ATTACK do right now? Used for the touch button label too. */
function frontTarget() {
  const p = G.player;
  if (!p || G.state !== 'play' || p.airborne) return null;
  const f = frontPoint(p);
  for (const e of G.ents) {
    if (e instanceof NPC && Math.hypot(e.x - f.x, e.y - 6 - f.y) < 13) return { type: 'npc', e, label: 'Talk' };
  }
  const tx = Math.floor(f.x / TILE), ty = Math.floor(f.y / TILE);
  const ch = tileAt(tx, ty);
  if (ch === 'S') return { type: 'sign', tx, ty, label: 'Read' };
  if (ch === 'c') return { type: 'chest', tx, ty, label: 'Open' };
  if (ch === 'Q') return { type: 'fountain', label: 'Drink' };
  if (ch === 'C') return { type: 'gate', tx, ty, label: 'Look' };
  return null;
}

G.tryInteract = () => {
  const t = frontTarget();
  if (!t) return false;
  const S = G.save;
  switch (t.type) {
    case 'npc': {
      const lines = DIALOGUE[t.e.talk](S);
      const done = t.e.talk === 'elder' && G.areaId === 'castle' ? startEnding : null;
      Dialog.open(lines, t.e.name, done);
      break;
    }
    case 'sign': {
      const txt = (G.room.def.signs || {})[t.tx + ',' + t.ty] || '...';
      Dialog.open(txt.split('\n\n'));
      break;
    }
    case 'chest': openChest(t.tx, t.ty); break;
    case 'fountain':
      S.hp = S.maxHp;
      Sound.sfx.heal();
      burst(G.player.x, G.player.y - 8, '#8fd0ff', 14, 50, 0.6);
      writeSave();
      Dialog.open(['You drink from the sparkling fountain.\nYour hearts are fully restored!']);
      break;
    case 'gate': {
      const n = relicCount(S);
      if (n < 3) Dialog.open([`A dark seal covers the castle gate.\nThree sacred relics glow faintly... you hold ${n} of 3.`]);
      else {
        S.flags.castleOpen = true;
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (G.room.tiles[y][x] === 'C') G.setTile(x, y, 'A');
        Sound.sfx.solved(); G.shake = 0.4;
        burst(128, 24, '#c040ff', 30, 90, 0.8);
        writeSave();
        Dialog.open(['The three relics blaze with light...', 'The dark seal SHATTERS! The way into Castle Malvoren is open.']);
      }
      break;
    }
  }
  return true;
};

function openChest(tx, ty) {
  const item = G.room.def.chest;
  G.setTile(tx, ty, 'O');
  setFlag('chest');
  Sound.sfx.door();
  if (item === 'key') { addKey(); itemGet('key'); return; }
  if (item === 'container') { G.save.maxHp += 2; G.save.hp = G.save.maxHp; itemGet('container'); return; }
  G.save.items[item] = true;
  G.save.hp = G.save.maxHp;
  itemGet(item);
}

function addKey() { const k = G.areaId; G.save.keys[k] = (G.save.keys[k] || 0) + 1; }

/** Hold an item overhead with a fanfare and a message. */
function itemGet(kind, after) {
  const p = G.player;
  p.state = 'hold'; p.holdItem = kind;
  Sound.sfx.fanfare();
  writeSave();
  Dialog.open(ITEMS[kind].text.split('\n\n'), null, () => {
    p.state = 'walk'; p.holdItem = null;
    if (after) after();
  });
}

/** Walking into a block, boulder or locked door. */
G.tryPush = (p, ix, iy) => {
  const tx = Math.floor((p.x + ix * (p.w / 2 + 3)) / TILE);
  const ty = Math.floor((p.y + iy * (p.h / 2 + 3)) / TILE);
  const block = G.ents.find(e => e.isBlock && !e.dead && e.tx === tx && e.ty === ty);
  if (block) { block.push(ix, iy); return; }
  const ch = tileAt(tx, ty);
  if (ch === 'G') {
    if (G.save.items.glove) {
      G.setTile(tx, ty, '.'); setFlag('G@' + tx + ',' + ty);
      Sound.sfx.smash(); G.shake = 0.25;
      burst(tx * TILE + 8, ty * TILE + 8, '#7a7084', 16, 80, 0.5);
      writeSave();
    } else if (G.msgCool <= 0) {
      G.msgCool = 3;
      Dialog.open(['This boulder is far too heavy to budge.\nPerhaps some special gear would help...']);
    }
  } else if (ch === 'L') {
    const k = G.areaId;
    if ((G.save.keys[k] || 0) > 0) {
      G.save.keys[k]--;
      // unlock the whole door (it may be two tiles wide)
      const stack = [[tx, ty]];
      while (stack.length) {
        const [x, y] = stack.pop();
        if (tileAt(x, y) !== 'L') continue;
        G.setTile(x, y, '.'); setFlag('L@' + x + ',' + y);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      Sound.sfx.unlock();
      writeSave();
    } else if (G.msgCool <= 0) {
      G.msgCool = 3;
      Sound.sfx.error();
      Dialog.open(["It's locked. You need a small key.\nKeys are found in chests, or appear when you solve a room's puzzle."]);
    }
  } else if (ch === 'C') {
    G.tryInteract();
  }
};

/** Sword swing hits enemies, bushes, crystals, and bounces magic orbs. */
G.swordHit = (r, dmg, p) => {
  for (const e of G.ents) {
    if (e.dead || p.swordHits.has(e)) continue;
    if (e.isEnemy && ov(r, e.body())) {
      p.swordHits.add(e);
      if (G.room.trap && G.room.doorsOpen && e.isBoss) continue;
      e.hit(dmg, p.x, p.y - 6);
    } else if (e.isProjectile && e.team === 'enemy' && ov(r, { x: e.x - 5, y: e.y - 5, w: 10, h: 10 })) {
      p.swordHits.add(e);
      if (e.reflectable) {
        const boss = G.ents.find(b => b instanceof Malvoren && !b.dead);
        e.reflect(boss || { x: e.x - e.vx, y: e.y - e.vy + 10 });
      } else { e.dead = true; Sound.sfx.bump(); burst(e.x, e.y, '#ffffff', 5, 40, 0.2); }
    }
  }
  const x0 = Math.floor(r.x / TILE), x1 = Math.floor((r.x + r.w) / TILE);
  const y0 = Math.floor(r.y / TILE), y1 = Math.floor((r.y + r.h) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const ch = tileAt(tx, ty);
    if (ch === 'B') cutBush(tx, ty);
    if (ch === 'x' && !p.swordHits.has('x')) { p.swordHits.add('x'); hitCrystal(tx, ty); }
  }
};

function cutBush(tx, ty) {
  G.setTile(tx, ty, '.');
  Sound.sfx.cut();
  burst(tx * TILE + 8, ty * TILE + 8, '#3fae4a', 10, 60, 0.45);
  burst(tx * TILE + 8, ty * TILE + 8, '#78d470', 6, 40, 0.4);
  const r = Math.random();
  if (r < 0.18) G.ents.push(new Pickup(tx * TILE + 8, ty * TILE + 10, 'coin', { pop: true }));
  else if (r < 0.26) G.ents.push(new Pickup(tx * TILE + 8, ty * TILE + 10, 'heart', { pop: true }));
}

function hitCrystal(tx, ty) {
  if (G.room.def.solve === 'crystal' && !G.room.solved) {
    Sound.sfx.crystal();
    burst(tx * TILE + 8, ty * TILE + 6, '#5ad0ff', 14, 60, 0.5);
    solveRoom();
  } else Sound.sfx.bump();
}

G.beamHitTile = (x, y) => {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  const ch = tileAt(tx, ty);
  if (ch === 'x') hitCrystal(tx, ty);
  if (ch === 'B') cutBush(tx, ty);
};

/** The Sun Sword fires a beam with each swing (one at a time). */
G.fireBeam = spin => {
  if (G.ents.some(e => e.kind === 'beam' && !e.dead)) return;
  const p = G.player;
  const dirs = spin ? ['up', 'down', 'left', 'right'] : [p.face];
  for (const f of dirs) {
    const d = DIRS[f];
    G.ents.push(new Projectile(p.x + d[0] * 10, p.y - 7 + d[1] * 8, d[0] * 180, d[1] * 180, 'beam'));
  }
  Sound.sfx.beam();
};

/** Stepping on entrances and stairs. */
G.checkTileTriggers = p => {
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  const ch = tileAt(tx, ty);
  const warpTile = ch === 'E' || ch === 'A' || ch === 'U';
  if (!warpTile) { G.warpLock = false; return; }
  if (G.warpLock || G.state !== 'play') return;
  if (ch === 'U') {
    const ex = G.room.area.exitTo;
    warpTo(ex.area, ex.room, ex.x, ex.y);
  } else {
    const dest = WARPS[G.areaId + '|' + G.room.key + '|' + tx + ',' + ty];
    if (!dest) return;
    const en = AREAS[dest].entry;
    G.regionName = '';
    warpTo(dest, en.room, en.x, en.y);
  }
};

/** Pressure plates: solved when a block rests on every plate. */
G.checkPlates = () => {
  const r = G.room;
  if (r.def.solve !== 'plates' || r.solved) return;
  const plates = [];
  r.tiles.forEach((row, y) => row.forEach((c, x) => { if (c === 'o') plates.push([x, y]); }));
  const covered = plates.every(([x, y]) => G.ents.some(b => b.isBlock && !b.dead && b.tx === x && b.ty === y && b.slide <= 0));
  if (covered) solveRoom();
};

function solveRoom() {
  const r = G.room;
  r.solved = true;
  setFlag('solved');
  r.doorsOpen = true;
  r.trap = false;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (r.tiles[y][x] === 'x') G.setTile(x, y, 'X');
  r.dirty = true;
  if (r.def.reward === 'key' && !flag('rewardKey')) {
    G.ents.push(new Pickup(128, 92, 'key', { permanent: true, flag: 'rewardKey', pop: true }));
  }
  Sound.sfx.solved();
  writeSave();
}

G.onEnemyKilled = e => {
  const r = G.room;
  if (r.def.solve === 'clear' && !r.solved) {
    if (!G.ents.some(o => o.isEnemy && !o.dead && o !== e)) setTimeout(() => { if (G.room === r) solveRoom(); }, 300);
  }
};

G.onBossDefeated = boss => {
  setFlag('boss');
  solveRoom();
  const area = G.room.area;
  if (boss instanceof Malvoren) {
    G.save.flags.malvorenDefeated = true;
    writeSave();
    Sound.playMusic('ending');
    G.ents = G.ents.filter(e => !e.isEnemy && !e.isProjectile);
    G.ents.push(new NPC(128, 80, 'elder', 'Elder Rowan', 'elder'));
    burst(128, 70, '#ffffff', 30, 80, 0.8);
    Dialog.open(['Malvoren fades into shadow with a final cry...', 'The dark magic binding Elder Rowan is broken! Go and speak with the Elder.']);
    return;
  }
  G.ents.push(new Pickup(boss.x, boss.y, area.relic, { permanent: true, pop: true }));
  G.ents.push(new Pickup(boss.x - 30, boss.y, 'container', { permanent: true, pop: true, flag: 'container' }));
  Sound.playMusic('dungeon');
};

G.dropLoot = (x, y) => {
  const r = Math.random();
  const hurt = G.save.hp < G.save.maxHp;
  if (r < 0.28) G.ents.push(new Pickup(x, y, 'coin', { pop: true }));
  else if (r < 0.36) G.ents.push(new Pickup(x, y, 'coin5', { pop: true }));
  else if (r < (hurt ? 0.58 : 0.44)) G.ents.push(new Pickup(x, y, 'heart', { pop: true }));
};

/** Pick something up. */
G.collect = pk => {
  const S = G.save;
  if (pk.opts.flag) setFlag(pk.opts.flag);
  switch (pk.kind) {
    case 'coin': S.coins = Math.min(999, S.coins + 1); Sound.sfx.coin(); break;
    case 'coin5': S.coins = Math.min(999, S.coins + 5); Sound.sfx.coin(); break;
    case 'heart': S.hp = Math.min(S.maxHp, S.hp + 2); Sound.sfx.heart(); break;
    case 'key':
      addKey(); Sound.sfx.key();
      if (!S.flags.seenKey) { S.flags.seenKey = true; itemGet('key'); }
      writeSave();
      break;
    case 'container':
      S.maxHp += 2; S.hp = S.maxHp;
      itemGet('container');
      break;
    case 'd1': case 'd2': case 'd3': {
      S.relics[pk.kind] = true;
      S.hp = S.maxHp;
      const ex = G.room.area.exitTo;
      itemGet(pk.kind, () => {
        const n = relicCount(S);
        const msg = n < 3 ? `That's ${n} of 3 relics! The relic's light carries you back outside...` : 'All three relics are yours! Their light carries you outside... Now, on to Castle Malvoren!';
        Dialog.open([msg], null, () => { G.regionName = ''; warpTo(ex.area, ex.room, ex.x, ex.y); });
      });
      break;
    }
  }
};

G.buy = item => {
  const S = G.save;
  if (S.coins < item.price) {
    Sound.sfx.error();
    Dialog.open([`That costs ${item.price} coins. Come back when you have a few more!`], 'Wynn');
    return;
  }
  if (item.item === 'potion' && S.hp >= S.maxHp) {
    Dialog.open(["You're already in perfect health! Save your coins, friend."], 'Wynn');
    return;
  }
  S.coins -= item.price;
  Sound.sfx.buy();
  if (item.item === 'potion') { S.hp = S.maxHp; Dialog.open(['Glug glug... Your hearts are fully restored!'], 'Wynn'); writeSave(); }
  else { S.flags.boughtContainer = true; item.dead = true; S.maxHp += 2; S.hp = S.maxHp; itemGet('container'); }
};

G.playerDied = () => {
  G.state = 'dying';
  G.dyingT = 1.4;
  G.player.state = 'dead';
  Sound.stopMusic();
  Sound.sfx.fall();
};

function respawn() {
  const S = G.save, c = S.checkpoint;
  S.hp = S.maxHp;
  G.player.inv = 1.5;
  G.player.state = 'walk';
  G.regionName = '';
  fadeTo(() => placeInRoom(c.area, c.room, c.x, c.y));
}

// ---------------------------------------------------------------------
// Dialog box (DOM, so the text is big and crisp on phones)
// ---------------------------------------------------------------------
const Dialog = {
  pages: [], i: 0, shown: 0, cb: null, prevState: 'play',
  open(pages, name, cb) {
    if (G.state === 'dialog') { // queue after the current one
      const prevCb = this.cb;
      this.pages.push(...pages);
      this.cb = () => { if (prevCb) prevCb(); if (cb) cb(); };
      return;
    }
    this.pages = pages.slice(); this.i = 0; this.shown = 0; this.cb = cb;
    this.prevState = G.state === 'dialog' ? 'play' : G.state;
    G.state = 'dialog';
    $('dialog').classList.remove('hidden');
    $('dialog-name').textContent = name || '';
    $('dialog-name').style.display = name ? '' : 'none';
    this.render();
    Input.clear();
  },
  render() {
    const full = this.pages[this.i];
    $('dialog-text').textContent = full.slice(0, Math.floor(this.shown));
    $('dialog-next').style.visibility = this.shown >= full.length ? 'visible' : 'hidden';
  },
  update(dt) {
    const full = this.pages[this.i];
    if (this.shown < full.length) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(full.length, this.shown + dt * 55);
      if (Math.floor(this.shown) !== before && before % 3 === 0) Sound.sfx.text();
      this.render();
    }
    if (Input.pressed('attack') || Input.pressed('jump') || Input.pressed('pause') || Input.pressed('roll') || Input.pressed('spin')) this.advance();
  },
  advance() {
    const full = this.pages[this.i];
    if (this.shown < full.length) { this.shown = full.length; this.render(); return; }
    Sound.sfx.menu();
    this.i++;
    if (this.i >= this.pages.length) {
      $('dialog').classList.add('hidden');
      G.state = 'play';
      Input.clear();
      const cb = this.cb; this.cb = null;
      if (cb) cb();
    } else { this.shown = 0; this.render(); }
  },
};

// ---------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------
function drawHUD(g) {
  const S = G.save, I = Art.icons;
  g.fillStyle = '#1a1c2c'; g.fillRect(0, 0, W, HUD);
  g.fillStyle = '#2e3150'; g.fillRect(0, HUD - 2, W, 2);
  // hearts (two half-hearts each)
  const hearts = S.maxHp / 2;
  for (let i = 0; i < hearts; i++) {
    const v = S.hp - i * 2;
    const img = v >= 2 ? I.heartFull : v === 1 ? I.heartHalf : I.heartEmpty;
    const row = i >= 7 ? 1 : 0;
    g.drawImage(img, 5 + (i % 7) * 9, 4 + row * 9);
  }
  // low health warning blink
  if (S.hp <= 2 && Math.floor(G.t * 3) % 2) { g.fillStyle = 'rgba(255,60,90,0.25)'; g.fillRect(3, 2, 66, 20); }
  // coins
  g.drawImage(I.coin, 76, 6);
  Art.text(g, String(S.coins).padStart(3, '0'), 87, 9, '#ffffff');
  // keys (only inside dungeons)
  if (G.room && G.room.area.dungeon) {
    g.drawImage(I.key, 104, 6);
    Art.text(g, 'x' + (S.keys[G.areaId] || 0), 113, 9, '#ffffff');
  }
  // items
  let ix = 132;
  for (const it of ['boots', 'glove', 'sunsword']) {
    if (S.items[it]) { const im = I[it]; g.drawImage(im, ix, 12 - im.height / 2 | 0); }
    ix += 14;
  }
  // relics
  ['d1', 'd2', 'd3'].forEach((r, i) => g.drawImage(S.relics[r] ? I[r] : I.relicEmpty, 176 + i * 14, 6));
}

function drawBossBar(g) {
  const b = G.ents.find(e => e.isBoss && !e.dead);
  if (!b || (G.room.trap && G.room.doorsOpen)) return;
  const x = 64, y = HUD + VIEW_H - 9, w = 128;
  g.fillStyle = '#1a1c2c'; g.fillRect(x - 2, y - 2, w + 4, 7);
  g.fillStyle = '#5a2030'; g.fillRect(x, y, w, 3);
  g.fillStyle = '#ff4060'; g.fillRect(x, y, Math.max(0, w * b.hp / b.maxHp), 3);
  g.fillStyle = '#ff9aaa'; g.fillRect(x, y, Math.max(0, w * b.hp / b.maxHp), 1);
}

// ---------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------
const screen = document.getElementById('screen');
const sctx = screen.getContext('2d');
const buf = document.createElement('canvas');
buf.width = W; buf.height = H;
const bctx = buf.getContext('2d');
bctx.imageSmoothingEnabled = false;

function drawWorld(g) {
  const r = G.room;
  g.drawImage(r.bg, 0, 0);
  const list = G.ents.filter(e => !e.dead).concat([G.player]);
  list.sort((a, b) => (a.isBlock ? -1 : 0) - (b.isBlock ? -1 : 0) || a.y - b.y);
  for (const e of list) e.draw(g);
  if (G.player.state === 'hold' && G.player.holdItem) {
    const img = Art.icons[G.player.holdItem];
    g.drawImage(img, Math.round(G.player.x - img.width / 2), Math.round(G.player.y - 14 - img.height));
  }
  for (const p of G.parts) {
    g.globalAlpha = Math.max(0, Math.min(1, p.life / p.max * 1.5));
    g.fillStyle = p.color; g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  g.globalAlpha = 1;
}

function render() {
  const g = bctx;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (G.state === 'title' || !G.room) { drawTitleScene(g); blit(); return; }
  let sx = 0, sy = 0;
  if (G.shake > 0) { sx = Math.round(rand(-2, 2)); sy = Math.round(rand(-2, 2)); }
  g.save();
  g.beginPath(); g.rect(0, HUD, W, VIEW_H); g.clip();
  g.translate(sx, HUD + sy);
  if (G.state === 'scroll') {
    const s = G.scroll, k = easeInOut(s.t);
    const dx = s.dir[0] * VIEW_W, dy = s.dir[1] * VIEW_H;
    g.drawImage(s.oldBg, Math.round(-dx * k), Math.round(-dy * k));
    g.drawImage(G.room.bg, Math.round(dx * (1 - k)), Math.round(dy * (1 - k)));
    const p = G.player;
    // the hero glides from where they left the old screen to where they enter the new one
    const ox = p.x, oy = p.y;
    p.x = s.from.x + (s.to.x + dx - s.from.x) * k - dx * k;
    p.y = s.from.y + (s.to.y + dy - s.from.y) * k - dy * k;
    p.anim += 0.016; p.draw(g);
    p.x = ox; p.y = oy;
  } else {
    drawWorld(g);
  }
  if (G.state === 'dying' || G.state === 'gameover') {
    g.fillStyle = `rgba(80,0,20,${G.state === 'gameover' ? 0.5 : (1.4 - G.dyingT) / 1.4 * 0.5})`;
    g.fillRect(-4, -4, W + 8, VIEW_H + 8);
    if (G.state === 'dying') { // hero spins and drops
      const p = G.player, k = Math.floor(G.dyingT * 10) % 4;
      g.drawImage(Art.sprites.hero[['down', 'left', 'up', 'right'][k] + '0'], Math.round(p.x - 8), Math.round(p.y - 12));
    }
  }
  g.restore();
  drawBossBar(g);
  drawHUD(g);
  if (G.state === 'fade' && G.fade) {
    const t = G.fade.t;
    g.fillStyle = `rgba(0,0,0,${t < 0.35 ? t / 0.35 : Math.max(0, 1 - (t - 0.45) / 0.35)})`;
    g.fillRect(0, 0, W, H);
  }
  blit();
}

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function blit() {
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(buf, 0, 0, screen.width, screen.height);
}

// Title screen backdrop: the village with the hero strolling by
let titleRoom = null;
function drawTitleScene(g) {
  if (!titleRoom) {
    titleRoom = Art.mk(VIEW_W, VIEW_H);
    Art.renderRoom(titleRoom, AREAS.over.rooms['1,2'].map.map(r => r.split('')), 'over', 0);
  }
  g.drawImage(titleRoom, 0, HUD);
  g.fillStyle = 'rgba(20,20,50,0.45)'; g.fillRect(0, 0, W, H);
  const x = (G.t * 30) % (W + 40) - 20;
  const fr = Math.floor(G.t * 7) % 2;
  g.drawImage(Art.sprites.hero['right' + fr], Math.round(x), 172);
  for (let i = 0; i < 14; i++) {
    const a = G.t * 0.5 + i * 1.7;
    g.fillStyle = i % 2 ? '#fff6a0' : '#ffffff';
    g.fillRect(Math.round((i * 37 + Math.sin(a) * 10) % W), Math.round((i * 23 + G.t * 8 * (1 + i % 3)) % H), 1, 1);
  }
}

// ---------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------
function update(dt) {
  G.t += dt;
  G.shake = Math.max(0, G.shake - dt);
  G.msgCool = Math.max(0, G.msgCool - dt);
  if (G.save && G.state !== 'title' && G.state !== 'pause') G.save.time += dt;

  if (Input.pressed('pause')) {
    if (G.state === 'play') { openPause(); return; }
    else if (G.state === 'pause') { closePause(); return; }
  }

  switch (G.state) {
    case 'play': updatePlay(dt); break;
    case 'dialog': Dialog.update(dt); updateParticles(dt); break;
    case 'scroll':
      G.scroll.t += dt / 0.55;
      if (G.scroll.t >= 1) { G.scroll = null; G.state = 'play'; enterRoom(); }
      break;
    case 'fade':
      G.fade.t += dt;
      if (!G.fade.done && G.fade.t >= 0.4) { G.fade.done = true; G.fade.fn(); }
      if (G.fade.t >= 0.8) { G.fade = null; if (G.state === 'fade') G.state = 'play'; }
      break;
    case 'dying':
      G.dyingT -= dt;
      if (G.dyingT <= 0) { G.state = 'gameover'; show('gameover'); }
      break;
  }
  if (G.room && G.room.animated) {
    G.room.animT += dt;
    if (G.room.animT > 0.35) { G.room.animT = 0; G.room.frame++; G.room.dirty = true; }
  }
  if (G.room && G.room.dirty) renderBg();
  updateContextLabel();
}

function updatePlay(dt) {
  const r = G.room;
  G.player.update(dt);
  if (G.state !== 'play') return;
  // boss rooms: doors shut behind you once you step inside
  if (r.trap && r.doorsOpen && G.player.y < VIEW_H - 40) {
    r.doorsOpen = false;
    Sound.sfx.door(); G.shake = 0.2;
    if (r.bossName) showBanner(r.bossName);
  }
  for (const e of G.ents) {
    if (e.dead) continue;
    if (e.isBoss && r.trap && r.doorsOpen) continue;   // boss waits until the doors close
    e.update(dt);
  }
  G.ents = G.ents.filter(e => !e.dead);
  updateParticles(dt);
  if (G.state === 'play') checkEdges();
}

function updateParticles(dt) {
  for (const p of G.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.vx *= 0.96; }
  G.parts = G.parts.filter(p => p.life > 0);
}

let lastLabel = '';
function updateContextLabel() {
  const t = G.state === 'play' ? frontTarget() : null;
  const label = t ? t.label : 'Attack';
  if (label !== lastLabel) {
    lastLabel = label;
    $('b-attack').querySelector('span').textContent = label;
    $('b-attack').classList.toggle('context', !!t);
  }
}

// ---------------------------------------------------------------------
// Menus & overlays
// ---------------------------------------------------------------------
function $(id) { return document.getElementById(id); }
function show(id) { $(id).classList.remove('hidden'); syncOverlayClass(); }
function hide(id) { $(id).classList.add('hidden'); syncOverlayClass(); }
/** Hide the touch controls while a menu is open so taps reach the menu. */
function syncOverlayClass() {
  const open = ['pause', 'help', 'gameover', 'ending'].some(id => !$(id).classList.contains('hidden'));
  document.body.classList.toggle('overlay-open', open);
}

let bannerTimer = null;
function showBanner(text) {
  const b = $('banner');
  b.textContent = text;
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('show'), 2400);
}

function goalText() {
  const S = G.save;
  if (S.flags.rescued) return 'Odyssey is at peace. Thank you for playing! Feel free to keep exploring.';
  if (!S.relics.d1) return 'Find the FOREST SHRINE: go west from the village, then north through Whisperwood Forest.';
  if (!S.relics.d2) return 'Find the RIVER GROTTO at Silverrun Falls: go east through the market. Leap the wide gap with your Leaping Boots!';
  if (!S.relics.d3) return 'Climb to the PEAK TOWER: go north from Silverrun Falls. Smash the boulders with your Power Glove.';
  if (!S.flags.malvorenDefeated) return 'Storm CASTLE MALVOREN: north from the Crossroads, then east. Rescue Elder Rowan!';
  return 'Speak with Elder Rowan in the castle throne room.';
}

function iconURL(img, k = 3) {
  const c = Art.scale(img, k);
  return c.toDataURL();
}

function openPause() {
  if (G.state !== 'play') return;
  G.state = 'pause';
  Sound.sfx.menu();
  const S = G.save, I = Art.icons;
  const inv = $('pause-inv');
  inv.innerHTML = '';
  const add = (img, label, have) => {
    const d = document.createElement('div');
    d.className = 'inv-item' + (have ? '' : ' missing');
    d.innerHTML = `<img alt="" src="${iconURL(img)}"><span>${have ? label : '???'}</span>`;
    inv.appendChild(d);
  };
  add(I.boots, 'Leaping Boots', S.items.boots);
  add(I.glove, 'Power Glove', S.items.glove);
  add(I.sunsword, 'Sun Sword', S.items.sunsword);
  add(I.d1, 'Relic of Earth', S.relics.d1);
  add(I.d2, 'Relic of Water', S.relics.d2);
  add(I.d3, 'Relic of Sky', S.relics.d3);
  $('pause-goal').textContent = goalText();
  $('pause-stats').textContent = `Hearts: ${S.maxHp / 2}   Coins: ${S.coins}   Time: ${fmtTime(S.time)}`;
  updateMuteButtons();
  show('pause');
}
function closePause() {
  hide('pause'); hide('help');
  G.state = 'play';
  Input.clear();
}
function fmtTime(s) { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; }

function updateMuteButtons() {
  $('btn-mute').textContent = Sound.muted ? '🔇' : '🔊';
  $('btn-mute').setAttribute('aria-label', Sound.muted ? 'Unmute' : 'Mute');
  $('pause-sound').textContent = 'Sound: ' + (Sound.muted ? 'Off' : 'On');
}

function showTitle() {
  G.state = 'title';
  hide('pause'); hide('gameover'); hide('ending'); hide('dialog'); hide('help');
  const has = !!loadSave();
  $('title-continue').style.display = has ? '' : 'none';
  $('title-new').textContent = 'New Game';
  $('title-new').dataset.confirm = '';
  show('title');
  document.body.classList.add('on-title');
  Sound.playMusic('title');
}

function startGame(save, isNew) {
  G.save = save;
  // older saves may be missing fields
  for (const k of ['keys', 'items', 'relics', 'flags']) if (!G.save[k]) G.save[k] = {};
  G.save.hp = G.save.maxHp;          // always start a session with full hearts
  hide('title');
  document.body.classList.remove('on-title');
  const c = G.save.checkpoint;
  G.player = new Player(c.x, c.y);
  G.regionName = '';
  G.state = 'play';
  placeInRoom(c.area, c.room, c.x, c.y);
  if (isNew) {
    Dialog.open([
      'Long ago, the peaceful land of Odyssey was protected by three sacred relics.',
      'But one dark night, the sorcerer MALVOREN stole the relics... and kidnapped Elder Rowan of Willowbrook Village!',
      'You, a young hero with a trusty sword, have vowed to set things right.',
      'Talk to the villagers to begin your quest. Walk up to someone and press ATTACK to talk.',
    ]);
  }
}

function startEnding() {
  G.save.flags.rescued = true;
  writeSave();
  G.state = 'fade';
  G.fade = { t: 0, done: false, fn: () => {
    G.state = 'ending';
    Sound.playMusic('ending');
    const S = G.save;
    $('ending-stats').textContent = `Time: ${fmtTime(S.time)}  ·  Hearts: ${S.maxHp / 2}  ·  Coins: ${S.coins}`;
    show('ending');
  } };
}

function setupMenus() {
  const click = (id, fn) => $(id).addEventListener('click', e => { e.preventDefault(); Sound.init(); Sound.sfx.menu(); fn(); });
  click('title-continue', () => { const s = loadSave(); if (s) startGame(s, false); });
  click('title-new', () => {
    const btn = $('title-new');
    if (loadSave() && !btn.dataset.confirm) { btn.dataset.confirm = '1'; btn.textContent = 'Erase save & start over?'; return; }
    const s = newSave();
    startGame(s, true);
    writeSave();
  });
  click('title-help', () => show('help'));
  click('help-close', () => hide('help'));
  click('pause-resume', closePause);
  click('pause-help', () => show('help'));
  click('pause-sound', () => { Sound.toggleMute(); updateMuteButtons(); });
  click('pause-title', () => { writeSave(); showTitle(); });
  click('gameover-continue', () => { hide('gameover'); respawn(); });
  click('ending-continue', () => {
    hide('ending');
    G.save.checkpoint = { area: 'over', room: '1,2', x: 7.5 * 16 + 8, y: 6 * 16 + 8 };
    writeSave();
    G.state = 'play';
    G.regionName = '';
    fadeTo(() => placeInRoom('over', '1,2', 7.5 * 16 + 8, 6 * 16 + 8));
  });
  click('ending-title', () => showTitle());
  $('btn-pause').addEventListener('click', e => { e.preventDefault(); Sound.init(); if (G.state === 'play') openPause(); else if (G.state === 'pause') closePause(); });
  $('btn-mute').addEventListener('click', e => { e.preventDefault(); Sound.init(); Sound.toggleMute(); updateMuteButtons(); });
  $('dialog').addEventListener('pointerdown', e => { e.preventDefault(); if (G.state === 'dialog') Dialog.advance(); });

  // keyboard shortcuts for overlays
  Input.onAny(a => {
    Sound.init();
    if (a === 'mute') { Sound.toggleMute(); updateMuteButtons(); return; }
    if (G.state === 'title' && (a === 'attack' || a === 'pause') && $('help').classList.contains('hidden')) {
      const s = loadSave();
      if (s) startGame(s, false); else { startGame(newSave(), true); writeSave(); }
      Input.clear();
    } else if (G.state === 'gameover' && (a === 'attack' || a === 'pause')) {
      hide('gameover'); respawn(); Input.clear();
    }
  });
  updateMuteButtons();
}

// ---------------------------------------------------------------------
// Layout: fit the game to any screen, portrait or landscape
// ---------------------------------------------------------------------
function layout() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = vh > vw * 1.05;
  const touch = document.body.classList.contains('touch');
  document.body.classList.toggle('portrait', portrait);
  document.body.classList.toggle('landscape', !portrait);
  let sw, sh;
  if (portrait) {
    sw = vw; sh = sw * H / W;
    const maxH = touch ? vh * 0.58 : vh;
    if (sh > maxH) { sh = maxH; sw = sh * W / H; }
  } else {
    sh = vh; sw = sh * W / H;
    if (sw > vw) { sw = vw; sh = sw * H / W; }
  }
  // snap to whole pixels-per-game-pixel when we're close, for the crispest look
  const k = sw / W;
  if (k > 2 && Math.abs(k - Math.round(k)) < 0.12 && Math.round(k) * H <= (portrait ? vh : vh)) { sw = Math.round(k) * W; sh = Math.round(k) * H; }
  sw = Math.floor(sw); sh = Math.floor(sh);
  const stage = $('stage');
  stage.style.width = sw + 'px'; stage.style.height = sh + 'px';
  stage.style.left = Math.floor((vw - sw) / 2) + 'px';
  stage.style.top = portrait ? '0px' : Math.floor((vh - sh) / 2) + 'px';
  document.documentElement.style.setProperty('--u', (sh / H) + 'px');
  document.documentElement.style.setProperty('--stage-h', sh + 'px');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  screen.width = Math.round(sw * dpr); screen.height = Math.round(sh * dpr);
  screen.style.width = sw + 'px'; screen.style.height = sh + 'px';
  blit();
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
let last = 0;
function frame(ts) {
  const dt = Math.min(1 / 30, (ts - last) / 1000 || 0);
  last = ts;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function boot() {
  Art.init();
  Input.setupTouch();
  setupMenus();
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 200));
  layout();
  // stop the page from scrolling / zooming / selecting while playing
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { writeSave(); if (G.state === 'play') openPause(); }
  });
  window.addEventListener('pagehide', writeSave);
  showTitle();
  requestAnimationFrame(frame);
}
boot();
