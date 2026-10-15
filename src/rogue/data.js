// Rogue 5.4 data tables and constants, ported from the original C source
// (rogue.h / extern.c / init.c / things.c).  Copyright (C) 1980-1983, 1985, 1999
// Michael Toy, Ken Arnold and Glenn Wichman.  See LICENSE.TXT of the original.

export const MAXROOMS = 9, MAXTHINGS = 9, MAXOBJ = 9, MAXPACK = 23, MAXTRAPS = 10;
export const AMULETLEVEL = 26, NUMTHINGS = 7, MAXPASS = 13;
export const NUMLINES = 24, NUMCOLS = 80, STATLINE = NUMLINES - 1;
export const MAXLINES = 32, MAXCOLS = 80;
export const BORE_LEVEL = 50;

export const ESCAPE = '\x1b';

// things that appear on the screen
export const PASSAGE = '#', DOOR = '+', FLOOR = '.', PLAYER = '@', TRAP = '^',
  STAIRS = '%', GOLD = '*', POTION = '!', SCROLL = '?', MAGIC = '$', FOOD = ':',
  WEAPON = ')', ARMOR = ']', AMULET = ',', RING = '=', STICK = '/';
export const CALLABLE = -1, R_OR_S = -2;

// constants
export const HEALTIME = 30, HUHDURATION = 20, SEEDURATION = 850, HUNGERTIME = 1300,
  MORETIME = 150, STOMACHSIZE = 2000, STARVETIME = 850;
export const LEFT = 0, RIGHT = 1, BOLT_LENGTH = 6, LAMPDIST = 3;
export const BEFORE = 1, AFTER = 2;

export const VS_POISON = 0, VS_PARALYZATION = 0, VS_DEATH = 0, VS_BREATH = 2, VS_MAGIC = 3;

// room flags
export const ISDARK = 0o1, ISGONE = 0o2, ISMAZE = 0o4;
// object flags
export const ISCURSED = 0o1, ISKNOW = 0o2, ISMISL = 0o4, ISMANY = 0o10, ISPROT = 0o40;
// creature flags
export const CANHUH = 0o1, CANSEE = 0o2, ISBLIND = 0o4, ISCANC = 0o10, ISLEVIT = 0o10,
  ISFOUND = 0o20, ISGREED = 0o40, ISHASTE = 0o100, ISTARGET = 0o200, ISHELD = 0o400,
  ISHUH = 0o1000, ISINVIS = 0o2000, ISMEAN = 0o4000, ISHALU = 0o4000, ISREGEN = 0o10000,
  ISRUN = 0o20000, SEEMONST = 0o40000, ISFLY = 0o40000, ISSLOW = 0o100000;

// level map flags
export const F_PASS = 0x80, F_SEEN = 0x40, F_DROPPED = 0x20, F_LOCKED = 0x20,
  F_REAL = 0x10, F_PNUM = 0x0f, F_TMASK = 0x07;

// traps
export const T_DOOR = 0, T_ARROW = 1, T_SLEEP = 2, T_BEAR = 3, T_TELEP = 4, T_DART = 5,
  T_RUST = 6, T_MYST = 7, NTRAPS = 8;

// potions
export const P_CONFUSE = 0, P_LSD = 1, P_POISON = 2, P_STRENGTH = 3, P_SEEINVIS = 4,
  P_HEALING = 5, P_MFIND = 6, P_TFIND = 7, P_RAISE = 8, P_XHEAL = 9, P_HASTE = 10,
  P_RESTORE = 11, P_BLIND = 12, P_LEVIT = 13, MAXPOTIONS = 14;
// scrolls
export const S_CONFUSE = 0, S_MAP = 1, S_HOLD = 2, S_SLEEP = 3, S_ARMOR = 4,
  S_ID_POTION = 5, S_ID_SCROLL = 6, S_ID_WEAPON = 7, S_ID_ARMOR = 8, S_ID_R_OR_S = 9,
  S_SCARE = 10, S_FDET = 11, S_TELEP = 12, S_ENCH = 13, S_CREATE = 14, S_REMOVE = 15,
  S_AGGR = 16, S_PROTECT = 17, MAXSCROLLS = 18;
// weapons
export const MACE = 0, SWORD = 1, BOW = 2, ARROW = 3, DAGGER = 4, TWOSWORD = 5, DART = 6,
  SHIRAKEN = 7, SPEAR = 8, FLAME = 9, MAXWEAPONS = 9;
