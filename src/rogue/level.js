// Level generation: rooms, mazes, passages, traps, objects. Ported from rooms.c,
// passages.c and new_level.c.
import * as D from './data.js';
import {
  S, rnd, roll, chat, setchat, flat, setflat, INDEX, moat, setmoat, ce, cpy, on, new_item,
  coord, clearScreen, addch, inch, emit, isupper,
} from './state.js';

// late-bound cross module functions (avoids circular import ordering issues)
export const X = {};

const { NUMCOLS, NUMLINES, MAXROOMS, ISGONE, ISDARK, ISMAZE, F_REAL, F_PASS, F_PNUM, GOLD } = D;

// ---------------------------------------------------------------- rooms
export function do_rooms() {
  const bsze = coord(Math.trunc(NUMCOLS / 3), Math.trunc(NUMLINES / 3));
  for (const rp of S.rooms) { rp.r_goldval = 0; rp.r_nexits = 0; rp.r_flags = 0; }
  const left_out = rnd(4);
  for (let i = 0; i < left_out; i++) S.rooms[rnd_room()].r_flags |= ISGONE;
  for (let i = 0; i < MAXROOMS; i++) {
    const rp = S.rooms[i];
    const top = coord((i % 3) * bsze.x + 1, Math.trunc(i / 3) * bsze.y);
    if (rp.r_flags & ISGONE) {
      do {
        rp.r_pos.x = top.x + rnd(bsze.x - 2) + 1;
        rp.r_pos.y = top.y + rnd(bsze.y - 2) + 1;
        rp.r_max.x = -NUMCOLS;
        rp.r_max.y = -NUMLINES;
      } while (!(rp.r_pos.y > 0 && rp.r_pos.y < NUMLINES - 1));
      continue;
    }
    if (rnd(10) < S.level - 1) {
      rp.r_flags |= ISDARK;
      if (rnd(15) === 0) rp.r_flags = ISMAZE;
    }
    if (rp.r_flags & ISMAZE) {
      rp.r_max.x = bsze.x - 1;
      rp.r_max.y = bsze.y - 1;
      if ((rp.r_pos.x = top.x) === 1) rp.r_pos.x = 0;
      if ((rp.r_pos.y = top.y) === 0) { rp.r_pos.y++; rp.r_max.y--; }
    } else {
      do {
        rp.r_max.x = rnd(bsze.x - 4) + 4;
        rp.r_max.y = rnd(bsze.y - 4) + 4;
        rp.r_pos.x = top.x + rnd(bsze.x - rp.r_max.x);
        rp.r_pos.y = top.y + rnd(bsze.y - rp.r_max.y);
      } while (rp.r_pos.y === 0);
    }
    draw_room(rp);
    if (rnd(2) === 0 && (!S.amulet || S.level >= S.max_level)) {
      const gold = new_item();
      gold.o_arm = rp.r_goldval = GOLDCALC();
      find_floor(rp, rp.r_gold, 0, false);
      cpy(gold.o_pos, rp.r_gold);
      setchat(rp.r_gold.y, rp.r_gold.x, GOLD);
      gold.o_flags = D.ISMANY;
      gold.o_group = 1;
      gold.o_type = GOLD;
      S.lvl_obj.unshift(gold);
    }
    if (rnd(100) < (rp.r_goldval > 0 ? 80 : 25)) {
      const tp = new_item();
      const mp = coord();
      find_floor(rp, mp, 0, true);
      X.new_monster(tp, X.randmonster(false), mp);
      X.give_pack(tp);
    }
  }
}

export const GOLDCALC = () => rnd(50 + 10 * S.level) + 2;

export function draw_room(rp) {
  if (rp.r_flags & ISMAZE) do_maze(rp);
  else {
    vert(rp, rp.r_pos.x);
    vert(rp, rp.r_pos.x + rp.r_max.x - 1);
    horiz(rp, rp.r_pos.y);
    horiz(rp, rp.r_pos.y + rp.r_max.y - 1);
    for (let y = rp.r_pos.y + 1; y < rp.r_pos.y + rp.r_max.y - 1; y++)
      for (let x = rp.r_pos.x + 1; x < rp.r_pos.x + rp.r_max.x - 1; x++) setchat(y, x, D.FLOOR);
  }
}
function vert(rp, startx) {
  for (let y = rp.r_pos.y + 1; y <= rp.r_max.y + rp.r_pos.y - 1; y++) setchat(y, startx, '|');
}
function horiz(rp, starty) {
  for (let x = rp.r_pos.x; x <= rp.r_pos.x + rp.r_max.x - 1; x++) setchat(starty, x, '-');
}

