/* =====================================================================
   ODYSSEY — World data
   ---------------------------------------------------------------------
   Every room is 16 x 11 tiles. Rooms live on a grid inside an "area"
   (the overworld, or a dungeon). Walking off the edge of a room moves
   you into the neighbouring room on that grid.

   TILE LEGEND
     .  ground (grass outdoors, floor in dungeons)   ,  flowers
     :  dirt path        T  tree           B  bush (cut with sword)
     R  rock             ~  water          =  bridge
     M  mountain/cliff   r  roof           h  house wall   n house door
     F  fence            S  sign           Q  healing fountain
     E  dungeon entrance W  castle wall    C  castle gate (sealed)
     #  stone wall       t  torch          p  pit (jump over it!)
     b  push block       o  pressure plate (needs a block on it)
     x  crystal switch   L  locked door    d  shutter door
     c  chest            U  stairs out     K  small key
     G  heavy boulder (needs the Power Glove)
     1  slime   2  bat   3  skeleton   Z  boss spawn point

   ROOM OPTIONS
     name     region name shown in a banner when it changes
     music    which music track to play
     signs    { "x,y": "text" }
     npcs     [{ x, y, look, name, talk }]  (talk = key into DIALOGUE)
     chest    contents of the chest in this room
     solve    'plates' | 'crystal' | 'clear' | 'boss' — opens shutters (d)
     reward   'key' — a key appears when the room is solved
     boss     which boss lives here
     shop     [{ x, y, item, price }]
   ===================================================================== */