// armor
export const LEATHER = 0, RING_MAIL = 1, STUDDED_LEATHER = 2, SCALE_MAIL = 3,
  CHAIN_MAIL = 4, SPLINT_MAIL = 5, BANDED_MAIL = 6, PLATE_MAIL = 7, MAXARMORS = 8;
// rings
export const R_PROTECT = 0, R_ADDSTR = 1, R_SUSTSTR = 2, R_SEARCH = 3, R_SEEINVIS = 4,
  R_NOP = 5, R_AGGR = 6, R_ADDHIT = 7, R_ADDDAM = 8, R_REGEN = 9, R_DIGEST = 10,
  R_TELEPORT = 11, R_STEALTH = 12, R_SUSTARM = 13, MAXRINGS = 14;
// sticks
export const WS_LIGHT = 0, WS_INVIS = 1, WS_ELECT = 2, WS_FIRE = 3, WS_COLD = 4,
  WS_POLYMORPH = 5, WS_MISSILE = 6, WS_HASTE_M = 7, WS_SLOW_M = 8, WS_DRAIN = 9,
  WS_NOP = 10, WS_TELAWAY = 11, WS_TELTO = 12, WS_CANCEL = 13, MAXSTICKS = 14;

const ___ = 1, XX = 10;
// name, carry, flags, {str, exp, lvl, arm, hpt, dmg}
const M = (name, carry, flags, exp, lvl, arm, dmg) => ({
  m_name: name, m_carry: carry, m_flags: flags,
  m_stats: { s_str: XX, s_exp: exp, s_lvl: lvl, s_arm: arm, s_hpt: ___, s_dmg: dmg, s_maxhp: 0 },
});
export const monsters = [
  M('aquator', 0, ISMEAN, 20, 5, 2, '0x0/0x0'),
  M('bat', 0, ISFLY, 1, 1, 3, '1x2'),
  M('centaur', 15, 0, 17, 4, 4, '1x2/1x5/1x5'),
  M('dragon', 100, ISMEAN, 5000, 10, -1, '1x8/1x8/3x10'),
  M('emu', 0, ISMEAN, 2, 1, 7, '1x2'),
  M('venus flytrap', 0, ISMEAN, 80, 8, 3, '%%%x0'),
  M('griffin', 20, ISMEAN | ISFLY | ISREGEN, 2000, 13, 2, '4x3/3x5'),
  M('hobgoblin', 0, ISMEAN, 3, 1, 5, '1x8'),
  M('ice monster', 0, 0, 5, 1, 9, '0x0'),
  M('jabberwock', 70, 0, 3000, 15, 6, '2x12/2x4'),
  M('kestrel', 0, ISMEAN | ISFLY, 1, 1, 7, '1x4'),
  M('leprechaun', 0, 0, 10, 3, 8, '1x1'),
  M('medusa', 40, ISMEAN, 200, 8, 2, '3x4/3x4/2x5'),
  M('nymph', 100, 0, 37, 3, 9, '0x0'),
  M('orc', 15, ISGREED, 5, 1, 6, '1x8'),
  M('phantom', 0, ISINVIS, 120, 8, 3, '4x4'),
  M('quagga', 0, ISMEAN, 15, 3, 3, '1x5/1x5'),
  M('rattlesnake', 0, ISMEAN, 9, 2, 3, '1x6'),
  M('snake', 0, ISMEAN, 2, 1, 5, '1x3'),
  M('troll', 50, ISREGEN | ISMEAN, 120, 6, 4, '1x8/1x8/2x6'),
  M('black unicorn', 0, ISMEAN, 190, 7, -2, '1x9/1x9/2x9'),
  M('vampire', 20, ISREGEN | ISMEAN, 350, 8, 1, '1x10'),
  M('wraith', 0, 0, 55, 5, 4, '1x6'),
  M('xeroc', 30, 0, 100, 7, 7, '4x4'),
  M('yeti', 30, 0, 50, 4, 6, '1x6/1x6'),
  M('zombie', 0, ISMEAN, 6, 2, 8, '1x8'),
];

const I = (name, prob, worth) => ({ oi_name: name, oi_prob: prob, oi_worth: worth, oi_guess: null, oi_know: false });

export const things = [I(null, 26), I(null, 36), I(null, 16), I(null, 7), I(null, 7), I(null, 4), I(null, 4)];

