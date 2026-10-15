// Seeing, chasing and monster behaviour. Ported from misc.c (look), chase.c,
// monsters.c and parts of move.c.
import * as D from './data.js';
import {
  S, rnd, roll, chat, setchat, flat, INDEX, moat, setmoat, winat, ce, cpy, on, new_item, coord,
  addch, inch, emit, msg, addmsg, endmsg, isupper, isalpha, dist, dist_cp, sign, spread,
  vowelstr,
} from './state.js';
import * as L from './level.js';
import * as Dm from './daemons.js';

const { NUMCOLS, NUMLINES, FLOOR, PASSAGE, DOOR, ISGONE, ISDARK, F_PASS, F_REAL, F_PNUM, LAMPDIST } = D;

// ---------------------------------------------------------------- basics
export function step_ok(ch) {
  switch (ch) {
    case ' ': case '|': case '-': return false;
    default: return !isalpha(ch);
  }
}

export function roomin(cp) {
  const fp = flat(cp.y, cp.x);
  if (fp & F_PASS) return S.passages[fp & F_PNUM];
  for (const rp of S.rooms)
    if (cp.x <= rp.r_pos.x + rp.r_max.x && rp.r_pos.x <= cp.x &&
        cp.y <= rp.r_pos.y + rp.r_max.y && rp.r_pos.y <= cp.y) return rp;
  msg(`in some bizarre place (${cp.y}, ${cp.x})`);
  return S.passages[0];
}

export function diag_ok(sp, ep) {
  if (ep.x < 0 || ep.x >= NUMCOLS || ep.y <= 0 || ep.y >= NUMLINES - 1) return false;
  if (ep.x === sp.x || ep.y === sp.y) return true;
  return step_ok(chat(ep.y, sp.x)) && step_ok(chat(sp.y, ep.x));
}

export function cansee(y, x) {
  if (on(S.player, D.ISBLIND)) return false;
  const hero = S.hero;
  if (dist(y, x, hero.y, hero.x) < LAMPDIST) {
    if (flat(y, x) & F_PASS)
      if (y !== hero.y && x !== hero.x && !step_ok(chat(y, hero.x)) && !step_ok(chat(hero.y, x)))
        return false;
    return true;
  }
  const rer = roomin(coord(x, y));
  return rer === S.player.t_room && !(rer.r_flags & ISDARK);
}

export function see_monst(mp) {
  const hero = S.hero;
  if (on(S.player, D.ISBLIND)) return false;
  if (on(mp, D.ISINVIS) && !on(S.player, D.CANSEE)) return false;
  const y = mp.t_pos.y, x = mp.t_pos.x;
  if (dist(y, x, hero.y, hero.x) < LAMPDIST) {
    if (y !== hero.y && x !== hero.x && !step_ok(chat(y, hero.x)) && !step_ok(chat(hero.y, x)))
      return false;
    return true;
  }
  if (mp.t_room !== S.player.t_room) return false;
  return !(mp.t_room.r_flags & ISDARK);
}

export function door_open(rp) {
  if (!(rp.r_flags & ISGONE))
    for (let y = rp.r_pos.y; y < rp.r_pos.y + rp.r_max.y; y++)
      for (let x = rp.r_pos.x; x < rp.r_pos.x + rp.r_max.x; x++)
        if (isupper(winat(y, x))) wake_monster(y, x);
}

export function rnd_thing() {
  const list = [D.POTION, D.SCROLL, D.RING, D.STICK, D.FOOD, D.WEAPON, D.ARMOR, D.STAIRS, D.GOLD, D.AMULET];
  const i = S.level >= D.AMULETLEVEL ? rnd(list.length) : rnd(list.length - 1);
  return list[i];
}

export function trip_ch(y, x, ch) {
  if (on(S.player, D.ISHALU) && S.after)
    switch (ch) {
      case FLOOR: case ' ': case PASSAGE: case '-': case '|': case DOOR: case D.TRAP: break;
      default:
        if (y !== S.stairs.y || x !== S.stairs.x || !S.seenstairs) ch = rnd_thing();
    }
  return ch;
}