const AREAS = {

  /* ------------------------------------------------------------------ */
  over: {
    name: 'Odyssey', theme: 'over',
    rooms: {
      // ---------------- Row 0 (north) ----------------
      '0,0': {
        name: 'Whisperwood Forest', music: 'field',
        map: [
          'TTTTTTTTTTTTTTTT',
          'TTT,.TTTTTT..TTT',
          'TT...######...TT',
          'T....###E##..,.T',
          'T..t....:....t.T',
          'T,......:......T',
          'T.....:::,..1..T',
          'TT.B..:.....B.TT',
          'TT....::.....TTT',
          'TTT....:..,.TTTT',
          'TTTTTT....TTTTTT',
        ],
      },
      '1,0': {
        name: 'Northern Meadow', music: 'field',
        map: [
          'MMMMMMMMMMMMMMMM',
          'MMM..MMMMMM..MMM',
          'M.....R...,....M',
          'M..,......2....M',
          'M....RR.........',
          'M.......::::::::',
          'M..R....:.......',
          'M.....,.:..R...M',
          'M..1....:....,.M',
          'MM......:.....MM',
          'MMMMMM....MMMMMM',
        ],
      },
      '2,0': {
        name: 'Castle Malvoren', music: 'castle',
        map: [
          'MWWWWWWWWWWWWWWM',
          'MWWWWWWCCWWWWWWM',
          'M..t...::...t..M',
          'M......::......M',
          '.......::...3..M',
          '::::::::::.....M',
          '.......::......M',
          'M..R...::...R..M',
          'M......::......M',
          'MM.....::.....MM',
          'MMMMMM....MMMMMM',
        ],
      },
      '3,0': {
        name: 'Skyreach Peak', music: 'field',
        map: [
          'MMMMMMMMMMMMMMMM',
          'MMMMM######MMMMM',
          'MMMM.###E##.MMMM',
          'MMM..t..:..t..MM',
          'MM......:.....MM',
          'M..R....:...2..M',
          'M.......:......M',
          'M..2...::...R..M',
          'MM.....::.....MM',
          'MMM....::....MMM',
          'MMMMMM....MMMMMM',
        ],
      },
      // ---------------- Row 1 ----------------
      '0,1': {
        name: 'Whisperwood Forest', music: 'field',
        signs: { '12,6': 'A low fence blocks the path.\nPress JUMP while walking to hop right over it!' },
        map: [
          'TTTTTT....TTTTTT',
          'T..T....,..T..TT',
          'T.,...1.......,T',
          'TT.TT..B...TT..T',
          'T..........1...T',
          'TTTTFFFFFFFFTTTT',
          'T...........S..T',
          'TT..T.,....T..TT',
          'T.......B......T',
          'TT.,.T.....T..TT',
          'TTTTTT....TTTTTT',
        ],
      },
      '1,1': {
        name: 'The Crossroads', music: 'field',
        signs: { '5,5': 'NORTH: Castle Malvoren\nEAST: Silverrun River\nSOUTH: Willowbrook Village' },
        map: [
          'TTTTTT....TTTTTT',
          'T....,.::.....,T',
          'T..B...::...B..T',
          'T......::....1.T',
          'T......::.......',
          'T....S.:::::::::',
          'T......::.......',
          'T..,...::...,..T',
          'TB.....::.....BT',
          'T......::......T',
          'TTTTTT....TTTTTT',
        ],
      },
      '2,1': {
        name: 'Silverrun River', music: 'field',
        map: [
          'MMMMMM....MMMMMM',
          'M......::......M',
          '~~~~~~~==~~~~~~~',
          '~~~~~~~==~~~~~~~',
          '......:::.....,M',
          ':::::::::......M',
          '......:::..B...M',
          'T..,...::....1.M',
          'TT.....::......M',
          'TTT....::....,MM',
          'TTTTTT....MMMMMM',
        ],
      },
      '3,1': {
        name: 'Mount Odessa', music: 'field',
        map: [
          'MMMMMM....MMMMMM',
          'MM......2.....MM',
          'M...R.......R..M',
          'MMpppppppppppppM',
          'M.....3........M',
          'M..R.......R...M',
          'MpppppppppppppMM',
          'M.......2......M',
          'M..R.......R...M',
          'MM.............M',
          'MMMMMM....MMMMMM',
        ],
      },
      // ---------------- Row 2 (south) ----------------
      '0,2': {
        name: 'Whisperwood Forest', music: 'field',
        signs: { '5,9': 'NORTH: The Forest Shrine.\nBeware of slimes!' },
        map: [
          'TTTTTT....TTTTTT',
          'TT.T......,..TTT',
          'T..,..B..1.T..TT',
          'TT...TT......BTT',
          'T...T.....,.....',
          'T..B....::::::::',
          'T,....1.........',
          'TT..TT....BB..TT',
          'T..,.....T...,TT',
          'TTT..S..TT..TTTT',
          'TTTTTTTTTTTTTTTT',
        ],
      },
      '1,2': {
        name: 'Willowbrook Village', music: 'village',
        signs: { '4,9': 'WILLOWBROOK VILLAGE\nWest: Whisperwood Forest\nNorth: The Crossroads\nEast: Market' },
        npcs: [
          { x: 9,  y: 3,  look: 'lina',  name: 'Lina',  talk: 'lina' },
          { x: 4,  y: 6,  look: 'tobin', name: 'Old Tobin', talk: 'tobin' },
          { x: 13, y: 8,  look: 'mira',  name: 'Mira',  talk: 'mira' },
          { x: 2,  y: 1,  look: 'pip',   name: 'Pip',   talk: 'pip' },
        ],
        map: [
          'TTTTTT....TTTTTT',
          'T,...........,.T',
          'T.rrr......rrr.T',
          'T.hnh..::..hnh.T',
          '....:..::..:....',
          '::::::::::::::::',
          '....,..::..,....',
          'T.rrr..::..Q...T',
          'T.hnh..::......T',
          'T,..S..::....,.T',
          'TTTTTTTTTTTTTTTT',
        ],
      },
      '2,2': {
        name: 'Willowbrook Market', music: 'village',
        signs: { '11,9': "WYNN'S WARES\nWalk onto an item to buy it." },
        npcs: [
          { x: 5, y: 7, look: 'wynn', name: 'Wynn', talk: 'wynn' },
          { x: 12, y: 6, look: 'bram', name: 'Guard Bram', talk: 'bram' },
        ],
        shop: [
          { x: 3, y: 8, item: 'potion', price: 10 },
          { x: 7, y: 8, item: 'container', price: 40 },
        ],
        map: [
          'TTTTTT....TTTTTT',
          'T......::.....,T',
          'T.rrrr.::......T',
          'T.hhnh.::..rrr.T',
          '.......::..hnh..',
          '::::::::::::::::',
          '....,...........',
          'T..............T',
          'T..........,...T',
          'T,.........S...T',
          'TTTTTTTTTTTTTTTT',
        ],
      },
      '3,2': {
        name: 'Silverrun Falls', music: 'field',
        signs: { '1,8': 'The ground here split in a great quake.\nOnly a mighty leap could cross this gap...' },
        map: [
          'MMMMMM....MMMMMM',
          'MMMMMMMGGMMMMMMM',
          'M..pp.........MM',
          'M..pp...R...MMMM',
          '...pp.......MEMM',
          '...pp.....::::MM',
          '...pp....,....MM',
          'M..pp..2......MM',
          'MS.pp....R....MM',
          'MM.pp.......MMMM',
          'MMMMMMMMMMMMMMMM',
        ],
      },
    },
  },

  /* ------------------------------------------------------------------ */
  d1: {
    name: 'Forest Shrine', theme: 'forest', dungeon: true, relic: 'd1',
    entry: { room: '1,3', x: 7.5, y: 8 },
    exitTo: { area: 'over', room: '0,0', x: 8, y: 4 },
    rooms: {
      '1,3': {
        music: 'dungeon',
        signs: { '3,7': 'FOREST SHRINE\nPress ATTACK to swing your sword.\nPress JUMP to hop over small pits.' },
        map: [
          '#######..#######',
          '#..............#',
          '#.t..........t.#',
          '#......1.......#',
          '#..............#',
          '#...1......1...#',
          '#..............#',
          '#..S...........#',
          '#.t..........t.#',
          '#......UU......#',
          '################',
        ],
      },
      '1,2': {
        music: 'dungeon', solve: 'plates',
        signs: { '2,8': 'Push the stone block onto the switch.\nWalk against a block to push it.' },
        map: [
          '#######LL#######',
          '#..............#',
          '#..............#',
          '#..............#',
          '#.........b..o.#',
          '...............d',
          '#..............#',
          '#..............#',
          '#.S............#',
          '#..............#',
          '#######..#######',
        ],
      },
      '0,2': {
        music: 'dungeon',
        map: [
          '################',
          '#..............#',
          '#..1.......1...#',
          '#....ppppp.....#',
          '#....p...p.....#',
          '#....p.K.p......',
          '#....p...p.....#',
          '#....ppppp.....#',
          '#..1...........#',
          '#..............#',
          '################',
        ],
      },
      '2,2': {
        music: 'dungeon', chest: 'boots',
        map: [
          '################',
          '#..............#',
          '#..pp......pp..#',
          '#..pp..c...pp..#',
          '#..............#',
          '...............#',
          '#..............#',
          '#..pp......pp..#',
          '#..pp..1...pp..#',
          '#..............#',
          '################',
        ],
      },
      '1,1': {
        music: 'dungeon',
        signs: { '5,7': 'A wide chasm! A normal hop will not do.\nOnly those with LEAPING BOOTS can cross.' },
        map: [
          '#######..#######',
          '#..............#',
          '#.t..........t.#',
          '#..............#',
          '#pppppppppppppp#',
          '#pppppppppppppp#',
          '#..............#',
          '#....S.........#',
          '#..1........1..#',
          '#..............#',
          '#######..#######',
        ],
      },
      '1,0': {
        music: 'boss', solve: 'boss', boss: 'kingslime',
        map: [
          '################',
          '#..............#',
          '#.t..........t.#',
          '#..............#',
          '#..............#',
          '#.......Z......#',
          '#..............#',
          '#..............#',
          '#.t..........t.#',
          '#..............#',
          '#######dd#######',
        ],
      },
    },
  },

  /* ------------------------------------------------------------------ */
  d2: {
    name: 'River Grotto', theme: 'water', dungeon: true, relic: 'd2',
    entry: { room: '1,2', x: 7.5, y: 8 },
    exitTo: { area: 'over', room: '3,2', x: 13, y: 5 },
    rooms: {
      '1,2': {
        music: 'dungeon',
        signs: { '2,7': 'RIVER GROTTO\nBats swoop when you come close.\nTip: ROLL through danger!' },
        map: [
          '#######..#######',
          '#~~..........~~#',
          '#~~..2....2..~~#',
          '#..............#',
          '#..............#',
          '#..~~~~..~~~~..#',
          '#..............#',
          '#.S............#',
          '#~~...........~#',
          '#~~....UU....~~#',
          '################',
        ],
      },
      '1,1': {
        music: 'dungeon',
        map: [
          '#######..#######',
          '#~~....GG....~~#',
          '#~............~#',
          '#..............#',
          '#.....3........#',
          'L...............',
          '#..............#',
          '#~............~#',
          '#~~..........~~#',
          '#..............#',
          '#######..#######',
        ],
      },
      '2,1': {
        music: 'dungeon', chest: 'key',
        map: [
          '################',
          '#..............#',
          '#....pppppppp..#',
          '#....pppppppp..#',
          '#....pp....pp..#',
          '.....pp.c..pp..#',
          '#....pp....pp..#',
          '#....pppppppp..#',
          '#....pppppppp..#',
          '#.2..........2.#',
          '################',
        ],
      },
      '0,1': {
        music: 'dungeon', solve: 'plates',
        map: [
          '#######dd#######',
          '#..............#',
          '#..o.......o...#',
          '#..............#',
          '#...b.....b....#',
          '#...............',
          '#..............#',
          '#~~..........~~#',
          '#~~~...3....~~~#',
          '#~~~~......~~~~#',
          '################',
        ],
      },
      '0,0': {
        music: 'dungeon', chest: 'glove',
        map: [
          '################',
          '#..............#',
          '#.t..........t.#',
          '#..............#',
          '#.......c......#',
          '#..............#',
          '#..2........2..#',
          '#..............#',
          '#..............#',
          '#..............#',
          '#######..#######',
        ],
      },
      '1,0': {
        music: 'boss', solve: 'boss', boss: 'nightwing',
        map: [
          '################',
          '#~~..........~~#',
          '#~............~#',
          '#..............#',
          '#..............#',
          '#.......Z......#',
          '#..............#',
          '#..............#',
          '#~............~#',
          '#~~..........~~#',
          '#######dd#######',
        ],
      },
    },
  },

  /* ------------------------------------------------------------------ */
  d3: {
    name: 'Peak Tower', theme: 'peak', dungeon: true, relic: 'd3',
    entry: { room: '1,2', x: 7.5, y: 8 },
    exitTo: { area: 'over', room: '3,0', x: 8, y: 3 },
    rooms: {
      '1,2': {
        music: 'dungeon',
        signs: { '2,7': 'PEAK TOWER\nSkeletons raise an arm before they throw.\nWatch for it, then dodge!' },
        map: [
          '#######..#######',
          '#.....#GG#.....#',
          '#.t...#..#...t.#',
          '#..............#',
          '#...3......3...#',
          '#..............#',
          '#..............#',
          '#.S............#',
          '#.t..........t.#',
          '#......UU......#',
          '################',
        ],
      },
      '1,1': {
        music: 'dungeon', solve: 'crystal',
        signs: { '2,8': 'A crystal glows across the abyss...\nIf only your blade could reach that far.' },
        map: [
          '#######dd#######',
          '#x.ppp.........#',
          '#ppppp.........#',
          '#ppppp.........#',
          '#ppppp.........#',
          'L.........3.....',
          '#..............#',
          '#..............#',
          '#.S............#',
          '#..............#',
          '#######..#######',
        ],
      },
      '2,1': {
        music: 'dungeon', solve: 'plates', reward: 'key',
        map: [
          '################',
          '#..............#',
          '#..#.o....o.#..#',
          '#..#........#..#',
          '#..#.b....b.#..#',
          '...............#',
          '#..3........3..#',
          '#..............#',
          '#..............#',
          '#..............#',
          '################',
        ],
      },
      '0,1': {
        music: 'dungeon', chest: 'sunsword',
        map: [
          '################',
          '#..............#',
          '#.t....c.....t.#',
          '#..............#',
          '#..2........2..#',
          '#...............',
          '#..............#',
          '#..pp......pp..#',
          '#..pp......pp..#',
          '#..............#',
          '################',
        ],
      },
      '1,0': {
        music: 'boss', solve: 'boss', boss: 'bonelord',
        map: [
          '################',
          '#..............#',
          '#.t..........t.#',
          '#..............#',
          '#..............#',
          '#.......Z......#',
          '#..............#',
          '#..............#',
          '#.t..........t.#',
          '#..............#',
          '#######dd#######',
        ],
      },
    },
  },

  /* ------------------------------------------------------------------ */
  castle: {
    name: 'Castle Malvoren', theme: 'castle', dungeon: true,
    entry: { room: '0,2', x: 7.5, y: 8 },
    exitTo: { area: 'over', room: '2,0', x: 7.5, y: 3 },
    rooms: {
      '0,2': {
        music: 'castle', solve: 'clear',
        map: [
          '#######dd#######',
          '#t............t#',
          '#..............#',
          '#..3........3..#',
          '#..............#',
          '#.....2..2.....#',
          '#..............#',
          '#..............#',
          '#t............t#',
          '#......UU......#',
          '################',
        ],
      },
      '0,1': {
        music: 'castle', solve: 'crystal',
        map: [
          '#######dd#######',
          '#x..ppp........#',
          '#pppppp...3....#',
          '#pppppp........#',
          '#pppppp........#',
          '#..............#',
          '#pppppppppppppp#',
          '#pppppppppppppp#',
          '#..............#',
          '#######GG#######',
          '#######..#######',
        ],
      },
      '0,0': {
        music: 'final', solve: 'boss', boss: 'malvoren',
        map: [
          '################',
          '#t............t#',
          '#..............#',
          '#..............#',
          '#..............#',
          '#.......Z......#',
          '#..............#',
          '#..............#',
          '#t............t#',
          '#..............#',
          '#######dd#######',
        ],
      },
    },
  },
};

