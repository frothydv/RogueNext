// The command loop and player movement (command.c, move.c, main.c) plus game setup.
import * as D from './data.js';
import {
  S, rnd, roll, chat, setchat, flat, setflat, INDEX, moat, winat, ce, cpy, on, coord, new_item,
  addch, emit, msg, addmsg, endmsg, io, isupper, isdigit, unctrl, CTRL, resetWorld, GameOver,
  clearScreen, spread, clearMsgBuf, screen,
} from './state.js';
import * as W from './world.js';
import * as I from './items.js';
import * as Dm from './daemons.js';
import * as C from './combat.js';
import * as A from './actions.js';
import * as L from './level.js';

// ---- wiring for late-bound cross references ----
Object.assign(L.X, {
  new_monster: W.new_monster, randmonster: W.randmonster, give_pack: W.give_pack,
  step_ok: W.step_ok, roomin: W.roomin, door_open: W.door_open, see_monst: W.see_monst,
  turn_see: W.turn_see, visuals: W.visuals, new_thing: I.new_thing,
});
W.wire({ new_thing: I.new_thing });
Object.assign(S, {
  fire_bolt: A.fire_bolt, attack: C.attack, rust_armor: A.rust_armor, enter_room: L.enter_room,
  death: C.death, ring_eat: I.ring_eat, status: () => emit('status', {}),
});

// ------------------------------------------------------------------ setup
export function init_player() {
  const pstats = S.player.t_stats;
  Object.assign(pstats, S.max_stats);
  S.food_left = D.HUNGERTIME;
  let obj = new_item();
  obj.o_type = D.FOOD; obj.o_count = 1;
  I.add_pack(obj, true);
  obj = new_item();
  obj.o_type = D.ARMOR; obj.o_which = D.RING_MAIL;
  obj.o_arm = D.a_class[D.RING_MAIL] - 1;
  obj.o_flags |= D.ISKNOW; obj.o_count = 1;
  S.cur_armor = obj;
  I.add_pack(obj, true);
  obj = new_item();
  I.init_weapon(obj, D.MACE);
  obj.o_hplus = 1; obj.o_dplus = 1; obj.o_flags |= D.ISKNOW;
  I.add_pack(obj, true);
  S.cur_weapon = obj;
  obj = new_item();
  I.init_weapon(obj, D.BOW);
  obj.o_hplus = 1; obj.o_flags |= D.ISKNOW;
  I.add_pack(obj, true);
  obj = new_item();
  I.init_weapon(obj, D.ARROW);
  obj.o_count = rnd(15) + 25; obj.o_flags |= D.ISKNOW;
  I.add_pack(obj, true);
}

export function newGame(opts = {}) {
  S.after = false; S.again = false; S.seenstairs = false; S.amulet = false; S.door_stop = false;
  S.firstmove = false; S.has_hit = false; S.kamikaze = false; S.move_on = false;
  S.playing = true; S.running = false; S.stat_msg = false; S.to_death = false;
  S.pack_used.fill(false);
  S.dir_ch = ''; S.huh = ''; S.runch = ''; S.take = '';
  S.last_comm = ''; S.l_last_comm = ''; S.last_dir = ''; S.l_last_dir = '';
  S.n_objs = 0; S.ntraps = 0; S.hungry_state = 0; S.inpack = 0; S.level = 1; S.max_hit = 0;
  S.max_level = 0; S.no_food = 0; S.count = 0; S.food_left = 0; S.no_command = 0; S.no_move = 0;
  S.purse = 0; S.quiet = 0; S.vf_hit = 0; S.between = 0; S.group = 2; S.turns = 0;
  S.cur_armor = null; S.cur_ring = [null, null]; S.cur_weapon = null;
  S.last_pick = null; S.l_last_pick = null; S.detect = null; S.win = false;
  S.max_stats = { s_str: 16, s_exp: 0, s_lvl: 1, s_arm: 10, s_hpt: 12, s_dmg: '1x4', s_maxhp: 12 };
  D.monsters[5].m_stats.s_dmg = '%%%x0';
  S.dnum = opts.seed !== undefined ? opts.seed : (Date.now() & 0x7fffffff);
  S.seed = S.dnum;
  clearMsgBuf();
  clearScreen();
  resetWorld();
  I.resetInfoTables();
  Dm.initDaemons();
  I.init_probs();
  init_player();
  I.init_names();
  I.init_colors();
  I.init_stones();
  I.init_materials();
  L.new_level();
  Dm.start_daemon(W.runners, 0, D.AFTER);
  Dm.start_daemon(Dm.doctor, 0, D.AFTER);
  Dm.fuse(Dm.swander, 0, spread(70), D.AFTER);
  Dm.start_daemon(Dm.stomach, 0, D.AFTER);
  cpy(S.oldpos, S.hero);
  S.oldrp = W.roomin(S.hero);
  countch = ''; direction = ''; newcount = false;
}
Dm.register('runners', W.runners);