export const arm_info = [
  I('leather armor', 20, 20), I('ring mail', 15, 25), I('studded leather armor', 15, 20),
  I('scale mail', 13, 30), I('chain mail', 12, 75), I('splint mail', 10, 80),
  I('banded mail', 10, 90), I('plate mail', 5, 150),
];
export const pot_info = [
  I('confusion', 7, 5), I('hallucination', 8, 5), I('poison', 8, 5), I('gain strength', 13, 150),
  I('see invisible', 3, 100), I('healing', 13, 130), I('monster detection', 6, 130),
  I('magic detection', 6, 105), I('raise level', 2, 250), I('extra healing', 5, 200),
  I('haste self', 5, 190), I('restore strength', 13, 130), I('blindness', 5, 5),
  I('levitation', 6, 75),
];
export const ring_info = [
  I('protection', 9, 400), I('add strength', 9, 400), I('sustain strength', 5, 280),
  I('searching', 10, 420), I('see invisible', 10, 310), I('adornment', 1, 10),
  I('aggravate monster', 10, 10), I('dexterity', 8, 440), I('increase damage', 8, 400),
  I('regeneration', 4, 460), I('slow digestion', 9, 240), I('teleportation', 5, 30),
  I('stealth', 7, 470), I('maintain armor', 5, 380),
];
export const scr_info = [
  I('monster confusion', 7, 140), I('magic mapping', 4, 150), I('hold monster', 2, 180),
  I('sleep', 3, 5), I('enchant armor', 7, 160), I('identify potion', 10, 80),
  I('identify scroll', 10, 80), I('identify weapon', 6, 80), I('identify armor', 7, 100),
  I('identify ring, wand or staff', 10, 115), I('scare monster', 3, 200),
  I('food detection', 2, 60), I('teleportation', 5, 165), I('enchant weapon', 8, 150),
  I('create monster', 4, 75), I('remove curse', 7, 105), I('aggravate monsters', 3, 20),
  I('protect armor', 2, 250),
];
export const weap_info = [
  I('mace', 11, 8), I('long sword', 11, 15), I('short bow', 12, 15), I('arrow', 12, 1),
  I('dagger', 8, 3), I('two handed sword', 10, 75), I('dart', 12, 2), I('shuriken', 12, 5),
  I('spear', 12, 5), I(null, 0, 0),
];
export const ws_info = [
  I('light', 12, 250), I('invisibility', 6, 5), I('lightning', 3, 330), I('fire', 3, 330),
  I('cold', 3, 330), I('polymorph', 15, 310), I('magic missile', 10, 170),
  I('haste monster', 10, 5), I('slow monster', 11, 350), I('drain life', 9, 300),
  I('nothing', 1, 5), I('teleport away', 6, 340), I('teleport to', 6, 50),
  I('cancellation', 5, 280),
];

export const a_class = [8, 7, 7, 6, 5, 4, 4, 3];

export const e_levels = [10, 20, 40, 80, 160, 320, 640, 1300, 2600, 5200, 13000, 26000,
  50000, 100000, 200000, 400000, 800000, 2000000, 4000000, 8000000, 0];

export const tr_name = ['a trapdoor', 'an arrow trap', 'a sleeping gas trap', 'a beartrap',
  'a teleport trap', 'a poison dart trap', 'a rust trap', 'a mysterious trap'];

export const rainbow = ['amber', 'aquamarine', 'black', 'blue', 'brown', 'clear', 'crimson',
  'cyan', 'ecru', 'gold', 'green', 'grey', 'magenta', 'orange', 'pink', 'plaid', 'purple',
  'red', 'silver', 'tan', 'tangerine', 'topaz', 'turquoise', 'vermilion', 'violet', 'white',
  'yellow'];