// ---------------------------------------------------------------- maze
let Maxy, Maxx, Starty, Startx;
const maze = Array.from({ length: Math.trunc(NUMLINES / 3) + 2 }, () =>
  Array.from({ length: Math.trunc(NUMCOLS / 3) + 2 }, () => ({ nexits: 0, exits: [], used: false })));

function do_maze(rp) {
  for (const row of maze) for (const sp of row) { sp.used = false; sp.nexits = 0; sp.exits = []; }
  Maxy = rp.r_max.y; Maxx = rp.r_max.x; Starty = rp.r_pos.y; Startx = rp.r_pos.x;
  const starty = Math.trunc(rnd(rp.r_max.y) / 2) * 2;
  const startx = Math.trunc(rnd(rp.r_max.x) / 2) * 2;
  putpass(coord(startx + Startx, starty + Starty));
  dig(starty, startx);
}

const mazeDel = [[2, 0], [-2, 0], [0, 2], [0, -2]];
function dig(y, x) {
  for (;;) {
    let cnt = 0, nexty = 0, nextx = 0;
    for (const [dy, dx] of mazeDel) {
      const newy = y + dy, newx = x + dx;
      if (newy < 0 || newy > Maxy || newx < 0 || newx > Maxx) continue;
      if (flat(newy + Starty, newx + Startx) & F_PASS) continue;
      if (rnd(++cnt) === 0) { nexty = newy; nextx = newx; }
    }
    if (cnt === 0) return;
    accnt_maze(y, x, nexty, nextx);
    accnt_maze(nexty, nextx, y, x);
    const pos = coord();
    if (nexty === y) {
      pos.y = y + Starty;
      pos.x = nextx - x < 0 ? nextx + Startx + 1 : nextx + Startx - 1;
    } else {
      pos.x = x + Startx;
      pos.y = nexty - y < 0 ? nexty + Starty + 1 : nexty + Starty - 1;
    }
    putpass(pos);
    putpass(coord(nextx + Startx, nexty + Starty));
    dig(nexty, nextx);
  }
}
function accnt_maze(y, x, ny, nx) {
  const sp = maze[y][x];
  for (const cp of sp.exits) if (cp.y === ny && cp.x === nx) return;
  sp.exits.push(coord(nx, ny));
  sp.nexits++;
}

export function rnd_pos(rp, cp) {
  cp.x = rp.r_pos.x + rnd(rp.r_max.x - 2) + 1;
  cp.y = rp.r_pos.y + rnd(rp.r_max.y - 2) + 1;
}

export function find_floor(rp, cp, limit, monst) {
  const pickroom = rp === null;
  let compchar = '';
  if (!pickroom) compchar = rp.r_flags & ISMAZE ? D.PASSAGE : D.FLOOR;
  let cnt = limit;
  for (;;) {
    if (limit && cnt-- === 0) return false;
    if (pickroom) {
      rp = S.rooms[rnd_room()];
      compchar = rp.r_flags & ISMAZE ? D.PASSAGE : D.FLOOR;
    }
    rnd_pos(rp, cp);
    const pp = INDEX(cp.y, cp.x);
    if (monst) {
      if (pp.p_monst === null && X.step_ok(pp.p_ch)) return true;
    } else if (pp.p_ch === compchar) return true;
  }
}

// enter_room: reveal a lit room to the screen memory
export function enter_room(cp) {
  const rp = (S.player.t_room = X.roomin(cp));
  X.door_open(rp);
  if (!(rp.r_flags & ISDARK) && !on(S.player, D.ISBLIND)) {
    for (let y = rp.r_pos.y; y < rp.r_max.y + rp.r_pos.y; y++)
      for (let x = rp.r_pos.x; x < rp.r_max.x + rp.r_pos.x; x++) {
        const tp = moat(y, x);
        const ch = chat(y, x);
        if (tp === null) {
          addch(y, x, ch);
        } else {
          tp.t_oldch = ch;
          if (!X.see_monst(tp)) {
            if (on(S.player, D.SEEMONST)) addch(y, x, tp.t_disguise, true);
            else addch(y, x, ch);
          } else addch(y, x, tp.t_disguise);
        }
      }
  }
  emit('enter_room', { room: rp });
}