// ------------------------------------------------------------------ traps
export function be_trapped(tc) {
  const player = S.player, pstats = player.t_stats;
  if (on(player, D.ISLEVIT)) return D.T_RUST;
  S.running = false;
  S.count = 0;
  const pp = INDEX(tc.y, tc.x);
  pp.p_ch = D.TRAP;
  const tr = pp.p_flags & D.F_TMASK;
  pp.p_flags |= D.F_SEEN;
  emit('trap', { type: tr, x: tc.x, y: tc.y });
  switch (tr) {
    case D.T_DOOR:
      S.level++;
      emit('stairs', { dir: 'fall' });
      L.new_level();
      msg('you fell into a trap!');
      break;
    case D.T_BEAR:
      S.no_move += spread(3);
      msg('you are caught in a bear trap');
      break;
    case D.T_MYST:
      switch (rnd(11)) {
        case 0: msg('you are suddenly in a parallel dimension'); break;
        case 1: msg(`the light in here suddenly seems ${D.rainbow[rnd(D.rainbow.length)]}`); break;
        case 2: msg('you feel a sting in the side of your neck'); break;
        case 3: msg('multi-colored lines swirl around you, then fade'); break;
        case 4: msg(`a ${D.rainbow[rnd(D.rainbow.length)]} light flashes in your eyes`); break;
        case 5: msg('a spike shoots past your ear!'); break;
        case 6: msg(`${D.rainbow[rnd(D.rainbow.length)]} sparks dance across your armor`); break;
        case 7: msg('you suddenly feel very thirsty'); break;
        case 8: msg('you feel time speed up suddenly'); break;
        case 9: msg('time now seems to be going slower'); break;
        case 10: msg(`you pack turns ${D.rainbow[rnd(D.rainbow.length)]}!`); break;
      }
      break;
    case D.T_SLEEP:
      S.no_command += spread(5);
      player.t_flags &= ~D.ISRUN;
      msg('a strange white mist envelops you and you fall asleep');
      break;
    case D.T_ARROW:
      if (C.swing(pstats.s_lvl - 1, pstats.s_arm, 1)) {
        pstats.s_hpt -= roll(1, 6);
        if (pstats.s_hpt <= 0) { msg('an arrow killed you'); C.death('a'); }
        else msg('oh no! An arrow shot you');
        emit('player_hurt', { kind: 'arrow' });
      } else {
        const arrow = new_item();
        I.init_weapon(arrow, D.ARROW);
        arrow.o_count = 1;
        cpy(arrow.o_pos, S.hero);
        I.fall(arrow, false);
        msg('an arrow shoots past you');
      }
      break;
    case D.T_TELEP:
      A.teleport();
      addch(tc.y, tc.x, D.TRAP);
      break;
    case D.T_DART:
      if (!C.swing(pstats.s_lvl + 1, pstats.s_arm, 1)) msg('a small dart whizzes by your ear and vanishes');
      else {
        pstats.s_hpt -= roll(1, 4);
        if (pstats.s_hpt <= 0) { msg('a poisoned dart killed you'); C.death('d'); }
        if (!W.ISWEARING(D.R_SUSTSTR) && !W.save(D.VS_POISON)) I.chg_str(-1);
        msg('a small dart just hit you in the shoulder');
        emit('player_hurt', { kind: 'dart' });
      }
      break;
    case D.T_RUST:
      msg('a gush of water hits you on the head');
      A.rust_armor(S.cur_armor);
      break;
  }
  return tr;
}

// ------------------------------------------------------------------ movement
export function do_run(ch) { S.running = true; S.after = false; S.runch = ch; }

