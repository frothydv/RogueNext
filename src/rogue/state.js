// Global game state (the C globals of Rogue 5.4), the RNG, message buffer, the
// "screen" memory grid that mirrors what curses would have drawn, and the event
// bus that the 3D presentation layer listens to.
import {
  MAXLINES, MAXCOLS, NUMLINES, NUMCOLS, MAXROOMS, MAXPASS, F_REAL, ISGONE, ISDARK,
  ESCAPE, monsters,
} from './data.js';

export const coord = (x = 0, y = 0) => ({ x, y });

export function newRoom() {
  return {
    r_pos: coord(), r_max: coord(), r_gold: coord(), r_goldval: 0, r_flags: 0,
    r_nexits: 0, r_exit: Array.from({ length: 12 }, () => coord()),
  };
}

export function newStats() {
  return { s_str: 10, s_exp: 0, s_lvl: 1, s_arm: 10, s_hpt: 1, s_dmg: '', s_maxhp: 0 };
}

// A "THING": the union of creature and object fields.
export function new_item() {
  return {
    t_pos: coord(), t_turn: false, t_type: '', t_disguise: '', t_oldch: ' ', t_dest: null,
    t_flags: 0, t_stats: newStats(), t_room: null, t_pack: [], t_reserved: 0,
    o_type: '', o_pos: coord(), o_text: null, o_launch: 0, o_packch: '', o_damage: '0x0',
    o_hurldmg: '0x0', o_count: 0, o_which: 0, o_hplus: 0, o_dplus: 0, o_arm: 0,
    o_flags: 0, o_group: 0, o_label: null,
    id: ++new_item.counter,
  };
}
new_item.counter = 0;

export const S = {
  after: false, again: false, noscore: 0, seenstairs: false, amulet: false,
  door_stop: false, fight_flush: false, firstmove: false, has_hit: false,
  inv_describe: true, jump: false, kamikaze: false, lower_msg: false, move_on: false,
  passgo: false, playing: true, q_comm: false, running: false, save_msg: true,
  see_floor: true, stat_msg: false, terse: false, to_death: false, tombstone: true,
  pack_used: new Array(26).fill(false),
  dir_ch: '', huh: '', runch: '', take: '', last_comm: '', l_last_comm: '',
  last_dir: '', l_last_dir: '',
  fruit: 'slime-mold', whoami: 'Rodney',
  p_colors: [], r_stones: [], s_names: [], ws_made: [], ws_type: [],
  n_objs: 0, ntraps: 0, hungry_state: 0, inpack: 0, level: 1, max_hit: 0, max_level: 0,
  no_food: 0, count: 0, food_left: 0, no_command: 0, no_move: 0, purse: 0, quiet: 0,
  vf_hit: 0, dnum: 0, seed: 1,
  delta: coord(), oldpos: coord(), stairs: coord(),
  places: null,
  cur_armor: null, cur_ring: [null, null], cur_weapon: null, l_last_pick: null,
  last_pick: null, lvl_obj: [], mlist: [], player: null, hero: null,
  oldrp: null, rooms: [], passages: [],
  max_stats: { s_str: 16, s_exp: 0, s_lvl: 1, s_arm: 10, s_hpt: 12, s_dmg: '1x4', s_maxhp: 12 },
  d_list: [],
  between: 0, group: 2, turns: 0,
  detect: null,       // transient magic/monster/food detection overlays
  wizard: false,
  lastKiller: '',
  win: false,
};

export const PLAYER_T = 'player';

export function resetWorld() {
  S.places = new Array(MAXLINES * MAXCOLS);
  for (let i = 0; i < S.places.length; i++) S.places[i] = { p_ch: ' ', p_flags: F_REAL, p_monst: null };
  S.rooms = Array.from({ length: MAXROOMS }, newRoom);
  S.passages = Array.from({ length: MAXPASS }, () => {
    const r = newRoom(); r.r_flags = ISGONE | ISDARK; return r;
  });
  S.player = new_item();
  S.player.t_type = '@';
  S.hero = S.player.t_pos;
}

// ---- RNG: the exact LCG used by Rogue 5.4 ----
function RN() {
  S.seed = (Math.imul(S.seed, 11109) + 13849) | 0;
  return (S.seed >> 16) & 0xffff;
}
export const rnd = (range) => (range === 0 ? 0 : Math.abs(RN()) % range);
export function roll(number, sides) {
  let t = 0;
  while (number-- > 0) t += rnd(sides) + 1;
  return t;
}

