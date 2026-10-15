// Save / load the whole game to browser storage (the original wrote an encrypted save file).
import * as D from './rogue/data.js';
import { S, new_item, resetWorld, coord, clearScreen, screen, standout } from './rogue/state.js';
import * as Dm from './rogue/daemons.js';
import * as I from './rogue/items.js';

const KEY = 'rogue-tabletop-save-v1';

const SCALARS = ['after', 'again', 'noscore', 'seenstairs', 'amulet', 'door_stop', 'fight_flush', 'firstmove', 'has_hit', 'inv_describe',
  'jump', 'kamikaze', 'lower_msg', 'move_on', 'passgo', 'playing', 'q_comm', 'running', 'save_msg', 'see_floor', 'stat_msg', 'terse', 'to_death',
  'tombstone', 'dir_ch', 'huh', 'runch', 'take', 'last_comm', 'l_last_comm', 'last_dir', 'l_last_dir', 'fruit', 'whoami', 'n_objs', 'ntraps',
  'hungry_state', 'inpack', 'level', 'max_hit', 'max_level', 'no_food', 'count', 'food_left', 'no_command', 'no_move', 'purse', 'quiet', 'vf_hit',
  'dnum', 'seed', 'between', 'group', 'turns', 'autoNamePrompt'];

const THING_PLAIN = ['t_turn', 't_type', 't_disguise', 't_oldch', 't_flags', 't_reserved', 'o_type', 'o_text', 'o_launch', 'o_packch', 'o_damage',
  'o_hurldmg', 'o_count', 'o_which', 'o_hplus', 'o_dplus', 'o_arm', 'o_flags', 'o_group', 'o_label', 'id'];

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}
export function deleteSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

function packThing(t) {
  const o = {};
  for (const k of THING_PLAIN) o[k] = t[k];
  o.t_pos = { x: t.t_pos.x, y: t.t_pos.y };
  o.o_pos = { x: t.o_pos.x, y: t.o_pos.y };
  o.t_stats = { ...t.t_stats };
  return o;
}
function unpackThing(o) {
  const t = new_item();
  for (const k of THING_PLAIN) t[k] = o[k];
  t.t_pos.x = o.t_pos.x; t.t_pos.y = o.t_pos.y;
  t.o_pos.x = o.o_pos.x; t.o_pos.y = o.o_pos.y;
  t.t_stats = { ...o.t_stats };
  t.t_pack = [];
  if (o.id > new_item.counter) new_item.counter = o.id;
  return t;
}
const roomRef = (r) => {
  if (!r) return null;
  let i = S.rooms.indexOf(r);
  if (i >= 0) return ['r', i];
  i = S.passages.indexOf(r);
  return i >= 0 ? ['p', i] : null;
};
const roomDeref = (ref) => (ref ? (ref[0] === 'r' ? S.rooms[ref[1]] : S.passages[ref[1]]) : null);
const packRoom = (r) => ({ pos: { ...r.r_pos }, max: { ...r.r_max }, gold: { ...r.r_gold }, goldval: r.r_goldval, flags: r.r_flags, nexits: r.r_nexits, exits: r.r_exit.map((e) => ({ ...e })) });
const unpackRoom = (r, o) => {
  Object.assign(r.r_pos, o.pos); Object.assign(r.r_max, o.max); Object.assign(r.r_gold, o.gold);
  r.r_goldval = o.goldval; r.r_flags = o.flags; r.r_nexits = o.nexits;
  o.exits.forEach((e, i) => Object.assign(r.r_exit[i], e));
};

export function serialize() {
  const pack = S.player.t_pack;
  const pidx = (o) => (o ? pack.indexOf(o) : -1);
  const data = {
    v: 1, when: Date.now(),
    scalars: Object.fromEntries(SCALARS.map((k) => [k, S[k]])),
    max_stats: { ...S.max_stats },
    stairs: { ...S.stairs }, oldpos: { ...S.oldpos }, delta: { ...S.delta },
    player: { ...packThing(S.player), pack: pack.map(packThing) },
    cur: { armor: pidx(S.cur_armor), weapon: pidx(S.cur_weapon), ringL: pidx(S.cur_ring[0]), ringR: pidx(S.cur_ring[1]) },
    places: S.places.map((p) => [p.p_ch, p.p_flags, p.p_monst ? p.p_monst.id : 0]),
    rooms: S.rooms.map(packRoom), passages: S.passages.map(packRoom),
    oldrp: roomRef(S.oldrp), proom: roomRef(S.player.t_room),
    lvl_obj: S.lvl_obj.map(packThing),
    mlist: S.mlist.map((m) => {
      const d = m.t_dest;
      let dest = null;
      if (d === S.hero) dest = ['hero'];
      else if (d) {
        const ri = S.rooms.findIndex((r) => r.r_gold === d);
        if (ri >= 0) dest = ['gold', ri];
        else { const oi = S.lvl_obj.findIndex((o) => o.o_pos === d); dest = oi >= 0 ? ['obj', oi] : ['pos', d.x, d.y]; }
      }
      return { ...packThing(m), pack: m.t_pack.map(packThing), room: roomRef(m.t_room), dest };
    }),
    info: {
      pot: D.pot_info.map((o) => [o.oi_know, o.oi_guess]), scr: D.scr_info.map((o) => [o.oi_know, o.oi_guess]),
      ring: D.ring_info.map((o) => [o.oi_know, o.oi_guess, o.oi_worth]), ws: D.ws_info.map((o) => [o.oi_know, o.oi_guess]),
      probs: [D.things, D.arm_info, D.pot_info, D.ring_info, D.scr_info, D.weap_info, D.ws_info].map((t) => t.map((o) => o.oi_prob)),
      weapname: D.weap_info[D.FLAME].oi_name, vf: D.monsters[5].m_stats.s_dmg,
    },
    names: { p_colors: S.p_colors, r_stones: S.r_stones, s_names: S.s_names, ws_made: S.ws_made, ws_type: S.ws_type },
    daemons: S.d_list.map((d) => ({ t: d.d_type, f: d.d_func ? d.d_func.name : null, a: d.d_arg, time: d.d_time })),
    screen: screen.join(''), standout: standout.map((b) => (b ? 1 : 0)).join(''),
    counter: new_item.counter,
  };
  return JSON.stringify(data);
}