function turn_ok(y, x) {
  const pp = INDEX(y, x);
  return pp.p_ch === D.DOOR || (pp.p_flags & (D.F_REAL | D.F_PASS)) === (D.F_REAL | D.F_PASS);
}
function turnref() {
  const pp = INDEX(S.hero.y, S.hero.x);
  if (!(pp.p_flags & D.F_SEEN)) pp.p_flags |= D.F_SEEN;
}

export function do_move(dy, dx) {
  const hero = S.hero, player = S.player;
  S.firstmove = false;
  if (S.no_move) {
    S.no_move--;
    msg('you are still stuck in the bear trap');
    emit('bump', { kind: 'trap' });
    return;
  }
  const nh = coord();
  if (on(player, D.ISHUH) && rnd(5) !== 0) {
    cpy(nh, W.rndmove(player));
    if (ce(nh, hero)) { S.after = false; S.running = false; S.to_death = false; return; }
  } else { nh.y = hero.y + dy; nh.x = hero.x + dx; }

  for (;;) {
    let ch = ' ', fl = 0, bound = false;
    if (nh.x < 0 || nh.x >= D.NUMCOLS || nh.y <= 0 || nh.y >= D.NUMLINES - 1) bound = true;
    else {
      if (!W.diag_ok(hero, nh)) { S.after = false; S.running = false; return; }
      if (S.running && ce(hero, nh)) S.after = S.running = false;
      fl = flat(nh.y, nh.x);
      ch = winat(nh.y, nh.x);
      if (!(fl & D.F_REAL) && ch === D.FLOOR) {
        if (!on(player, D.ISLEVIT)) {
          setchat(nh.y, nh.x, (ch = D.TRAP));
          setflat(nh.y, nh.x, flat(nh.y, nh.x) | D.F_REAL);
        }
      } else if (on(player, D.ISHELD) && ch !== 'F') {
        msg('you are being held');
        emit('bump', { kind: 'held' });
        return;
      }
    }
    let move_stuff = false;
    if (bound || ch === ' ' || ch === '|' || ch === '-') {
      if (S.passgo && S.running && (player.t_room.r_flags & D.ISGONE) && !on(player, D.ISBLIND)) {
        let turned = false;
        switch (S.runch) {
          case 'h': case 'l': {
            const b1 = hero.y !== 1 && turn_ok(hero.y - 1, hero.x);
            const b2 = hero.y !== D.NUMLINES - 2 && turn_ok(hero.y + 1, hero.x);
            if (!(b1 !== b2)) break;
            if (b1) { S.runch = 'k'; dy = -1; } else { S.runch = 'j'; dy = 1; }
            dx = 0; turnref(); turned = true; break;
          }
          case 'j': case 'k': {
            const b1 = hero.x !== 0 && turn_ok(hero.y, hero.x - 1);
            const b2 = hero.x !== D.NUMCOLS - 1 && turn_ok(hero.y, hero.x + 1);
            if (!(b1 !== b2)) break;
            if (b1) { S.runch = 'h'; dx = -1; } else { S.runch = 'l'; dx = 1; }
            dy = 0; turnref(); turned = true; break;
          }
        }
        if (turned) { nh.y = hero.y + dy; nh.x = hero.x + dx; continue; }
      }
      S.running = false;
      S.after = false;
      emit('bump', { kind: 'wall', dir: { x: nh.x - hero.x, y: nh.y - hero.y } });
      return;
    }
    switch (ch) {
      case D.DOOR:
        S.running = false;
        if (flat(hero.y, hero.x) & D.F_PASS) L.enter_room(nh);
        move_stuff = true;
        break;
      case D.TRAP: {
        const t = be_trapped(nh);
        if (t === D.T_DOOR || t === D.T_TELEP) return;
        move_stuff = true;
        break;
      }
      case D.PASSAGE:
        S.player.t_room = W.roomin(hero);
        move_stuff = true;
        break;
      case D.FLOOR:
        if (!(fl & D.F_REAL)) be_trapped(hero);
        move_stuff = true;
        break;
      case D.STAIRS:
        S.seenstairs = true;
      // fallthrough
      default:
        S.running = false;
        if (isupper(ch) || moat(nh.y, nh.x)) C.fight(nh, S.cur_weapon, false);
        else {
          if (ch !== D.STAIRS) S.take = ch;
          move_stuff = true;
        }
    }
    if (move_stuff) {
      addch(hero.y, hero.x, W.floor_at());
      if ((fl & D.F_PASS) && chat(S.oldpos.y, S.oldpos.x) === D.DOOR) L.leave_room(nh);
      const from = coord(hero.x, hero.y);
      cpy(hero, nh);
      emit('hero_move', { from, to: coord(hero.x, hero.y) });
    }
    return;
  }
}

