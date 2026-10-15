// Player item actions: quaff, read, zap, throw, wield, wear, rings, eat, drop...
// Ported from potions.c, scrolls.c, sticks.c, weapons.c, armor.c, rings.c, wizard.c,
// parts of things.c, misc.c and command.c.
import * as D from './data.js';
import {
  S, rnd, roll, chat, setchat, flat, setflat, INDEX, moat, winat, ce, cpy, on, coord,
  new_item, addch, inch, emit, msg, addmsg, endmsg, io, isupper, unctrl, sign, spread,
  GameOver, dist, setmoat,
} from './state.js';
import * as W from './world.js';
import * as I from './items.js';
import * as Dm from './daemons.js';
import * as C from './combat.js';
import * as L from './level.js';

const { ISRING } = W;
const ISWEARING = W.ISWEARING;
const choose_str = Dm.choose_str;

// ------------------------------------------------------------------ helpers
export function waste_time() {
  Dm.do_daemons(D.BEFORE);
  Dm.do_fuses(D.BEFORE);
  Dm.do_daemons(D.AFTER);
  Dm.do_fuses(D.AFTER);
}

export function dropcheck(obj) {
  if (obj === null) return true;
  if (obj !== S.cur_armor && obj !== S.cur_weapon && obj !== S.cur_ring[D.LEFT] && obj !== S.cur_ring[D.RIGHT])
    return true;
  if (obj.o_flags & D.ISCURSED) { msg("you can't.  It appears to be cursed"); return false; }
  if (obj === S.cur_weapon) S.cur_weapon = null;
  else if (obj === S.cur_armor) { waste_time(); S.cur_armor = null; }
  else {
    S.cur_ring[obj === S.cur_ring[D.LEFT] ? D.LEFT : D.RIGHT] = null;
    switch (obj.o_which) {
      case D.R_ADDSTR: I.chg_str(-obj.o_arm); break;
      case D.R_SEEINVIS: Dm.unsee(); Dm.extinguish(Dm.unsee); break;
    }
  }
  emit('equip_changed', {});
  return true;
}

export function levit_check() {
  if (!on(S.player, D.ISLEVIT)) return false;
  msg("You can't.  You're floating off the ground!");
  return true;
}

export function rust_armor(arm) {
  if (arm === null || arm.o_type !== D.ARMOR || arm.o_which === D.LEATHER || arm.o_arm >= 9) return;
  if ((arm.o_flags & D.ISPROT) || ISWEARING(D.R_SUSTARM)) {
    if (!S.to_death) msg('the rust vanishes instantly');
  } else {
    arm.o_arm++;
    if (!S.terse) msg('your armor appears to be weaker now. Oh my!');
    else msg('your armor weakens');
    emit('armor_rust', {});
  }
}

export function uncurse(obj) { if (obj !== null) obj.o_flags &= ~D.ISCURSED; }

export function seen_stairs() {
  if (inch(S.stairs.y, S.stairs.x) === D.STAIRS) return true;
  if (ce(S.hero, S.stairs)) return true;
  const tp = moat(S.stairs.y, S.stairs.x);
  if (tp !== null) {
    if (W.see_monst(tp) && on(tp, D.ISRUN)) return true;
    if (on(S.player, D.SEEMONST) && tp.t_oldch === D.STAIRS) return true;
  }
  return false;
}

export function invis_on() {
  S.player.t_flags |= D.CANSEE;
  emit('status_fx', { kind: 'seeinvis' });
}

export function add_haste(potion) {
  if (on(S.player, D.ISHASTE)) {
    S.no_command += rnd(8);
    S.player.t_flags &= ~(D.ISRUN | D.ISHASTE);
    Dm.extinguish(Dm.nohaste);
    msg('you faint from exhaustion');
    return false;
  }
  S.player.t_flags |= D.ISHASTE;
  if (potion) Dm.fuse(Dm.nohaste, 0, rnd(4) + 4, D.AFTER);
  emit('status_fx', { kind: 'haste' });
  return true;
}

async function show_detect(kind, cells, message) {
  S.detect = { kind, cells };
  emit('detect', { kind, cells });
  await io.waitSpace(message);
  S.detect = null;
  emit('detect_end', {});
}

// ------------------------------------------------------------------ potions
const p_actions = [
  [D.ISHUH, Dm.unconfuse, D.HUHDURATION, 'what a tripy feeling!', "wait, what's going on here. Huh? What? Who?"],
  [D.ISHALU, Dm.come_down, D.SEEDURATION, 'Oh, wow!  Everything seems so cosmic!', 'Oh, wow!  Everything seems so cosmic!'],
  [0, null, 0], [0, null, 0],
  [D.CANSEE, Dm.unsee, D.SEEDURATION, null, null],
  [0, null, 0], [0, null, 0], [0, null, 0], [0, null, 0], [0, null, 0], [0, null, 0], [0, null, 0],
  [D.ISBLIND, Dm.sight, D.SEEDURATION, 'oh, bummer!  Everything is dark!  Help!', 'a cloak of darkness falls around you'],
  [D.ISLEVIT, Dm.land, D.HEALTIME, "oh, wow!  You're floating in the air!", 'you start to float in the air'],
];

function do_pot(type, knowit, seeMsg) {
  const pp = p_actions[type];
  if (!D.pot_info[type].oi_know) D.pot_info[type].oi_know = knowit;
  const t = spread(pp[2]);
  if (!on(S.player, pp[0])) {
    S.player.t_flags |= pp[0];
    Dm.fuse(pp[1], 0, t, D.AFTER);
    W.look(false);
  } else Dm.lengthen(pp[1], t);
  msg(seeMsg || choose_str(pp[3], pp[4]));
}

