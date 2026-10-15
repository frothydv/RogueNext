// Turns the stream of game events into a sequenced, animated performance on the table.
import * as THREE from 'three';
import * as D from '../rogue/data.js';
import { S, screen } from '../rogue/state.js';
import * as P from './props.js';
import { FLOOR_Y } from './board.js';
import { colorFor } from './icons.js';
import { audio } from './audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const cellPos = (c, y = 0.5) => V(c.x + 0.5, y, c.y + 0.5);
const rnd = (a, b) => a + Math.random() * (b - a);

export class Director {
  constructor({ stage, board, entities, fx, ui }) {
    Object.assign(this, { stage, board, entities, fx, ui });
    this.queue = [];
    this.wait = 0;
    this.fast = false;
    this.resolvers = [];
    this.running = false;
    this.fade = 0;
    this.fadeT = 0;
    this.stepDur = 0.15;
    this.heroLookRed = 0;
    this.stage.updaters.push((dt) => this.update(dt));
    this.look = { hue: 0, wobble: 0, blind: 0, desat: 0 };
  }

  handle(type, data) {
    this.queue.push({ type, data });
    if (this.queue.length > 120) this.skip();
  }

  now() { return this.stage.time; }

  update(dt) {
    if (this.wait > 0) this.wait -= dt;
    let guard = 0;
    while (this.wait <= 0 && this.queue.length && guard++ < 200) {
      const ev = this.queue.shift();
      const d = this.run(ev);
      if (d > 0 && !this.fast) this.wait = d;
    }
    this.applyLook(dt);
    if (this.resolvers.length && this.settled()) {
      const rs = this.resolvers; this.resolvers = [];
      rs.forEach((r) => r());
    }
  }

  busyMinis() {
    const e = this.entities;
    if (e.hero && (e.hero.mv || e.hero.lunge)) return true;
    for (const m of e.monsters.values()) if ((m.mv || m.lunge || m.death) && !m.silent) return true;
    return false;
  }

  settled() {
    return this.queue.length === 0 && this.wait <= 0 && !this.busyMinis() && this.fx.bolts.length === 0 && this.fx.projectiles.length === 0 && this.fx.dice.length === 0 ? true : false;
  }

