// Objects: naming, creation, pack management. Ported from things.c, pack.c,
// weapons.c (init_weapon), armor.c and parts of misc.c.
import * as D from './data.js';
import {
  S, rnd, roll, chat, setchat, flat, setflat, INDEX, ce, cpy, on, new_item, coord,
  addch, emit, msg, addmsg, endmsg, io, vowelstr, isupper, unctrl,
} from './state.js';
import * as W from './world.js';
import { GOLDCALC } from './level.js';

const { POTION, SCROLL, FOOD, WEAPON, ARMOR, RING, STICK, AMULET, GOLD } = D;

// --------------------------------------------------------------- tables
let base = null;
export function resetInfoTables() {
  const all = [D.things, D.arm_info, D.pot_info, D.ring_info, D.scr_info, D.weap_info, D.ws_info];
  if (!base) base = all.map((t) => t.map((o) => [o.oi_prob, o.oi_worth]));
  all.forEach((t, ti) => t.forEach((o, i) => {
    o.oi_prob = base[ti][i][0]; o.oi_worth = base[ti][i][1]; o.oi_guess = null; o.oi_know = false;
  }));
}

function sumprobs(info, bound) {
  for (let i = 1; i < bound; i++) info[i].oi_prob += info[i - 1].oi_prob;
}
export function init_probs() {
  sumprobs(D.things, D.NUMTHINGS);
  sumprobs(D.pot_info, D.MAXPOTIONS);
  sumprobs(D.scr_info, D.MAXSCROLLS);
  sumprobs(D.ring_info, D.MAXRINGS);
  sumprobs(D.ws_info, D.MAXSTICKS);
  sumprobs(D.weap_info, D.MAXWEAPONS);
  sumprobs(D.arm_info, D.MAXARMORS);
}

export function init_colors() {
  const used = new Array(D.rainbow.length).fill(false);
  for (let i = 0; i < D.MAXPOTIONS; i++) {
    let j;
    do j = rnd(D.rainbow.length); while (used[j]);
    used[j] = true;
    S.p_colors[i] = D.rainbow[j];
  }
}
export function init_names() {
  for (let i = 0; i < D.MAXSCROLLS; i++) {
    let buf = '';
    let nwords = rnd(3) + 2;
    while (nwords--) {
      let nsyl = rnd(3) + 1;
      while (nsyl--) {
        const sp = D.sylls[rnd(D.sylls.length)];
        if (buf.length + sp.length > 40) break;
        buf += sp;
      }
      buf += ' ';
    }
    S.s_names[i] = buf.slice(0, -1);
  }
}
export function init_stones() {
  const used = new Array(D.stones.length).fill(false);
  for (let i = 0; i < D.MAXRINGS; i++) {
    let j;
    do j = rnd(D.stones.length); while (used[j]);
    used[j] = true;
    S.r_stones[i] = D.stones[j].st_name;
    D.ring_info[i].oi_worth += D.stones[j].st_value;
  }
}
export function init_materials() {
  const used = new Array(D.wood.length).fill(false);
  const metused = new Array(D.metal.length).fill(false);
  for (let i = 0; i < D.MAXSTICKS; i++) {
    let str;
    for (;;) {
      if (rnd(2) === 0) {
        const j = rnd(D.metal.length);
        if (!metused[j]) { S.ws_type[i] = 'wand'; str = D.metal[j]; metused[j] = true; break; }
      } else {
        const j = rnd(D.wood.length);
        if (!used[j]) { S.ws_type[i] = 'staff'; str = D.wood[j]; used[j] = true; break; }
      }
    }
    S.ws_made[i] = str;
  }
}
export const pick_color = (col) => (on(S.player, D.ISHALU) ? D.rainbow[rnd(D.rainbow.length)] : col);

// --------------------------------------------------------------- naming
export function num(n1, n2, type) {
  let s = n1 < 0 ? `${n1}` : `+${n1}`;
  if (type === WEAPON) s += n2 < 0 ? `,${n2}` : `,+${n2}`;
  return s;
}

export function ring_num(obj) {
  if (!(obj.o_flags & D.ISKNOW)) return '';
  switch (obj.o_which) {
    case D.R_PROTECT: case D.R_ADDSTR: case D.R_ADDDAM: case D.R_ADDHIT:
      return ` [${num(obj.o_arm, 0, RING)}]`;
    default: return '';
  }
}
export function charge_str(obj) {
  if (!(obj.o_flags & D.ISKNOW)) return '';
  return S.terse ? ` [${obj.o_arm}]` : ` [${obj.o_arm} charges]`;
}