export function leave_room(cp) {
  const rp = S.player.t_room;
  if (rp.r_flags & ISMAZE) return;
  let floor;
  if (rp.r_flags & ISGONE) floor = D.PASSAGE;
  else if (!(rp.r_flags & ISDARK) || on(S.player, D.ISBLIND)) floor = D.FLOOR;
  else floor = ' ';
  S.player.t_room = S.passages[flat(cp.y, cp.x) & F_PNUM];
  for (let y = rp.r_pos.y; y < rp.r_max.y + rp.r_pos.y; y++)
    for (let x = rp.r_pos.x; x < rp.r_max.x + rp.r_pos.x; x++) {
      const ch = inch(y, x);
      if (ch === D.FLOOR) {
        // floors are remembered by our presentation; the original blanks dark rooms
        if (floor === ' ' && ch !== ' ') addch(y, x, ' ');
      } else if (isupper(ch)) {
        if (on(S.player, D.SEEMONST)) { addch(y, x, ch, true); continue; }
        const pp = INDEX(y, x);
        addch(y, x, pp.p_ch === D.DOOR ? D.DOOR : floor);
      }
    }
  X.door_open(rp);
}

// ---------------------------------------------------------------- passages
const rdesConn = [
  [0, 1, 0, 1, 0, 0, 0, 0, 0], [1, 0, 1, 0, 1, 0, 0, 0, 0], [0, 1, 0, 0, 0, 1, 0, 0, 0],
  [1, 0, 0, 0, 1, 0, 1, 0, 0], [0, 1, 0, 1, 0, 1, 0, 1, 0], [0, 0, 1, 0, 1, 0, 0, 0, 1],
  [0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 0, 0, 0, 1, 0, 1, 0, 1], [0, 0, 0, 0, 0, 1, 0, 1, 0],
];

export function do_passages() {
  const rdes = rdesConn.map((conn) => ({ conn, isconn: new Array(9).fill(false), ingraph: false }));
  let roomcount = 1;
  let r1 = rdes[rnd(MAXROOMS)];
  let r2 = null;
  r1.ingraph = true;
  do {
    let j = 0;
    for (let i = 0; i < MAXROOMS; i++)
      if (r1.conn[i] && !rdes[i].ingraph && rnd(++j) === 0) r2 = rdes[i];
    if (j === 0) {
      do r1 = rdes[rnd(MAXROOMS)]; while (!r1.ingraph);
    } else {
      r2.ingraph = true;
      const i = rdes.indexOf(r1), jj = rdes.indexOf(r2);
      conn(i, jj);
      r1.isconn[jj] = true;
      r2.isconn[i] = true;
      roomcount++;
    }
  } while (roomcount < MAXROOMS);

  for (roomcount = rnd(5); roomcount > 0; roomcount--) {
    r1 = rdes[rnd(MAXROOMS)];
    let j = 0;
    for (let i = 0; i < MAXROOMS; i++)
      if (r1.conn[i] && !r1.isconn[i] && rnd(++j) === 0) r2 = rdes[i];
    if (j !== 0) {
      const i = rdes.indexOf(r1), jj = rdes.indexOf(r2);
      conn(i, jj);
      r1.isconn[jj] = true;
      r2.isconn[i] = true;
    }
  }
  passnum();
}