export function show_floor() {
  if ((S.player.t_room.r_flags & (ISGONE | ISDARK)) === ISDARK && !on(S.player, D.ISBLIND))
    return S.see_floor;
  return true;
}
export function floor_ch() {
  if (S.player.t_room.r_flags & ISGONE) return PASSAGE;
  return show_floor() ? FLOOR : ' ';
}
export function floor_at() {
  let ch = chat(S.hero.y, S.hero.x);
  if (ch === FLOOR) ch = floor_ch();
  return ch;
}

export function find_obj(y, x) {
  for (const obj of S.lvl_obj) if (obj.o_pos.y === y && obj.o_pos.x === x) return obj;
  return null;
}

// ---------------------------------------------------------------- look
export function look(wakeup) {
  const hero = S.hero, player = S.player;
  let passcount = 0;
  let rp = player.t_room;
  if (!ce(S.oldpos, hero)) {
    erase_lamp(S.oldpos, S.oldrp);
    cpy(S.oldpos, hero);
    S.oldrp = rp;
  }
  const ey = hero.y + 1, ex = hero.x + 1, sx = hero.x - 1, sy = hero.y - 1;
  let sumhero = 0, diffhero = 0;
  if (S.door_stop && !S.firstmove && S.running) {
    sumhero = hero.y + hero.x;
    diffhero = hero.y - hero.x;
  }
  const hpp = INDEX(hero.y, hero.x);
  const pch = hpp.p_ch, pfl = hpp.p_flags;

  for (let y = sy; y <= ey; y++)
    if (y > 0 && y < NUMLINES - 1) for (let x = sx; x <= ex; x++) {
      if (x < 0 || x >= NUMCOLS) continue;
      if (!on(player, D.ISBLIND)) if (y === hero.y && x === hero.x) continue;
      const pp = INDEX(y, x);
      let ch = pp.p_ch;
      if (ch === ' ') continue;
      const fp = pp.p_flags;
      if (pch !== DOOR && ch !== DOOR) if ((pfl & F_PASS) !== (fp & F_PASS)) continue;
      if (((fp & F_PASS) || ch === DOOR) && ((pfl & F_PASS) || pch === DOOR)) {
        if (hero.x !== x && hero.y !== y && !step_ok(chat(y, hero.x)) && !step_ok(chat(hero.y, x)))
          continue;
      }
      const tp = pp.p_monst;
      if (tp === null) ch = trip_ch(y, x, ch);
      else if (on(player, D.SEEMONST) && on(tp, D.ISINVIS)) {
        if (S.door_stop && !S.firstmove) S.running = false;
        continue;
      } else {
        if (wakeup) wake_monster(y, x);
        if (see_monst(tp)) ch = on(player, D.ISHALU) ? String.fromCharCode(rnd(26) + 65) : tp.t_disguise;
      }
      if (on(player, D.ISBLIND) && (y !== hero.y || x !== hero.x)) continue;

      if ((player.t_room.r_flags & ISDARK) && !S.see_floor && ch === FLOOR) ch = ' ';
      addch(y, x, ch);
      if (!tp && ch !== ' ' && ch !== PASSAGE) pp.p_flags |= 0; // keep flags intact

      if (S.door_stop && !S.firstmove && S.running) {
        switch (S.runch) {
          case 'h': if (x === ex) continue; break;
          case 'j': if (y === sy) continue; break;
          case 'k': if (y === ey) continue; break;
          case 'l': if (x === sx) continue; break;
          case 'y': if ((y + x) - sumhero >= 1) continue; break;
          case 'u': if ((y - x) - diffhero >= 1) continue; break;
          case 'n': if ((y + x) - sumhero <= -1) continue; break;
          case 'b': if ((y - x) - diffhero <= -1) continue; break;
        }
        switch (ch) {
          case DOOR: if (x === hero.x || y === hero.y) S.running = false; break;
          case PASSAGE: if (x === hero.x || y === hero.y) passcount++; break;
          case FLOOR: case '|': case '-': case ' ': break;
          default: S.running = false;
        }
      }
    }
  if (S.door_stop && !S.firstmove && passcount > 1) S.running = false;
  if (!S.running || !S.jump) addch(hero.y, hero.x, D.PLAYER);
}

