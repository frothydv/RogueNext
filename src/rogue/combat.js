// Fighting, death and victory. Ported from fight.c and rip.c.
import * as D from './data.js';
import {
  S, rnd, roll, chat, setchat, moat, setmoat, ce, cpy, on, coord, addch, emit,
  msg, addmsg, endmsg, vowelstr, isupper, GameOver,
} from './state.js';
import * as W from './world.js';
import * as I from './items.js';
import { GOLDCALC } from './level.js';
import { choose_str } from './daemons.js';

const { ISRUN, LEFT, RIGHT } = D;
const ISRING = W.ISRING;

function atoi(s) { return parseInt(s, 10) || 0; }

export function fight(mp, weap, thrown) {
  const tp = moat(mp.y, mp.x);
  if (tp === null) return false;
  S.count = 0;
  S.quiet = 0;
  W.runto(mp);
  if (tp.t_type === 'X' && tp.t_disguise !== 'X' && !on(S.player, D.ISBLIND)) {
    tp.t_disguise = 'X';
    if (on(S.player, D.ISHALU)) addch(tp.t_pos.y, tp.t_pos.x, String.fromCharCode(rnd(26) + 65));
    else addch(tp.t_pos.y, tp.t_pos.x, 'X');
    msg(choose_str("heavy!  That's a nasty critter!", "wait!  That's a xeroc!"));
    emit('xeroc_reveal', { mon: tp });
    if (!thrown) return false;
  }
  const mname = W.set_mname(tp);
  let did_hit = false;
  S.has_hit = S.terse && !S.to_death;
  if (roll_em(S.player, tp, weap, thrown)) {
    did_hit = false;
    if (thrown) thunk(weap, mname, S.terse);
    else hit(null, mname, S.terse);
    if (on(S.player, D.CANHUH)) {
      did_hit = true;
      tp.t_flags |= D.ISHUH;
      S.player.t_flags &= ~D.CANHUH;
      endmsg();
      S.has_hit = false;
      msg(`your hands stop glowing ${I.pick_color('red')}`);
      emit('status_fx', { kind: 'hands_off' });
    }
    if (tp.t_stats.s_hpt <= 0) killed(tp, true);
    else if (did_hit && !on(S.player, D.ISBLIND)) msg(`${mname} appears confused`);
    did_hit = true;
  } else if (thrown) bounce(weap, mname, S.terse);
  else miss(null, mname, S.terse);
  return did_hit;
}