export async function quaff() {
  const obj = await I.get_item('quaff', D.POTION);
  if (obj === null) return;
  const p = S.player.t_stats;
  if (obj.o_type !== D.POTION) {
    if (!S.terse) msg('yuk! Why would you want to drink that?');
    else msg("that's undrinkable");
    return;
  }
  if (obj === S.cur_weapon) S.cur_weapon = null;
  const trip = on(S.player, D.ISHALU);
  I.leave_pack(obj, false, false);
  emit('potion_quaff', { which: obj.o_which });
  switch (obj.o_which) {
    case D.P_CONFUSE: do_pot(D.P_CONFUSE, !trip); break;
    case D.P_POISON:
      D.pot_info[D.P_POISON].oi_know = true;
      if (ISWEARING(D.R_SUSTSTR)) msg('you feel momentarily sick');
      else {
        I.chg_str(-(rnd(3) + 1));
        msg('you feel very sick now');
        Dm.come_down();
      }
      break;
    case D.P_HEALING:
      D.pot_info[D.P_HEALING].oi_know = true;
      if ((p.s_hpt += roll(p.s_lvl, 4)) > p.s_maxhp) p.s_hpt = ++p.s_maxhp;
      Dm.sight();
      msg('you begin to feel better');
      emit('status_fx', { kind: 'heal' });
      break;
    case D.P_STRENGTH:
      D.pot_info[D.P_STRENGTH].oi_know = true;
      I.chg_str(1);
      msg('you feel stronger, now.  What bulging muscles!');
      emit('status_fx', { kind: 'strength' });
      break;
    case D.P_MFIND:
      S.player.t_flags |= D.SEEMONST;
      Dm.fuse(Dm.turn_see_fuse, 1, D.HUHDURATION, D.AFTER);
      if (!W.turn_see(false)) msg(`you have a ${choose_str('normal', 'strange')} feeling for a moment, then it passes`);
      else {
        D.pot_info[D.P_MFIND].oi_know = true;
        emit('status_fx', { kind: 'monster_detect' });
      }
      break;
    case D.P_TFIND: {
      const cells = [];
      for (const tp of S.lvl_obj) if (I.is_magic(tp)) cells.push({ x: tp.o_pos.x, y: tp.o_pos.y });
      for (const mp of S.mlist) for (const tp of mp.t_pack) if (I.is_magic(tp)) cells.push({ x: mp.t_pos.x, y: mp.t_pos.y });
      if (cells.length) {
        D.pot_info[D.P_TFIND].oi_know = true;
        await show_detect('magic', cells, 'You sense the presence of magic on this level.');
      } else msg(`you have a ${choose_str('normal', 'strange')} feeling for a moment, then it passes`);
      break;
    }
    case D.P_LSD:
      if (!trip) {
        if (on(S.player, D.SEEMONST)) W.turn_see(false);
        Dm.start_daemon(Dm.visuals_d, 0, D.BEFORE);
        S.seenstairs = seen_stairs();
      }
      do_pot(D.P_LSD, true);
      break;
    case D.P_SEEINVIS: {
      const show = on(S.player, D.CANSEE);
      do_pot(D.P_SEEINVIS, false, `this potion tastes like ${S.fruit} juice`);
      if (!show) invis_on();
      Dm.sight();
      break;
    }
    case D.P_RAISE:
      D.pot_info[D.P_RAISE].oi_know = true;
      msg('you suddenly feel much more skillful');
      I.raise_level();
      emit('status_fx', { kind: 'levelup' });
      break;
    case D.P_XHEAL:
      D.pot_info[D.P_XHEAL].oi_know = true;
      if ((p.s_hpt += roll(p.s_lvl, 8)) > p.s_maxhp) {
        if (p.s_hpt > p.s_maxhp + p.s_lvl + 1) ++p.s_maxhp;
        p.s_hpt = ++p.s_maxhp;
      }
      Dm.sight();
      Dm.come_down();
      msg('you begin to feel much better');
      emit('status_fx', { kind: 'heal' });
      break;
    case D.P_HASTE:
      D.pot_info[D.P_HASTE].oi_know = true;
      S.after = false;
      if (add_haste(true)) msg('you feel yourself moving much faster');
      break;
    case D.P_RESTORE:
      if (ISRING(D.LEFT, D.R_ADDSTR)) p.s_str = I.add_str(p.s_str, -S.cur_ring[D.LEFT].o_arm);
      if (ISRING(D.RIGHT, D.R_ADDSTR)) p.s_str = I.add_str(p.s_str, -S.cur_ring[D.RIGHT].o_arm);
      if (p.s_str < S.max_stats.s_str) p.s_str = S.max_stats.s_str;
      if (ISRING(D.LEFT, D.R_ADDSTR)) p.s_str = I.add_str(p.s_str, S.cur_ring[D.LEFT].o_arm);
      if (ISRING(D.RIGHT, D.R_ADDSTR)) p.s_str = I.add_str(p.s_str, S.cur_ring[D.RIGHT].o_arm);
      msg('hey, this tastes great.  It make you feel warm all over');
      emit('status_fx', { kind: 'heal' });
      break;
    case D.P_BLIND: do_pot(D.P_BLIND, true); emit('status_fx', { kind: 'blind' }); break;
    case D.P_LEVIT: do_pot(D.P_LEVIT, true); emit('status_fx', { kind: 'levitate' }); break;
  }
  S.status();
  await call_it(D.pot_info[obj.o_which]);
}