// ------------------------------------------------------------------ the command loop
let countch = '', direction = '', newcount = false;

const readchar = async () => {
  const c = await io.readchar();
  return c;
};

export async function command() {
  const player = S.player, hero = S.hero;
  let ntimes = 1;
  if (on(player, D.ISHASTE)) ntimes++;
  Dm.do_daemons(D.BEFORE);
  Dm.do_fuses(D.BEFORE);
  while (ntimes--) {
    S.again = false;
    if (S.has_hit) { endmsg(); S.has_hit = false; }
    W.look(true);
    if (!S.running) S.door_stop = false;
    S.status();
    S.take = '';
    S.after = true;
    let ch;
    if (!S.no_command) {
      if (S.running || S.to_death) ch = S.runch;
      else if (S.count) ch = countch;
      else { ch = await readchar(); S.move_on = false; }
    } else ch = '.';
    if (S.no_command) {
      if (--S.no_command === 0) { player.t_flags |= D.ISRUN; msg('you can move again'); emit('status_fx', { kind: 'wake' }); }
      emit('sleeping', {});
    } else {
      newcount = false;
      if (isdigit(ch)) {
        S.count = 0;
        newcount = true;
        while (isdigit(ch)) {
          S.count = S.count * 10 + (ch.charCodeAt(0) - 48);
          if (S.count > 255) S.count = 255;
          emit('count', { count: S.count });
          ch = await readchar();
        }
        countch = ch;
        switch (ch) {
          case CTRL('B'): case CTRL('H'): case CTRL('J'): case CTRL('K'): case CTRL('L'):
          case CTRL('N'): case CTRL('U'): case CTRL('Y'):
          case '.': case 'a': case 'b': case 'h': case 'j': case 'k': case 'l': case 'm': case 'n':
          case 'q': case 'r': case 's': case 't': case 'u': case 'y': case 'z': case 'B': case 'C':
          case 'H': case 'I': case 'J': case 'K': case 'L': case 'N': case 'U': case 'Y':
            break;
          default: S.count = 0;
        }
        emit('count', { count: 0 });
      }
      if (S.count && !S.running) S.count--;
      if (ch !== 'a' && ch !== D.ESCAPE && !(S.running || S.count || S.to_death)) {
        S.l_last_comm = S.last_comm;
        S.l_last_dir = S.last_dir;
        S.l_last_pick = S.last_pick;
        S.last_comm = ch;
        S.last_dir = '';
        S.last_pick = null;
      }
      over:
      for (;;) {
        switch (ch) {
          case ',': {
            const obj = S.lvl_obj.find((o) => o.o_pos.y === hero.y && o.o_pos.x === hero.x);
            if (obj) { if (!A.levit_check()) I.pick_up(obj.o_type); }
            else {
              if (!S.terse) addmsg('there is ');
              addmsg('nothing here');
              if (!S.terse) addmsg(' to pick up');
              endmsg();
            }
            break;
          }
          case '!': msg('there is no shell to escape to in the dungeon'); S.after = false; break;
          case 'h': do_move(0, -1); break;
          case 'j': do_move(1, 0); break;
          case 'k': do_move(-1, 0); break;
          case 'l': do_move(0, 1); break;
          case 'y': do_move(-1, -1); break;
          case 'u': do_move(-1, 1); break;
          case 'b': do_move(1, -1); break;
          case 'n': do_move(1, 1); break;
          case 'H': do_run('h'); break;
          case 'J': do_run('j'); break;
          case 'K': do_run('k'); break;
          case 'L': do_run('l'); break;
          case 'Y': do_run('y'); break;
          case 'U': do_run('u'); break;
          case 'B': do_run('b'); break;
          case 'N': do_run('n'); break;
          case CTRL('H'): case CTRL('J'): case CTRL('K'): case CTRL('L'):
          case CTRL('Y'): case CTRL('U'): case CTRL('B'): case CTRL('N'):
            if (!on(player, D.ISBLIND)) { S.door_stop = true; S.firstmove = true; }
            if (S.count && !newcount) ch = direction;
            else {
              ch = String.fromCharCode(ch.charCodeAt(0) + ('A'.charCodeAt(0) - 1));
              direction = ch;
            }
            continue over;
          case 'F':
            S.kamikaze = true;
          // fallthrough
          case 'f': {
            if (!(await I.get_dir())) { S.after = false; break; }
            S.delta.y += hero.y;
            S.delta.x += hero.x;
            const mp = moat(S.delta.y, S.delta.x);
            if (mp === null || (!W.see_monst(mp) && !on(player, D.SEEMONST))) {
              if (!S.terse) addmsg('I see ');
              msg('no monster there');
              S.after = false;
            } else if (W.diag_ok(hero, S.delta)) {
              S.to_death = true;
              S.max_hit = 0;
              mp.t_flags |= D.ISTARGET;
              S.runch = ch = S.dir_ch;
              continue over;
            }
            break;
          }
          case 't':
            if (!(await I.get_dir())) S.after = false;
            else await A.missile(S.delta.y, S.delta.x);
            break;
          case 'a':
            if (S.last_comm === '') { msg("you haven't typed a command yet"); S.after = false; }
            else { ch = S.last_comm; S.again = true; continue over; }
            break;
          case 'q': await A.quaff(); break;
          case 'Q':
            S.after = false;
            S.q_comm = true;
            await quit();
            S.q_comm = false;
            break;
          case 'i': S.after = false; await I.inventory(player.t_pack, 0); break;
          case 'I': S.after = false; await I.picky_inven(); break;
          case 'd': await A.drop(); break;
          case 'r': await A.read_scroll(); break;
          case 'e': await A.eat(); break;
          case 'w': await A.wield(); break;
          case 'W': await A.wear(); break;
          case 'T': await A.take_off(); break;
          case 'P': await A.ring_on(); break;
          case 'R': await A.ring_off(); break;
          case 'o': await io.options(); S.after = false; break;
          case 'c': await A.call(); S.after = false; break;
          case '>': S.after = false; A.d_level(); break;
          case '<': S.after = false; A.u_level(); break;
          case '?': S.after = false; await help(); break;
          case '/': S.after = false; await identify(); break;
          case 's': A.search(); break;
          case 'z':
            if (await I.get_dir()) await A.do_zap();
            else S.after = false;
            break;
          case 'D': S.after = false; await io.showDiscoveries(discoveries()); break;
          case CTRL('P'): S.after = false; msg(S.huh); break;
          case CTRL('R'): S.after = false; emit('redraw', {}); break;
          case 'v': S.after = false; msg('The Amulet of Yendor 1.0.0 — rules of Rogue version 5.4.4. (mctesq was here)'); break;
          case 'S': S.after = false; await io.saveGame(); break;
          case '.': break;
          case ' ': S.after = false; break;
          case '^':
            S.after = false;
            if (await I.get_dir()) {
              S.delta.y += hero.y;
              S.delta.x += hero.x;
              const pp = INDEX(S.delta.y, S.delta.x);
              if (!S.terse) addmsg('You have found ');
              if (chat(S.delta.y, S.delta.x) !== D.TRAP) msg('no trap there');
              else if (on(player, D.ISHALU)) msg(D.tr_name[rnd(D.NTRAPS)]);
              else { msg(D.tr_name[pp.p_flags & D.F_TMASK]); pp.p_flags |= D.F_SEEN; }
            }
            break;
          case D.ESCAPE:
            S.door_stop = false;
            S.count = 0;
            S.after = false;
            S.again = false;
            S.running = false;
            S.to_death = false;
            break;
          case 'm':
            S.move_on = true;
            if (!(await I.get_dir())) S.after = false;
            else { ch = S.dir_ch; countch = S.dir_ch; continue over; }
            break;
          case ')': A.current(S.cur_weapon, 'wielding', null); break;
          case ']': A.current(S.cur_armor, 'wearing', null); break;
          case '=':
            A.current(S.cur_ring[D.LEFT], 'wearing', S.terse ? '(L)' : 'on left hand');
            A.current(S.cur_ring[D.RIGHT], 'wearing', S.terse ? '(R)' : 'on right hand');
            break;
          case '@': S.after = false; emit('show_stats', {}); stat_msg(); break;
          default:
            S.after = false;
            S.save_msg = false;
            S.count = 0;
            msg(`illegal command '${unctrl(ch)}'`);
            S.save_msg = true;
        }
        break;
      }
      if (!S.running) S.door_stop = false;
    }
    if (S.take !== '') I.pick_up(S.take);
    if (!S.running) S.door_stop = false;
    if (!S.after) ntimes++;
  }
  Dm.do_daemons(D.AFTER);
  Dm.do_fuses(D.AFTER);
  if (W.ISRING(D.LEFT, D.R_SEARCH)) A.search();
  else if (W.ISRING(D.LEFT, D.R_TELEPORT) && rnd(50) === 0) A.teleport();
  if (W.ISRING(D.RIGHT, D.R_SEARCH)) A.search();
  else if (W.ISRING(D.RIGHT, D.R_TELEPORT) && rnd(50) === 0) A.teleport();
  S.turns++;
}

