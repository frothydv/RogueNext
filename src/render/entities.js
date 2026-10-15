// Keeps the 3D scene's characters, items, doors, stairs, traps and torches in step with the game state.
import * as THREE from 'three';
import * as D from '../rogue/data.js';
import { S, screen, INDEX, isupper, standout } from '../rogue/state.js';
import { find_obj } from '../rogue/world.js';
import { Mini } from './minis.js';
import * as P from './props.js';
import { FLOOR_Y, TERR, WALL_H } from './board.js';
import { colorFor, appearanceFor } from './icons.js';

const W = 80;
const ITEM_GLYPHS = new Set(['*', '!', '?', ':', ')', ']', ',', '=', '/']);

export function worldOf(x, y) { return new THREE.Vector3(x + 0.5, FLOOR_Y, y + 0.5); }

function cloneMats(obj) {
  obj.traverse((o) => {
    if (o.isMesh && o.material && !Array.isArray(o.material)) {
      o.material = o.material.clone();
      if (o.material.color) o.userData.baseColor = o.material.color.clone();
    }
  });
}
function dimGroup(g, f) {
  g.traverse((o) => {
    if (o.isMesh && o.userData.baseColor && o.material && o.material.color) o.material.color.copy(o.userData.baseColor).multiplyScalar(f);
  });
}