function nameit(obj, type, which, op, prfunc) {
  if (op.oi_know || op.oi_guess) {
    let s = obj.o_count === 1 ? `A ${type} ` : `${obj.o_count} ${type}s `;
    if (op.oi_know) s += `of ${op.oi_name}${prfunc(obj)}(${which})`;
    else s += `called ${op.oi_guess}${prfunc(obj)}(${which})`;
    return s;
  }
  if (obj.o_count === 1) return `A${vowelstr(which)} ${which} ${type}`;
  return `${obj.o_count} ${which} ${type}s`;
}

export function inv_name(obj, drop) {
  let pb = '';
  const which = obj.o_which;
  switch (obj.o_type) {
    case POTION: pb = nameit(obj, 'potion', S.p_colors[which], D.pot_info[which], () => ''); break;
    case RING: pb = nameit(obj, 'ring', S.r_stones[which], D.ring_info[which], ring_num); break;
    case STICK: pb = nameit(obj, S.ws_type[which], S.ws_made[which], D.ws_info[which], charge_str); break;
    case SCROLL: {
      pb = obj.o_count === 1 ? 'A scroll ' : `${obj.o_count} scrolls `;
      const op = D.scr_info[which];
      if (op.oi_know) pb += `of ${op.oi_name}`;
      else if (op.oi_guess) pb += `called ${op.oi_guess}`;
      else pb += `titled '${S.s_names[which]}'`;
      break;
    }
    case FOOD:
      if (which === 1) {
        if (obj.o_count === 1) pb = `A${vowelstr(S.fruit)} ${S.fruit}`;
        else pb = `${obj.o_count} ${S.fruit}s`;
      } else if (obj.o_count === 1) pb = 'Some food';
      else pb = `${obj.o_count} rations of food`;
      break;
    case WEAPON: {
      const sp = D.weap_info[which].oi_name;
      pb = obj.o_count > 1 ? `${obj.o_count} ` : `A${vowelstr(sp)} `;
      if (obj.o_flags & D.ISKNOW) pb += `${num(obj.o_hplus, obj.o_dplus, WEAPON)} ${sp}`;
      else pb += sp;
      if (obj.o_count > 1) pb += 's';
      if (obj.o_label !== null) pb += ` called ${obj.o_label}`;
      break;
    }
    case ARMOR: {
      const sp = D.arm_info[which].oi_name;
      if (obj.o_flags & D.ISKNOW) {
        pb = `${num(D.a_class[which] - obj.o_arm, 0, ARMOR)} ${sp} [`;
        if (!S.terse) pb += 'protection ';
        pb += `${10 - obj.o_arm}]`;
      } else pb = sp;
      if (obj.o_label !== null) pb += ` called ${obj.o_label}`;
      break;
    }
    case AMULET: pb = 'The Amulet of Yendor'; break;
    case GOLD: pb = `${obj.o_arm} Gold pieces`; break;
    default: pb = `Something bizarre ${unctrl(obj.o_type)}`;
  }
  if (S.inv_describe) {
    if (obj === S.cur_armor) pb += ' (being worn)';
    if (obj === S.cur_weapon) pb += ' (weapon in hand)';
    if (obj === S.cur_ring[D.LEFT]) pb += ' (on left hand)';
    else if (obj === S.cur_ring[D.RIGHT]) pb += ' (on right hand)';
  }
  if (drop && pb[0] >= 'A' && pb[0] <= 'Z') pb = pb[0].toLowerCase() + pb.slice(1);
  else if (!drop && pb[0] >= 'a' && pb[0] <= 'z') pb = pb[0].toUpperCase() + pb.slice(1);
  return pb;
}

// --------------------------------------------------------------- creation
export function pick_one(info, nitems) {
  const i = rnd(100);
  for (let k = 0; k < nitems; k++) if (i < info[k].oi_prob) return k;
  return 0;
}

export function init_weapon(weap, which) {
  const iwp = D.init_dam[which];
  weap.o_type = WEAPON;
  weap.o_which = which;
  weap.o_damage = iwp[0];
  weap.o_hurldmg = iwp[1];
  weap.o_launch = iwp[2];
  weap.o_flags = iwp[3];
  weap.o_hplus = 0;
  weap.o_dplus = 0;
  if (which === D.DAGGER) {
    weap.o_count = rnd(4) + 2;
    weap.o_group = S.group++;
  } else if (weap.o_flags & D.ISMANY) {
    weap.o_count = rnd(8) + 8;
    weap.o_group = S.group++;
  } else {
    weap.o_count = 1;
    weap.o_group = 0;
  }
}