export function attack(mp) {
  const player = S.player, pstats = player.t_stats;
  S.running = false;
  S.count = 0;
  S.quiet = 0;
  if (S.to_death && !on(mp, D.ISTARGET)) { S.to_death = false; S.kamikaze = false; }
  if (mp.t_type === 'X' && mp.t_disguise !== 'X' && !on(player, D.ISBLIND)) {
    mp.t_disguise = 'X';
    if (on(player, D.ISHALU)) addch(mp.t_pos.y, mp.t_pos.x, String.fromCharCode(rnd(26) + 65));
  }
  const mname = W.set_mname(mp);
  let oldhp = pstats.s_hpt;
  if (roll_em(mp, player, null, false)) {
    if (mp.t_type !== 'I') {
      if (S.has_hit) addmsg('.  ');
      hit(mname, null, false);
    } else if (S.has_hit) endmsg();
    S.has_hit = false;
    if (pstats.s_hpt <= 0) death(mp.t_type);
    else if (!S.kamikaze) {
      oldhp -= pstats.s_hpt;
      if (oldhp > S.max_hit) S.max_hit = oldhp;
      if (pstats.s_hpt <= S.max_hit) S.to_death = false;
    }
    if (!on(mp, D.ISCANC)) {
      switch (mp.t_type) {
        case 'A': S.rust_armor(S.cur_armor); break;
        case 'I':
          player.t_flags &= ~ISRUN;
          if (!S.no_command) {
            addmsg('you are frozen');
            if (!S.terse) addmsg(` by the ${mname}`);
            endmsg();
          }
          S.no_command += rnd(2) + 2;
          if (S.no_command > D.BORE_LEVEL) death('h');
          break;
        case 'R':
          if (!W.save(D.VS_POISON)) {
            if (!W.ISWEARING(D.R_SUSTSTR)) {
              I.chg_str(-1);
              if (!S.terse) msg('you feel a bite in your leg and now feel weaker');
              else msg('a bite has weakened you');
            } else if (!S.to_death) {
              if (!S.terse) msg('a bite momentarily weakens you');
              else msg('bite has no effect');
            }
          }
          break;
        case 'W': case 'V':
          if (rnd(100) < (mp.t_type === 'W' ? 15 : 30)) {
            let fewer;
            if (mp.t_type === 'W') {
              if (pstats.s_exp === 0) death('W');
              if (--pstats.s_lvl === 0) { pstats.s_exp = 0; pstats.s_lvl = 1; }
              else pstats.s_exp = D.e_levels[pstats.s_lvl - 1] + 1;
              fewer = roll(1, 10);
            } else fewer = roll(1, 3);
            pstats.s_hpt -= fewer;
            pstats.s_maxhp -= fewer;
            if (pstats.s_hpt <= 0) pstats.s_hpt = 1;
            if (pstats.s_maxhp <= 0) death(mp.t_type);
            msg('you suddenly feel weaker');
          }
          break;
        case 'F':
          player.t_flags |= D.ISHELD;
          D.monsters[5].m_stats.s_dmg = `${++S.vf_hit}x1`;
          if (--pstats.s_hpt <= 0) death('F');
          break;
        case 'L': {
          const lastpurse = S.purse;
          S.purse -= GOLDCALC();
          if (!W.save(D.VS_MAGIC)) S.purse -= GOLDCALC() + GOLDCALC() + GOLDCALC() + GOLDCALC();
          if (S.purse < 0) S.purse = 0;
          emit('monster_vanish', { mon: mp, why: 'thief' });
          remove_mon(mp.t_pos, mp, false);
          mp = null;
          if (S.purse !== lastpurse) msg('your purse feels lighter');
          break;
        }
        case 'N': {
          let steal = null, nobj = 0;
          for (const obj of player.t_pack)
            if (obj !== S.cur_armor && obj !== S.cur_weapon && obj !== S.cur_ring[LEFT] &&
                obj !== S.cur_ring[RIGHT] && I.is_magic(obj) && rnd(++nobj) === 0) steal = obj;
          if (steal !== null) {
            emit('monster_vanish', { mon: mp, why: 'thief' });
            remove_mon(mp.t_pos, moat(mp.t_pos.y, mp.t_pos.x), false);
            mp = null;
            I.leave_pack(steal, false, false);
            msg(`she stole ${I.inv_name(steal, true)}!`);
          }
          break;
        }
      }
    }
  } else if (mp.t_type !== 'I') {
    if (S.has_hit) { addmsg('.  '); S.has_hit = false; }
    if (mp.t_type === 'F') {
      pstats.s_hpt -= S.vf_hit;
      if (pstats.s_hpt <= 0) death(mp.t_type);
    }
    miss(mname, null, false);
  }
  S.count = 0;
  S.status();
  return mp === null ? -1 : 0;
}

export function swing(at_lvl, op_arm, wplus) {
  const res = rnd(20);
  const need = (20 - at_lvl) - op_arm;
  swing.last = { res, need: need - wplus };
  return res + wplus >= need;
}
swing.last = { res: 0, need: 0 };