export function stat_msg() {
  const p = S.player.t_stats;
  const arm = S.cur_armor !== null ? S.cur_armor.o_arm : p.s_arm;
  const names = ['', 'Hungry', 'Weak', 'Faint'];
  msg(`Level: ${S.level}  Gold: ${S.purse}  Hp: ${p.s_hpt}(${p.s_maxhp})  Str: ${p.s_str}(${S.max_stats.s_str})  Arm: ${10 - arm}  Exp: ${p.s_lvl}/${p.s_exp}  ${names[S.hungry_state]}`);
}

export async function quit() {
  msg('really quit?');
  emit('confirm', { text: 'Really quit?', keys: 'y' });
  const c = await io.readchar();
  emit('confirm_end', {});
  if (c === 'y') throw new GameOver('quit', { purse: S.purse });
  msg('');
  S.count = 0;
  S.to_death = false;
}

async function help() {
  msg('character you want help for (* for all): ');
  emit('help_prompt', { active: true });
  const helpch = await io.readchar();
  emit('help_prompt', { active: false });
  if (helpch !== '*') {
    const key = helpch.charCodeAt(0) < 32 ? (helpch === D.ESCAPE ? 'ESC' : '^' + String.fromCharCode(helpch.charCodeAt(0) + 64)) : helpch;
    for (const h of D.helpstr)
      if (h.h_ch === key) {
        S.lower_msg = true;
        msg(`${h.h_ch}  ${h.h_desc}`);
        S.lower_msg = false;
        return;
      }
    msg(`unknown character '${unctrl(helpch)}'`);
    return;
  }
  await io.showHelp();
}