export async function call_it(info) {
  if (info.oi_know) { info.oi_guess = null; return; }
  if (!info.oi_guess && S.autoNamePrompt) {
    msg(S.terse ? 'call it: ' : 'what do you want to call it? ');
    const s = await io.getString('What do you want to call it?', '');
    if (s !== null && s !== '') info.oi_guess = s;
  }
}

// ------------------------------------------------------------------ scrolls
export async function read_scroll() {
  let obj = await I.get_item('read', D.SCROLL);
  if (obj === null) return;
  if (obj.o_type !== D.SCROLL) {
    if (!S.terse) msg('there is nothing on it to read');
    else msg('nothing to read');
    return;
  }
  if (obj === S.cur_weapon) S.cur_weapon = null;
  const discardit = obj.o_count === 1;
  I.leave_pack(obj, false, false);
  const orig_obj = obj;
  const hero = S.hero;
  emit('scroll_read', { which: obj.o_which });
  switch (obj.o_which) {
    case D.S_CONFUSE:
      S.player.t_flags |= D.CANHUH;
      msg(`your hands begin to glow ${I.pick_color('red')}`);
      emit('status_fx', { kind: 'hands_glow' });
      break;
    case D.S_ARMOR:
      if (S.cur_armor !== null) {
        S.cur_armor.o_arm--;
        S.cur_armor.o_flags &= ~D.ISCURSED;
        msg(`your armor glows ${I.pick_color('silver')} for a moment`);
        emit('status_fx', { kind: 'enchant' });
      }
      break;
    case D.S_HOLD: {
      let ch = 0;
      for (let x = hero.x - 2; x <= hero.x + 2; x++)
        if (x >= 0 && x < D.NUMCOLS)
          for (let y = hero.y - 2; y <= hero.y + 2; y++)
            if (y >= 0 && y <= D.NUMLINES - 1) {
              const m = moat(y, x);
              if (m !== null && on(m, D.ISRUN)) {
                m.t_flags &= ~D.ISRUN;
                m.t_flags |= D.ISHELD;
                ch++;
                emit('monster_held', { mon: m });
              }
            }
      if (ch) {
        addmsg('the monster');
        if (ch > 1) addmsg('s around you');
        addmsg(' freeze');
        if (ch === 1) addmsg('s');
        endmsg();
        D.scr_info[D.S_HOLD].oi_know = true;
      } else msg('you feel a strange sense of loss');
      break;
    }
    case D.S_SLEEP:
      D.scr_info[D.S_SLEEP].oi_know = true;
      S.no_command += rnd(spread(5)) + 4;
      S.player.t_flags &= ~D.ISRUN;
      msg('you fall asleep');
      emit('status_fx', { kind: 'sleep' });
      break;
    case D.S_CREATE: {
      let i = 0;
      const mp = coord();
      for (let y = hero.y - 1; y <= hero.y + 1; y++)
        for (let x = hero.x - 1; x <= hero.x + 1; x++) {
          if (y === hero.y && x === hero.x) continue;
          const ch = winat(y, x);
          if (W.step_ok(ch)) {
            if (ch === D.SCROLL && W.find_obj(y, x).o_which === D.S_SCARE) continue;
            else if (rnd(++i) === 0) { mp.y = y; mp.x = x; }
          }
        }
      if (i === 0) msg('you hear a faint cry of anguish in the distance');
      else {
        const o = new_item();
        W.new_monster(o, W.randmonster(false), mp);
        emit('monster_summoned', { mon: o });
      }
      break;
    }
    case D.S_ID_POTION: case D.S_ID_SCROLL: case D.S_ID_WEAPON: case D.S_ID_ARMOR: case D.S_ID_R_OR_S: {
      const id_type = [0, 0, 0, 0, 0, D.POTION, D.SCROLL, D.WEAPON, D.ARMOR, D.R_OR_S];
      D.scr_info[obj.o_which].oi_know = true;
      msg(`this scroll is an ${D.scr_info[obj.o_which].oi_name} scroll`);
      await whatis(true, id_type[obj.o_which]);
      break;
    }
    case D.S_MAP: {
      D.scr_info[D.S_MAP].oi_know = true;
      msg('oh, now this scroll has a map on it');
      for (let y = 1; y < D.NUMLINES - 1; y++)
        for (let x = 0; x < D.NUMCOLS; x++) {
          const pp = INDEX(y, x);
          let ch = pp.p_ch;
          let draw = true;
          const pass = () => {
            if (!(pp.p_flags & D.F_REAL)) pp.p_ch = D.PASSAGE;
            pp.p_flags |= (D.F_SEEN | D.F_REAL);
            ch = D.PASSAGE;
          };
          const def = () => { if (pp.p_flags & D.F_PASS) pass(); else ch = ' '; };
          switch (ch) {
            case D.DOOR: case D.STAIRS: break;
            case '-': case '|':
              if (!(pp.p_flags & D.F_REAL)) { ch = pp.p_ch = D.DOOR; pp.p_flags |= D.F_REAL; }
              break;
            case ' ':
              if (pp.p_flags & D.F_REAL) def();
              else { pp.p_flags |= D.F_REAL; ch = pp.p_ch = D.PASSAGE; pass(); }
              break;
            case D.PASSAGE: pass(); break;
            case D.FLOOR:
              if (pp.p_flags & D.F_REAL) ch = ' ';
              else { ch = D.TRAP; pp.p_ch = D.TRAP; pp.p_flags |= (D.F_SEEN | D.F_REAL); }
              break;
            default: def();
          }
          if (ch !== ' ') {
            const o = pp.p_monst;
            if (o !== null) o.t_oldch = ch;
            if (o === null || !on(S.player, D.SEEMONST)) addch(y, x, ch);
          }
        }
      emit('map_revealed', {});
      break;
    }
    case D.S_FDET: {
      const cells = [];
      for (const o of S.lvl_obj) if (o.o_type === D.FOOD) cells.push({ x: o.o_pos.x, y: o.o_pos.y });
      if (cells.length) {
        D.scr_info[D.S_FDET].oi_know = true;
        await show_detect('food', cells, 'Your nose tingles and you smell food.');
      } else msg('your nose tingles');
      break;
    }
    case D.S_TELEP: {
      const cur_room = S.player.t_room;
      teleport();
      if (cur_room !== S.player.t_room) D.scr_info[D.S_TELEP].oi_know = true;
      break;
    }
    case D.S_ENCH:
      if (S.cur_weapon === null || S.cur_weapon.o_type !== D.WEAPON) msg('you feel a strange sense of loss');
      else {
        S.cur_weapon.o_flags &= ~D.ISCURSED;
        if (rnd(2) === 0) S.cur_weapon.o_hplus++; else S.cur_weapon.o_dplus++;
        msg(`your ${D.weap_info[S.cur_weapon.o_which].oi_name} glows ${I.pick_color('blue')} for a moment`);
        emit('status_fx', { kind: 'enchant' });
      }
      break;
    case D.S_SCARE:
      msg('you hear maniacal laughter in the distance');
      break;
    case D.S_REMOVE:
      uncurse(S.cur_armor); uncurse(S.cur_weapon);
      uncurse(S.cur_ring[D.LEFT]); uncurse(S.cur_ring[D.RIGHT]);
      msg(choose_str('you feel in touch with the Universal Onenes', 'you feel as if somebody is watching over you'));
      emit('status_fx', { kind: 'bless' });
      break;
    case D.S_AGGR:
      W.aggravate();
      msg('you hear a high pitched humming noise');
      break;
    case D.S_PROTECT:
      if (S.cur_armor !== null) {
        S.cur_armor.o_flags |= D.ISPROT;
        msg(`your armor is covered by a shimmering ${I.pick_color('gold')} shield`);
        emit('status_fx', { kind: 'enchant' });
      } else msg('you feel a strange sense of loss');
      break;
  }
  obj = orig_obj;
  W.look(true);
  S.status();
  await call_it(D.scr_info[obj.o_which]);
}