export function saveGame() {
  localStorage.setItem(KEY, serialize());
}

export function loadGame() {
  const raw = localStorage.getItem(KEY);
  if (!raw) throw new Error('no saved game');
  const data = JSON.parse(raw);
  restore(data);
}

export function restore(data) {
  resetWorld();
  clearScreen();
  Dm.initDaemons();
  for (const k of SCALARS) if (data.scalars[k] !== undefined) S[k] = data.scalars[k];
  S.playing = true;
  Object.assign(S.max_stats, data.max_stats);
  Object.assign(S.stairs, data.stairs); Object.assign(S.oldpos, data.oldpos); Object.assign(S.delta, data.delta);
  new_item.counter = data.counter || 0;
  // pack
  const p = S.player;
  const base = unpackThing(data.player);
  Object.assign(p, { ...base, t_pos: S.hero, t_pack: [], t_dest: null, t_room: null });
  S.hero.x = data.player.t_pos.x; S.hero.y = data.player.t_pos.y;
  p.t_stats = { ...data.player.t_stats };
  S.pack_used.fill(false);
  p.t_pack = data.player.pack.map((o) => { const t = unpackThing(o); if (t.o_packch) S.pack_used[t.o_packch.charCodeAt(0) - 97] = true; return t; });
  const at = (i) => (i >= 0 ? p.t_pack[i] : null);
  S.cur_armor = at(data.cur.armor); S.cur_weapon = at(data.cur.weapon);
  S.cur_ring = [at(data.cur.ringL), at(data.cur.ringR)];
  data.rooms.forEach((r, i) => unpackRoom(S.rooms[i], r));
  data.passages.forEach((r, i) => unpackRoom(S.passages[i], r));
  p.t_room = roomDeref(data.proom);
  S.oldrp = roomDeref(data.oldrp);
  S.lvl_obj = data.lvl_obj.map(unpackThing);
  // monsters
  const byId = new Map();
  S.mlist = data.mlist.map((m) => {
    const t = unpackThing(m);
    t.t_pack = m.pack.map(unpackThing);
    t.t_room = roomDeref(m.room);
    byId.set(t.id, t);
    return t;
  });
  data.mlist.forEach((m, i) => {
    const t = S.mlist[i], d = m.dest;
    if (!d) t.t_dest = null;
    else if (d[0] === 'hero') t.t_dest = S.hero;
    else if (d[0] === 'gold') t.t_dest = S.rooms[d[1]].r_gold;
    else if (d[0] === 'obj') t.t_dest = S.lvl_obj[d[1]].o_pos;
    else t.t_dest = coord(d[1], d[2]);
  });
  data.places.forEach((pl, i) => { S.places[i].p_ch = pl[0]; S.places[i].p_flags = pl[1]; S.places[i].p_monst = pl[2] ? byId.get(pl[2]) || null : null; });
  // tables
  I.resetInfoTables();
  const inf = data.info;
  [[D.pot_info, inf.pot], [D.scr_info, inf.scr], [D.ring_info, inf.ring], [D.ws_info, inf.ws]].forEach(([t, v]) => v.forEach((e, i) => { t[i].oi_know = e[0]; t[i].oi_guess = e[1]; if (e.length > 2) t[i].oi_worth = e[2]; }));
  [D.things, D.arm_info, D.pot_info, D.ring_info, D.scr_info, D.weap_info, D.ws_info].forEach((t, ti) => t.forEach((o, i) => { o.oi_prob = inf.probs[ti][i]; }));
  D.weap_info[D.FLAME].oi_name = inf.weapname; D.monsters[5].m_stats.s_dmg = inf.vf;
  Object.assign(S, { p_colors: data.names.p_colors, r_stones: data.names.r_stones, s_names: data.names.s_names, ws_made: data.names.ws_made, ws_type: data.names.ws_type });
  // daemons
  data.daemons.forEach((d, i) => { const s = S.d_list[i]; s.d_type = d.t; s.d_func = d.f ? Dm.registry[d.f] || null : null; s.d_arg = d.a; s.d_time = d.time; if (!s.d_func) s.d_type = 0; });
  const scr = data.screen;
  for (let i = 0; i < screen.length; i++) { screen[i] = scr[i]; standout[i] = data.standout[i] === '1'; }
}