/* Overworld entrances: which tile leads where. */
const WARPS = {
  'over|0,0|8,3': 'd1',
  'over|3,2|13,4': 'd2',
  'over|3,0|8,2': 'd3',
  'over|2,0|7,1': 'castle',
  'over|2,0|8,1': 'castle',
};

/* Item descriptions (used for item-get messages and the pause menu). */
const ITEMS = {
  boots:     { name: 'Leaping Boots', text: 'You got the LEAPING BOOTS!\nYour jumps now soar twice as far. Wide gaps are no match for you!' },
  glove:     { name: 'Power Glove',   text: 'You got the POWER GLOVE!\nWalk into heavy boulders to smash them aside.' },
  sunsword:  { name: 'Sun Sword',     text: 'You got the SUN SWORD!\nEach swing now fires a beam of light that can strike faraway crystals.' },
  key:       { name: 'Small Key',     text: 'You found a small key!\nWalk into a locked door to open it.' },
  container: { name: 'Heart Container', text: 'You got a HEART CONTAINER!\nYour life grew by one heart.' },
  potion:    { name: 'Red Potion',    text: 'Your hearts are fully restored!' },
  d1:        { name: 'Relic of Earth', text: 'You recovered the RELIC OF EARTH!\nIts warm green glow fills you with courage.' },
  d2:        { name: 'Relic of Water', text: 'You recovered the RELIC OF WATER!\nIt shimmers like a cool spring.' },
  d3:        { name: 'Relic of Sky',   text: 'You recovered the RELIC OF SKY!\nIt hums with the power of the wind.' },
};