export function roll_em(thatt, thdef, weap, hurl) {
  const att = thatt.t_stats, def = thdef.t_stats;
  let cp, hplus, dplus, did_hit = false;
  if (weap === null) { cp = att.s_dmg; dplus = 0; hplus = 0; }
  else {
    hplus = weap.o_hplus; dplus = weap.o_dplus;
    if (weap === S.cur_weapon) {
      if (ISRING(LEFT, D.R_ADDDAM)) dplus += S.cur_ring[LEFT].o_arm;
      else if (ISRING(LEFT, D.R_ADDHIT)) hplus += S.cur_ring[LEFT].o_arm;
      if (ISRING(RIGHT, D.R_ADDDAM)) dplus += S.cur_ring[RIGHT].o_arm;
      else if (ISRING(RIGHT, D.R_ADDHIT)) hplus += S.cur_ring[RIGHT].o_arm;
    }
    cp = weap.o_damage;
    if (hurl) {
      if ((weap.o_flags & D.ISMISL) && S.cur_weapon !== null && S.cur_weapon.o_which === weap.o_launch) {
        cp = weap.o_hurldmg;
        hplus += S.cur_weapon.o_hplus;
        dplus += S.cur_weapon.o_dplus;
      } else if (weap.o_launch < 0) cp = weap.o_hurldmg;
    }
  }
  if (!on(thdef, ISRUN)) hplus += 4;
  let def_arm = def.s_arm;
  if (def === S.player.t_stats) {
    if (S.cur_armor !== null) def_arm = S.cur_armor.o_arm;
    if (ISRING(LEFT, D.R_PROTECT)) def_arm -= S.cur_ring[LEFT].o_arm;
    if (ISRING(RIGHT, D.R_PROTECT)) def_arm -= S.cur_ring[RIGHT].o_arm;
  }
  let totalDmg = 0;
  const swings = [];
  while (cp !== null && cp !== undefined && cp !== '') {
    const ndice = atoi(cp);
    const xi = cp.indexOf('x');
    if (xi < 0) break;
    cp = cp.slice(xi + 1);
    const nsides = atoi(cp);
    const s = swing(att.s_lvl, def_arm, hplus + D.str_plus[att.s_str]);
    const info = { ...swing.last, hit: s, dmg: 0 };
    if (s) {
      const proll = roll(ndice, nsides);
      const damage = dplus + proll + D.add_dam[att.s_str];
      def.s_hpt -= Math.max(0, damage);
      info.dmg = Math.max(0, damage);
      totalDmg += info.dmg;
      did_hit = true;
    }
    swings.push(info);
    const si = cp.indexOf('/');
    if (si < 0) break;
    cp = cp.slice(si + 1);
  }
  emit('combat', {
    att: thatt === S.player ? 'player' : thatt, def: thdef === S.player ? 'player' : thdef,
    hit: did_hit, dmg: totalDmg, swings, thrown: !!hurl, weap,
  });
  return did_hit;
}

export function prname(mname, upper) {
  let s = mname === null ? 'you' : mname;
  if (upper) s = s[0].toUpperCase() + s.slice(1);
  return s;
}

export function thunk(weap, mname, noend) {
  if (S.to_death) return;
  if (weap.o_type === D.WEAPON) addmsg(`the ${D.weap_info[weap.o_which].oi_name} hits `);
  else addmsg('you hit ');
  addmsg(mname);
  if (!noend) endmsg();
}
export function hit(er, ee, noend) {
  if (S.to_death) return;
  addmsg(prname(er, true));
  let s;
  if (S.terse) s = ' hit';
  else {
    let i = rnd(4);
    if (er !== null) i += 4;
    s = D.h_names[i];
  }
  addmsg(s);
  if (!S.terse) addmsg(prname(ee, false));
  if (!noend) endmsg();
}
export function miss(er, ee, noend) {
  if (S.to_death) return;
  addmsg(prname(er, true));
  let i = S.terse ? 0 : rnd(4);
  if (er !== null) i += 4;
  addmsg(D.m_names[i]);
  if (!S.terse) addmsg(` ${prname(ee, false)}`);
  if (!noend) endmsg();
}
export function bounce(weap, mname, noend) {
  if (S.to_death) return;
  if (weap.o_type === D.WEAPON) addmsg(`the ${D.weap_info[weap.o_which].oi_name} misses `);
  else addmsg('you missed ');
  addmsg(mname);
  if (!noend) endmsg();
}

export function remove_mon(mp, tp, waskill) {
  for (const obj of [...tp.t_pack]) {
    cpy(obj.o_pos, tp.t_pos);
    tp.t_pack.splice(tp.t_pack.indexOf(obj), 1);
    if (waskill) I.fall(obj, false);
  }
  setmoat(mp.y, mp.x, null);
  addch(mp.y, mp.x, tp.t_oldch);
  const i = S.mlist.indexOf(tp);
  if (i >= 0) S.mlist.splice(i, 1);
  if (on(tp, D.ISTARGET)) { S.kamikaze = false; S.to_death = false; }
  emit('monster_removed', { mon: tp, killed: waskill });
}