export const sylls = ['a', 'ab', 'ag', 'aks', 'ala', 'an', 'app', 'arg', 'arze', 'ash',
  'bek', 'bie', 'bit', 'bjor', 'blu', 'bot', 'bu', 'byt', 'comp', 'con', 'cos', 'cre', 'dalf',
  'dan', 'den', 'do', 'e', 'eep', 'el', 'eng', 'er', 'ere', 'erk', 'esh', 'evs', 'fa', 'fid',
  'fri', 'fu', 'gan', 'gar', 'glen', 'gop', 'gre', 'ha', 'hyd', 'i', 'ing', 'ip', 'ish', 'it',
  'ite', 'iv', 'jo', 'kho', 'kli', 'klis', 'la', 'lech', 'mar', 'me', 'mi', 'mic', 'mik', 'mon',
  'mung', 'mur', 'nej', 'nelg', 'nep', 'ner', 'nes', 'nes', 'nih', 'nin', 'o', 'od', 'ood',
  'org', 'orn', 'ox', 'oxy', 'pay', 'ple', 'plu', 'po', 'pot', 'prok', 're', 'rea', 'rhov',
  'ri', 'ro', 'rog', 'rok', 'rol', 'sa', 'san', 'sat', 'sef', 'seh', 'shu', 'ski', 'sna',
  'sne', 'snik', 'sno', 'so', 'sol', 'sri', 'sta', 'sun', 'ta', 'tab', 'tem', 'ther', 'ti',
  'tox', 'trol', 'tue', 'turs', 'u', 'ulk', 'um', 'un', 'uni', 'ur', 'val', 'viv', 'vly',
  'vom', 'wah', 'wed', 'werg', 'wex', 'whon', 'wun', 'xo', 'y', 'yot', 'yu', 'zant', 'zeb',
  'zim', 'zok', 'zon', 'zum'];

export const stones = [
  ['agate', 25], ['alexandrite', 40], ['amethyst', 50], ['carnelian', 40], ['diamond', 300],
  ['emerald', 300], ['germanium', 225], ['granite', 5], ['garnet', 50], ['jade', 150],
  ['kryptonite', 300], ['lapis lazuli', 50], ['moonstone', 50], ['obsidian', 15], ['onyx', 60],
  ['opal', 200], ['pearl', 220], ['peridot', 63], ['ruby', 350], ['sapphire', 285],
  ['stibotantalite', 200], ['tiger eye', 50], ['topaz', 60], ['turquoise', 70],
  ['taaffeite', 300], ['zircon', 80],
].map(([st_name, st_value]) => ({ st_name, st_value }));

export const wood = ['avocado wood', 'balsa', 'bamboo', 'banyan', 'birch', 'cedar', 'cherry',
  'cinnibar', 'cypress', 'dogwood', 'driftwood', 'ebony', 'elm', 'eucalyptus', 'fall',
  'hemlock', 'holly', 'ironwood', 'kukui wood', 'mahogany', 'manzanita', 'maple', 'oaken',
  'persimmon wood', 'pecan', 'pine', 'poplar', 'redwood', 'rosewood', 'spruce', 'teak',
  'walnut', 'zebrawood'];

export const metal = ['aluminum', 'beryllium', 'bone', 'brass', 'bronze', 'copper',
  'electrum', 'gold', 'iron', 'lead', 'magnesium', 'mercury', 'nickel', 'pewter', 'platinum',
  'steel', 'silver', 'silicon', 'tin', 'titanium', 'tungsten', 'zinc'];

// weapon initial damage table: [wielded, thrown, launcher, flags]
export const init_dam = [
  ['2x4', '1x3', -1, 0],
  ['3x4', '1x2', -1, 0],
  ['1x1', '1x1', -1, 0],
  ['1x1', '2x3', BOW, ISMANY | ISMISL],
  ['1x6', '1x4', -1, ISMISL],
  ['4x4', '1x2', -1, 0],
  ['1x1', '1x3', -1, ISMANY | ISMISL],
  ['1x2', '2x4', -1, ISMANY | ISMISL],
  ['2x3', '1x6', -1, ISMISL],
];

export const h_names = [' scored an excellent hit on ', ' hit ', ' have injured ',
  ' swing and hit ', ' scored an excellent hit on ', ' hit ', ' has injured ', ' swings and hits '];
export const m_names = [' miss', ' swing and miss', ' barely miss', " don't hit",
  ' misses', ' swings and misses', ' barely misses', " doesn't hit"];
export const str_plus = [-7, -6, -5, -4, -3, -2, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1,
  1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3];
export const add_dam = [-7, -6, -5, -4, -3, -2, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 3,
  3, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6];

export const lvl_mons = ['K', 'E', 'B', 'S', 'H', 'I', 'R', 'O', 'Z', 'L', 'C', 'Q', 'A',
  'N', 'Y', 'F', 'T', 'W', 'P', 'X', 'U', 'M', 'V', 'G', 'J', 'D'];