/* NPC appearance: colors used to palette-swap the villager sprite. */
const LOOKS = {
  lina:  { hair: '#e2a33a', tunic: '#d2547a', tunicDark: '#9c3558' },
  tobin: { hair: '#c9c9c9', tunic: '#6b7fbf', tunicDark: '#4a5a90' },
  mira:  { hair: '#8b3a2a', tunic: '#e0b34a', tunicDark: '#a8822c' },
  pip:   { hair: '#3a2a1a', tunic: '#5fbf5f', tunicDark: '#3a8a3a' },
  wynn:  { hair: '#5a3a8a', tunic: '#bf6b3a', tunicDark: '#8a4a28' },
  bram:  { hair: '#2a2a2a', tunic: '#8a8a9a', tunicDark: '#5a5a6a' },
};

/* Dialogue. Each function receives the save data and returns a list of
   pages, so hints can change as the quest moves forward. */
const DIALOGUE = {
  lina(s) {
    const n = relicCount(s);
    if (s.flags.rescued) return ["Grandpa is home safe, all thanks to you!", "You'll always be a hero here in Odyssey."];
    if (n === 0 && !s.items.boots) return [
      "Oh, thank goodness you're here!",
      "The sorcerer Malvoren stole our three sacred relics... and carried my grandpa, Elder Rowan, off to his castle!",
      "The first relic is hidden in the FOREST SHRINE. Go WEST, then NORTH through Whisperwood Forest.",
    ];
    if (!s.relics.d1) return ["The Forest Shrine is west, then north through the woods. You can do it!"];
    if (!s.relics.d2) return [
      "You found the Relic of Earth!",
      "The second relic is in the RIVER GROTTO. Go EAST past the market to Silverrun Falls.",
      "Those Leaping Boots should carry you across the broken ground there!",
    ];
    if (!s.relics.d3) return [
      "Two relics! You're amazing!",
      "The last one is in the PEAK TOWER. From Silverrun Falls, head NORTH up the mountain.",
      "Heavy boulders block the path... but your Power Glove can smash them!",
    ];
    return [
      "All three relics! The seal on Malvoren's castle must be broken now.",
      "The castle is NORTH of the Crossroads, then EAST. Please... bring Grandpa home.",
    ];
  },
  tobin(s) {
    return [
      "Heh, young one. Let an old adventurer give you some advice.",
      "JUMP over holes, fences and bushes. Just make sure you land on solid ground!",
      "And if you fall into a pit, don't fret. You'll climb right back out.",
    ];
  },
  mira(s) {
    return [
      "See the fountain? Stand next to it and press ATTACK to heal all your hearts.",
      "And don't worry if you faint out there. You'll wake up right where you entered the area.",
      "Your progress is saved automatically, too!",
    ];
  },
  pip(s) {
    return [
      "Wanna know a secret? Press SPIN to whirl your sword all the way around!",
      "It hits everything near you. Perfect when slimes surround you!",
    ];
  },
  wynn(s) {
    return [
      "Welcome to Wynn's Wares! Walk onto an item to buy it.",
      "Defeat monsters and cut bushes to find coins.",
    ];
  },
  bram(s) {
    if (relicCount(s) >= 3 && !s.flags.rescued) return ["The castle's dark seal flickers... Now's your chance, hero!"];
    return [
      "Halt! ...Oh, it's you. Sorry, I'm a bit jumpy since the attack.",
      "A guard's tip: press ROLL to dodge. Nothing can hurt you mid-roll!",
    ];
  },
  elder(s) {
    if (s.flags.rescued) return [
      "Welcome home, young hero. Willowbrook has never been brighter.",
      "The relics rest safely once more. Odyssey owes you everything.",
    ];
    return [
      "You... you came for me! And you carry all three sacred relics!",
      "Malvoren's darkness is gone. The light returns to Odyssey.",
      "Come, young hero. Let us go home to Willowbrook.",
    ];
  },
};

function relicCount(s) {
  return (s.relics.d1 ? 1 : 0) + (s.relics.d2 ? 1 : 0) + (s.relics.d3 ? 1 : 0);
}