export function fix_stick(cur) {
  cur.o_damage = S.ws_type[cur.o_which] === 'staff' ? '2x3' : '1x1';
  cur.o_hurldmg = '1x1';
  cur.o_arm = cur.o_which === D.WS_LIGHT ? rnd(10) + 10 : rnd(5) + 3;
}

export function new_thing() {
  const cur = new_item();
  cur.o_hplus = 0; cur.o_dplus = 0;
  cur.o_damage = '0x0'; cur.o_hurldmg = '0x0';
  cur.o_arm = 11; cur.o_count = 1; cur.o_group = 0; cur.o_flags = 0;
  let r;
  switch (S.no_food > 3 ? 2 : pick_one(D.things, D.NUMTHINGS)) {
    case 0:
      cur.o_type = POTION; cur.o_which = pick_one(D.pot_info, D.MAXPOTIONS); break;
    case 1:
      cur.o_type = SCROLL; cur.o_which = pick_one(D.scr_info, D.MAXSCROLLS); break;
    case 2:
      cur.o_type = FOOD; S.no_food = 0;
      cur.o_which = rnd(10) !== 0 ? 0 : 1; break;
    case 3:
      init_weapon(cur, pick_one(D.weap_info, D.MAXWEAPONS));
      if ((r = rnd(100)) < 10) { cur.o_flags |= D.ISCURSED; cur.o_hplus -= rnd(3) + 1; }
      else if (r < 15) cur.o_hplus += rnd(3) + 1;
      break;
    case 4:
      cur.o_type = ARMOR; cur.o_which = pick_one(D.arm_info, D.MAXARMORS);
      cur.o_arm = D.a_class[cur.o_which];
      if ((r = rnd(100)) < 20) { cur.o_flags |= D.ISCURSED; cur.o_arm += rnd(3) + 1; }
      else if (r < 28) cur.o_arm -= rnd(3) + 1;
      break;
    case 5:
      cur.o_type = RING; cur.o_which = pick_one(D.ring_info, D.MAXRINGS);
      switch (cur.o_which) {
        case D.R_ADDSTR: case D.R_PROTECT: case D.R_ADDHIT: case D.R_ADDDAM:
          if ((cur.o_arm = rnd(3)) === 0) { cur.o_arm = -1; cur.o_flags |= D.ISCURSED; }
          break;
        case D.R_AGGR: case D.R_TELEPORT: cur.o_flags |= D.ISCURSED;
      }
      break;
    case 6:
      cur.o_type = STICK; cur.o_which = pick_one(D.ws_info, D.MAXSTICKS); fix_stick(cur);
      break;
  }
  return cur;
}

// --------------------------------------------------------------- pack
export function pack_char() {
  const i = S.pack_used.indexOf(false);
  S.pack_used[i] = true;
  return String.fromCharCode(97 + i);
}
export const ISMULT = (t) => t === POTION || t === SCROLL || t === FOOD;

export function pack_room(from_floor, obj) {
  if (++S.inpack > D.MAXPACK) {
    if (!S.terse) addmsg("there's ");
    addmsg('no room');
    if (!S.terse) addmsg(' in your pack');
    endmsg();
    if (from_floor) move_msg(obj);
    S.inpack = D.MAXPACK;
    return false;
  }
  if (from_floor) {
    S.lvl_obj.splice(S.lvl_obj.indexOf(obj), 1);
    addch(S.hero.y, S.hero.x, W.floor_ch());
    setchat(S.hero.y, S.hero.x, S.player.t_room.r_flags & D.ISGONE ? D.PASSAGE : D.FLOOR);
  }
  return true;
}