// ------------------------------------------------------------------ identify
export function set_know(obj, info) {
  info[obj.o_which].oi_know = true;
  obj.o_flags |= D.ISKNOW;
  info[obj.o_which].oi_guess = null;
}

export async function whatis(insist, type) {
  const pack = S.player.t_pack;
  if (pack.length === 0) { msg("you don't have anything in your pack to identify"); return; }
  let obj;
  // (Deviation from the original: don't soft-lock when nothing of that type is carried.)
  if (insist && !pack.some((o) => I.typeMatches(o, type))) return;
  for (;;) {
    obj = await I.get_item('identify', type);
    if (insist) {
      if (S.n_objs === 0) return;
      else if (obj === null) msg('you must identify something');
      else if (type && obj.o_type !== type && !(type === D.R_OR_S && (obj.o_type === D.RING || obj.o_type === D.STICK)))
        msg(`you must identify a ${I.type_name(type)}`);
      else break;
    } else break;
  }
  if (obj === null) return;
  switch (obj.o_type) {
    case D.SCROLL: set_know(obj, D.scr_info); break;
    case D.POTION: set_know(obj, D.pot_info); break;
    case D.STICK: set_know(obj, D.ws_info); break;
    case D.WEAPON: case D.ARMOR: obj.o_flags |= D.ISKNOW; break;
    case D.RING: set_know(obj, D.ring_info); break;
  }
  msg(I.inv_name(obj, false));
  emit('pack_changed', {});
}

// ------------------------------------------------------------------ teleport
export function teleport() {
  const c = coord();
  addch(S.hero.y, S.hero.x, W.floor_at());
  const from = coord(S.hero.x, S.hero.y);
  L.find_floor(null, c, 0, true);
  if (W.roomin(c) !== S.player.t_room) {
    L.leave_room(S.hero);
    cpy(S.hero, c);
    L.enter_room(S.hero);
  } else {
    cpy(S.hero, c);
    W.look(true);
  }
  addch(S.hero.y, S.hero.x, D.PLAYER);
  if (on(S.player, D.ISHELD)) {
    S.player.t_flags &= ~D.ISHELD;
    S.vf_hit = 0;
    D.monsters[5].m_stats.s_dmg = '000x0';
  }
  S.no_move = 0;
  S.count = 0;
  S.running = false;
  emit('teleport', { from, to: coord(S.hero.x, S.hero.y) });
}

// ------------------------------------------------------------------ eat etc.
export async function eat() {
  const obj = await I.get_item('eat', D.FOOD);
  if (obj === null) return;
  if (obj.o_type !== D.FOOD) {
    if (!S.terse) msg('ugh, you would get ill if you ate that');
    else msg("that's Inedible!");
    return;
  }
  if (S.food_left < 0) S.food_left = 0;
  if ((S.food_left += D.HUNGERTIME - 200 + rnd(400)) > D.STOMACHSIZE) S.food_left = D.STOMACHSIZE;
  S.hungry_state = 0;
  if (obj === S.cur_weapon) S.cur_weapon = null;
  if (obj.o_which === 1) msg(`my, that was a yummy ${S.fruit}`);
  else if (rnd(100) > 70) {
    S.player.t_stats.s_exp++;
    msg(`${choose_str('bummer', 'yuk')}, this food tastes awful`);
    I.check_level();
  } else msg(`${choose_str('oh, wow', 'yum')}, that tasted good`);
  I.leave_pack(obj, false, false);
  emit('eat', {});
}

