// Daemons and fuses (daemon.c / daemons.c)
import * as D from './data.js';
import {
  S, rnd, roll, on, emit, msg, addmsg, addch, chat, spread,
} from './state.js';
import * as W from './world.js';

const EMPTY = 0, DAEMON = -1, MAXDAEMONS = 20;
export const registry = {};
// Daemons are saved by name, so each one is registered under an explicit key (the
// minified build renames functions, so fn.name cannot be relied on).
export const register = (name, fn) => { registry[name] = fn; fn.daemonName = name; return fn; };

export function initDaemons() {
  S.d_list = Array.from({ length: MAXDAEMONS }, () => ({ d_type: EMPTY, d_func: null, d_arg: 0, d_time: 0 }));
}
function d_slot() { return S.d_list.find((d) => d.d_type === EMPTY) || null; }
function find_slot(func) { return S.d_list.find((d) => d.d_type !== EMPTY && d.d_func === func) || null; }

export function start_daemon(func, arg, type) {
  const dev = d_slot(); if (!dev) return;
  dev.d_type = type; dev.d_func = func; dev.d_arg = arg; dev.d_time = DAEMON;
}
export function kill_daemon(func) { const dev = find_slot(func); if (dev) dev.d_type = EMPTY; }
export function do_daemons(flag) {
  for (const dev of S.d_list)
    if (dev.d_type === flag && dev.d_time === DAEMON) dev.d_func(dev.d_arg);
}
export function fuse(func, arg, time, type) {
  const wire = d_slot(); if (!wire) return;
  wire.d_type = type; wire.d_func = func; wire.d_arg = arg; wire.d_time = time;
}
export function lengthen(func, xtime) { const w = find_slot(func); if (w) w.d_time += xtime; }
export function extinguish(func) { const w = find_slot(func); if (w) w.d_type = EMPTY; }
export function do_fuses(flag) {
  for (const wire of S.d_list)
    if (flag === wire.d_type && wire.d_time > 0 && --wire.d_time === 0) {
      wire.d_type = EMPTY;
      wire.d_func(wire.d_arg);
    }
}

// ---------------------------------------------------------------- the daemons
export const doctor = register('doctor', function doctor() {
  const p = S.player.t_stats;
  const lv = p.s_lvl, ohp = p.s_hpt;
  S.quiet++;
  if (lv < 8) { if (S.quiet + (lv << 1) > 20) p.s_hpt++; }
  else if (S.quiet >= 3) p.s_hpt += rnd(lv - 7) + 1;
  if (W.ISRING(D.LEFT, D.R_REGEN)) p.s_hpt++;
  if (W.ISRING(D.RIGHT, D.R_REGEN)) p.s_hpt++;
  if (ohp !== p.s_hpt) {
    if (p.s_hpt > p.s_maxhp) p.s_hpt = p.s_maxhp;
    S.quiet = 0;
  }
});

export const swander = register('swander', function swander() { start_daemon(rollwand, 0, D.BEFORE); });

export const rollwand = register('rollwand', function rollwand() {
  if (++S.between >= 4) {
    if (roll(1, 6) === 4) {
      W.wanderer();
      kill_daemon(rollwand);
      fuse(swander, 0, spread(70), D.BEFORE);
    }
    S.between = 0;
  }
});

export const unconfuse = register('unconfuse', function unconfuse() {
  S.player.t_flags &= ~D.ISHUH;
  msg(`you feel less ${choose_str('trippy', 'confused')} now`);
  emit('status_fx', { kind: 'unconfuse' });
});

export const unsee = register('unsee', function unsee() {
  for (const th of S.mlist)
    if (on(th, D.ISINVIS) && W.see_monst(th)) addch(th.t_pos.y, th.t_pos.x, th.t_oldch);
  S.player.t_flags &= ~D.CANSEE;
  emit('status_fx', { kind: 'unsee' });
});

export const sight = register('sight', function sight() {
  if (on(S.player, D.ISBLIND)) {
    extinguish(sight);
    S.player.t_flags &= ~D.ISBLIND;
    if (!(S.player.t_room.r_flags & D.ISGONE)) S.enter_room(S.hero);
    msg(choose_str('far out!  Everything is all cosmic again', 'the veil of darkness lifts'));
    emit('status_fx', { kind: 'sight' });
  }
});

export const nohaste = register('nohaste', function nohaste() {
  S.player.t_flags &= ~D.ISHASTE;
  msg('you feel yourself slowing down');
  emit('status_fx', { kind: 'nohaste' });
});

export function choose_str(ts, ns) { return on(S.player, D.ISHALU) ? ts : ns; }

export const stomach = register('stomach', function stomach() {
  const orig_hungry = S.hungry_state;
  if (S.food_left <= 0) {
    if (S.food_left-- < -D.STARVETIME) S.death('s');
    if (S.no_command || rnd(5) !== 0) return;
    S.no_command += rnd(8) + 4;
    S.hungry_state = 3;
    if (!S.terse) addmsg(choose_str('the munchies overpower your motor capabilities.  ',
      'you feel too weak from lack of food.  '));
    msg(choose_str('You freak out', 'You faint'));
  } else {
    const oldfood = S.food_left;
    S.food_left -= S.ring_eat(D.LEFT) + S.ring_eat(D.RIGHT) + 1 - (S.amulet ? 1 : 0);
    if (S.food_left < D.MORETIME && oldfood >= D.MORETIME) {
      S.hungry_state = 2;
      msg(choose_str('the munchies are interfering with your motor capabilites',
        'you are starting to feel weak'));
    } else if (S.food_left < 2 * D.MORETIME && oldfood >= 2 * D.MORETIME) {
      S.hungry_state = 1;
      if (S.terse) msg(choose_str('getting the munchies', 'getting hungry'));
      else msg(choose_str('you are getting the munchies', 'you are starting to get hungry'));
    }
  }
  if (S.hungry_state !== orig_hungry) {
    S.player.t_flags &= ~D.ISRUN;
    S.running = false;
    S.to_death = false;
    S.count = 0;
  }
});

export const come_down = register('come_down', function come_down() {
  if (!on(S.player, D.ISHALU)) return;
  kill_daemon(visuals_d);
  S.player.t_flags &= ~D.ISHALU;
  emit('status_fx', { kind: 'come_down' });
  if (on(S.player, D.ISBLIND)) return;
  for (const tp of S.lvl_obj) if (W.cansee(tp.o_pos.y, tp.o_pos.x)) addch(tp.o_pos.y, tp.o_pos.x, tp.o_type);
  const seemonst = on(S.player, D.SEEMONST);
  for (const tp of S.mlist) {
    if (W.cansee(tp.t_pos.y, tp.t_pos.x)) {
      if (!on(tp, D.ISINVIS) || on(S.player, D.CANSEE)) addch(tp.t_pos.y, tp.t_pos.x, tp.t_disguise);
      else addch(tp.t_pos.y, tp.t_pos.x, chat(tp.t_pos.y, tp.t_pos.x));
    } else if (seemonst) addch(tp.t_pos.y, tp.t_pos.x, tp.t_type, true);
  }
  msg('Everything looks SO boring now.');
});

export const visuals_d = register('visuals', function visuals() { W.visuals(); });

export const land = register('land', function land() {
  S.player.t_flags &= ~D.ISLEVIT;
  msg(choose_str("bummer!  You've hit the ground", 'you float gently to the ground'));
  emit('status_fx', { kind: 'land' });
});

// turn_see used as a fuse callback
export const turn_see_fuse = register('turn_see', function turn_see(arg) { W.turn_see(!!arg); });