export function add_pack(obj, silent) {
  const pack = S.player.t_pack;
  let from_floor = false;
  if (obj === null) {
    obj = W.find_obj(S.hero.y, S.hero.x);
    if (obj === null) return;
    from_floor = true;
  }
  if (obj.o_type === SCROLL && obj.o_which === D.S_SCARE && (obj.o_flags & D.ISFOUND)) {
    S.lvl_obj.splice(S.lvl_obj.indexOf(obj), 1);
    addch(S.hero.y, S.hero.x, W.floor_ch());
    setchat(S.hero.y, S.hero.x, S.player.t_room.r_flags & D.ISGONE ? D.PASSAGE : D.FLOOR);
    msg('the scroll turns to dust as you pick it up');
    emit('item_gone', { obj });
    return;
  }
  if (pack.length === 0) {
    pack.push(obj);
    obj.o_packch = pack_char();
    S.inpack++;
  } else {
    let lpIdx = -1; // index to insert after
    let handled = false;
    for (let i = 0; i < pack.length; i++) {
      let op = pack[i];
      if (op.o_type !== obj.o_type) lpIdx = i;
      else {
        let k = i;
        while (op.o_type === obj.o_type && op.o_which !== obj.o_which) {
          lpIdx = k;
          if (k + 1 >= pack.length) break;
          op = pack[++k];
        }
        if (op.o_type === obj.o_type && op.o_which === obj.o_which) {
          if (ISMULT(op.o_type)) {
            if (!pack_room(from_floor, obj)) return;
            op.o_count++;
            obj = op; lpIdx = -2; handled = true;
          } else if (obj.o_group) {
            lpIdx = k;
            let kk = k;
            while (op.o_type === obj.o_type && op.o_which === obj.o_which && op.o_group !== obj.o_group) {
              lpIdx = kk;
              if (kk + 1 >= pack.length) break;
              op = pack[++kk];
            }
            if (op.o_type === obj.o_type && op.o_which === obj.o_which && op.o_group === obj.o_group) {
              op.o_count += obj.o_count;
              S.inpack--;
              if (!pack_room(from_floor, obj)) return;
              obj = op; lpIdx = -2; handled = true;
            }
          } else lpIdx = k;
        }
        break;
      }
    }
    if (!handled && lpIdx !== -2) {
      if (lpIdx === -1) lpIdx = pack.length - 1;
      if (!pack_room(from_floor, obj)) return;
      obj.o_packch = pack_char();
      pack.splice(lpIdx + 1, 0, obj);
    }
  }
  obj.o_flags |= D.ISFOUND;
  for (const op of S.mlist) if (op.t_dest === obj.o_pos) op.t_dest = S.hero;
  if (obj.o_type === AMULET) S.amulet = true;
  if (!silent) {
    if (!S.terse) addmsg('you now have ');
    msg(`${inv_name(obj, !S.terse)} (${obj.o_packch})`);
  }
  emit('pack_changed', { picked: obj });
}

export function leave_pack(obj, newobj, all) {
  const pack = S.player.t_pack;
  S.inpack--;
  let nobj = obj;
  if (obj.o_count > 1 && !all) {
    S.last_pick = obj;
    obj.o_count--;
    if (obj.o_group) S.inpack++;
    if (newobj) {
      nobj = { ...obj, t_pos: coord(), o_pos: coord(obj.o_pos.x, obj.o_pos.y), t_stats: { ...obj.t_stats },
        t_pack: [], id: ++new_item.counter };
      nobj.o_count = 1;
    }
  } else {
    S.last_pick = null;
    S.pack_used[obj.o_packch.charCodeAt(0) - 97] = false;
    pack.splice(pack.indexOf(obj), 1);
  }
  emit('pack_changed', {});
  return nobj;
}

export function move_msg(obj) {
  if (!S.terse) addmsg('you ');
  msg(`moved onto ${inv_name(obj, true)}`);
}

export function money(value) {
  S.purse += value;
  addch(S.hero.y, S.hero.x, W.floor_ch());
  setchat(S.hero.y, S.hero.x, S.player.t_room.r_flags & D.ISGONE ? D.PASSAGE : D.FLOOR);
  if (value > 0) {
    if (!S.terse) addmsg('you found ');
    msg(`${value} gold pieces`);
    emit('gold', { value });
  }
}

export function pick_up(ch) {
  if (on(S.player, D.ISLEVIT)) return;
  const obj = W.find_obj(S.hero.y, S.hero.x);
  if (S.move_on) { if (obj) move_msg(obj); return; }
  switch (ch) {
    case GOLD:
      if (obj === null) return;
      money(obj.o_arm);
      S.lvl_obj.splice(S.lvl_obj.indexOf(obj), 1);
      S.player.t_room.r_goldval = 0;
      emit('item_gone', { obj });
      break;
    default:
      add_pack(null, false);
  }
}