// ---- level map accessors (INDEX(y,x) = places[(x<<5)+y]) ----
const dummyPlace = { p_ch: ' ', p_flags: F_REAL, p_monst: null };
export function INDEX(y, x) {
  if (x < 0 || x >= MAXCOLS || y < 0 || y >= MAXLINES) {
    dummyPlace.p_ch = ' '; dummyPlace.p_flags = F_REAL; dummyPlace.p_monst = null;
    return dummyPlace;
  }
  return S.places[(x << 5) + y];
}
export const chat = (y, x) => INDEX(y, x).p_ch;
export const setchat = (y, x, ch) => { INDEX(y, x).p_ch = ch; };
export const flat = (y, x) => INDEX(y, x).p_flags;
export const setflat = (y, x, f) => { INDEX(y, x).p_flags = f & 0xff; };
export const moat = (y, x) => INDEX(y, x).p_monst;
export const setmoat = (y, x, m) => { INDEX(y, x).p_monst = m; };
export const winat = (y, x) => {
  const m = moat(y, x);
  return m !== null ? m.t_disguise : chat(y, x);
};
export const ce = (a, b) => a.x === b.x && a.y === b.y;
export const cpy = (dst, src) => { dst.x = src.x; dst.y = src.y; return dst; };
export const on = (thing, flag) => (thing.t_flags & flag) !== 0;
export const isupper = (ch) => ch.length === 1 && ch >= 'A' && ch <= 'Z';
export const islower = (ch) => ch.length === 1 && ch >= 'a' && ch <= 'z';
export const isalpha = (ch) => isupper(ch) || islower(ch);
export const isdigit = (ch) => ch.length === 1 && ch >= '0' && ch <= '9';
export const CTRL = (c) => String.fromCharCode(c.charCodeAt(0) & 0o37);
export const unctrl = (ch) => {
  const c = ch.charCodeAt(0);
  if (c === 27) return '^[';
  if (c < 32) return '^' + String.fromCharCode(c + 64);
  return ch;
};
export const max = (a, b) => (a > b ? a : b);
export const sign = (n) => (n < 0 ? -1 : n > 0 ? 1 : 0);
export const spread = (nm) => nm - Math.trunc(nm / 20) + rnd(Math.trunc(nm / 10));
export const dist = (y1, x1, y2, x2) => (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
export const dist_cp = (c1, c2) => dist(c1.y, c1.x, c2.y, c2.x);
export const vowelstr = (s) => ('aeiouAEIOU'.includes(s[0]) ? 'n' : '');

// ---- screen memory (what the terminal would be showing) ----
export const screen = new Array(NUMLINES * NUMCOLS).fill(' ');
export const standout = new Array(NUMLINES * NUMCOLS).fill(false);
export function addch(y, x, ch, so = false) {
  if (y < 0 || y >= NUMLINES || x < 0 || x >= NUMCOLS) return;
  screen[y * NUMCOLS + x] = ch;
  standout[y * NUMCOLS + x] = so;
}
export const inch = (y, x) => (y < 0 || y >= NUMLINES || x < 0 || x >= NUMCOLS ? ' ' : screen[y * NUMCOLS + x]);
export function clearScreen() { screen.fill(' '); standout.fill(false); }

// ---- event bus for presentation ----
const listeners = new Set();
export const onEvent = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export function emit(type, data = {}) { for (const l of listeners) l(type, data); }

// ---- I/O hooks, supplied by the UI ----
export const io = {
  readchar: async () => ESCAPE,
  // show a modal list; resolves when dismissed
  showList: async (_title, _lines, _opts) => {},
  getString: async (_prompt, initial) => initial,
  waitSpace: async (_text) => {},
  pickItem: null,
  status: () => {},
  gameOver: async () => {},
};

// ---- messages ----
let msgbuf = '';
export function addmsg(text) { msgbuf += text; }
export function endmsg() {
  if (S.save_msg) S.huh = msgbuf;
  let m = msgbuf;
  if (m.length > 0 && m[0] >= 'a' && m[0] <= 'z' && !S.lower_msg && m[1] !== ')') {
    m = m[0].toUpperCase() + m.slice(1);
  }
  msgbuf = '';
  if (m !== '') emit('msg', { text: m });
  return true;
}
export function msg(text) {
  if (text === '') return true;
  msgbuf += text;
  return endmsg();
}
export function clearMsgBuf() { msgbuf = ''; }

// ---- end of game by exception, like the C code's exit() ----
export class GameOver extends Error {
  constructor(kind, data = {}) { super('game over: ' + kind); this.kind = kind; this.data = data; }
}

export const monsterName = (ch) => monsters[ch.charCodeAt(0) - 65].m_name;