export function erase_lamp(pos, rp) {
  if (!(S.see_floor && (rp.r_flags & (ISGONE | ISDARK)) === ISDARK && !on(S.player, D.ISBLIND))) return;
  for (let x = pos.x - 1; x <= pos.x + 1; x++)
    for (let y = pos.y - 1; y <= pos.y + 1; y++) {
      if (y === S.hero.y && x === S.hero.x) continue;
      if (inch(y, x) === FLOOR) addch(y, x, ' ');
    }
}

// ---------------------------------------------------------------- monsters
export function randmonster(wander) {
  const mons = wander ? D.wand_mons : D.lvl_mons;
  let d;
  do {
    d = S.level + (rnd(10) - 6);
    if (d < 0) d = rnd(5);
    if (d > 25) d = rnd(5) + 21;
  } while (mons[d] === 0);
  return mons[d];
}

export function new_monster(tp, type, cp) {
  let lev_add = S.level - D.AMULETLEVEL;
  if (lev_add < 0) lev_add = 0;
  S.mlist.unshift(tp);
  tp.t_type = type;
  tp.t_disguise = type;
  cpy(tp.t_pos, cp);
  tp.t_oldch = inch(cp.y, cp.x);
  tp.t_room = roomin(cp);
  setmoat(cp.y, cp.x, tp);
  const mp = D.monsters[type.charCodeAt(0) - 65];
  const st = tp.t_stats;
  st.s_lvl = mp.m_stats.s_lvl + lev_add;
  st.s_maxhp = st.s_hpt = roll(st.s_lvl, 8);
  st.s_arm = mp.m_stats.s_arm - lev_add;
  st.s_dmg = mp.m_stats.s_dmg;
  st.s_str = mp.m_stats.s_str;
  st.s_exp = mp.m_stats.s_exp + lev_add * 10 + exp_add(tp);
  tp.t_flags = mp.m_flags;
  if (S.level > 29) tp.t_flags |= D.ISHASTE;
  tp.t_turn = true;
  tp.t_pack = [];
  if (ISWEARING(D.R_AGGR)) runto(cp);
  if (type === 'X') tp.t_disguise = rnd_thing();
  emit('monster_new', { mon: tp });
}

export function ISRING(h, r) {
  const c = S.cur_ring[h];
  return c !== null && c.o_which === r;
}
export const ISWEARING = (r) => ISRING(D.LEFT, r) || ISRING(D.RIGHT, r);

export function exp_add(tp) {
  let mod;
  if (tp.t_stats.s_lvl === 1) mod = Math.trunc(tp.t_stats.s_maxhp / 8);
  else mod = Math.trunc(tp.t_stats.s_maxhp / 6);
  if (tp.t_stats.s_lvl > 9) mod *= 20;
  else if (tp.t_stats.s_lvl > 6) mod *= 4;
  return mod;
}

export function wanderer() {
  const tp = new_item();
  const cp = coord();
  do L.find_floor(null, cp, 0, true);
  while (roomin(cp) === S.player.t_room);
  new_monster(tp, randmonster(true), cp);
  if (on(S.player, D.SEEMONST)) {
    addch(tp.t_pos.y, tp.t_pos.x, on(S.player, D.ISHALU) ? String.fromCharCode(rnd(26) + 65) : tp.t_type, true);
  }
  runto(tp.t_pos);
}

export function wake_monster(y, x) {
  const tp = moat(y, x);
  if (tp === null) return null;
  const ch = tp.t_type;
  const hero = S.hero, player = S.player;
  if (!on(tp, D.ISRUN) && rnd(3) !== 0 && on(tp, D.ISMEAN) && !on(tp, D.ISHELD) &&
      !ISWEARING(D.R_STEALTH) && !on(player, D.ISLEVIT)) {
    tp.t_dest = hero;
    tp.t_flags |= D.ISRUN;
    emit('monster_wake', { mon: tp });
  }
  if (ch === 'M' && !on(player, D.ISBLIND) && !on(player, D.ISHALU) && !on(tp, D.ISFOUND) &&
      !on(tp, D.ISCANC) && on(tp, D.ISRUN)) {
    const rp = player.t_room;
    if ((rp !== null && !(rp.r_flags & ISDARK)) || dist(y, x, hero.y, hero.x) < LAMPDIST) {
      tp.t_flags |= D.ISFOUND;
      if (!save(D.VS_MAGIC)) {
        if (on(player, D.ISHUH)) Dm.lengthen(Dm.unconfuse, spread(D.HUHDURATION));
        else Dm.fuse(Dm.unconfuse, 0, spread(D.HUHDURATION), D.AFTER);
        player.t_flags |= D.ISHUH;
        const mname = set_mname(tp);
        addmsg(mname);
        if (mname !== 'it') addmsg("'");
        msg('s gaze has confused you');
        emit('status_fx', { kind: 'confuse' });
      }
    }
  }
  if (on(tp, D.ISGREED) && !on(tp, D.ISRUN)) {
    tp.t_flags |= D.ISRUN;
    if (player.t_room.r_goldval) tp.t_dest = player.t_room.r_gold;
    else tp.t_dest = hero;
  }
  return tp;
}