export class Entities {
  constructor(stage, board) {
    this.stage = stage;
    this.board = board;
    this.group = new THREE.Group();
    stage.scene.add(this.group);
    this.monsters = new Map();
    this.items = new Map();
    this.leaving = [];
    this.doors = new Map();
    this.traps = new Map();
    this.stairs = null;
    this.torches = [];
    this.hero = null;
    this.detectGroup = new THREE.Group();
    this.group.add(this.detectGroup);
    this.dirArrows = this.buildArrows();
    this.group.add(this.dirArrows);
    this.dirArrows.visible = false;
    this.hover = this.buildHoverRing();
    this.group.add(this.hover);
    this.pathDots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.1, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.7), transparent: true, opacity: 0.85, depthWrite: false }), 160);
    this.pathDots.rotation.x = -Math.PI / 2;
    this.pathDots.count = 0;
    this.pathDots.frustumCulled = false;
    this.group.add(this.pathDots);
    this.sparkles = [];
    this.lastSyncKey = '';
    this.itemKeyFor = (k, g, o) => `${k}:${g}:${o ? o.id : 0}`;
    board.listeners.reveal.push(() => { this.dirtyStatic = true; });
    this.dirtyStatic = true;
    stage.updaters.push((dt, t) => this.update(dt, t));
  }

  buildArrows() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.8, 0.6), transparent: true, opacity: 0.9, depthWrite: false });
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.2); shape.lineTo(0.17, -0.1); shape.lineTo(0.05, -0.05); shape.lineTo(0.05, -0.22); shape.lineTo(-0.05, -0.22); shape.lineTo(-0.05, -0.05); shape.lineTo(-0.17, -0.1);
    const geo = new THREE.ShapeGeometry(shape);
    this.arrowMeshes = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.atan2(-dx, -dy); // points outward
      m.position.set(dx * 0.95, 0.35, dy * 0.95);
      m.userData.d = [dx, dy];
      g.add(m);
      this.arrowMeshes.push(m);
    }
    return g;
  }

  buildHoverRing() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.47, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.0, 0.8), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    g.add(ring);
    g.visible = false;
    g.userData.ring = ring;
    return g;
  }

  setHover(cell, color) {
    if (!cell) { this.hover.visible = false; return; }
    this.hover.visible = true;
    this.hover.position.set(cell.x + 0.5, FLOOR_Y + 0.05, cell.y + 0.5);
    if (color) this.hover.userData.ring.material.color.setRGB(...color);
  }

  setPath(cells) {
    if (!cells || cells.length === 0) { this.pathDots.count = 0; return; }
    const m = new THREE.Matrix4();
    const n = Math.min(cells.length, 160);
    for (let i = 0; i < n; i++) {
      m.makeTranslation(cells[i].x + 0.5, -(cells[i].y + 0.5), FLOOR_Y + 0.04);
      this.pathDots.setMatrixAt(i, m);
    }
    this.pathDots.count = n;
    this.pathDots.instanceMatrix.needsUpdate = true;
  }

  showDirArrows(on, allowed) {
    this.dirArrows.visible = on;
    if (on) this.arrowMeshes.forEach((m) => { m.visible = true; });
    void allowed;
  }

  // -------------------------------------------------------------- level reset
  reset() {
    for (const m of this.monsters.values()) { this.group.remove(m.root); m.dispose(); }
    this.monsters.clear();
    for (const it of this.items.values()) this.group.remove(it.mesh);
    this.items.clear();
    for (const d of this.doors.values()) this.group.remove(d.mesh);
    this.doors.clear();
    for (const t of this.traps.values()) this.group.remove(t.mesh);
    this.traps.clear();
    if (this.stairs) { this.group.remove(this.stairs); this.stairs = null; }
    for (const t of this.torches) this.group.remove(t.mesh);
    this.torches = [];
    this.leaving.length = 0;
    this.detectGroup.clear();
    this.dirtyStatic = true;
  }

  ensureHero() {
    if (!this.hero) {
      this.hero = new Mini('@', 'hero');
      this.group.add(this.hero.root);
      this.hero.placeAt(S.hero.x + 0.5, S.hero.y + 0.5);
    }
    return this.hero;
  }

  monsterVisible(mon) {
    const g = screen[mon.t_pos.y * W + mon.t_pos.x];
    return isupper(g);
  }

  mini(mon) { return this.monsters.get(mon.id); }

  makeMonsterMini(mon) {
    const m = new Mini(mon.t_type, 'mon');
    const tier = mon.t_stats.s_lvl - S.player.t_stats.s_lvl;
    m.setRingColor(tier >= 5 ? 0xff2020 : tier >= 2 ? 0xff8a20 : tier >= -1 ? 0xe8c030 : 0x4ac860);
    m.placeAt(mon.t_pos.x + 0.5, mon.t_pos.y + 0.5);
    m.mon = mon;
    m.big = m.big || 1;
    m.appear = 0;
    this.group.add(m.root);
    m.root.traverse((o) => { if (o.isMesh) o.userData.mini = m; });
    this.monsters.set(mon.id, m);
    // sleep marker
    const z = this.makeZzz();
    m.root.add(z);
    m.zzz = z;
    return m;
  }

  makeZzz() {
    if (!Entities._zzzTex) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 64;
      const g = c.getContext('2d');
      g.font = 'bold 40px Georgia'; g.fillStyle = '#cfe4ff'; g.strokeStyle = '#223'; g.lineWidth = 4;
      g.strokeText('z', 16, 50); g.fillText('z', 16, 50);
      g.font = 'bold 30px Georgia'; g.strokeText('z', 54, 34); g.fillText('z', 54, 34);
      g.font = 'bold 22px Georgia'; g.strokeText('Z', 88, 20); g.fillText('Z', 88, 20);
      Entities._zzzTex = new THREE.CanvasTexture(c);
      Entities._zzzTex.colorSpace = THREE.SRGBColorSpace;
    }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: Entities._zzzTex, transparent: true, depthWrite: false, depthTest: false }));
    s.scale.set(0.6, 0.3, 1);
    s.position.set(0.15, 1.1, 0);
    s.renderOrder = 20;
    return s;
  }

  // -------------------------------------------------------------- sync with game state
  sync(now, fromEvent = false) {
    const hero = this.ensureHero();
    const player = S.player;
    if (!hero.mv) { hero.placeAt(S.hero.x + 0.5, S.hero.y + 0.5); }
    hero.sleeping = S.no_command > 0;
    hero.levit = !!(player.t_flags & D.ISLEVIT);
    this.stage.setFocus(hero.mv ? hero.mv.tx : S.hero.x + 0.5, hero.mv ? hero.mv.tz : S.hero.y + 0.5);

    // monsters
    const seenIds = new Set();
    for (const mon of S.mlist) {
      const vis = this.monsterVisible(mon);
      let m = this.monsters.get(mon.id);
      if (vis) {
        seenIds.add(mon.id);
        if (!m) m = this.makeMonsterMini(mon);
        if (m.fading && !m.death) { m.fading = false; m.unvanish(); }
        m.mon = mon;
        const detectedOnly = standout[mon.t_pos.y * W + mon.t_pos.x] && !this.board && false;
        void detectedOnly;
        if (!m.mv && !m.death) {
          const wx = mon.t_pos.x + 0.5, wz = mon.t_pos.y + 0.5;
          if (Math.abs(m.x - wx) + Math.abs(m.z - wz) > 0.01) m.placeAt(wx, wz);
        }
        m.sleeping = !(mon.t_flags & D.ISRUN) && !(mon.t_flags & D.ISHELD) && !m.recentlyActed;
        m.held = !!(mon.t_flags & D.ISHELD);
        m.root.visible = true;
        // ghost look for detected-but-unseen monsters
        const ghost = standout[mon.t_pos.y * W + mon.t_pos.x] === true;
        if (ghost !== !!m.ghost) { m.ghost = ghost; m.setAlpha(ghost ? 0.45 : 1); m.setRingColor(ghost ? 0xc040ff : m.ringMat.color.getHex()); }
        if (mon.t_flags & D.ISINVIS && (S.player.t_flags & D.CANSEE)) m.setAlpha(0.55);
      }
    }
    for (const [id, m] of this.monsters) {
      if (!seenIds.has(id) && !m.death) {
        // gone from sight (or gone from the level): fade out
        const alive = S.mlist.some((x) => x.id === id);
        if (!m.fading) { m.fading = true; m.vanish(now, alive ? 0.25 : 0.4); m.silent = true; }
      }
    }

    this.syncItems(now);
    this.syncStatic(now);
    this.syncDoorsTorches();
  }

  syncItems(now) {
    const want = new Map();
    const hallu = !!(S.player.t_flags & D.ISHALU);
    for (let y = 1; y < 23; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      const g = screen[k];
      if (!ITEM_GLYPHS.has(g)) continue;
      const obj = find_obj(y, x);
      const real = obj && obj.o_type === g ? obj : null;
      want.set(this.itemKeyFor(k, hallu ? 'h' : g, real), { x, y, g, obj: real });
    }
    for (const [key, it] of this.items) {
      if (!want.has(key)) {
        this.items.delete(key);
        this.retire(it, now);
      }
    }
    for (const [key, w] of want) {
      if (this.items.has(key)) continue;
      const spec = { value: w.obj ? w.obj.o_arm : 30, which: w.obj ? w.obj.o_which : (Math.random() * 3) | 0 };
      let kind = w.g;
      let ap = w.obj ? appearanceFor(S, w.obj) : {};
      if (!w.obj) {
        // mimic or hallucination: invent something plausible
        if (w.g === D.POTION) ap = { color: colorFor(D.rainbow[(Math.random() * 27) | 0]) };
        if (w.g === D.RING) ap = { color: colorFor(D.stones[(Math.random() * 20) | 0].st_name) };
        if (w.g === D.STICK) ap = { color: colorFor(D.metal[(Math.random() * 20) | 0]), staff: Math.random() < 0.5 };
      }
      Object.assign(spec, ap);
      const mesh = P.buildItem(kind, spec);
      cloneMats(mesh);
      mesh.position.set(w.x + 0.5, 0, w.y + 0.5);
      mesh.rotation.y = ((w.x * 7 + w.y * 13) % 10) * 0.4;
      mesh.scale.setScalar(0.001);
      this.group.add(mesh);
      this.items.set(key, { mesh, x: w.x, y: w.y, born: now, glow: mesh.userData.glow, sparkle: mesh.userData.sparkle, amulet: mesh.userData.amulet, kind });
    }
  }

  retire(it, now) {
    this.leaving.push({ it, t0: now, dur: 0.28, toHero: !!this.pickupPending });
  }

  syncStatic() {
    const b = this.board;
    // stairs
    const sx = S.stairs.x, sy = S.stairs.y, sk = sy * W + sx;
    const showStairs = b.seen[sk] && b.terr[sk] === TERR.STAIRS;
    if (showStairs && !this.stairs) {
      this.stairs = P.buildStairs();
      this.stairs.position.set(sx, 0, sy);
      this.group.add(this.stairs);
    } else if (!showStairs && this.stairs) { this.group.remove(this.stairs); this.stairs = null; }
    // traps
    const live = new Set();
    for (let k = 0; k < b.seen.length; k++) {
      if (b.seen[k] && b.terr[k] === TERR.TRAP) {
        live.add(k);
        if (!this.traps.has(k)) {
          const x = k % W, y = (k / W) | 0;
          const type = INDEX(y, x).p_flags & D.F_TMASK;
          const mesh = P.buildTrap(type);
          mesh.position.set(x + 0.5, 0, y + 0.5);
          this.group.add(mesh);
          this.traps.set(k, { mesh, born: this.stage.time });
        }
      }
    }
    for (const [k, t] of this.traps) if (!live.has(k)) { this.group.remove(t.mesh); this.traps.delete(k); }
  }

  syncDoorsTorches() {
    if (!this.dirtyStatic) return;
    this.dirtyStatic = false;
    const b = this.board;
    const live = new Set();
    for (const d of b.doorCells) {
      live.add(d.k);
      if (!this.doors.has(d.k)) {
        const mesh = P.buildDoor(d.horiz);
        mesh.position.set(d.x + (d.horiz ? 0 : 0), 0, d.y);
        if (!d.horiz) mesh.position.set(d.x, 0, d.y + 1);
        mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.group.add(mesh);
        this.doors.set(d.k, { mesh, open: 1, cell: d });
      }
    }
    for (const [k, d] of this.doors) if (!live.has(k)) { this.group.remove(d.mesh); this.doors.delete(k); }
    // torches
    const liveT = new Set();
    for (const s of b.torchSites) {
      liveT.add(s.k);
      if (this.torches.some((t) => t.site.k === s.k)) continue;
      const mesh = P.buildSconce();
      // wall face centre; (dx,dy) points into the room
      mesh.position.set(s.x + 0.5 + s.dx * 0.5, FLOOR_Y + WALL_H * 0.6, s.y + 0.5 + s.dy * 0.5);
      mesh.rotation.y = Math.atan2(s.dx, s.dy);
      this.group.add(mesh);
      this.torches.push({ mesh, site: s, seed: Math.random() * 10, light: null });
    }
    this.torches = this.torches.filter((t) => {
      if (!liveT.has(t.site.k)) { this.group.remove(t.mesh); return false; }
      return true;
    });
  }

  showDetect(kind, cells) {
    this.detectGroup.clear();
    const color = kind === 'magic' ? new THREE.Color(2.0, 0.8, 3.0) : new THREE.Color(1.0, 2.5, 0.8);
    for (const c of cells) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: P.haloTexture(), color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
      s.position.set(c.x + 0.5, 0.7, c.y + 0.5);
      s.scale.setScalar(1.7);
      s.renderOrder = 30;
      this.detectGroup.add(s);
    }
  }
  clearDetect() { this.detectGroup.clear(); }

  // -------------------------------------------------------------- per-frame
  update(dt, t) {
    const hero = this.hero;
    if (hero) {
      hero.update(dt, t);
      const tip = hero.rig.torchTip;
      if (tip) {
        tip.getWorldPosition(this._tmp || (this._tmp = new THREE.Vector3()));
        const L = this.stage.heroLight;
        L.position.set(this._tmp.x, this._tmp.y + 0.45, this._tmp.z);
        const blind = S.player.t_flags & D.ISBLIND;
        L.intensity = (blind ? 3 : 20) * (1 + Math.sin(t * 17) * 0.05 + Math.sin(t * 29) * 0.04);
      }
      this.board.heroX = hero.root.position.x;
      this.board.heroZ = hero.root.position.z;
      this.stage.heroWorld = hero.root.position;
      this.dirArrows.position.set(hero.root.position.x, FLOOR_Y, hero.root.position.z);
      if (this.dirArrows.visible) {
        const k = 0.5 + 0.5 * Math.sin(t * 6);
        this.arrowMeshes.forEach((m, i) => { const [dx, dy] = m.userData.d; const o = 0.95 + k * 0.12; m.position.set(dx * o, 0.35, dy * o); void i; });
      }
    }
    for (const [id, m] of this.monsters) {
      m.update(dt, t);
      if (m.dead) {
        this.group.remove(m.root);
        m.dispose();
        this.monsters.delete(id);
      }
    }
    // door animation
    const near = [];
    if (hero) near.push([hero.x, hero.z]);
    for (const m of this.monsters.values()) near.push([m.x, m.z]);
    for (const d of this.doors.values()) {
      const cx = d.cell.x + 0.5, cz = d.cell.y + 0.5;
      const occ = near.some(([x, z]) => Math.abs(x - cx) < 1.2 && Math.abs(z - cz) < 1.2);
      d.open += ((occ ? 1.0 : 0.62) - d.open) * (1 - Math.exp(-dt * 8));
      d.mesh.userData.hinge.rotation.y = -1.25 * d.open - (occ ? 0.2 : 0);
    }
    // items: grow in, glow pulse, sparkle
    for (const it of this.items.values()) {
      const a = Math.min(1, (t - it.born) / 0.3);
      const s = a < 1 ? 0.001 + (1 - Math.pow(1 - a, 3)) * 1.0 : 1;
      it.mesh.scale.setScalar(s);
      const vis = this.board.vis[it.y * W + it.x];
      const dim = 0.35 + 0.65 * Math.min(1, vis * 1.2);
      if (it.dim !== dim) { it.dim = dim; dimGroup(it.mesh, dim); }
      if (it.glow) it.mesh.position.y = Math.sin(t * 2 + it.x) * 0.012;
      if (it.amulet) it.mesh.rotation.y = t * 0.8;
    }
    // leaving items
    for (let i = this.leaving.length - 1; i >= 0; i--) {
      const l = this.leaving[i];
      const p = (t - l.t0) / l.dur;
      if (p >= 1) { this.group.remove(l.it.mesh); this.leaving.splice(i, 1); continue; }
      l.it.mesh.scale.setScalar(Math.max(0.001, 1 - p));
      if (hero && l.toHero) {
        const tx = hero.root.position.x, tz = hero.root.position.z;
        l.it.mesh.position.x += (tx - l.it.mesh.position.x) * Math.min(1, dt * 12);
        l.it.mesh.position.z += (tz - l.it.mesh.position.z) * Math.min(1, dt * 12);
        l.it.mesh.position.y = Math.sin(p * Math.PI) * 0.6;
      } else l.it.mesh.position.y += dt * 0.5;
    }
    // stairs rune
    if (this.stairs) this.stairs.userData.rune.rotation.z = t * 0.25;
    // torches: flicker; pool lights to the nearest ones
    const pool = this.stage.torchPool;
    const hx = hero ? hero.root.position.x : 0, hz = hero ? hero.root.position.z : 0;
    for (const tr of this.torches) {
      const f = 1 + Math.sin(t * 13 + tr.seed) * 0.12 + Math.sin(t * 31 + tr.seed * 2) * 0.08;
      const fl = tr.mesh.userData.flame;
      fl.scale.set(f, f * 1.2, f);
      tr.mesh.userData.halo.material.opacity = 0.42 * f;
      tr.d2 = (tr.mesh.position.x - hx) ** 2 + (tr.mesh.position.z - hz) ** 2;
      tr.f = f;
      if (this.fx && tr.d2 < 400 && Math.random() < dt * 2.2) this.fx.embers({ x: tr.mesh.position.x + tr.site.dx * 0.14, y: tr.mesh.position.y + 0.38, z: tr.mesh.position.z + tr.site.dy * 0.14 });
    }
    const sorted = this.torches.slice().sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < pool.length; i++) {
      const l = pool[i];
      const tr = sorted[i];
      if (tr && tr.d2 < 400 && this.board.vis[tr.site.k] > 0.2) {
        l.position.copy(tr.mesh.position).add(new THREE.Vector3(tr.site.dx * 0.3, 0.2, tr.site.dy * 0.3));
        l.intensity += (24 * tr.f - l.intensity) * Math.min(1, dt * 8);
      } else l.intensity += (0 - l.intensity) * Math.min(1, dt * 8);
    }
    // trap pulse
    for (const tr of this.traps.values()) {
      const type = tr.mesh.userData.type;
      const p = tr.mesh.userData.plate.material;
      if (type === D.T_TELEP || type === D.T_SLEEP || type === D.T_MYST) p.emissiveIntensity = 0.5 + 0.35 * Math.sin(t * 3);
      const a = Math.min(1, (t - tr.born) / 0.4);
      tr.mesh.scale.setScalar(0.4 + 0.6 * a);
    }
    if (this.hover.visible) this.hover.userData.ring.scale.setScalar(1 + Math.sin(t * 6) * 0.05);
  }
}