function conn(r1, r2) {
  let rm, direc, rpf, rpt, rmt;
  let distance = 0, turn_spot, turn_distance = 0;
  const del = coord(), curr = coord(), turn_delta = coord(), spos = coord(), epos = coord();
  if (r1 < r2) { rm = r1; direc = r1 + 1 === r2 ? 'r' : 'd'; }
  else { rm = r2; direc = r2 + 1 === r1 ? 'r' : 'd'; }
  rpf = S.rooms[rm];
  if (direc === 'd') {
    rmt = rm + 3; rpt = S.rooms[rmt];
    del.x = 0; del.y = 1;
    spos.x = rpf.r_pos.x; spos.y = rpf.r_pos.y;
    epos.x = rpt.r_pos.x; epos.y = rpt.r_pos.y;
    if (!(rpf.r_flags & ISGONE))
      do {
        spos.x = rpf.r_pos.x + rnd(rpf.r_max.x - 2) + 1;
        spos.y = rpf.r_pos.y + rpf.r_max.y - 1;
      } while ((rpf.r_flags & ISMAZE) && !(flat(spos.y, spos.x) & F_PASS));
    if (!(rpt.r_flags & ISGONE))
      do {
        epos.x = rpt.r_pos.x + rnd(rpt.r_max.x - 2) + 1;
      } while ((rpt.r_flags & ISMAZE) && !(flat(epos.y, epos.x) & F_PASS));
    distance = Math.abs(spos.y - epos.y) - 1;
    turn_delta.y = 0;
    turn_delta.x = spos.x < epos.x ? 1 : -1;
    turn_distance = Math.abs(spos.x - epos.x);
  } else {
    rmt = rm + 1; rpt = S.rooms[rmt];
    del.x = 1; del.y = 0;
    spos.x = rpf.r_pos.x; spos.y = rpf.r_pos.y;
    epos.x = rpt.r_pos.x; epos.y = rpt.r_pos.y;
    if (!(rpf.r_flags & ISGONE))
      do {
        spos.x = rpf.r_pos.x + rpf.r_max.x - 1;
        spos.y = rpf.r_pos.y + rnd(rpf.r_max.y - 2) + 1;
      } while ((rpf.r_flags & ISMAZE) && !(flat(spos.y, spos.x) & F_PASS));
    if (!(rpt.r_flags & ISGONE))
      do {
        epos.y = rpt.r_pos.y + rnd(rpt.r_max.y - 2) + 1;
      } while ((rpt.r_flags & ISMAZE) && !(flat(epos.y, epos.x) & F_PASS));
    distance = Math.abs(spos.x - epos.x) - 1;
    turn_delta.y = spos.y < epos.y ? 1 : -1;
    turn_delta.x = 0;
    turn_distance = Math.abs(spos.y - epos.y);
  }
  turn_spot = rnd(distance - 1) + 1;
  if (!(rpf.r_flags & ISGONE)) door(rpf, spos); else putpass(spos);
  if (!(rpt.r_flags & ISGONE)) door(rpt, epos); else putpass(epos);
  curr.x = spos.x; curr.y = spos.y;
  while (distance > 0) {
    curr.x += del.x; curr.y += del.y;
    if (distance === turn_spot)
      while (turn_distance--) {
        putpass(curr);
        curr.x += turn_delta.x; curr.y += turn_delta.y;
      }
    putpass(curr);
    distance--;
  }
  curr.x += del.x; curr.y += del.y;
}

export function putpass(cp) {
  const pp = INDEX(cp.y, cp.x);
  pp.p_flags |= F_PASS;
  if (rnd(10) + 1 < S.level && rnd(40) === 0) pp.p_flags &= ~F_REAL;
  else pp.p_ch = D.PASSAGE;
}

function door(rm, cp) {
  const e = rm.r_exit[rm.r_nexits++];
  e.x = cp.x; e.y = cp.y;
  if (rm.r_flags & ISMAZE) return;
  const pp = INDEX(cp.y, cp.x);
  if (rnd(10) + 1 < S.level && rnd(5) === 0) {
    pp.p_ch = cp.y === rm.r_pos.y || cp.y === rm.r_pos.y + rm.r_max.y - 1 ? '-' : '|';
    pp.p_flags &= ~F_REAL;
  } else pp.p_ch = D.DOOR;
}

let pnum, newpnum;
function passnum() {
  pnum = 0;
  newpnum = false;
  for (const rp of S.passages) rp.r_nexits = 0;
  for (const rp of S.rooms)
    for (let i = 0; i < rp.r_nexits; i++) {
      newpnum = true;
      numpass(rp.r_exit[i].y, rp.r_exit[i].x);
    }
}
function numpass(y, x) {
  if (x >= NUMCOLS || x < 0 || y >= NUMLINES || y <= 0) return;
  const pp = INDEX(y, x);
  if (pp.p_flags & F_PNUM) return;
  if (newpnum) { pnum++; newpnum = false; }
  const ch = pp.p_ch;
  if (ch === D.DOOR || (!(pp.p_flags & F_REAL) && (ch === '|' || ch === '-'))) {
    const rp = S.passages[pnum];
    const e = rp.r_exit[rp.r_nexits++];
    e.y = y; e.x = x;
  } else if (!(pp.p_flags & F_PASS)) return;
  pp.p_flags |= pnum;
  numpass(y + 1, x);
  numpass(y - 1, x);
  numpass(y, x + 1);
  numpass(y, x - 1);
}