export function give_pack(tp) {
  if (S.level >= S.max_level && rnd(100) < D.monsters[tp.t_type.charCodeAt(0) - 65].m_carry)
    tp.t_pack.unshift(X_new_thing());
}
let X_new_thing = () => { throw new Error('new_thing not wired'); };
export const wire = (fns) => { X_new_thing = fns.new_thing; };

export function save_throw(which, tp) {
  const need = 14 + which - Math.trunc(tp.t_stats.s_lvl / 2);
  return roll(1, 20) >= need;
}
export function save(which) {
  if (which === D.VS_MAGIC) {
    if (ISRING(D.LEFT, D.R_PROTECT)) which -= S.cur_ring[D.LEFT].o_arm;
    if (ISRING(D.RIGHT, D.R_PROTECT)) which -= S.cur_ring[D.RIGHT].o_arm;
  }
  return save_throw(which, S.player);
}

export function set_mname(tp) {
  let ch;
  if (!see_monst(tp) && !on(S.player, D.SEEMONST)) return S.terse ? 'it' : 'something';
  let mname;
  if (on(S.player, D.ISHALU)) {
    const c = inch(tp.t_pos.y, tp.t_pos.x);
    ch = isupper(c) ? c.charCodeAt(0) - 65 : rnd(26);
    mname = D.monsters[ch].m_name;
  } else mname = D.monsters[tp.t_type.charCodeAt(0) - 65].m_name;
  return 'the ' + mname;
}

// ---------------------------------------------------------------- chasing
let ch_ret = coord();

export function runners() {
  for (const tp of [...S.mlist]) {
    if (!S.mlist.includes(tp)) continue;
    if (!on(tp, D.ISHELD) && on(tp, D.ISRUN)) {
      const orig_pos = coord(tp.t_pos.x, tp.t_pos.y);
      const wastarget = on(tp, D.ISTARGET);
      if (move_monst(tp) === -1) continue;
      if (on(tp, D.ISFLY) && dist_cp(S.hero, tp.t_pos) >= 3) move_monst(tp);
      if (wastarget && !ce(orig_pos, tp.t_pos)) {
        tp.t_flags &= ~D.ISTARGET;
        S.to_death = false;
      }
    }
  }
  if (S.has_hit) { endmsg(); S.has_hit = false; }
}

export function move_monst(tp) {
  if (!on(tp, D.ISSLOW) || tp.t_turn) if (do_chase(tp) === -1) return -1;
  if (on(tp, D.ISHASTE)) if (do_chase(tp) === -1) return -1;
  tp.t_turn = !tp.t_turn;
  return 0;
}

export function relocate(th, new_loc) {
  if (!ce(new_loc, th.t_pos)) {
    const old = coord(th.t_pos.x, th.t_pos.y);
    addch(th.t_pos.y, th.t_pos.x, th.t_oldch);
    th.t_room = roomin(new_loc);
    set_oldch(th, new_loc);
    const oroom = th.t_room;
    setmoat(th.t_pos.y, th.t_pos.x, null);
    if (oroom !== th.t_room) th.t_dest = find_dest(th);
    cpy(th.t_pos, new_loc);
    setmoat(new_loc.y, new_loc.x, th);
    emit('monster_move', { mon: th, from: old });
  }
  if (see_monst(th)) addch(new_loc.y, new_loc.x, th.t_disguise);
  else if (on(S.player, D.SEEMONST)) addch(new_loc.y, new_loc.x, th.t_type, true);
}