export const wand_mons = ['K', 'E', 'B', 'S', 'H', 0, 'R', 'O', 'Z', 0, 'C', 'Q', 'A',
  0, 'Y', 0, 'T', 'W', 'P', 0, 'U', 'M', 'V', 'G', 'J', 0];

// help list
export const helpstr = [
  ['?', 'prints help', true], ['/', 'identify object', true],
  ['h', 'left', true], ['j', 'down', true], ['k', 'up', true], ['l', 'right', true],
  ['y', 'up & left', true], ['u', 'up & right', true], ['b', 'down & left', true],
  ['n', 'down & right', true],
  ['H', 'run left', false], ['J', 'run down', false], ['K', 'run up', false],
  ['L', 'run right', false], ['Y', 'run up & left', false], ['U', 'run up & right', false],
  ['B', 'run down & left', false], ['N', 'run down & right', false],
  ['^H', 'run left until adjacent', false], ['^J', 'run down until adjacent', false],
  ['^K', 'run up until adjacent', false], ['^L', 'run right until adjacent', false],
  ['^Y', 'run up & left until adjacent', false], ['^U', 'run up & right until adjacent', false],
  ['^B', 'run down & left until adjacent', false], ['^N', 'run down & right until adjacent', false],
  ['', '<SHIFT><dir>: run that way', true], ['', '<CTRL><dir>: run till adjacent', true],
  ['f', '<dir> fight till death or near death', true], ['t', '<dir> throw something', true],
  ['m', '<dir> move onto without picking up', true], ['z', '<dir> zap a wand in a direction', true],
  ['^', '<dir> identify trap type', true], ['s', 'search for trap/secret door', true],
  ['>', 'go down a staircase', true], ['<', 'go up a staircase', true],
  ['.', 'rest for a turn', true], [',', 'pick something up', true], ['i', 'inventory', true],
  ['I', 'inventory single item', true], ['q', 'quaff potion', true], ['r', 'read scroll', true],
  ['e', 'eat food', true], ['w', 'wield a weapon', true], ['W', 'wear armor', true],
  ['T', 'take armor off', true], ['P', 'put on ring', true], ['R', 'remove ring', true],
  ['d', 'drop object', true], ['c', 'call object', true], ['a', 'repeat last command', true],
  [')', 'print current weapon', true], [']', 'print current armor', true],
  ['=', 'print current rings', true], ['@', 'print current stats', true],
  ['D', "recall what's been discovered", true], ['o', 'examine/set options', true],
  ['^R', 'redraw screen', true], ['^P', 'repeat last message', true],
  ['ESC', 'cancel command', true], ['S', 'save game', true], ['Q', 'quit', true],
  ['F', '<dir> fight till either of you dies', true], ['v', 'print version number', true],
].map(([h_ch, h_desc, h_print]) => ({ h_ch, h_desc, h_print }));

export const ident_list = {
  '|': 'wall of a room', '-': 'wall of a room', '*': 'gold', '%': 'a staircase',
  '+': 'door', '.': 'room floor', '@': 'you', '#': 'passage', '^': 'trap', '!': 'potion',
  '?': 'scroll', ':': 'food', ')': 'weapon', ' ': 'solid rock', ']': 'armor',
  ',': 'the Amulet of Yendor', '=': 'ring', '/': 'wand or staff',
};

export const monster_blurbs = {
  A: 'Its touch corrodes armor.', B: 'Erratic and annoying.', C: 'Half man, half horse.',
  D: 'Breathes fire. Run.', E: 'Fast and mean.', F: 'Roots you in place.',
  G: 'Regenerates, flies, and hits like a cart.', H: 'Ugly and cruel.',
  I: 'Its touch freezes you solid.', J: 'Vorpal in every way.', K: 'Small, fast, nasty.',
  L: 'Steals your gold and vanishes.', M: 'Her gaze confuses.', N: 'Steals a magic item.',
  O: 'Guards the gold.', P: 'Invisible and wandering.', Q: 'Twin hooves.',
  R: 'Poisonous bite.', S: 'Hisses.', T: 'Regenerates. Hits hard.', U: 'Never to be underestimated.',
  V: 'Drains your very life.', W: 'Drains your experience.', X: 'Mimics other things.',
  Y: 'A big furry brute.', Z: 'Slow and relentless.',
};