export async function wield() {
  const oweapon = S.cur_weapon;
  if (!dropcheck(S.cur_weapon)) { S.cur_weapon = oweapon; return; }
  S.cur_weapon = oweapon;
  const obj = await I.get_item('wield', D.WEAPON);
  if (obj === null) { S.after = false; return; }
  if (obj.o_type === D.ARMOR) { msg("you can't wield armor"); S.after = false; return; }
  if (I.is_current(obj)) { S.after = false; return; }
  const sp = I.inv_name(obj, true);
  S.cur_weapon = obj;
  if (!S.terse) addmsg('you are now ');
  msg(`wielding ${sp} (${obj.o_packch})`);
  emit('equip_changed', {});
}

export async function wear() {
  const obj = await I.get_item('wear', D.ARMOR);
  if (obj === null) return;
  if (S.cur_armor !== null) {
    addmsg('you are already wearing some');
    if (!S.terse) addmsg(".  You'll have to take it off first");
    endmsg();
    S.after = false;
    return;
  }
  if (obj.o_type !== D.ARMOR) { msg("you can't wear that"); return; }
  waste_time();
  obj.o_flags |= D.ISKNOW;
  const sp = I.inv_name(obj, true);
  S.cur_armor = obj;
  if (!S.terse) addmsg('you are now ');
  msg(`wearing ${sp}`);
  emit('equip_changed', {});
}

export async function take_off() {
  const obj = S.cur_armor;
  if (obj === null) {
    S.after = false;
    msg(S.terse ? 'not wearing armor' : "you aren't wearing any armor");
    return;
  }
  if (!dropcheck(S.cur_armor)) return;
  S.cur_armor = null;
  addmsg(S.terse ? 'was' : 'you used to be');
  msg(` wearing ${obj.o_packch}) ${I.inv_name(obj, true)}`);
  emit('equip_changed', {});
}

async function gethand() {
  for (;;) {
    msg(S.terse ? 'left or right ring? ' : 'left hand or right hand? ');
    emit('prompt_hand', { active: true });
    const c = await io.readchar();
    emit('prompt_hand', { active: false });
    if (c === D.ESCAPE) return -1;
    if (c === 'l' || c === 'L') return D.LEFT;
    else if (c === 'r' || c === 'R') return D.RIGHT;
    msg(S.terse ? 'L or R' : 'please type L or R');
  }
}

export async function ring_on() {
  const obj = await I.get_item('put on', D.RING);
  if (obj === null) return;
  if (obj.o_type !== D.RING) {
    msg(S.terse ? 'not a ring' : 'it would be difficult to wrap that around a finger');
    return;
  }
  if (I.is_current(obj)) return;
  let ring;
  if (S.cur_ring[D.LEFT] === null && S.cur_ring[D.RIGHT] === null) {
    if ((ring = await gethand()) < 0) return;
  } else if (S.cur_ring[D.LEFT] === null) ring = D.LEFT;
  else if (S.cur_ring[D.RIGHT] === null) ring = D.RIGHT;
  else { msg(S.terse ? 'wearing two' : 'you already have a ring on each hand'); return; }
  S.cur_ring[ring] = obj;
  switch (obj.o_which) {
    case D.R_ADDSTR: I.chg_str(obj.o_arm); break;
    case D.R_SEEINVIS: invis_on(); break;
    case D.R_AGGR: W.aggravate(); break;
  }
  if (!S.terse) addmsg('you are now wearing ');
  msg(`${I.inv_name(obj, true)} (${obj.o_packch})`);
  emit('equip_changed', {});
}

export async function ring_off() {
  let ring;
  if (S.cur_ring[D.LEFT] === null && S.cur_ring[D.RIGHT] === null) {
    msg(S.terse ? 'no rings' : "you aren't wearing any rings");
    return;
  } else if (S.cur_ring[D.LEFT] === null) ring = D.RIGHT;
  else if (S.cur_ring[D.RIGHT] === null) ring = D.LEFT;
  else if ((ring = await gethand()) < 0) return;
  const obj = S.cur_ring[ring];
  if (obj === null) { msg('not wearing such a ring'); return; }
  if (dropcheck(obj)) msg(`was wearing ${I.inv_name(obj, true)}(${obj.o_packch})`);
}

export async function drop() {
  const ch = chat(S.hero.y, S.hero.x);
  if (ch !== D.FLOOR && ch !== D.PASSAGE) { S.after = false; msg('there is something there already'); return; }
  let obj = await I.get_item('drop', 0);
  if (obj === null) return;
  if (!dropcheck(obj)) return;
  obj = I.leave_pack(obj, true, !I.ISMULT(obj.o_type));
  S.lvl_obj.unshift(obj);
  setchat(S.hero.y, S.hero.x, obj.o_type);
  setflat(S.hero.y, S.hero.x, flat(S.hero.y, S.hero.x) | D.F_DROPPED);
  cpy(obj.o_pos, S.hero);
  if (obj.o_type === D.AMULET) S.amulet = false;
  msg(`dropped ${I.inv_name(obj, true)}`);
  emit('item_dropped', { obj });
}