export function set_oldch(tp, cp) {
  if (ce(tp.t_pos, cp)) return;
  const sch = tp.t_oldch;
  tp.t_oldch = inch(cp.y, cp.x);
  if (!on(S.player, D.ISBLIND)) {
    if ((sch === FLOOR || tp.t_oldch === FLOOR) && (tp.t_room.r_flags & ISDARK)) tp.t_oldch = ' ';
    else if (dist_cp(cp, S.hero) <= LAMPDIST && S.see_floor) tp.t_oldch = chat(cp.y, cp.x);
  }
}

export function do_chase(th) {
  const hero = S.hero;
  let rer = th.t_room, ree;
  let mindist = 32767, curdist;
  let stoprun = false;
  let thisc = coord();
  if (on(th, D.ISGREED) && rer.r_goldval === 0) th.t_dest = hero;
  if (th.t_dest === hero) ree = S.player.t_room;
  else ree = roomin(th.t_dest);
  let door = chat(th.t_pos.y, th.t_pos.x) === DOOR;
  for (;;) {
    if (rer !== ree) {
      for (let i = 0; i < rer.r_nexits; i++) {
        const cp = rer.r_exit[i];
        curdist = dist_cp(th.t_dest, cp);
        if (curdist < mindist) { thisc = coord(cp.x, cp.y); mindist = curdist; }
      }
      if (door) {
        rer = S.passages[flat(th.t_pos.y, th.t_pos.x) & F_PNUM];
        door = false;
        continue;
      }
    } else {
      thisc = coord(th.t_dest.x, th.t_dest.y);
      if (th.t_type === 'D' && (th.t_pos.y === hero.y || th.t_pos.x === hero.x ||
          Math.abs(th.t_pos.y - hero.y) === Math.abs(th.t_pos.x - hero.x)) &&
          dist_cp(th.t_pos, hero) <= D.BOLT_LENGTH * D.BOLT_LENGTH && !on(th, D.ISCANC) &&
          rnd(5) === 0) {
        S.delta.y = sign(hero.y - th.t_pos.y);
        S.delta.x = sign(hero.x - th.t_pos.x);
        if (S.has_hit) endmsg();
        S.fire_bolt(th.t_pos, S.delta, 'flame');
        S.running = false;
        S.count = 0;
        S.quiet = 0;
        if (S.to_death && !on(th, D.ISTARGET)) { S.to_death = false; S.kamikaze = false; }
        return 0;
      }
    }
    break;
  }
  if (!chase(th, thisc)) {
    if (ce(thisc, hero)) return S.attack(th);
    else if (ce(thisc, th.t_dest)) {
      for (const obj of S.lvl_obj)
        if (th.t_dest === obj.o_pos) {
          S.lvl_obj.splice(S.lvl_obj.indexOf(obj), 1);
          th.t_pack.unshift(obj);
          setchat(obj.o_pos.y, obj.o_pos.x, th.t_room.r_flags & ISGONE ? PASSAGE : FLOOR);
          th.t_dest = find_dest(th);
          emit('item_taken_by_monster', { mon: th, obj });
          break;
        }
      if (th.t_type !== 'F') stoprun = true;
    }
  } else if (th.t_type === 'F') return 0;
  relocate(th, ch_ret);
  if (stoprun && ce(th.t_pos, th.t_dest)) th.t_flags &= ~D.ISRUN;
  return 0;
}

export function runto(runner) {
  const tp = moat(runner.y, runner.x);
  if (tp === null) return;
  tp.t_flags |= D.ISRUN;
  tp.t_flags &= ~D.ISHELD;
  tp.t_dest = find_dest(tp);
}

export function rndmove(who) {
  const ret = coord(who.t_pos.x + rnd(3) - 1, 0);
  ret.y = who.t_pos.y + rnd(3) - 1;
  const y = ret.y, x = ret.x;
  if (y === who.t_pos.y && x === who.t_pos.x) return ret;
  let bad = false;
  if (!diag_ok(who.t_pos, ret)) bad = true;
  else {
    const ch = winat(y, x);
    if (!step_ok(ch)) bad = true;
    else if (ch === D.SCROLL) {
      const obj = S.lvl_obj.find((o) => y === o.o_pos.y && x === o.o_pos.x);
      if (obj && obj.o_which === D.S_SCARE) bad = true;
    }
  }
  if (bad) return coord(who.t_pos.x, who.t_pos.y);
  return ret;
}