// is_magic: Does an object radiate magic?
export function is_magic(obj) {
  switch (obj.o_type) {
    case ARMOR: return !!(obj.o_flags & D.ISPROT) || obj.o_arm !== D.a_class[obj.o_which];
    case WEAPON: return obj.o_hplus !== 0 || obj.o_dplus !== 0;
    case POTION: case SCROLL: case STICK: case RING: case AMULET: return true;
  }
  return false;
}

export function fallpos(pos, newpos) {
  let cnt = 0;
  for (let y = pos.y - 1; y <= pos.y + 1; y++)
    for (let x = pos.x - 1; x <= pos.x + 1; x++) {
      if (y === S.hero.y && x === S.hero.x) continue;
      const ch = chat(y, x);
      if ((ch === D.FLOOR || ch === D.PASSAGE) && rnd(++cnt) === 0) { newpos.y = y; newpos.x = x; }
    }
  return cnt !== 0;
}

export function fall(obj, pr) {
  const fpos = coord();
  if (fallpos(obj.o_pos, fpos)) {
    const pp = INDEX(fpos.y, fpos.x);
    pp.p_ch = obj.o_type;
    cpy(obj.o_pos, fpos);
    if (W.cansee(fpos.y, fpos.x)) {
      if (pp.p_monst !== null) pp.p_monst.t_oldch = obj.o_type;
      else addch(fpos.y, fpos.x, obj.o_type);
    }
    S.lvl_obj.unshift(obj);
    emit('item_landed', { obj });
    return;
  }
  if (pr) {
    if (S.has_hit) { endmsg(); S.has_hit = false; }
    msg(`the ${D.weap_info[obj.o_which].oi_name} vanishes as it hits the ground`);
  }
  emit('item_gone', { obj });
}

export function is_current(obj) {
  if (obj === null) return false;
  if (obj === S.cur_armor || obj === S.cur_weapon || obj === S.cur_ring[D.LEFT] || obj === S.cur_ring[D.RIGHT]) {
    if (!S.terse) addmsg("That's already ");
    msg('in use');
    return true;
  }
  return false;
}

export function reset_last() {
  S.last_comm = S.l_last_comm;
  S.last_dir = S.l_last_dir;
  S.last_pick = S.l_last_pick;
}

// --------------------------------------------------------------- selecting
export const type_name = (type) => ({
  [POTION]: 'potion', [SCROLL]: 'scroll', [FOOD]: 'food', [D.R_OR_S]: 'ring, wand or staff',
  [RING]: 'ring', [STICK]: 'wand or staff', [WEAPON]: 'weapon', [ARMOR]: 'suit of armor',
}[type]);

export function typeMatches(obj, type) {
  if (!type) return true;
  if (type === obj.o_type) return true;
  if (type === D.CALLABLE && obj.o_type !== FOOD && obj.o_type !== AMULET) return true;
  if (type === D.R_OR_S && (obj.o_type === RING || obj.o_type === STICK)) return true;
  return false;
}

// inventory: list the pack (type filters).  Returns true if something to show.
export async function inventory(list, type, block = true) {
  const items = list.filter((o) => typeMatches(o, type));
  S.n_objs = items.length;
  if (items.length === 0) {
    if (S.terse) msg(type === 0 ? 'empty handed' : 'nothing appropriate');
    else msg(type === 0 ? 'you are empty handed' : "you don't have anything appropriate");
    return false;
  }
  if (block) await io.showList('inventory', items, { type });
  return true;
}

export async function get_item(purpose, type) {
  const pack = S.player.t_pack;
  if (pack.length === 0) { msg("you aren't carrying anything"); return null; }
  if (S.again) {
    if (S.last_pick) return S.last_pick;
    msg('you ran out');
    return null;
  }
  for (;;) {
    if (!S.terse) addmsg('which object do you want to ');
    addmsg(purpose);
    if (S.terse) addmsg(' what');
    msg('? (* for list): ');
    emit('prompt_item', { purpose, type, active: true });
    const ch = await io.readchar();
    emit('prompt_item', { active: false });
    if (ch === D.ESCAPE) {
      reset_last();
      S.after = false;
      msg('');
      return null;
    }
    S.n_objs = 1;
    if (ch === '*') {
      if (!(await inventory(pack, type))) { S.after = false; return null; }
      continue;
    }
    const obj = pack.find((o) => o.o_packch === ch);
    if (!obj) { msg(`'${unctrl(ch)}' is not a valid item`); continue; }
    return obj;
  }
}