async function identify() {
  msg('what do you want identified? ');
  emit('help_prompt', { active: true, identify: true });
  const ch = await io.readchar();
  emit('help_prompt', { active: false });
  if (ch === D.ESCAPE) { msg(''); return; }
  let str;
  if (isupper(ch)) str = D.monsters[ch.charCodeAt(0) - 65].m_name;
  else str = D.ident_list[ch] || 'unknown character';
  msg(`'${unctrl(ch)}': ${str}`);
}

// set_order: the original lists discoveries in a shuffled order, so the order of the entries
// gives nothing away about which "called" guess is which (and it draws from the game's RNG)
function set_order(n) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n; i > 0; i--) {
    const r = rnd(i);
    const t = order[i - 1]; order[i - 1] = order[r]; order[r] = t;
  }
  return order;
}

// the 'D' list for '*' (every type, in the original's order)
export function discoveries() {
  const sets = [
    ['Potions', D.POTION, D.pot_info, D.MAXPOTIONS],
    ['Scrolls', D.SCROLL, D.scr_info, D.MAXSCROLLS],
    ['Rings', D.RING, D.ring_info, D.MAXRINGS],
    ['Wands & Staves', D.STICK, D.ws_info, D.MAXSTICKS],
  ];
  const out = [];
  for (const [title, type, info, n] of sets) {
    const items = [];
    for (const i of set_order(n))
      if (info[i].oi_know || info[i].oi_guess) {
        const o = new_item();
        o.o_type = type; o.o_which = i; o.o_count = 1; o.o_flags = 0;
        const save = S.inv_describe;
        S.inv_describe = false;
        items.push({ which: i, text: I.inv_name(o, false), known: info[i].oi_know });
        S.inv_describe = save;
      }
    out.push({ title, type, items, total: n });
  }
  return out;
}

export async function playit() {
  while (S.playing) {
    await command();
    await io.afterCommand();
  }
}