// ---------------------------------------------------------------- new level
export function new_level() {
  S.player.t_flags &= ~D.ISHELD;
  if (S.level > S.max_level) S.max_level = S.level;
  for (const pp of S.places) { pp.p_ch = ' '; pp.p_flags = F_REAL; pp.p_monst = null; }
  clearScreen();
  S.mlist = [];
  S.lvl_obj = [];
  for (const rp of S.rooms) { rp.r_flags = 0; rp.r_goldval = 0; rp.r_nexits = 0; }
  for (const pa of S.passages) { pa.r_nexits = 0; }
  do_rooms();
  do_passages();
  S.no_food++;
  put_things();
  if (rnd(10) < S.level) {
    S.ntraps = rnd(Math.trunc(S.level / 4)) + 1;
    if (S.ntraps > D.MAXTRAPS) S.ntraps = D.MAXTRAPS;
    let i = S.ntraps;
    while (i--) {
      do find_floor(null, S.stairs, 0, false);
      while (chat(S.stairs.y, S.stairs.x) !== D.FLOOR);
      const pp = INDEX(S.stairs.y, S.stairs.x);
      pp.p_flags &= ~F_REAL;
      pp.p_flags |= rnd(D.NTRAPS);
    }
  }
  find_floor(null, S.stairs, 0, false);
  setchat(S.stairs.y, S.stairs.x, D.STAIRS);
  S.seenstairs = false;
  for (const tp of S.mlist) tp.t_room = X.roomin(tp.t_pos);
  find_floor(null, S.hero, 0, true);
  enter_room(S.hero);
  addch(S.hero.y, S.hero.x, D.PLAYER);
  if (on(S.player, D.SEEMONST)) X.turn_see(false);
  if (on(S.player, D.ISHALU)) X.visuals();
  emit('new_level', { level: S.level });
}

export function rnd_room() {
  let rm;
  do rm = rnd(MAXROOMS); while (S.rooms[rm].r_flags & ISGONE);
  return rm;
}

function put_things() {
  if (S.amulet && S.level < S.max_level) return;
  if (rnd(20) === 0) treas_room();
  for (let i = 0; i < D.MAXOBJ; i++)
    if (rnd(100) < 36) {
      const obj = X.new_thing();
      S.lvl_obj.unshift(obj);
      find_floor(null, obj.o_pos, 0, false);
      setchat(obj.o_pos.y, obj.o_pos.x, obj.o_type);
    }
  if (S.level >= D.AMULETLEVEL && !S.amulet) {
    const obj = new_item();
    S.lvl_obj.unshift(obj);
    obj.o_hplus = 0; obj.o_dplus = 0;
    obj.o_damage = '0x0'; obj.o_hurldmg = '0x0';
    obj.o_arm = 11;
    obj.o_type = D.AMULET;
    find_floor(null, obj.o_pos, 0, false);
    setchat(obj.o_pos.y, obj.o_pos.x, D.AMULET);
  }
}

function treas_room() {
  const rp = S.rooms[rnd_room()];
  let spots = (rp.r_max.y - 2) * (rp.r_max.x - 2) - 2;
  if (spots > 10 - 2) spots = 10 - 2;
  let nm = rnd(spots) + 2;
  const num_monst = nm;
  const mp = coord();
  while (nm--) {
    find_floor(rp, mp, 2 * 10, false);
    const tp = X.new_thing();
    cpy(tp.o_pos, mp);
    S.lvl_obj.unshift(tp);
    setchat(mp.y, mp.x, tp.o_type);
  }
  if ((nm = rnd(spots) + 2) < num_monst + 2) nm = num_monst + 2;
  spots = (rp.r_max.y - 2) * (rp.r_max.x - 2);
  if (nm > spots) nm = spots;
  S.level++;
  while (nm--) {
    if (find_floor(rp, mp, 10, true)) {
      const tp = new_item();
      X.new_monster(tp, X.randmonster(false), mp);
      tp.t_flags |= D.ISMEAN;
      X.give_pack(tp);
    }
  }
  S.level--;
}