export function killed(tp, pr) {
  const pstats = S.player.t_stats;
  pstats.s_exp += tp.t_stats.s_exp;
  switch (tp.t_type) {
    case 'F':
      S.player.t_flags &= ~D.ISHELD;
      S.vf_hit = 0;
      D.monsters[5].m_stats.s_dmg = '000x0';
      break;
    case 'L': {
      if (I.fallpos(tp.t_pos, tp.t_room.r_gold) && S.level >= S.max_level) {
        const gold = new_item_gold();
        gold.o_arm = GOLDCALC();
        if (W.save(D.VS_MAGIC)) gold.o_arm += GOLDCALC() + GOLDCALC() + GOLDCALC() + GOLDCALC();
        tp.t_pack.unshift(gold);
      }
      break;
    }
  }
  const mname = W.set_mname(tp);
  emit('monster_killed', { mon: tp });
  remove_mon(tp.t_pos, tp, true);
  if (pr) {
    if (S.has_hit) { addmsg('.  Defeated '); S.has_hit = false; }
    else {
      if (!S.terse) addmsg('you have ');
      addmsg('defeated ');
    }
    msg(mname);
  }
  I.check_level();
}
import { new_item } from './state.js';
function new_item_gold() { const g = new_item(); g.o_type = D.GOLD; return g; }

// --------------------------------------------------------------- end of game
const killNames = { a: ['arrow', true], b: ['bolt', true], d: ['dart', true], h: ['hypothermia', false], s: ['starvation', false] };
export function killname(monst, doart) {
  let sp, article;
  if (isupper(monst)) { sp = D.monsters[monst.charCodeAt(0) - 65].m_name; article = true; }
  else {
    sp = 'Wally the Wonder Badger'; article = false;
    if (killNames[monst]) { sp = killNames[monst][0]; article = killNames[monst][1]; }
  }
  return (doart && article ? `a${vowelstr(sp)} ` : '') + sp;
}

export function death(monst) {
  S.purse -= Math.trunc(S.purse / 10);
  throw new GameOver('death', { monst, killer: killname(monst, false), purse: S.purse });
}

export function total_winner() {
  const rows = [];
  let worth = 0;
  const oldpurse = S.purse;
  for (const obj of S.player.t_pack) {
    let op;
    switch (obj.o_type) {
      case D.FOOD: worth = 2 * obj.o_count; break;
      case D.WEAPON:
        worth = D.weap_info[obj.o_which].oi_worth;
        worth *= 3 * (obj.o_hplus + obj.o_dplus) + obj.o_count;
        obj.o_flags |= D.ISKNOW; break;
      case D.ARMOR:
        worth = D.arm_info[obj.o_which].oi_worth;
        worth += (9 - obj.o_arm) * 100;
        worth += 10 * (D.a_class[obj.o_which] - obj.o_arm);
        obj.o_flags |= D.ISKNOW; break;
      case D.SCROLL:
        worth = D.scr_info[obj.o_which].oi_worth * obj.o_count;
        op = D.scr_info[obj.o_which];
        if (!op.oi_know) worth = Math.trunc(worth / 2);
        op.oi_know = true; break;
      case D.POTION:
        worth = D.pot_info[obj.o_which].oi_worth * obj.o_count;
        op = D.pot_info[obj.o_which];
        if (!op.oi_know) worth = Math.trunc(worth / 2);
        op.oi_know = true; break;
      case D.RING:
        op = D.ring_info[obj.o_which];
        worth = op.oi_worth;
        if ([D.R_ADDSTR, D.R_ADDDAM, D.R_PROTECT, D.R_ADDHIT].includes(obj.o_which)) {
          if (obj.o_arm > 0) worth += obj.o_arm * 100; else worth = 10;
        }
        if (!(obj.o_flags & D.ISKNOW)) worth = Math.trunc(worth / 2);
        obj.o_flags |= D.ISKNOW; op.oi_know = true; break;
      case D.STICK:
        op = D.ws_info[obj.o_which];
        worth = op.oi_worth + 20 * obj.o_arm;
        if (!(obj.o_flags & D.ISKNOW)) worth = Math.trunc(worth / 2);
        obj.o_flags |= D.ISKNOW; op.oi_know = true; break;
      case D.AMULET: worth = 1000; break;
    }
    if (worth < 0) worth = 0;
    rows.push({ ch: obj.o_packch, worth, name: I.inv_name(obj, false) });
    S.purse += worth;
  }
  throw new GameOver('win', { rows, oldpurse, purse: S.purse });
}