export async function call() {
  const obj = await I.get_item('call', D.CALLABLE);
  if (obj === null) return;
  let op = null, elsewise = null, know = null, tgt = null;
  switch (obj.o_type) {
    case D.RING: op = D.ring_info[obj.o_which]; elsewise = S.r_stones[obj.o_which]; break;
    case D.POTION: op = D.pot_info[obj.o_which]; elsewise = S.p_colors[obj.o_which]; break;
    case D.SCROLL: op = D.scr_info[obj.o_which]; elsewise = S.s_names[obj.o_which]; break;
    case D.STICK: op = D.ws_info[obj.o_which]; elsewise = S.ws_made[obj.o_which]; break;
    case D.FOOD: msg("you can't call that anything"); return;
  }
  if (op) { tgt = op; know = op.oi_know; if (op.oi_guess !== null) elsewise = op.oi_guess; }
  else { tgt = obj; elsewise = obj.o_label; }
  if (know) { msg('that has already been identified'); return; }
  const init = elsewise === null ? '' : elsewise;
  msg(S.terse ? 'call it: ' : 'what do you want to call it? ');
  const s = await io.getString(`Call this ${obj.o_type === D.WEAPON ? 'weapon' : 'item'} something`, init);
  if (s !== null) {
    if (op) op.oi_guess = s === '' ? null : s;
    else obj.o_label = s === '' ? null : s;
    emit('pack_changed', {});
  }
}

export function current(cur, how, where) {
  S.after = false;
  if (cur !== null) {
    if (!S.terse) addmsg(`you are ${how} (`);
    S.inv_describe = false;
    addmsg(`${cur.o_packch}) ${I.inv_name(cur, true)}`);
    S.inv_describe = true;
    if (where) addmsg(` ${where}`);
    endmsg();
  } else {
    if (!S.terse) addmsg('you are ');
    addmsg(`${how} nothing`);
    if (where) addmsg(` ${where}`);
    endmsg();
  }
}

// ------------------------------------------------------------------ missiles
export function do_motion(obj, ydelta, xdelta) {
  const path = [];
  cpy(obj.o_pos, S.hero);
  for (;;) {
    cpy(obj.o_pos, { x: obj.o_pos.x + xdelta, y: obj.o_pos.y + ydelta });
    const ch = winat(obj.o_pos.y, obj.o_pos.x);
    if (W.step_ok(ch) && ch !== D.DOOR) {
      path.push({ x: obj.o_pos.x, y: obj.o_pos.y });
      continue;
    }
    break;
  }
  emit('throw', { obj, from: { x: S.hero.x, y: S.hero.y }, path, end: { x: obj.o_pos.x, y: obj.o_pos.y }, dir: { x: xdelta, y: ydelta } });
}

export function hit_monster(y, x, obj) {
  return C.fight(coord(x, y), obj, true);
}

export async function missile(ydelta, xdelta) {
  let obj = await I.get_item('throw', D.WEAPON);
  if (obj === null) return;
  if (!dropcheck(obj) || I.is_current(obj)) return;
  obj = I.leave_pack(obj, true, false);
  do_motion(obj, ydelta, xdelta);
  if (moat(obj.o_pos.y, obj.o_pos.x) === null || !hit_monster(obj.o_pos.y, obj.o_pos.x, obj)) I.fall(obj, true);
  else emit('item_gone', { obj });
}