export function chase(tp, ee) {
  const er = tp.t_pos;
  let curdist, thisdist, plcnt = 1;
  if ((on(tp, D.ISHUH) && rnd(5) !== 0) || (tp.t_type === 'P' && rnd(5) === 0) ||
      (tp.t_type === 'B' && rnd(2) === 0)) {
    ch_ret = rndmove(tp);
    curdist = dist_cp(ch_ret, ee);
    if (rnd(20) === 0) tp.t_flags &= ~D.ISHUH;
  } else {
    curdist = dist_cp(er, ee);
    ch_ret = coord(er.x, er.y);
    let ey = er.y + 1;
    if (ey >= NUMLINES - 1) ey = NUMLINES - 2;
    let ex = er.x + 1;
    if (ex >= NUMCOLS) ex = NUMCOLS - 1;
    for (let x = er.x - 1; x <= ex; x++) {
      if (x < 0) continue;
      for (let y = er.y - 1; y <= ey; y++) {
        const tryp = coord(x, y);
        if (!diag_ok(er, tryp)) continue;
        const ch = winat(y, x);
        if (step_ok(ch)) {
          if (ch === D.SCROLL) {
            const obj = S.lvl_obj.find((o) => y === o.o_pos.y && x === o.o_pos.x);
            if (obj && obj.o_which === D.S_SCARE) continue;
          }
          const m = moat(y, x);
          if (m !== null && m.t_type === 'X') continue;
          thisdist = dist(y, x, ee.y, ee.x);
          if (thisdist < curdist) {
            plcnt = 1; ch_ret = tryp; curdist = thisdist;
          } else if (thisdist === curdist && rnd(++plcnt) === 0) {
            ch_ret = tryp; curdist = thisdist;
          }
        }
      }
    }
  }
  return curdist !== 0 && !ce(ch_ret, S.hero);
}

export function find_dest(tp) {
  const prob = D.monsters[tp.t_type.charCodeAt(0) - 65].m_carry;
  if (prob <= 0 || tp.t_room === S.player.t_room || see_monst(tp)) return S.hero;
  for (const obj of S.lvl_obj) {
    if (obj.o_type === D.SCROLL && obj.o_which === D.S_SCARE) continue;
    if (roomin(obj.o_pos) === tp.t_room && rnd(100) < prob) {
      if (!S.mlist.some((m) => m.t_dest === obj.o_pos)) return obj.o_pos;
    }
  }
  return S.hero;
}

export function aggravate() {
  for (const mp of S.mlist) runto(mp.t_pos);
}

export function turn_see(turn_off) {
  let add_new = 0;
  for (const mp of S.mlist) {
    const can_see = see_monst(mp);
    if (turn_off) {
      if (!can_see) addch(mp.t_pos.y, mp.t_pos.x, mp.t_oldch);
    } else {
      addch(mp.t_pos.y, mp.t_pos.x,
        on(S.player, D.ISHALU) ? String.fromCharCode(rnd(26) + 65) : mp.t_type, !can_see);
      if (!can_see) add_new++;
    }
  }
  if (turn_off) S.player.t_flags &= ~D.SEEMONST;
  else S.player.t_flags |= D.SEEMONST;
  return add_new;
}

export function visuals() {
  if (!S.after || (S.running && S.jump)) return;
  for (const tp of S.lvl_obj) if (cansee(tp.o_pos.y, tp.o_pos.x)) addch(tp.o_pos.y, tp.o_pos.x, rnd_thing());
  if (!S.seenstairs && cansee(S.stairs.y, S.stairs.x)) addch(S.stairs.y, S.stairs.x, rnd_thing());
  const seemonst = on(S.player, D.SEEMONST);
  for (const tp of S.mlist) {
    if (see_monst(tp)) {
      if (tp.t_type === 'X' && tp.t_disguise !== 'X') addch(tp.t_pos.y, tp.t_pos.x, rnd_thing());
      else addch(tp.t_pos.y, tp.t_pos.x, String.fromCharCode(rnd(26) + 65));
    } else if (seemonst) addch(tp.t_pos.y, tp.t_pos.x, String.fromCharCode(rnd(26) + 65), true);
  }
}
