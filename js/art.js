/* =====================================================================
   ODYSSEY — Art
   Every graphic is generated in code at startup: tiles are painted with
   small pixel routines, characters come from text "pixel maps".
   Nothing is loaded from disk.
   ===================================================================== */

const Art = (() => {
  const T = 16;

  /** Create an offscreen canvas and let `fn` paint on it. */
  function mk(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (fn) fn(g);
    return c;
  }
  const R = (g, c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  /** Tiny deterministic random generator so tiles look the same every time. */
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  /** Fill a pixel circle/ellipse. */
  function blob(g, c, cx, cy, rx, ry) {
    g.fillStyle = c;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) g.fillRect(x, y, 1, 1);
      }
  }

  /** Build a sprite canvas from a text pixel map and a palette. */
  function fromMap(rows, pal, flip) {
    const h = rows.length, w = rows[0].length;
    return mk(w, h, g => {
      rows.forEach((row, y) => {
        if (row.length !== w) console.warn('pixel map row width mismatch', row);
        for (let x = 0; x < w; x++) {
          const ch = row[x];
          if (ch === '.' || !pal[ch]) continue;
          R(g, pal[ch], flip ? w - 1 - x : x, y);
        }
      });
    });
  }

  // ---------------------------------------------------------------------
  // Colours
  // ---------------------------------------------------------------------
  const C = {
    outline: '#1a1c2c',
    grass: '#7ccf5a', grassD: '#5fae46', grassL: '#a4e47e',
    path: '#e3c48c', pathD: '#c8a56c', pathL: '#f2dcae',
    leaf: '#2f8f46', leafD: '#1f6a35', leafL: '#56b862', trunk: '#7a4a2a', trunkD: '#553218',
    bush: '#3fae4a', bushD: '#2a7f36', bushL: '#78d470',
    rock: '#a3a3b4', rockD: '#6e6e80', rockL: '#d0d0dc',
    water: '#3a8ee6', waterD: '#2a6ab8', waterL: '#8fd0ff',
    mtn: '#b08060', mtnD: '#7f5a40', mtnL: '#d6a57c',
    roof: '#d05050', roofD: '#9c3333', roofL: '#ee7c6c',
    wall: '#f3e6c8', wallD: '#d2bf98', timber: '#8a5a3a',
    stone: '#a9a9bb', stoneD: '#77778c', stoneL: '#cfcfdd',
    wood: '#a0683c', woodD: '#6e4422', woodL: '#c88c58',
    gold: '#f4c430', goldD: '#c08a18', goldL: '#fff0a0',
    sand: '#ecd9a0',
  };

  const THEMES = {
    over:   { wall: C.stone, wallD: C.stoneD, wallL: C.stoneL, floor: C.grass, floorD: C.grassD, floorL: C.grassL },
    forest: { wall: '#58885a', wallD: '#2f4f34', wallL: '#7cae74', floor: '#bccf9c', floorD: '#9db57e', floorL: '#d4e3b8' },
    water:  { wall: '#4f75a8', wallD: '#2a4878', wallL: '#7298c8', floor: '#aac6de', floorD: '#8aaac6', floorL: '#cfe0ee' },
    peak:   { wall: '#7e6ea0', wallD: '#4a4070', wallL: '#a294c2', floor: '#cbc0da', floorD: '#ab9fc2', floorL: '#e2daec' },
    castle: { wall: '#5e4c62', wallD: '#33283a', wallL: '#806c86', floor: '#8e7c86', floorD: '#76646e', floorL: '#a8969e' },
  };

  // ---------------------------------------------------------------------
  // Tile painters. Each paints one 16x16 tile.
  // ---------------------------------------------------------------------
  function grass(g, seed) {
    R(g, C.grass, 0, 0, T, T);
    const r = rng(seed * 7 + 3);
    for (let i = 0; i < 6; i++) { const x = r() * 15 | 0, y = r() * 14 | 0; R(g, C.grassD, x, y, 1, 2); }
    for (let i = 0; i < 2; i++) { R(g, C.grassL, r() * 15 | 0, r() * 15 | 0); }
  }
  function floor(g, th, seed) {
    R(g, th.floor, 0, 0, T, T);
    R(g, th.floorD, 0, 15, T, 1); R(g, th.floorD, 15, 0, 1, T);
    R(g, th.floorL, 0, 0, T, 1); R(g, th.floorL, 0, 0, 1, T);
    const r = rng(seed * 13 + 5);
    for (let i = 0; i < 3; i++) R(g, th.floorD, 2 + r() * 12 | 0, 2 + r() * 12 | 0);
  }
  function ground(g, theme, seed) { if (theme === 'over') grass(g, seed); else floor(g, THEMES[theme], seed); }

  function bricks(g, base, dark, light) {
    R(g, base, 0, 0, T, T);
    for (let row = 0; row < 4; row++) {
      const y = row * 4;
      R(g, dark, 0, y + 3, T, 1);
      const off = row % 2 ? 4 : 0;
      for (let x = off; x < T; x += 8) R(g, dark, x, y, 1, 3);
      R(g, light, 0, y, T, 1);
    }
  }

  const painters = {
    '.': (g, th, s) => ground(g, th, s),
    ',': (g, th, s) => {
      ground(g, th, s);
      const r = rng(s * 3 + 11);
      const cols = ['#ffffff', '#ffe066', '#ff8fb0'];
      for (let i = 0; i < 3; i++) {
        const x = 2 + r() * 11 | 0, y = 2 + r() * 11 | 0, c = cols[i % 3];
        R(g, c, x - 1, y); R(g, c, x + 1, y); R(g, c, x, y - 1); R(g, c, x, y + 1); R(g, '#f4b400', x, y);
      }
    },
    ':': (g, th, s) => {
      R(g, C.path, 0, 0, T, T);
      const r = rng(s * 5 + 1);
      for (let i = 0; i < 5; i++) R(g, C.pathD, r() * 15 | 0, r() * 15 | 0, 2, 1);
      for (let i = 0; i < 3; i++) R(g, C.pathL, r() * 15 | 0, r() * 15 | 0);
    },
    's': (g) => { R(g, C.sand, 0, 0, T, T); },
    'T': (g, th, s) => {
      ground(g, th, s);
      R(g, C.trunkD, 6, 11, 4, 5); R(g, C.trunk, 7, 11, 2, 5);
      blob(g, C.outline, 8, 7, 8, 7.5);
      blob(g, C.leafD, 8, 7, 7, 6.5);
      blob(g, C.leaf, 7.5, 6.5, 6, 5.5);
      blob(g, C.leafL, 6, 4.5, 3, 2.5);
      const r = rng(s + 99);
      for (let i = 0; i < 4; i++) R(g, C.leafD, 3 + r() * 9 | 0, 4 + r() * 6 | 0);
    },
    'B': (g, th, s) => {
      ground(g, th, s);
      blob(g, C.outline, 8, 9, 7.5, 6.5);
      blob(g, C.bushD, 8, 9, 6.5, 5.5);
      blob(g, C.bush, 7.5, 8.5, 5.5, 4.5);
      R(g, C.bushL, 5, 6, 2, 1); R(g, C.bushL, 9, 7, 2, 1); R(g, C.bushL, 6, 10, 2, 1);
    },
    'R': (g, th, s) => {
      ground(g, th, s);
      blob(g, C.outline, 8, 9, 7.5, 6.5);
      blob(g, C.rockD, 8, 9, 6.5, 5.5);
      blob(g, C.rock, 7.5, 8, 5.5, 4.5);
      blob(g, C.rockL, 6, 6.5, 2.5, 1.5);
    },
    '~': (g, th, s, f) => {
      R(g, C.water, 0, 0, T, T);
      const o = f % 2 ? 4 : 0;
      for (let y = 2; y < T; y += 6) {
        R(g, C.waterL, (o + y) % 12, y, 3, 1);
        R(g, C.waterD, (o + y + 7) % 14, y + 3, 3, 1);
      }
    },
    '=': (g) => {
      R(g, C.water, 0, 0, T, T);
      R(g, C.woodD, 1, 0, 14, T);
      for (let y = 0; y < T; y += 4) { R(g, C.wood, 2, y, 12, 3); R(g, C.woodL, 2, y, 12, 1); }
      R(g, C.trunkD, 0, 0, 2, T); R(g, C.trunkD, 14, 0, 2, T);
    },
    'M': (g, th, s) => {
      R(g, C.mtn, 0, 0, T, T);
      const r = rng(s * 17 + 2);
      for (let i = 0; i < 4; i++) { const y = r() * 14 | 0; R(g, C.mtnD, 0, y, T, 1); R(g, C.mtnL, r() * 8 | 0, y + 1, 6, 1); }
      for (let i = 0; i < 4; i++) R(g, C.mtnD, r() * 14 | 0, r() * 14 | 0, 2, 2);
    },
    'r': (g) => {
      R(g, C.roof, 0, 0, T, T);
      for (let y = 0; y < T; y += 4) { R(g, C.roofD, 0, y + 3, T, 1); for (let x = (y / 4 % 2) * 4; x < T; x += 8) R(g, C.roofD, x, y, 1, 3); R(g, C.roofL, 0, y, T, 1); }
    },
    'h': (g) => {
      R(g, C.wall, 0, 0, T, T);
      R(g, C.timber, 0, 0, T, 2); R(g, C.timber, 0, 14, T, 2); R(g, C.timber, 0, 0, 2, T); R(g, C.timber, 14, 0, 2, T);
      R(g, '#8fd0ff', 5, 5, 6, 5); R(g, C.timber, 7, 5, 2, 5); R(g, C.timber, 5, 7, 6, 1); R(g, C.outline, 4, 4, 8, 1);
    },
    'n': (g) => {
      R(g, C.wall, 0, 0, T, T);
      R(g, C.timber, 0, 0, T, 2); R(g, C.timber, 0, 0, 2, T); R(g, C.timber, 14, 0, 2, T);
      R(g, C.outline, 3, 3, 10, 13); R(g, C.woodD, 4, 4, 8, 12); R(g, C.wood, 5, 5, 6, 11);
      R(g, C.gold, 9, 10, 1, 1);
    },
    'F': (g, th, s) => {
      ground(g, th, s);
      R(g, C.woodD, 0, 6, T, 2); R(g, C.woodD, 0, 11, T, 2);
      R(g, C.wood, 0, 6, T, 1); R(g, C.wood, 0, 11, T, 1);
      for (const x of [2, 12]) { R(g, C.outline, x - 1, 3, 4, 12); R(g, C.wood, x, 4, 2, 10); R(g, C.woodL, x, 4, 1, 10); }
    },
    'S': (g, th, s) => {
      ground(g, th, s);
      R(g, C.woodD, 7, 9, 2, 7);
      R(g, C.outline, 1, 2, 14, 9); R(g, C.wood, 2, 3, 12, 7); R(g, C.woodL, 2, 3, 12, 1);
      R(g, C.woodD, 4, 5, 8, 1); R(g, C.woodD, 4, 7, 6, 1);
    },
    'Q': (g, th, s, f) => {
      ground(g, th, s);
      blob(g, C.outline, 8, 8, 8, 7.5);
      blob(g, C.stone, 8, 8, 7, 6.5);
      blob(g, C.water, 8, 8, 5, 4.5);
      R(g, C.stoneL, 7, 3, 2, 7); R(g, C.waterL, 7, f % 2 ? 2 : 1, 2, 2);
      R(g, C.waterL, f % 2 ? 4 : 10, 8, 2, 1);
    },
    'E': (g) => {
      bricks(g, C.stone, C.stoneD, C.stoneL);
      R(g, C.outline, 2, 2, 12, 14); blob(g, C.outline, 8, 5, 6, 4);
      R(g, '#000000', 3, 4, 10, 12); blob(g, '#000000', 8, 5, 5, 3);
    },
    'W': (g) => {
      R(g, '#8a8aa0', 0, 0, T, T);
      R(g, '#5a5a70', 0, 7, T, 1); R(g, '#5a5a70', 0, 15, T, 1); R(g, '#5a5a70', 7, 0, 1, 7); R(g, '#5a5a70', 0, 8, 1, 7); R(g, '#5a5a70', 15, 8, 1, 7);
      R(g, '#aeaec4', 0, 0, T, 1); R(g, '#aeaec4', 0, 8, T, 1);
    },
    'C': (g, th, s, f) => {
      R(g, '#2a1a3a', 0, 0, T, T);
      for (let x = 1; x < T; x += 4) R(g, '#5a4a6a', x, 0, 2, T);
      for (let y = 3; y < T; y += 5) R(g, '#5a4a6a', 0, y, T, 2);
      R(g, f % 2 ? '#c040ff' : '#9020d0', 6, 6, 4, 4);
    },
    'A': (g) => { R(g, '#000000', 0, 0, T, T); R(g, '#2a1a3a', 0, 0, T, 2); },
    '#': (g, th) => { const t = THEMES[th]; bricks(g, t.wall, t.wallD, t.wallL); },
    't': (g, th, s, f) => {
      ground(g, th, s);
      R(g, C.outline, 4, 8, 8, 7); R(g, '#555566', 5, 9, 6, 5); R(g, '#888899', 5, 9, 6, 1);
      const fl = f % 2;
      R(g, '#ff6a00', 5, 3 + fl, 6, 6 - fl); R(g, '#ffb000', 6, 4 + fl, 4, 5 - fl); R(g, '#fff27a', 7, 6, 2, 3);
    },
    'p': (g, th) => {
      R(g, '#0a0a14', 0, 0, T, T);
      if (th === 'over') { R(g, '#1a1410', 0, 0, T, T); R(g, '#0a0806', 2, 4, 12, 10); }
      else R(g, '#05050c', 2, 3, 12, 11);
    },
    'b': (g, th, s) => { ground(g, th, s); },
    'o': (g, th, s) => {
      ground(g, th, s);
      R(g, C.outline, 2, 2, 12, 12); R(g, '#c0b060', 3, 3, 10, 10); R(g, '#e8d888', 3, 3, 10, 1); R(g, '#8a7a40', 3, 12, 10, 1);
      R(g, '#a09050', 6, 6, 4, 4);
    },
    'x': (g, th, s) => crystal(g, th, s, '#5ad0ff', '#2a80c8', '#d0f4ff'),
    'X': (g, th, s) => crystal(g, th, s, '#ffa040', '#c85a10', '#fff0a0'),
    'L': (g, th) => {
      const t = THEMES[th];
      bricks(g, t.wall, t.wallD, t.wallL);
      R(g, C.outline, 1, 1, 14, 14); R(g, C.woodD, 2, 2, 12, 12); R(g, C.wood, 3, 3, 10, 10);
      R(g, C.gold, 5, 5, 6, 6); R(g, C.outline, 7, 6, 2, 2); R(g, C.outline, 7.5 | 0, 8, 2, 2);
    },
    'd': (g, th) => {
      const t = THEMES[th];
      R(g, '#111118', 0, 0, T, T);
      for (let x = 1; x < T; x += 4) { R(g, t.wallD, x, 0, 3, T); R(g, t.wallL, x, 0, 1, T); }
      R(g, t.wallD, 0, 7, T, 2);
    },
    'c': (g, th, s) => chest(g, th, s, false),
    'O': (g, th, s) => chest(g, th, s, true),
    'U': (g, th, s) => {
      const t = THEMES[th];
      R(g, t.wallD, 0, 0, T, T);
      for (let i = 0; i < 4; i++) { R(g, t.floorL, 0, i * 4, T, 2); R(g, t.floor, 0, i * 4 + 2, T, 1); R(g, t.wallD, 0, i * 4 + 3, T, 1); }
    },
    'G': (g, th, s) => {
      ground(g, th, s);
      blob(g, C.outline, 8, 8.5, 8, 7.5);
      blob(g, '#5a5060', 8, 8.5, 7, 6.5);
      blob(g, '#7a7084', 7.5, 7.5, 6, 5);
      blob(g, '#9a90a4', 5.5, 5.5, 2.5, 1.5);
      R(g, C.outline, 9, 5, 1, 3); R(g, C.outline, 10, 8, 1, 3); R(g, C.outline, 8, 10, 2, 1); R(g, C.outline, 4, 9, 2, 1);
    },
    'K': (g, th, s) => ground(g, th, s),
    'Z': (g, th, s) => ground(g, th, s),
  };

  function crystal(g, th, s, c, d, l) {
    ground(g, th, s);
    R(g, C.outline, 3, 11, 10, 4); R(g, '#777788', 4, 12, 8, 2);
    g.fillStyle = C.outline; g.beginPath(); g.moveTo(8, 0); g.lineTo(13, 6); g.lineTo(8, 13); g.lineTo(3, 6); g.fill();
    g.fillStyle = d; g.beginPath(); g.moveTo(8, 1); g.lineTo(12, 6); g.lineTo(8, 12); g.lineTo(4, 6); g.fill();
    g.fillStyle = c; g.beginPath(); g.moveTo(8, 1); g.lineTo(12, 6); g.lineTo(8, 6); g.fill();
    g.beginPath(); g.moveTo(4, 6); g.lineTo(8, 12); g.lineTo(8, 6); g.fill();
    R(g, l, 7, 3, 1, 2);
  }
  function chest(g, th, s, open) {
    ground(g, th, s);
    R(g, C.outline, 1, 3, 14, 12);
    if (open) {
      R(g, C.woodD, 2, 4, 12, 4); R(g, '#1a1010', 3, 5, 10, 3);
      R(g, C.wood, 2, 8, 12, 6); R(g, C.gold, 2, 8, 12, 1);
    } else {
      R(g, C.wood, 2, 4, 12, 10); R(g, C.woodL, 2, 4, 12, 1); R(g, C.woodD, 2, 8, 12, 1);
      R(g, C.gold, 2, 7, 12, 1); R(g, C.gold, 7, 7, 2, 4); R(g, C.outline, 7, 9, 2, 1);
    }
  }

  // Tile cache: one canvas per theme / char / variant / animation frame.
  const tileCache = {};
  function tile(ch, theme, variant, frame) {
    const p = painters[ch] || painters['.'];
    const animated = ch === '~' || ch === 't' || ch === 'Q' || ch === 'C';
    const key = theme + ch + (variant & 3) + (animated ? frame % 2 : 0);
    if (!tileCache[key]) tileCache[key] = mk(T, T, g => p(g, theme, (variant & 3) + 1, animated ? frame % 2 : 0));
    return tileCache[key];
  }

  /** Paint a whole room (array of row arrays) into a canvas. */
  function renderRoom(canvas, tiles, theme, frame) {
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < tiles.length; y++)
      for (let x = 0; x < tiles[y].length; x++) {
        const ch = tiles[y][x];
        g.drawImage(tile(ch, theme, (x * 7 + y * 13) ^ (x * y), frame), x * T, y * T);
        // pits get a darker "lip" where the floor drops off
        if (ch === 'p' && y > 0 && tiles[y - 1][x] !== 'p') {
          const th = THEMES[theme];
          R(g, theme === 'over' ? C.mtnD : th.wallD, x * T, y * T, T, 4);
          R(g, theme === 'over' ? C.mtn : th.wall, x * T, y * T, T, 2);
        }
      }
  }

  // ---------------------------------------------------------------------
  // Character sprites (pixel maps)
  // ---------------------------------------------------------------------
  const HERO = {
    down: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhHHhhhhk...',
      '...khhhhhhhhk...',
      '...khsshhsshk...',
      '...kssksskssk...',
      '....kssSSssk....',
      '....kttttttk....',
      '...ksttttttsk...',
      '...ksttbbttsk...',
      '...kkTTTTTTkk...',
      '....kTTTTTTk....',
      '....kppkkppk....',
      '....kppk.kppk...',
      '....kkk...kkk...',
    ],
    down2: [13, '....kppkkppk....', '....kppk.kkk....', '....kkk.........'],
    up: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhHHhhhhk...',
      '...khhhhhhhhk...',
      '...khhhhhhhhk...',
      '...khhhhhhhhk...',
      '....khhhhhhk....',
      '....kttttttk....',
      '...ksttttttsk...',
      '...ksttttttsk...',
      '...kkTTTTTTkk...',
      '....kTTTTTTk....',
      '....kppkkppk....',
      '....kppk.kppk...',
      '....kkk...kkk...',
    ],
    up2: [13, '....kppkkppk....', '....kkk.kppk....', '.........kkk....'],
    side: [
      '................',
      '.....kkkkkk.....',
      '....khhhhhhk....',
      '...khhhHHhhhk...',
      '...khhhhhhhhk...',
      '...khhhhsssssk..',
      '...khhhsssksk...',
      '....khhssssk....',
      '....kttttttk....',
      '....kttttssk....',
      '....kttbbttk....',
      '....kTTTTTTk....',
      '....kTTTTTTk....',
      '.....kppppk.....',
      '.....kpkkpk.....',
      '.....kk..kk.....',
    ],
    side2: [13, '.....kppppk.....', '....kpk..kpk....', '....kk....kk....'],
  };
  const HERO_PAL = {
    k: C.outline, h: '#7a4520', H: '#b0703a', s: '#f5c9a0', S: '#e0a07a',
    t: '#2a9dbf', T: '#1d6f8a', b: '#7a4a2a', p: '#5a3a28', w: '#ffffff',
  };

  function heroFrame(name) {
    const m = HERO[name];
    if (Array.isArray(m) && typeof m[0] === 'number') {
      const baseName = name.replace('2', '');
      const rows = HERO[baseName].slice();
      for (let i = 1; i < m.length; i++) rows[m[0] + i - 1] = m[i];
      return rows;
    }
    return m;
  }

  /** Build the 4-direction, 2-frame sprite set for the hero or a villager. */
  function personSet(pal) {
    const set = {};
    for (const f of [0, 1]) {
      const sfx = f ? '2' : '';
      set['down' + f] = fromMap(heroFrame('down' + sfx), pal);
      set['up' + f] = fromMap(heroFrame('up' + sfx), pal);
      set['right' + f] = fromMap(heroFrame('side' + sfx), pal);
      set['left' + f] = fromMap(heroFrame('side' + sfx), pal, true);
    }
    return set;
  }

  const SLIME = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '......kkkk......',
    '....kkggggkk....',
    '...kggggggggk...',
    '..kgwwggggggggk.',
    '.kgwggggggggggk.',
    '.kgggkggggkgggk.',
    '.kgggkggggkgggk.',
    '.kggggggggggggk.',
    '.kGggggggggggGk.',
    '..kkkkkkkkkkkk..',
    '................',
  ];
  const SLIME2 = [
    '................', '................', '................', '................', '................', '................',
    '......kkkk......',
    '...kkkggggkkk...',
    '..kgwwgggggggk..',
    '.kgwggggggggggk.',
    '.kgggkggggkgggk.',
    '.kgggkggggkgggk.',
    'kggggggggggggggk',
    'kGggggggggggggGk',
    '.kkkkkkkkkkkkkk.',
    '................',
  ];

  const BAT1 = [
    '................', '................', '................',
    '.k............k.',
    '.kk..........kk.',
    '.kbk..k..k..kbk.',
    '.kbbk.kbbk.kbbk.',
    '.kbbbkbbbbkbbbk.',
    '..kbbbbbbbbbbk..',
    '...kbbrbbrbbk...',
    '....kbbbbbbk....',
    '.....kwkkwk.....',
    '................', '................', '................', '................',
  ];
  const BAT2 = [
    '................', '................', '................', '................', '................',
    '......k..k......',
    '......kbbk......',
    '....kkbbbbkk....',
    '..kkbbbbbbbbkk..',
    '.kbbbbrbbrbbbbk.',
    '.kbbkbbbbbbkbbk.',
    '.kbk.kwkkwk.kbk.',
    '.kk..........kk.',
    '.k............k.',
    '................', '................',
  ];
  const SKEL = [
    '................',
    '.....kkkkkk.....',
    '....kwwwwwwk....',
    '...kwwwwwwwwk...',
    '...kwkkwwkkwk...',
    '...kwkrwwkrwk...',
    '...kwwwkkwwwk...',
    '....kwkwkwk.....',
    '.....kkkkkk.....',
    '...kkwwwwwwkk...',
    '..kwkwkwwkwkwk..',
    '..kwkwwwwwwkwk..',
    '....kwkwwkwk....',
    '....kwk..kwk....',
    '....kwk..kwk....',
    '...kkk....kkk...',
  ];
  const SKEL2 = SKEL.slice(0, 13).concat(['....kwk...kwk...', '...kwk.....kwk..', '...kk......kkk..'].map(r => r.slice(0, 16)));
  const ELDER = [
    '................',
    '.....kkkkkk.....',
    '....kwwwwwwk....',
    '...kwwwwwwwwk...',
    '...kwsssssswk...',
    '...kssksskssk...',
    '...kwwssssswk...',
    '...kwwwwwwwwk...',
    '....kwwwwwwk....',
    '...kRRwwwwRRk...',
    '..kRRRRwwRRRRk..',
    '..ksRRRRRRRRsk..',
    '...kRRRRRRRRk...',
    '...kRRRRRRRRk...',
    '...kRRRRRRRRk...',
    '...kkkkkkkkkk...',
  ];
  const MALV = [
    '.......kk.......',
    '......kVVk......',
    '.....kVVVVk.....',
    '....kVVVVVVk....',
    '...kVVkkkkVVk...',
    '...kVkykkykVk...',
    '...kVkkkkkkVk...',
    '..kVVVkkkkVVVk..',
    '..kVPVVVVVVPVk..',
    '.kVVPVVVVVVPVVk.',
    '.kVVVPVVVVPVVVk.',
    'kVVVVVPPPPVVVVVk',
    'kvVVVVVVVVVVVVvk',
    'kvvVVVVVVVVVVvvk',
    '.kvvvVVVVVVvvvk.',
    '..kkkkkkkkkkkk..',
  ];

  /** Scale a canvas up by an integer factor (keeps pixels crisp). */
  function scale(src, k) {
    return mk(src.width * k, src.height * k, g => { g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0, src.width * k, src.height * k); });
  }
  function flipH(src) {
    return mk(src.width, src.height, g => { g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); });
  }
  /** A white silhouette of a sprite, used for the "just got hit" flash. */
  function whiteOf(src) {
    return mk(src.width, src.height, g => { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; R(g, '#ffffff', 0, 0, src.width, src.height); });
  }

  // ---------------------------------------------------------------------
  // Items & small icons
  // ---------------------------------------------------------------------
  function gem(c, d, l) {
    return mk(8, 12, g => {
      g.fillStyle = C.outline; g.beginPath(); g.moveTo(4, 0); g.lineTo(8, 3); g.lineTo(8, 9); g.lineTo(4, 12); g.lineTo(0, 9); g.lineTo(0, 3); g.fill();
      R(g, d, 1, 3, 6, 6); R(g, c, 2, 2, 4, 8); R(g, l, 3, 2, 1, 7); R(g, d, 2, 1, 4, 1); R(g, d, 2, 10, 4, 1);
    });
  }
  function heartIcon(fill, scaleK) {
    const map = ['.kk.kk.', 'kffkffk', 'kfffffk', 'kfffffk', '.kfffk.', '..kfk..', '...k...'];
    return fromMap(map, { k: C.outline, f: fill });
  }
  function halfHeart() {
    const map = ['.kk.kk.', 'kffkeek', 'kfffeek', 'kfffeek', '.kffek.', '..kfk..', '...k...'];
    return fromMap(map, { k: C.outline, f: '#ff3d5a', e: '#5a3a4a' });
  }

  const icons = {};
  function buildIcons() {
    icons.coin = gem('#3ed65a', '#1f8f34', '#b6ffbf');
    icons.coin5 = gem('#4a8cff', '#2a52b8', '#c0dcff');
    icons.heartFull = heartIcon('#ff3d5a');
    icons.heartEmpty = heartIcon('#5a3a4a');
    icons.heartHalf = halfHeart();
    icons.heart = icons.heartFull;
    icons.key = fromMap([
      '..kkkk..', '.kyyyyk.', 'kyykkyyk', 'kyk..kyk', 'kyykkyyk', '.kyyyyk.', '..kyyk..', '..kyyk..', '..kyyyk.', '..kyyk..', '..kyyyk.', '..kkkk..',
    ], { k: C.outline, y: C.gold });
    icons.container = fromMap([
      '.kkk.kkk.', 'kffwkfffk', 'kfwfffffk', 'kfffffffk', 'kfffffffk', '.kfffffk.', '..kfffk..', '...kfk...', '....k....',
    ], { k: C.outline, f: '#ff3d5a', w: '#ffffff' });
    icons.potion = fromMap([
      '...kkk...', '...kwk...', '...kwk...', '..kkkkk..', '.krrrrrk.', 'krrwrrrrk', 'krwrrrrrk', 'krrrrrrrk', 'krrrrrrrk', '.krrrrrk.', '..kkkkk..',
    ], { k: C.outline, w: '#ffffff', r: '#e83040' });
    icons.boots = fromMap([
      '..kkkk.....', '.kbbbbk.ww.', '.kbbbbkwww.', '.kbbbbkww..', '.kbbbbk....', '.kbbbbbkk..', 'kbbbbbbbbk.', 'kbbbbbbbbbk', 'kdddddddddk', '.kkkkkkkkk.',
    ], { k: C.outline, b: '#a0603a', d: '#5a3020', w: '#ffffff' });
    icons.glove = fromMap([
      '..k.k.k...', '.kokokok..', '.kokokok..', '.kokokokk.', '.koooooook', '.kooooookk', '.kooooook.', '..kooook..', '..kyyyyk..', '..kkkkkk..',
    ], { k: C.outline, o: '#f08a30', y: C.gold });
    icons.sunsword = fromMap([
      '.........kk', '........kwk', '.......kwyk', '......kwyk.', '.....kwyk..', '....kwyk...', '.k.kwyk....', '.kkwyk.....', '..kgk......', '.kgkgk.....', 'kgk.kk.....', 'kk.........',
    ], { k: C.outline, w: '#ffffff', y: '#ffe680', g: C.gold });
    icons.d1 = relic('#40d070', '#1f8a40', '#c0ffd0');
    icons.d2 = relic('#40a8ff', '#1f5ab8', '#c8ecff');
    icons.d3 = relic('#ffd040', '#c08a10', '#fff6c0');
    icons.relicEmpty = relic('#4a4a5a', '#2a2a3a', '#6a6a7a');
    icons.bone = fromMap(['kk....kk', 'kwkkkkwk', '.kwwwwk.', 'kwkkkkwk', 'kk....kk'], { k: C.outline, w: '#f0ece0' });
    icons.orb = mk(10, 10, g => { blob(g, '#40104a', 5, 5, 5, 5); blob(g, '#c040ff', 5, 5, 4, 4); blob(g, '#ffb0ff', 4, 4, 2, 2); });
    icons.orbBack = mk(10, 10, g => { blob(g, '#4a3a00', 5, 5, 5, 5); blob(g, '#ffd040', 5, 5, 4, 4); blob(g, '#ffffff', 4, 4, 2, 2); });
    icons.beamH = mk(14, 6, g => { R(g, '#fff27a', 0, 1, 14, 4); R(g, '#ffffff', 2, 2, 10, 2); });
    icons.beamV = mk(6, 14, g => { R(g, '#fff27a', 1, 0, 4, 14); R(g, '#ffffff', 2, 2, 2, 10); });
  }
  function relic(c, d, l) {
    return mk(12, 12, g => {
      g.fillStyle = C.outline; g.beginPath(); g.moveTo(6, 0); g.lineTo(12, 6); g.lineTo(6, 12); g.lineTo(0, 6); g.fill();
      g.fillStyle = d; g.beginPath(); g.moveTo(6, 1); g.lineTo(11, 6); g.lineTo(6, 11); g.lineTo(1, 6); g.fill();
      g.fillStyle = c; g.beginPath(); g.moveTo(6, 2); g.lineTo(9, 6); g.lineTo(6, 10); g.lineTo(3, 6); g.fill();
      R(g, l, 5, 3, 1, 3);
    });
  }

  // ---------------------------------------------------------------------
  // Tiny bitmap font (digits and a few symbols) for the HUD and prices.
  // ---------------------------------------------------------------------
  const DIGITS = {
    '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111',
    '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
    '8': '111101111101111', '9': '111101111001111', 'x': '000101010101000', '/': '001001010100100',
  };
  function text(g, str, x, y, color) {
    str = String(str);
    for (let i = 0; i < str.length; i++) {
      const d = DIGITS[str[i]];
      if (!d) continue;
      for (let p = 0; p < 15; p++) if (d[p] === '1') {
        R(g, C.outline, x + i * 4 + (p % 3) + 1, y + ((p / 3) | 0) + 1);
      }
      for (let p = 0; p < 15; p++) if (d[p] === '1') R(g, color || '#ffffff', x + i * 4 + (p % 3), y + ((p / 3) | 0));
    }
  }

  // ---------------------------------------------------------------------
  // Build everything
  // ---------------------------------------------------------------------
  const sprites = {};
  function init() {
    buildIcons();
    sprites.hero = personSet(HERO_PAL);
    for (const k in LOOKS) {
      const l = LOOKS[k];
      sprites['npc_' + k] = personSet(Object.assign({}, HERO_PAL, { h: l.hair, H: l.hair, t: l.tunic, T: l.tunicDark }));
    }
    sprites.heroWhite = {};
    for (const k in sprites.hero) sprites.heroWhite[k] = whiteOf(sprites.hero[k]);

    const slimePal = (g, gl) => ({ k: C.outline, g, G: gl, w: '#ffffff' });
    sprites.slime = [fromMap(SLIME, slimePal('#56d36a', '#2f9a44')), fromMap(SLIME2, slimePal('#56d36a', '#2f9a44'))];
    sprites.slimeBlue = [fromMap(SLIME, slimePal('#5aa8ff', '#2a6ad0')), fromMap(SLIME2, slimePal('#5aa8ff', '#2a6ad0'))];
    const batPal = { k: C.outline, b: '#6a4a9a', r: '#ff4060', w: '#ffffff' };
    sprites.bat = [fromMap(BAT1, batPal), fromMap(BAT2, batPal)];
    const skPal = { k: C.outline, w: '#f0ece0', r: '#ff4040' };
    sprites.skel = [fromMap(SKEL, skPal), fromMap(SKEL2, skPal)];
    sprites.elder = fromMap(ELDER, { k: C.outline, w: '#f4f4f4', s: '#f5c9a0', R: '#5a6abf' });
    sprites.malv = fromMap(MALV, { k: C.outline, V: '#5a2a8a', v: '#2a1640', y: '#ffe040', P: '#d050d0' });

    // Bosses are scaled-up versions with a few extra touches.
    const king = fromMap(SLIME, slimePal('#56d36a', '#2f9a44'));
    sprites.kingslime = [scale(king, 3), scale(fromMap(SLIME2, slimePal('#56d36a', '#2f9a44')), 3)];
    sprites.crown = fromMap(['k.k.k.k', 'kykykyk', 'kyyyyyk', 'kyryryk', 'kkkkkkk'], { k: C.outline, y: C.gold, r: '#ff4060' });
    const nwPal = { k: C.outline, b: '#3a2a5a', r: '#ffd040', w: '#ffffff' };
    sprites.nightwing = [scale(fromMap(BAT1, nwPal), 3), scale(fromMap(BAT2, nwPal), 3)];
    const blPal = { k: C.outline, w: '#e8e0c8', r: '#ff2020' };
    sprites.bonelord = [scale(fromMap(SKEL, blPal), 2), scale(fromMap(SKEL2, blPal), 2)];
    sprites.malvBig = scale(sprites.malv, 2);
    for (const k of ['slime', 'slimeBlue', 'bat', 'skel', 'kingslime', 'nightwing', 'bonelord'])
      sprites[k + 'White'] = sprites[k].map(whiteOf);
    sprites.malvBigWhite = whiteOf(sprites.malvBig);
    sprites.block = mk(16, 16, g => {
      R(g, C.outline, 0, 0, 16, 16); R(g, '#8a7a6a', 1, 1, 14, 14); R(g, '#b0a090', 1, 1, 14, 2); R(g, '#b0a090', 1, 1, 2, 14);
      R(g, '#5a4a3a', 1, 13, 14, 2); R(g, '#5a4a3a', 13, 1, 2, 14); R(g, '#9a8a7a', 5, 5, 6, 6); R(g, '#7a6a5a', 6, 6, 4, 4);
    });
  }

  return { init, mk, R, blob, tile, renderRoom, sprites, icons, text, scale, flipH, C, THEMES };
})();