// ------------------------------------------------------------------ sticks
export async function do_zap() {
  const obj = await I.get_item('zap with', D.STICK);
  if (obj === null) return;
  const hero = S.hero, delta = S.delta;
  if (obj.o_type !== D.STICK) { S.after = false; msg("you can't zap with that!"); return; }
  if (obj.o_arm === 0) { msg('nothing happens'); return; }
  emit('zap', { which: obj.o_which, dir: { x: delta.x, y: delta.y } });
  let tp;
  switch (obj.o_which) {
    case D.WS_LIGHT:
      D.ws_info[D.WS_LIGHT].oi_know = true;
      if (S.player.t_room.r_flags & D.ISGONE) msg('the corridor glows and then fades');
      else {
        S.player.t_room.r_flags &= ~D.ISDARK;
        L.enter_room(hero);
        addmsg('the room is lit');
        if (!S.terse) addmsg(` by a shimmering ${I.pick_color('blue')} light`);
        endmsg();
        emit('room_lit', {});
      }
      break;
    case D.WS_DRAIN:
      if (S.player.t_stats.s_hpt < 2) { msg('you are too weak to use it'); return; }
      drain();
      break;
    case D.WS_INVIS: case D.WS_POLYMORPH: case D.WS_TELAWAY: case D.WS_TELTO: case D.WS_CANCEL: {
      let y = hero.y, x = hero.x;
      while (W.step_ok(winat(y, x))) { y += delta.y; x += delta.x; }
      if ((tp = moat(y, x)) !== null) {
        let monster = tp.t_type;
        if (monster === 'F') S.player.t_flags &= ~D.ISHELD;
        switch (obj.o_which) {
          case D.WS_INVIS:
            tp.t_flags |= D.ISINVIS;
            if (W.cansee(y, x)) addch(y, x, tp.t_oldch);
            emit('monster_fx', { mon: tp, kind: 'invis' });
            break;
          case D.WS_POLYMORPH: {
            const pp = tp.t_pack;
            const idx = S.mlist.indexOf(tp);
            if (idx >= 0) S.mlist.splice(idx, 1);
            if (W.see_monst(tp)) addch(y, x, chat(y, x));
            const oldch = tp.t_oldch;
            const old = coord(x, y);
            W.new_monster(tp, (monster = String.fromCharCode(rnd(26) + 65)), old);
            if (W.see_monst(tp)) addch(y, x, monster);
            tp.t_oldch = oldch;
            tp.t_pack = pp;
            D.ws_info[D.WS_POLYMORPH].oi_know ||= W.see_monst(tp);
            emit('monster_fx', { mon: tp, kind: 'polymorph' });
            break;
          }
          case D.WS_CANCEL:
            tp.t_flags |= D.ISCANC;
            tp.t_flags &= ~(D.ISINVIS | D.CANHUH);
            tp.t_disguise = tp.t_type;
            if (W.see_monst(tp)) addch(y, x, tp.t_disguise);
            emit('monster_fx', { mon: tp, kind: 'cancel' });
            break;
          case D.WS_TELAWAY: case D.WS_TELTO: {
            const new_pos = coord();
            if (obj.o_which === D.WS_TELAWAY) {
              do L.find_floor(null, new_pos, 0, true); while (ce(new_pos, hero));
            } else { new_pos.y = hero.y + delta.y; new_pos.x = hero.x + delta.x; }
            tp.t_dest = hero;
            tp.t_flags |= D.ISRUN;
            emit('monster_fx', { mon: tp, kind: 'teleport' });
            W.relocate(tp, new_pos);
            break;
          }
        }
      }
      break;
    }
    case D.WS_MISSILE: {
      D.ws_info[D.WS_MISSILE].oi_know = true;
      const bolt = new_item();
      bolt.o_type = '*';
      bolt.o_hurldmg = '1x4';
      bolt.o_hplus = 100;
      bolt.o_dplus = 1;
      bolt.o_flags = D.ISMISL;
      if (S.cur_weapon !== null) bolt.o_launch = S.cur_weapon.o_which;
      do_motion_bolt(bolt, delta.y, delta.x);
      if ((tp = moat(bolt.o_pos.y, bolt.o_pos.x)) !== null && !W.save_throw(D.VS_MAGIC, tp))
        hit_monster(bolt.o_pos.y, bolt.o_pos.x, bolt);
      else if (S.terse) msg('missle vanishes');
      else msg('the missle vanishes with a puff of smoke');
      break;
    }
    case D.WS_HASTE_M: case D.WS_SLOW_M: {
      let y = hero.y, x = hero.x;
      while (W.step_ok(winat(y, x))) { y += delta.y; x += delta.x; }
      if ((tp = moat(y, x)) !== null) {
        if (obj.o_which === D.WS_HASTE_M) {
          if (on(tp, D.ISSLOW)) tp.t_flags &= ~D.ISSLOW; else tp.t_flags |= D.ISHASTE;
        } else {
          if (on(tp, D.ISHASTE)) tp.t_flags &= ~D.ISHASTE; else tp.t_flags |= D.ISSLOW;
          tp.t_turn = true;
        }
        emit('monster_fx', { mon: tp, kind: obj.o_which === D.WS_HASTE_M ? 'haste' : 'slow' });
        W.runto(coord(x, y));
      }
      break;
    }
    case D.WS_ELECT: case D.WS_FIRE: case D.WS_COLD: {
      const name = obj.o_which === D.WS_ELECT ? 'bolt' : obj.o_which === D.WS_FIRE ? 'flame' : 'ice';
      fire_bolt(hero, delta, name);
      D.ws_info[obj.o_which].oi_know = true;
      break;
    }
    case D.WS_NOP: break;
  }
  obj.o_arm--;
  emit('pack_changed', {});
}

function do_motion_bolt(obj, ydelta, xdelta) {
  const path = [];
  cpy(obj.o_pos, S.hero);
  for (;;) {
    obj.o_pos.y += ydelta; obj.o_pos.x += xdelta;
    const ch = winat(obj.o_pos.y, obj.o_pos.x);
    if (W.step_ok(ch) && ch !== D.DOOR) { path.push({ x: obj.o_pos.x, y: obj.o_pos.y }); continue; }
    break;
  }
  emit('bolt', { kind: 'missile', from: { x: S.hero.x, y: S.hero.y }, path, end: { x: obj.o_pos.x, y: obj.o_pos.y } });
}

export function drain() {
  const hero = S.hero, proom = S.player.t_room;
  const corp = chat(hero.y, hero.x) === D.DOOR ? S.passages[flat(hero.y, hero.x) & D.F_PNUM] : null;
  const inpass = !!(proom.r_flags & D.ISGONE);
  const drainee = [];
  for (const mp of S.mlist)
    if (mp.t_room === proom || mp.t_room === corp ||
        (inpass && chat(mp.t_pos.y, mp.t_pos.x) === D.DOOR &&
         S.passages[flat(mp.t_pos.y, mp.t_pos.x) & D.F_PNUM] === proom)) drainee.push(mp);
  if (drainee.length === 0) { msg('you have a tingling feeling'); return; }
  const pstats = S.player.t_stats;
  pstats.s_hpt = Math.trunc(pstats.s_hpt / 2);
  const cnt = Math.trunc(pstats.s_hpt / drainee.length);
  emit('drain', { targets: drainee.slice() });
  for (const mp of drainee) {
    if ((mp.t_stats.s_hpt -= cnt) <= 0) C.killed(mp, W.see_monst(mp));
    else W.runto(mp.t_pos);
  }
}