export async function picky_inven() {
  const pack = S.player.t_pack;
  if (pack.length === 0) msg("you aren't carrying anything");
  else if (pack.length === 1) msg(`a) ${inv_name(pack[0], false)}`);
  else {
    msg(S.terse ? 'item: ' : 'which item do you wish to inventory: ');
    emit('prompt_item', { purpose: 'inspect', type: 0, active: true });
    const mch = await io.readchar();
    emit('prompt_item', { active: false });
    if (mch === D.ESCAPE) { msg(''); return; }
    const obj = pack.find((o) => o.o_packch === mch);
    if (obj) msg(`${mch}) ${inv_name(obj, false)}`);
    else msg(`'${unctrl(mch)}' not in pack`);
  }
}

// get_dir: ask for a direction
export async function get_dir() {
  let prompt;
  if (S.again && S.last_dir !== '') {
    S.delta.y = get_dir.last.y; S.delta.x = get_dir.last.x;
    S.dir_ch = S.last_dir;
  } else {
    if (!S.terse) { prompt = 'which direction? '; msg(prompt); } else prompt = 'direction: ';
    let gotit;
    do {
      gotit = true;
      emit('prompt_dir', { active: true });
      const c = await io.readchar();
      emit('prompt_dir', { active: false });
      S.dir_ch = c;
      switch (c) {
        case 'h': case 'H': S.delta.y = 0; S.delta.x = -1; break;
        case 'j': case 'J': S.delta.y = 1; S.delta.x = 0; break;
        case 'k': case 'K': S.delta.y = -1; S.delta.x = 0; break;
        case 'l': case 'L': S.delta.y = 0; S.delta.x = 1; break;
        case 'y': case 'Y': S.delta.y = -1; S.delta.x = -1; break;
        case 'u': case 'U': S.delta.y = -1; S.delta.x = 1; break;
        case 'b': case 'B': S.delta.y = 1; S.delta.x = -1; break;
        case 'n': case 'N': S.delta.y = 1; S.delta.x = 1; break;
        case D.ESCAPE: S.last_dir = ''; reset_last(); msg(''); return false;
        default: msg(prompt); gotit = false;
      }
    } while (!gotit);
    if (isupper(S.dir_ch)) S.dir_ch = S.dir_ch.toLowerCase();
    S.last_dir = S.dir_ch;
    get_dir.last.y = S.delta.y; get_dir.last.x = S.delta.x;
  }
  if (on(S.player, D.ISHUH) && rnd(5) === 0)
    do {
      S.delta.y = rnd(3) - 1;
      S.delta.x = rnd(3) - 1;
    } while (S.delta.y === 0 && S.delta.x === 0);
  return true;
}
get_dir.last = coord();

// --------------------------------------------------------------- strength
export function add_str(cur, amt) {
  let v = cur + amt;
  if (v < 3) v = 3; else if (v > 31) v = 31;
  return v;
}
export function chg_str(amt) {
  if (amt === 0) return;
  const p = S.player.t_stats;
  p.s_str = add_str(p.s_str, amt);
  let comp = p.s_str;
  if (W.ISRING(D.LEFT, D.R_ADDSTR)) comp = add_str(comp, -S.cur_ring[D.LEFT].o_arm);
  if (W.ISRING(D.RIGHT, D.R_ADDSTR)) comp = add_str(comp, -S.cur_ring[D.RIGHT].o_arm);
  if (comp > S.max_stats.s_str) S.max_stats.s_str = comp;
}

export function ring_eat(hand) {
  const ring = S.cur_ring[hand];
  const uses = [1, 1, 1, -3, -5, 0, 0, -3, -3, 2, -2, 0, 1, 1];
  if (ring === null) return 0;
  let eat = uses[ring.o_which];
  if (eat < 0) eat = rnd(-eat) === 0 ? 1 : 0;
  if (ring.o_which === D.R_DIGEST) eat = -eat;
  return eat;
}

export function check_level() {
  const p = S.player.t_stats;
  let i;
  for (i = 0; D.e_levels[i] !== 0; i++) if (D.e_levels[i] > p.s_exp) break;
  i++;
  const olevel = p.s_lvl;
  p.s_lvl = i;
  if (i > olevel) {
    const add = roll(i - olevel, 10);
    p.s_maxhp += add;
    p.s_hpt += add;
    msg(`welcome to level ${i}`);
    emit('level_up', { level: i });
  }
}

export function raise_level() {
  S.player.t_stats.s_exp = D.e_levels[S.player.t_stats.s_lvl - 1] + 1;
  check_level();
}