  settle(maxMs = 700) {
    if (this.settled()) return Promise.resolve();
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      this.resolvers.push(fin);
      setTimeout(() => { if (!done) { this.skip(); fin(); } }, maxMs);
    });
  }

  skip() {
    this.fast = true;
    let guard = 0;
    while (this.queue.length && guard++ < 1000) this.run(this.queue.shift());
    this.fast = false;
    this.wait = 0;
    const e = this.entities;
    const finish = (m) => {
      if (m.mv) { m.x = m.mv.tx; m.z = m.mv.tz; m.mv = null; }
      m.lunge = null;
      if (m.death) { m.dead = true; m.root.visible = false; }
    };
    if (e.hero) finish(e.hero);
    for (const m of e.monsters.values()) finish(m);
    this.fx.bolts.slice().forEach((b) => { b.t = b.dur; });
    this.fx.projectiles.forEach((p) => { p.t = p.dur; });
    this.fx.dice.forEach((d) => { d.t = Math.max(d.t, d.dur); });
    this.resolvers.forEach((r) => r());
    this.resolvers = [];
  }

  setRunning(on) { this.running = on; this.stepDur = on ? 0.075 : 0.15; }

  // ----------------------------------------------------------------- the event handlers
  run({ type, data }) {
    const e = this.entities, fx = this.fx, st = this.stage, now = this.now();
    const hero = e.ensureHero();
    const heroPos = () => V(hero.x, 0.5, hero.z);
    const fast = this.fast;
    switch (type) {
      case 'msg': this.ui.message(data.text); return 0;
      case 'status': this.ui.refresh(); return 0;
      case 'turn_end':
        this.board.sync(now);
        e.sync(now);
        e.pickupPending = false;
        this.ui.refresh();
        return 0;
      case 'redraw': this.board.reset(); e.reset(); this.board.sync(now); e.sync(now); return 0;

      case 'new_level': {
        this.board.reset();
        e.reset();
        if (e.hero) { e.hero.root.scale.setScalar(1); e.hero.root.visible = true; e.hero.placeAt(S.hero.x + 0.5, S.hero.y + 0.5); e.hero.dead = false; e.hero.death = null; e.hero.setAlpha(1); }
        st.setFocus(S.hero.x + 0.5, S.hero.y + 0.5, true);
        this.board.sync(now);
        e.sync(now);
        this.ui.levelChanged();
        this.sink = null; this.fade = 1;
        if (!fast) fx.beam(V(S.hero.x + 0.5, 0.2, S.hero.y + 0.5), [1.5, 1.2, 0.6], 0.9, 3.5);
        return 0;
      }
      case 'stairs': {
        if (fast) return 0;
        audio.play('stairs');
        if (data.dir === 'fall') { fx.burst(heroPos(), { count: 24, color: [0.6, 0.45, 0.3], speed: 1.5, life: 0.8, size: 0.4, additive: false, up: 0.3 }); }
        this.tweenHeroSink(data.dir !== 'up');
        return 0.45;
      }
      case 'enter_room': return 0;

      case 'hero_move': {
        const dur = this.stepDur;
        if (!fast) audio.play('step');
        hero.moveTo(data.to.x + 0.5, data.to.y + 0.5, dur, now);
        st.setFocus(data.to.x + 0.5, data.to.y + 0.5);
        if (!fast) fx.burst(V(data.from.x + 0.5, 0.2, data.from.y + 0.5), { count: 2, color: [0.5, 0.42, 0.34], speed: 0.4, life: 0.5, size: 0.18, additive: false, up: 0.4 });
        this.footstep = (this.footstep || 0) + 1;
        return 0;
      }
      case 'bump': {
        if (fast) return 0;
        const dir = data.dir;
        if (dir) hero.attack(dir.x, dir.y, now, 0.22);
        return 0;
      }
      case 'monster_move': {
        const m = e.mini(data.mon);
        if (m && !m.death) {
          m.moveTo(data.mon.t_pos.x + 0.5, data.mon.t_pos.y + 0.5, this.stepDur * 1.1, now);
          m.recentlyActed = true;
        }
        return 0;
      }
      case 'monster_wake': {
        const m = e.mini(data.mon);
        if (m && !fast) {
          audio.play('wake');
          const s = fx.text(V(m.x, 1.4 * Math.min(1.3, m.big), m.z), '!', { color: '#ffd24a', size: 80, dur: 0.9, vy: 0.6 });
          void s; m.bounce = 1;
        }
        return 0;
      }
      case 'monster_new': return 0;
      case 'monster_held': {
        const m = e.mini(data.mon);
        if (m && !fast) fx.burst(V(m.x, 0.6, m.z), { count: 14, color: [0.8, 2.2, 3.0], speed: 1.2, life: 0.8, size: 0.2 });
        return 0;
      }
      case 'monster_summoned': {
        if (fast) return 0;
        const p = cellPos(data.mon.t_pos, 0.4);
        fx.burst(p, { count: 24, color: [1.6, 0.8, 2.6], speed: 2, life: 0.8, size: 0.3 });
        fx.ring(V(p.x, 0.2, p.z), [1.6, 0.8, 2.6], 0.9, 0.5);
        return 0.15;
      }
      case 'monster_fx': {
        const m = e.mini(data.mon);
        const p = m ? V(m.x, 0.7, m.z) : cellPos(data.mon.t_pos, 0.7);
        if (!fast) {
          const c = { polymorph: [3, 1, 3], cancel: [1, 2, 3], invis: [1, 1, 1], teleport: [2, 1.2, 3], haste: [3, 2.4, 0.6], slow: [0.8, 1.4, 3] }[data.kind] || [2, 2, 2];
          fx.burst(p, { count: 24, color: c, speed: 2, life: 0.8, size: 0.3 });
          fx.ring(V(p.x, 0.2, p.z), c, 0.9, 0.5);
        }
        return fast ? 0 : 0.12;
      }
      case 'xeroc_reveal': return 0;

      case 'combat': return this.doCombat(data);
      case 'monster_killed': {
        if (!fast) audio.play('kill');
        const m = e.mini(data.mon);
        if (m) {
          m.die(now, 0.6);
          if (!fast) {
            fx.burst(V(m.x, 0.5, m.z), { count: 22, color: [0.55, 0.5, 0.45], speed: 1.8, life: 0.9, size: 0.45, additive: false, up: 0.5 });
            fx.burst(V(m.x, 0.5, m.z), { count: 10, color: [2.5, 1.8, 0.5], speed: 2.2, life: 0.7, size: 0.15, gravity: 6 });
            fx.text(V(m.x, 1.3, m.z), `+${data.mon.t_stats.s_exp} xp`, { color: '#ffe48a', size: 54, dur: 1.4, vy: 0.5 });
          }
          st.cam.punch = 0.6;
        }
        return fast ? 0 : 0.3;
      }
      case 'monster_removed': {
        const m = e.mini(data.mon);
        if (m && !data.killed) {
          m.die(now, 0.3);
          if (!fast) fx.burst(V(m.x, 0.6, m.z), { count: 16, color: [1.4, 2.4, 1.2], speed: 2, life: 0.6, size: 0.3 });
        }
        return 0;
      }
      case 'monster_vanish': {
        const m = e.mini(data.mon);
        if (m && !fast) { fx.burst(V(m.x, 0.6, m.z), { count: 20, color: [2, 2, 0.6], speed: 2.2, life: 0.7, size: 0.25 }); }
        return 0;
      }
      case 'item_taken_by_monster': return 0;

      case 'throw': {
        if (fast) return 0;
        const o = data.obj;
        audio.play('throw');
        const from = V(hero.x, 0.7, hero.z), to = cellPos(data.end, 0.5);
        hero.attack(data.dir.x, data.dir.y, now, 0.3);
        let mesh;
        if (o.o_type === D.WEAPON) mesh = P.buildItem(D.WEAPON, { which: o.o_which });
        else mesh = P.buildItem(o.o_type, { which: o.o_which });
        mesh.scale.setScalar(1.0);
        mesh.position.y -= FLOOR_Y;
        const wrap = new THREE.Group(); wrap.add(mesh);
        mesh.position.set(0, -FLOOR_Y, 0);
        const spin = (o.o_which === D.DAGGER || o.o_which === D.SHIRAKEN || o.o_which === D.SPEAR && false) ? 22 : 0;
        const dur = Math.max(0.18, from.distanceTo(to) / 16);
        fx.projectile(wrap, from, to, dur, spin, 0.35);
        if (!spin) {
          const ang = Math.atan2(data.dir.x, data.dir.y);
          mesh.rotation.y = ang - Math.PI / 2;
        }
        return dur;
      }
      case 'bolt': {
        if (fast) return 0;
        const pts = [cellPos(data.from, 0.75), ...data.path.map((c) => cellPos(c, 0.75))];
        if (pts.length < 2) return 0;
        audio.play(data.kind === 'flame' ? 'flame' : data.kind === 'ice' ? 'ice' : data.kind === 'missile' ? 'missile' : 'bolt');
        const dur = fx.bolt(pts, data.kind);
        st.shake(data.kind === 'flame' ? 0.12 : 0.05);
        return dur;
      }
      case 'zap': {
        if (fast) return 0;
        hero.attack(data.dir.x, data.dir.y, now, 0.35);
        const p = V(hero.x + data.dir.x * 0.3, 0.9, hero.z + data.dir.y * 0.3);
        fx.halo(p, [1.5, 2.4, 3.0], 1.4, 0.45);
        fx.burst(p, { count: 12, color: [1.4, 2.2, 3.0], speed: 1.5, life: 0.5, size: 0.2 });
        return 0.18;
      }
      case 'drain': {
        if (fast) return 0;
        for (const mon of data.targets) {
          const m = e.mini(mon);
          if (!m) continue;
          for (let i = 0; i < 12; i++) {
            const t = i / 12;
            fx.add.spawn(V(m.x + (hero.x - m.x) * t, 0.8, m.z + (hero.z - m.z) * t), V(0, 0.2, 0), new THREE.Color(2.6, 0.2, 0.3), 0.7, 0.22, 0, 0);
          }
        }
        fx.screen.red = 0.6;
        return 0.3;
      }
      case 'potion_quaff': {
        if (fast) return 0;
        audio.play('potion');
        const color = new THREE.Color(colorFor(S.p_colors[data.which]));
        const c = [color.r * 2.2 + 0.3, color.g * 2.2 + 0.3, color.b * 2.2 + 0.3];
        const p = heroPos();
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * 6.28;
          fx.add.spawn(V(p.x + Math.cos(a) * 0.5, 0.3 + (i % 5) * 0.12, p.z + Math.sin(a) * 0.5), V(-Math.sin(a) * 1.4, 1.1, Math.cos(a) * 1.4), new THREE.Color(...c), 1.0, 0.22, 0, 0.4);
        }
        fx.ring(V(p.x, 0.2, p.z), c, 1.0, 0.6);
        hero.bounce = 1;
        return 0.3;
      }
      case 'scroll_read': {
        if (fast) return 0;
        audio.play('scroll');
        const p = heroPos();
        const runes = ['ᚠ', 'ᚨ', 'ᛉ', 'ᛟ', 'ᚦ', 'ᛈ'];
        for (let i = 0; i < 6; i++) fx.text(V(p.x + rnd(-0.5, 0.5), 0.8 + i * 0.1, p.z + rnd(-0.5, 0.5)), runes[i], { color: '#ffe9a0', size: 46, dur: 1.2, vy: 1.2 });
        fx.burst(V(p.x, 0.9, p.z), { count: 22, color: [2.4, 2.0, 1.0], speed: 1.4, life: 0.9, size: 0.18 });
        fx.halo(V(p.x, 1.0, p.z), [2.4, 2.0, 1.0], 2.0, 0.7);
        return 0.3;
      }
      case 'status_fx': return this.statusFx(data.kind);
      case 'level_up': {
        if (fast) return 0;
        audio.play('levelup');
        const p = heroPos();
        fx.ring(V(p.x, 0.2, p.z), [3, 2.2, 0.6], 2.2, 0.9);
        fx.beam(V(p.x, 0.2, p.z), [2.4, 1.8, 0.5], 1.0, 5);
        fx.text(V(p.x, 1.8, p.z), `LEVEL ${data.level}!`, { color: '#ffe070', size: 72, dur: 1.8, vy: 0.6 });
        fx.burst(V(p.x, 0.5, p.z), { count: 40, color: [3, 2.2, 0.6], speed: 3, life: 1.2, size: 0.18, gravity: 2 });
        return 0.4;
      }
      case 'player_hurt': { fx.screen.red = 1; st.shake(0.3); if (!fast) audio.play('hurt'); return 0; }
      case 'trap': return this.doTrap(data);
      case 'teleport': {
        if (fast) { hero.placeAt(data.to.x + 0.5, data.to.y + 0.5); return 0; }
        audio.play('teleport');
        const a = cellPos(data.from, 0.6), b = cellPos(data.to, 0.6);
        fx.burst(a, { count: 36, color: [2.0, 0.8, 3.0], speed: 2.4, life: 0.9, size: 0.3 });
        fx.ring(V(a.x, 0.2, a.z), [2.0, 0.8, 3.0], 1.2, 0.5);
        hero.placeAt(b.x, b.z);
        st.setFocus(b.x, b.z);
        fx.burst(b, { count: 36, color: [2.0, 0.8, 3.0], speed: 2.4, life: 0.9, size: 0.3 });
        fx.ring(V(b.x, 0.2, b.z), [2.0, 0.8, 3.0], 1.2, 0.5);
        fx.flashLight(b, 0xb060ff, 60, 0.5, 9);
        hero.appear = 0;
        return 0.3;
      }
      case 'secret_found': {
        if (fast) return 0;
        audio.play('secret');
        const p = cellPos(data, 0.7);
        fx.burst(p, { count: 24, color: [0.8, 0.7, 0.55], speed: 1.4, life: 1.0, size: 0.35, additive: false });
        fx.ring(V(p.x, 0.25, p.z), [2.5, 2.0, 0.8], 1.0, 0.6);
        fx.halo(p, [2.4, 1.9, 0.8], 1.8, 0.7);
        fx.text(V(p.x, 1.3, p.z), data.kind === 'door' ? 'Secret door!' : data.kind === 'trap' ? 'Trap!' : 'Passage!', { color: '#ffe48a', size: 44, dur: 1.5, vy: 0.4 });
        return 0.2;
      }
      case 'search': {
        if (fast) return 0;
        fx.ring(V(hero.x, 0.22, hero.z), [0.9, 1.4, 2.4], 1.8, 0.5, 0.05);
        return 0;
      }
      case 'detect': this.entities.showDetect(data.kind, data.cells); return 0;
      case 'detect_end': this.entities.clearDetect(); return 0;
      case 'map_revealed': this.board.revealRooms(); if (!fast) fx.beam(heroPos(), [1.4, 1.8, 2.6], 0.8, 4); return 0;
      case 'room_lit': {
        if (fast) return 0;
        fx.flashLight(V(hero.x, 2.5, hero.z), 0xaad0ff, 160, 0.9, 30);
        this.board.vis.fill(0);
        return 0.2;
      }
      case 'gold': {
        if (fast) return 0;
        audio.play('coin');
        const p = heroPos();
        fx.burst(V(p.x, 0.3, p.z), { count: 16, color: [3, 2.2, 0.5], speed: 2.4, life: 0.9, size: 0.14, gravity: 7, up: 1.4 });
        fx.text(V(p.x, 1.4, p.z), `+${data.value} gold`, { color: '#ffd040', size: 56, dur: 1.4, vy: 0.5 });
        return 0;
      }
      case 'pack_changed': { if (data.picked) { if (!fast) audio.play('pickup'); e.pickupPending = true; if (!fast) fx.halo(V(hero.x, 0.8, hero.z), [1.6, 1.8, 2.2], 1.2, 0.4); } this.ui.packChanged(data); return 0; }
      case 'equip_changed': this.ui.packChanged(data); return 0;
      case 'eat': {
        if (fast) return 0;
        audio.play('eat');
        fx.burst(V(hero.x, 0.8, hero.z), { count: 10, color: [0.8, 0.55, 0.3], speed: 1, life: 0.6, size: 0.12, gravity: 4, additive: false });
        return 0;
      }
      case 'item_landed': case 'item_dropped': case 'item_gone': return 0;
      case 'armor_rust': { if (!fast) fx.burst(V(hero.x, 0.9, hero.z), { count: 18, color: [1.2, 0.5, 0.2], speed: 1.6, life: 0.7, size: 0.18, gravity: 3 }); return 0; }
      case 'sleeping': { return fast ? 0 : 0.12; }

      // UI-bound events
      case 'prompt_item': case 'prompt_dir': case 'prompt_hand': case 'confirm': case 'confirm_end':
      case 'count': case 'help_prompt': case 'show_stats':
        this.ui.promptEvent(type, data);
        return 0;
      default: return 0;
    }
  }

  tweenHeroSink(down) {
    const hero = this.entities.hero;
    const t0 = this.now();
    this.sink = { t0, dur: 0.42, down };
    const upd = () => {
      if (!this.sink) return;
      const p = Math.min(1, (this.now() - this.sink.t0) / this.sink.dur);
      hero.root.scale.setScalar(Math.max(0.01, 1 - p * 0.95));
      hero.root.position.y = 0.2 - p * 0.4;
      this.fade = p;
      if (p >= 1) { this.sink = null; }
      else requestAnimationFrame(upd);
    };
    upd();
  }

  doCombat(d) {
    const e = this.entities, fx = this.fx, st = this.stage, now = this.now();
    const fast = this.fast;
    const hero = e.ensureHero();
    const attIsHero = d.att === 'player';
    const attM = attIsHero ? hero : e.mini(d.att);
    const defM = d.def === 'player' ? hero : e.mini(d.def);
    if (!defM && !attM) return 0;
    const ax = attM ? attM.x : S.hero.x + 0.5, az = attM ? attM.z : S.hero.y + 0.5;
    const dx = defM ? defM.x : ax, dz = defM ? defM.z : az;
    if (fast) { if (defM && d.hit) defM.hurt(); return 0; }
    if (d.thrown) {
      // the projectile has already flown; just show the impact
    } else if (attM) attM.attack(dx - ax, dz - az, now, 0.36);
    const sw = d.swings[0];
    if (sw) {
      const from = V(ax, 1.2, az), to = V(dx + (ax - dx) * 0.35, 0.3, dz + (az - dz) * 0.35);
      fx.rollDice(from, to, sw.res + 1, Math.max(1, sw.need), d.hit, attIsHero);
    }
    const delay = 0.2;
    setTimeout(() => {
      if (!defM) return;
      const top = V(defM.x, 1.25 * Math.min(1.4, defM.big || 1), defM.z);
      if (d.hit) {
        audio.play(d.def === 'player' ? 'hurt' : 'hitMonster');
        defM.hurt();
        fx.burst(V(defM.x, 0.7, defM.z), { count: 14, color: d.def === 'player' ? [2.5, 0.3, 0.2] : [2.4, 1.6, 0.6], speed: 2.2, life: 0.5, size: 0.2, gravity: 5 });
        fx.text(top, `${d.dmg}`, { color: d.def === 'player' ? '#ff6a5a' : '#fff0c0', size: d.def === 'player' ? 74 : 62, dur: 1.1, vy: 0.9 });
        if (d.def === 'player') { fx.screen.red = Math.max(fx.screen.red, 0.9); st.shake(0.28); }
        else st.shake(0.08);
        fx.flashLight(V(defM.x, 0.9, defM.z), d.def === 'player' ? 0xff3020 : 0xffc060, 25, 0.25, 6);
      } else {
        audio.play('miss');
        fx.text(top, 'miss', { color: '#cfd3dc', size: 44, dur: 0.9, vy: 0.5 });
        defM.bounce = 0.5;
        // little dodge hop
        if (defM !== hero) defM.hop = 1;
      }
    }, delay * 1000);
    return 0.5;
  }

  doTrap(d) {
    const e = this.entities, fx = this.fx, st = this.stage;
    const hero = e.ensureHero();
    if (this.fast) return 0;
    audio.play('trap');
    const p = V(hero.x, 0.3, hero.z);
    switch (d.type) {
      case D.T_SLEEP:
        for (let i = 0; i < 40; i++) fx.norm.spawn(V(p.x + rnd(-0.3, 0.3), 0.3, p.z + rnd(-0.3, 0.3)), V(rnd(-0.5, 0.5), rnd(0.2, 0.9), rnd(-0.5, 0.5)), new THREE.Color(0.5, 0.95, 0.55), rnd(1.2, 2.0), rnd(0.5, 0.9), 0, 0.6);
        break;
      case D.T_ARROW: case D.T_DART: {
        const from = V(p.x - 3, 0.7, p.z + rnd(-0.1, 0.1));
        const m = P.buildItem(D.WEAPON, { which: d.type === D.T_ARROW ? D.ARROW : D.DART });
        const w = new THREE.Group(); w.add(m); m.position.y = -FLOOR_Y;
        m.rotation.y = 0;
        fx.projectile(w, from, V(p.x, 0.7, p.z), 0.22, 0, 0);
        break;
      }
      case D.T_BEAR: fx.burst(p, { count: 20, color: [2.4, 2.2, 1.8], speed: 2.4, life: 0.4, size: 0.12 }); st.shake(0.2); break;
      case D.T_TELEP: fx.ring(V(p.x, 0.2, p.z), [2.0, 0.8, 3.0], 1.2, 0.6); break;
      case D.T_RUST: fx.burst(V(p.x, 1.6, p.z), { count: 40, color: [0.5, 0.9, 1.6], speed: 0.8, life: 0.8, size: 0.14, gravity: 8, up: 0.2 }); break;
      case D.T_MYST: for (let i = 0; i < 30; i++) fx.add.spawn(V(p.x, 0.5, p.z), V(rnd(-1.5, 1.5), rnd(0.5, 2), rnd(-1.5, 1.5)), new THREE.Color(rnd(0.5, 3), rnd(0.5, 3), rnd(0.5, 3)), 1.0, 0.18, 0, 0.5); break;
      case D.T_DOOR: fx.burst(p, { count: 20, color: [0.6, 0.45, 0.3], speed: 1.5, life: 0.8, size: 0.4, additive: false }); break;
    }
    return 0.25;
  }

  statusFx(kind) {
    if (this.fast) return 0;
    const fx = this.fx, hero = this.entities.ensureHero();
    const p = V(hero.x, 0.4, hero.z);
    switch (kind) {
      case 'heal':
        for (let i = 0; i < 14; i++) fx.text(V(p.x + rnd(-0.4, 0.4), 0.6 + rnd(0, 0.4), p.z + rnd(-0.4, 0.4)), '+', { color: '#7dff9a', size: 50, dur: 1.2, vy: 0.9 });
        fx.ring(V(p.x, 0.2, p.z), [0.8, 2.6, 1.2], 1.4, 0.7);
        fx.halo(V(p.x, 0.8, p.z), [0.8, 2.4, 1.2], 2.2, 0.8);
        break;
      case 'strength':
        fx.ring(V(p.x, 0.2, p.z), [3, 1.0, 0.5], 1.4, 0.6);
        fx.burst(V(p.x, 0.8, p.z), { count: 26, color: [3, 1.2, 0.5], speed: 2.4, life: 0.8, size: 0.2 });
        fx.text(V(p.x, 1.6, p.z), 'STR +', { color: '#ff9a5a', size: 60, dur: 1.4, vy: 0.5 });
        break;
      case 'levelup':
        fx.beam(V(p.x, 0.2, p.z), [2.4, 1.8, 0.5], 1.0, 5);
        break;
      case 'enchant': case 'bless':
        fx.burst(V(p.x, 0.9, p.z), { count: 30, color: [1.2, 2.0, 3.0], speed: 1.6, life: 1.0, size: 0.16, gravity: -0.5 });
        fx.halo(V(p.x, 0.9, p.z), [1.2, 2.0, 3.0], 2.0, 0.7);
        break;
      case 'hands_glow': fx.halo(V(p.x, 0.7, p.z), [3, 0.6, 0.4], 1.2, 0.8); break;
      case 'hands_off': break;
      case 'confuse': for (let i = 0; i < 5; i++) fx.text(V(p.x + rnd(-0.4, 0.4), 1.4, p.z + rnd(-0.4, 0.4)), '✦', { color: '#ffe070', size: 50, dur: 1.4, vy: 0.2 }); break;
      case 'haste': fx.ring(V(p.x, 0.2, p.z), [1.0, 2.0, 3.0], 1.4, 0.5); fx.text(V(p.x, 1.6, p.z), 'HASTE!', { color: '#8ad0ff', size: 56, dur: 1.2, vy: 0.5 }); break;
      case 'monster_detect': fx.ring(V(p.x, 0.2, p.z), [3, 1, 3], 4.0, 0.9, 0.04); break;
      case 'sleep': fx.text(V(p.x, 1.5, p.z), 'Zzz…', { color: '#cfe4ff', size: 56, dur: 1.4, vy: 0.4 }); break;
      case 'wake': fx.text(V(p.x, 1.5, p.z), '!', { color: '#ffd24a', size: 70, dur: 0.9, vy: 0.5 }); break;
      case 'seeinvis': fx.ring(V(p.x, 0.2, p.z), [1.2, 2.2, 3.0], 1.6, 0.6); break;
      default: break;
    }
    return 0.15;
  }

  // post-processing look driven by the hero's condition
  applyLook(dt) {
    const f = this.stage.final;
    if (!f) return;
    const u = f.uniforms, pf = S.player.t_flags, k = 1 - Math.exp(-dt * 4);
    const L = this.look;
    L.blind += ((pf & D.ISBLIND ? 1 : 0) - L.blind) * k;
    L.hue += ((pf & D.ISHALU ? 1 : 0) - L.hue) * k;
    L.wobble += ((pf & D.ISHUH ? 1 : 0) - L.wobble) * k;
    const faint = S.hungry_state >= 2 ? 0.35 * (S.hungry_state - 1) : 0;
    L.desat += (faint - L.desat) * k;
    const hp = S.player.t_stats.s_hpt / Math.max(1, S.player.t_stats.s_maxhp);
    const low = hp < 0.3 ? (0.3 - hp) / 0.3 * (0.6 + 0.4 * Math.sin(this.stage.time * 5)) * 0.55 : 0;
    u.uBlind.value = L.blind * 0.85;
    u.uHue.value = L.hue * Math.sin(this.stage.time * 0.8) * 1.3;
    u.uWobble.value = L.wobble;
    u.uDesat.value = L.desat;
    u.uRed.value = Math.max(this.fx.screen.red, low);
    u.uChroma.value = 0.0006 + (pf & D.ISHASTE ? 0.0014 : 0);
    if (!this.sink) this.fade = Math.max(0, this.fade - dt * 2.2);
    u.uFlash.value.set(0.02, 0.015, 0.01, this.fade);
  }
}