export function fire_bolt(start, dir, name) {
  const bolt = new_item();
  bolt.o_type = D.WEAPON;
  bolt.o_which = D.FLAME;
  bolt.o_hurldmg = '6x6';
  bolt.o_hplus = 100;
  bolt.o_dplus = 0;
  D.weap_info[D.FLAME].oi_name = name;
  const pos = coord(start.x, start.y);
  let hit_hero = start !== S.hero;
  let used = false, changed = false;
  const path = [];
  const hero = S.hero;
  const bounces = [];
  let steps = 0;
  const dirv = coord(dir.x, dir.y);
  for (let n = 0; n < D.BOLT_LENGTH && !used;) {
    pos.y += dirv.y;
    pos.x += dirv.x;
    path.push({ x: pos.x, y: pos.y });
    const ch = winat(pos.y, pos.x);
    let isWall = false;
    switch (ch) {
      case D.DOOR:
        if (ce(hero, pos)) break;
        isWall = true; break;
      case '|': case '-': case ' ': isWall = true; break;
    }
    if (isWall) {
      if (!changed) hit_hero = !hit_hero;
      changed = false;
      dirv.y = -dirv.y; dirv.x = -dirv.x;
      bounces.push(path.length - 1);
      msg(`the ${name} bounces`);
      if (++steps > 40) break;
      continue; // c1-- : do not consume a step
    }
    n++;
    let tp;
    if (!hit_hero && (tp = moat(pos.y, pos.x)) !== null) {
      hit_hero = true;
      changed = !changed;
      tp.t_oldch = chat(pos.y, pos.x);
      if (!W.save_throw(D.VS_MAGIC, tp)) {
        bolt.o_pos = coord(pos.x, pos.y);
        used = true;
        emit('bolt', { kind: name, from: { x: start.x, y: start.y }, path: path.slice(), bounces, end: { x: pos.x, y: pos.y } });
        path.length = 0;
        if (tp.t_type === 'D' && name === 'flame') {
          addmsg('the flame bounces');
          if (!S.terse) addmsg(' off the dragon');
          endmsg();
        } else hit_monster(pos.y, pos.x, bolt);
      } else if (ch !== 'M' || tp.t_disguise === 'M') {
        if (start === hero) W.runto(pos);
        if (S.terse) msg(`${name} misses`);
        else msg(`the ${name} whizzes past ${W.set_mname(tp)}`);
      }
    } else if (hit_hero && ce(pos, hero)) {
      hit_hero = false;
      changed = !changed;
      if (!W.save(D.VS_MAGIC)) {
        if ((S.player.t_stats.s_hpt -= roll(6, 6)) <= 0) {
          emit('bolt', { kind: name, from: { x: start.x, y: start.y }, path: path.slice(), bounces, end: { x: pos.x, y: pos.y } });
          if (start === hero) C.death('b');
          else C.death(moat(start.y, start.x).t_type);
        }
        used = true;
        if (S.terse) msg(`the ${name} hits`);
        else msg(`you are hit by the ${name}`);
        emit('player_hurt', { kind: name });
      } else msg(`the ${name} whizzes by you`);
    }
  }
  if (path.length) emit('bolt', { kind: name, from: { x: start.x, y: start.y }, path, bounces, end: path[path.length - 1] });
}

// ------------------------------------------------------------------ searching
export function search() {
  const hero = S.hero;
  const ey = hero.y + 1, ex = hero.x + 1;
  let probinc = on(S.player, D.ISHALU) ? 3 : 0;
  probinc += on(S.player, D.ISBLIND) ? 2 : 0;
  let found = false;
  for (let y = hero.y - 1; y <= ey; y++)
    for (let x = hero.x - 1; x <= ex; x++) {
      if (y === hero.y && x === hero.x) continue;
      const pp = INDEX(y, x);
      if (!(pp.p_flags & D.F_REAL)) {
        let foundone = false;
        switch (pp.p_ch) {
          case '|': case '-':
            if (rnd(5 + probinc) !== 0) break;
            pp.p_ch = D.DOOR;
            msg('a secret door');
            foundone = true;
            emit('secret_found', { x, y, kind: 'door' });
            break;
          case D.FLOOR:
            if (rnd(2 + probinc) !== 0) break;
            pp.p_ch = D.TRAP;
            if (!S.terse) addmsg('you found ');
            if (on(S.player, D.ISHALU)) msg(D.tr_name[rnd(D.NTRAPS)]);
            else {
              msg(D.tr_name[pp.p_flags & D.F_TMASK]);
              pp.p_flags |= D.F_SEEN;
            }
            foundone = true;
            emit('secret_found', { x, y, kind: 'trap' });
            break;
          case ' ':
            if (rnd(3 + probinc) !== 0) break;
            pp.p_ch = D.PASSAGE;
            foundone = true;
            emit('secret_found', { x, y, kind: 'passage' });
            break;
        }
        if (foundone) {
          found = true;
          pp.p_flags |= D.F_REAL;
          S.count = 0;
          S.running = false;
        }
      }
    }
  if (found) W.look(false);
  emit('search', {});
}

// ------------------------------------------------------------------ stairs
export function d_level() {
  if (levit_check()) return;
  if (chat(S.hero.y, S.hero.x) !== D.STAIRS) msg('I see no way down');
  else {
    S.level++;
    S.seenstairs = false;
    emit('stairs', { dir: 'down' });
    L.new_level();
  }
}
export function u_level() {
  if (levit_check()) return;
  if (chat(S.hero.y, S.hero.x) === D.STAIRS) {
    if (S.amulet) {
      S.level--;
      if (S.level === 0) C.total_winner();
      emit('stairs', { dir: 'up' });
      L.new_level();
      msg('you feel a wrenching sensation in your gut');
    } else msg('your way is magically blocked');
  } else msg('I see no way up');
}
