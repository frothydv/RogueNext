// 3D props: floor items, doors, stairs, traps, wall torches, and the kitchen-table clutter.
import * as THREE from 'three';
import * as D from '../rogue/data.js';
import { FLOOR_Y, WALL_H } from './board.js';
import { colorFor, drawIcon } from './icons.js';
import * as T from './textures.js';
import { instantiate, hasModel } from './models.js';

const mats = new Map();
function M(hex, o = {}) {
  const key = hex + '|' + JSON.stringify(o);
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: hex, roughness: o.rough ?? 0.5, metalness: o.metal ?? 0, emissive: o.emit ?? 0, emissiveIntensity: o.emitI ?? 1,
      transparent: o.alpha !== undefined, opacity: o.alpha ?? 1, side: o.double ? THREE.DoubleSide : THREE.FrontSide, flatShading: !!o.flat,
    });
    if (o.envI !== undefined) m.envMapIntensity = o.envI;
    mats.set(key, m);
  }
  return m;
}
const col = (name) => new THREE.Color(colorFor(name));
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
const sph = (r, m, x, y, z) => mesh(new THREE.SphereGeometry(r, 16, 12), m, x, y, z);
const cyl = (rt, rb, h, m, x, y, z, s = 14) => mesh(new THREE.CylinderGeometry(rt, rb, h, s), m, x, y, z);
const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
const cone = (r, h, m, x, y, z, s = 10) => mesh(new THREE.ConeGeometry(r, h, s), m, x, y, z);
const A = (p, c) => { p.add(c); return c; };

let coinGeo = null;
function coin() {
  if (!coinGeo) coinGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.016, 14);
  return coinGeo;
}

// ------------------------------------------------------------------ floor items
export function buildItem(kind, spec = {}) {
  const g = new THREE.Group();
  const y0 = FLOOR_Y;
  const tilt = (Math.random() - 0.5) * 1.2;
  switch (kind) {
    case D.GOLD: {
      const n = Math.min(26, 8 + Math.round((spec.value || 30) / 12));
      const gold = M(0xe8b830, { metal: 0.9, rough: 0.28, emit: 0x6a4a00, emitI: 0.35 });
      const gold2 = M(0xf4cc50, { metal: 0.9, rough: 0.22, emit: 0x7a5a00, emitI: 0.3 });
      for (let i = 0; i < n; i++) {
        const r = Math.sqrt(Math.random()) * 0.2 * (0.6 + n / 40);
        const a = Math.random() * 6.28;
        const layer = Math.floor((1 - r / 0.28) * 3);
        const c = mesh(coin(), i % 2 ? gold : gold2, Math.cos(a) * r, y0 + 0.01 + layer * 0.014, Math.sin(a) * r);
        c.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * 6, (Math.random() - 0.5) * 0.35);
        g.add(c);
      }
      g.userData.sparkle = true;
      break;
    }
    case D.POTION: {
      const c = col(spec.color);
      const glass = M(0xdff4ff, { rough: 0.05, alpha: 0.42, envI: 2.2 });
      const liquid = M(c.getHex(), { rough: 0.15, alpha: 0.88, emit: c.getHex(), emitI: 0.55, envI: 1.6 });
      g.add(sph(0.12, glass, 0, y0 + 0.13, 0));
      const liq = sph(0.1, liquid, 0, y0 + 0.115, 0); liq.scale.y = 0.85; liq.castShadow = false; g.add(liq);
      g.add(cyl(0.035, 0.05, 0.12, glass, 0, y0 + 0.28, 0));
      g.add(cyl(0.04, 0.035, 0.05, M(0xa8743a, { rough: 0.8 }), 0, y0 + 0.36, 0));
      g.userData.glow = c;
      break;
    }
    case D.SCROLL: {
      const par = M(0xe8d6a0, { rough: 0.85 });
      const s = cyl(0.055, 0.055, 0.36, par, 0, y0 + 0.06, 0, 12);
      s.rotation.z = Math.PI / 2; s.rotation.y = tilt;
      g.add(s);
      const rib = cyl(0.062, 0.062, 0.05, M(0xa01820, { rough: 0.7 }), 0, y0 + 0.06, 0, 12);
      rib.rotation.z = Math.PI / 2; rib.rotation.y = tilt; g.add(rib);
      for (const sx of [-1, 1]) {
        const cap = cyl(0.04, 0.04, 0.03, M(0x6a4a2a, { rough: 0.7 }), sx * 0.19 * Math.cos(tilt), y0 + 0.06, -sx * 0.19 * Math.sin(tilt), 10);
        cap.rotation.z = Math.PI / 2; cap.rotation.y = tilt; g.add(cap);
      }
      break;
    }
    case D.FOOD: {
      if (spec.which === 1) {
        g.add(sph(0.11, M(0x6fbf3a, { rough: 0.4 }), 0, y0 + 0.11, 0));
        const lf = cone(0.04, 0.12, M(0x2f7a24), 0.05, y0 + 0.24, 0); lf.rotation.z = -0.8; g.add(lf);
      } else {
        const cloth = M(0xc8a878, { rough: 0.9 });
        const b = box(0.3, 0.16, 0.2, cloth, 0, y0 + 0.08, 0); b.rotation.y = tilt; g.add(b);
        const str = box(0.32, 0.02, 0.02, M(0x6a4a2a), 0, y0 + 0.165, 0); str.rotation.y = tilt; g.add(str);
        const str2 = box(0.02, 0.02, 0.22, M(0x6a4a2a), 0, y0 + 0.165, 0); str2.rotation.y = tilt; g.add(str2);
        const loaf = sph(0.1, M(0xb88040, { rough: 0.8 }), 0.0, y0 + 0.2, 0); loaf.scale.set(1.5, 0.7, 0.9); loaf.rotation.y = tilt; g.add(loaf);
      }
      break;
    }
    case D.WEAPON: g.add(weaponMesh(spec.which, y0, tilt)); break;
    case D.ARMOR: g.add(armorMesh(spec.which, y0, tilt)); break;
    case D.RING: {
      const c = col(spec.color);
      const gold = M(0xe8c050, { metal: 1, rough: 0.2 });
      const tor = mesh(new THREE.TorusGeometry(0.1, 0.028, 10, 24), gold, 0, y0 + 0.11, 0);
      tor.rotation.x = Math.PI / 2 - 0.4;
      g.add(tor);
      const gem = mesh(new THREE.OctahedronGeometry(0.05), M(c.getHex(), { rough: 0.1, emit: c.getHex(), emitI: 0.9, envI: 2.5 }), 0, y0 + 0.2, -0.04);
      gem.scale.y = 1.3;
      g.add(gem);
      g.userData.glow = c;
      break;
    }
    case D.STICK: {
      const c = col(spec.color);
      const body = cyl(spec.staff ? 0.03 : 0.022, spec.staff ? 0.03 : 0.022, spec.staff ? 0.62 : 0.5, M(c.getHex(), { rough: spec.staff ? 0.8 : 0.3, metal: spec.staff ? 0 : 0.8 }), 0, y0 + 0.04, 0, 8);
      body.rotation.z = Math.PI / 2; body.rotation.y = tilt; g.add(body);
      const tip = sph(0.045, M(0x80d8ff, { emit: 0x50c0ff, emitI: 2.2, rough: 0.2 }), 0.3 * Math.cos(tilt) * (spec.staff ? 1 : 0.8), y0 + 0.05, -0.3 * Math.sin(tilt) * (spec.staff ? 1 : 0.8));
      tip.castShadow = false; g.add(tip);
      g.userData.glow = new THREE.Color(0x60c8ff);
      break;
    }
    case D.AMULET: {
      const gold = M(0xf0c040, { metal: 1, rough: 0.18, emit: 0x5a3a00, emitI: 0.4 });
      const d = cyl(0.14, 0.14, 0.03, gold, 0, y0 + 0.05, 0, 28); g.add(d);
      const gem = sph(0.09, M(0xff2040, { rough: 0.1, emit: 0xff1030, emitI: 2.2, envI: 2 }), 0, y0 + 0.11, 0); gem.scale.y = 0.7; g.add(gem);
      const chain = mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 26), gold, 0, y0 + 0.03, 0); chain.rotation.x = Math.PI / 2; chain.scale.set(1, 1.3, 1); g.add(chain);
      g.userData.glow = new THREE.Color(0xff3050);
      g.userData.amulet = true;
      break;
    }
    case D.TRAP: break;
    default: {
      const q = sph(0.12, M(0xaa88ff, { emit: 0x6644ff, emitI: 0.8 }), 0, y0 + 0.14, 0); g.add(q);
    }
  }
  return g;
}

function weaponMesh(which, y0, tilt) {
  const g = new THREE.Group();
  const steel = M(0xc4c8d4, { metal: 0.9, rough: 0.22, envI: 1.6 });
  const dark = M(0x70747e, { metal: 0.8, rough: 0.35 });
  const wood = M(0x7a4a22, { rough: 0.8 });
  const gold = M(0xc8a040, { metal: 0.9, rough: 0.3 });
  const lay = (m, rx = 0) => { m.rotation.z = Math.PI / 2; m.rotation.y = tilt; m.rotation.x = rx; return m; };
  const at = (len, f) => [Math.cos(tilt) * len * f, -Math.sin(tilt) * len * f];
  switch (which) {
    case D.MACE: {
      g.add(lay(cyl(0.022, 0.026, 0.5, wood, 0, y0 + 0.04, 0, 8)));
      const [hx, hz] = at(0.5, 0.5);
      const head = sph(0.075, dark, hx, y0 + 0.08, hz); g.add(head);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; const s = cone(0.02, 0.07, dark, hx + Math.cos(a) * 0.08, y0 + 0.08 + Math.sin(a) * 0.06, hz); s.rotation.z = -a + Math.PI / 2; g.add(s); }
      break;
    }
    case D.SWORD: case D.TWOSWORD: {
      const L = which === D.TWOSWORD ? 0.78 : 0.58;
      const b = box(L, 0.012, 0.06, steel, 0, y0 + 0.02, 0); b.rotation.y = tilt; b.position.x += at(L, 0.25)[0]; b.position.z += at(L, 0.25)[1];
      g.add(b);
      const [gx, gz] = at(L, -0.25);
      const guard = box(0.02, 0.02, 0.2, gold, gx, y0 + 0.02, gz); guard.rotation.y = tilt; g.add(guard);
      const [hx, hz] = at(0.2, -1.5);
      const grip = lay(cyl(0.02, 0.02, 0.18, wood, gx + hx * 0.4, y0 + 0.02, gz + hz * 0.4, 8)); g.add(grip);
      g.add(sph(0.03, gold, gx + hx * 0.85, y0 + 0.02, gz + hz * 0.85));
      break;
    }
    case D.DAGGER: {
      const b = box(0.24, 0.01, 0.04, steel, 0, y0 + 0.02, 0); b.rotation.y = tilt; g.add(b);
      g.add(lay(cyl(0.017, 0.017, 0.1, wood, -0.16 * Math.cos(tilt), y0 + 0.02, 0.16 * Math.sin(tilt), 8)));
      break;
    }
    case D.SPEAR: {
      g.add(lay(cyl(0.015, 0.015, 0.9, wood, 0, y0 + 0.03, 0, 6)));
      const [hx, hz] = at(0.9, 0.52);
      const tip = cone(0.04, 0.16, steel, hx, y0 + 0.03, hz, 6); tip.rotation.z = -Math.PI / 2; tip.rotation.y = tilt; g.add(tip);
      break;
    }
    case D.BOW: {
      const arc = mesh(new THREE.TorusGeometry(0.28, 0.014, 6, 24, Math.PI), wood, 0, y0 + 0.03, 0);
      arc.rotation.x = Math.PI / 2; arc.rotation.z = tilt; g.add(arc);
      g.add(lay(cyl(0.004, 0.004, 0.56, M(0xe8e0c8), 0, y0 + 0.03, 0.0, 4)));
      g.children[1].rotation.y = tilt + Math.PI / 2; g.children[1].rotation.z = Math.PI / 2;
      break;
    }
    case D.ARROW: case D.DART: {
      for (let i = 0; i < 4; i++) {
        const s = lay(cyl(0.008, 0.008, which === D.ARROW ? 0.4 : 0.22, wood, 0, y0 + 0.02 + i * 0.002, (i - 1.5) * 0.04, 5));
        g.add(s);
        const hd = cone(0.016, 0.05, steel, 0.2 * Math.cos(tilt), y0 + 0.02, (i - 1.5) * 0.04 - 0.2 * Math.sin(tilt), 5);
        hd.rotation.z = -Math.PI / 2; hd.rotation.y = tilt; g.add(hd);
      }
      break;
    }
    case D.SHIRAKEN: {
      for (let i = 0; i < 3; i++) {
        const st = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 8), steel, (i - 1) * 0.1, y0 + 0.012 + i * 0.01, (i % 2) * 0.05);
        st.scale.set(1, 1, 1);
        g.add(st);
      }
      break;
    }
    default: g.add(lay(cyl(0.03, 0.03, 0.4, steel, 0, y0 + 0.04, 0, 6)));
  }
  return g;
}

function armorMesh(which, y0, tilt) {
  const g = new THREE.Group();
  const cols = [0x8a5a30, 0x9aa0a8, 0x7a5030, 0xb0a070, 0xb8bcc8, 0xa0a8b8, 0x9a9eb0, 0xe0e4f0];
  const leather = which === D.LEATHER || which === D.STUDDED_LEATHER;
  const m = M(cols[which] ?? 0x9aa0a8, { metal: leather ? 0 : 0.85, rough: leather ? 0.8 : 0.3, envI: 1.5 });
  const chest = mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 16, 1, true, -1.3, 2.6), m, 0, y0 + 0.14, 0);
  chest.material = m.clone(); chest.material.side = THREE.DoubleSide;
  chest.rotation.y = tilt + Math.PI / 2;
  g.add(chest);
  const back = mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 16, 1, true, 1.84, 2.6), chest.material, 0, y0 + 0.14, 0);
  back.rotation.y = tilt + Math.PI / 2; g.add(back);
  for (const s of [-1, 1]) {
    const sh = sph(0.075, m, s * 0.17 * Math.cos(tilt), y0 + 0.24, -s * 0.17 * Math.sin(tilt)); sh.scale.set(1, 0.6, 1); g.add(sh);
  }
  if (!leather) { const trim = mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 20), M(0xc8a040, { metal: 1, rough: 0.3 }), 0, y0 + 0.25, 0); trim.rotation.x = Math.PI / 2; g.add(trim); }
  return g;
}

// ------------------------------------------------------------------ doors, stairs, traps, torches
function placed(name, x, y, z) {
  const inst = instantiate(name);
  inst.root.position.set(x, y, z);
  return inst;
}

export function buildDoor(horiz, openTo = 1) {
  if (hasModel('tile_door')) {
    // One arch standing in the middle of the cell (you walk through it); its leaf, cut from the arch, hangs on the west
    // jamb and swings.
    const g = new THREE.Group();
    const inst = instantiate('tile_door');
    const root = inst.root;
    const frame = root.getObjectByName('frame'), leaf = root.getObjectByName('leaf');
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(frame);
    const sc = 1 / (box.max.x - box.min.x);
    const depth = 1 / sc; // one cell, in model units
    const mid = new THREE.Box3().setFromObject(frame).getCenter(new THREE.Vector3()).z;
    frame.position.z += depth / 2 - mid;
    root.updateMatrixWorld(true);
    leaf.position.z += depth / 2 - new THREE.Box3().setFromObject(leaf).getCenter(new THREE.Vector3()).z;
    root.updateMatrixWorld(true);
    const lb = new THREE.Box3().setFromObject(leaf);
    const hinge = new THREE.Group();
    hinge.position.set(lb.min.x, 0, (lb.min.z + lb.max.z) / 2);
    root.add(hinge);
    hinge.updateMatrixWorld(true);
    hinge.attach(leaf);
    root.scale.setScalar(sc);
    root.position.set(0.5 - (box.min.x + box.max.x) / 2 * sc, FLOOR_Y - 0.01 - box.min.y * sc, 0);
    g.add(root);
    g.userData.hinge = hinge;
    hinge.rotation.y = -1.25 * openTo;
    if (!horiz) { g.rotation.y = -Math.PI / 2; g.position.set(0, 0, 1); }
    return g;
  }
  if (hasModel('kit_door')) {
    const g = new THREE.Group();
    const inst = placed('kit_door', 0.5, FLOOR_Y, 0.5);
    g.add(inst.root);
    g.userData.hinge = inst.rig.hinge;
    inst.rig.hinge.rotation.y = -1.25 * openTo;
    if (!horiz) { g.rotation.y = -Math.PI / 2; g.position.set(0, 0, 1); }
    return g;
  }
  const g = new THREE.Group();
  const wood = M(0x6a4326, { rough: 0.7 });
  const iron = M(0x2a2a30, { metal: 0.8, rough: 0.45 });
  const stone = M(0x8a8478, { rough: 0.9 });
  const slab = box(1, 0.05, 1, stone, 0.5, FLOOR_Y + 0.02, 0.5);
  slab.castShadow = false; g.add(slab);
  const hinge = new THREE.Group();
  hinge.position.set(0.08, FLOOR_Y + 0.04, 0.12);
  const leaf = new THREE.Group();
  leaf.position.set(0.42, 0.44, 0);
  leaf.add(box(0.84, 0.88, 0.07, wood, 0, 0, 0));
  for (const y of [-0.28, 0.28]) leaf.add(box(0.86, 0.07, 0.085, iron, 0, y, 0));
  leaf.add(box(0.07, 0.88, 0.085, iron, -0.3, 0, 0));
  leaf.add(sph(0.035, iron, 0.32, 0, 0.05));
  hinge.add(leaf);
  hinge.rotation.y = -1.25 * openTo;
  g.add(hinge);
  g.userData.hinge = hinge;
  if (!horiz) { g.rotation.y = -Math.PI / 2; g.position.set(0, 0, 1); }
  return g;
}

let stairsTex = null;
function stairsTexture() {
  if (stairsTex) return stairsTex;
  const c = T.canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#050403'; g.fillRect(0, 0, 512, 512);
  // descending square spiral steps, brighter at the rim
  for (let i = 0; i < 9; i++) {
    const m = 20 + i * 24;
    const l = 64 - i * 6;
    g.fillStyle = `hsl(32 22% ${l * 0.7}%)`;
    g.fillRect(m, m, 512 - m * 2, 512 - m * 2);
    g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = 3; g.strokeRect(m, m, 512 - m * 2, 512 - m * 2);
  }
  const rg = g.createRadialGradient(256, 256, 10, 256, 256, 150);
  rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
  stairsTex = T.canvasTexture(c);
  return stairsTex;
}
let runeTex = null;
function runeTexture() {
  if (runeTex) return runeTex;
  const c = T.canvas(256, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = '#ffc060'; g.fillStyle = '#ffc060'; g.lineWidth = 6; g.shadowColor = '#ff9020'; g.shadowBlur = 14;
  g.beginPath(); g.arc(128, 128, 112, 0, 7); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 96, 0, 7); g.stroke();
  const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ';
  g.font = 'bold 26px serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * 6.283;
    g.save(); g.translate(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104); g.rotate(a + Math.PI / 2);
    g.fillText(glyphs[i], 0, 0); g.restore();
  }
  runeTex = T.canvasTexture(c);
  return runeTex;
}

export function buildStairs() {
  const g = new THREE.Group();
  const modelled = hasModel('kit_stairs');
  if (modelled) g.add(placed('kit_stairs', 0.5, FLOOR_Y, 0.5).root);
  const stone = M(0x6a655a, { rough: 0.85 });
  if (!modelled) {
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), new THREE.MeshStandardMaterial({ map: stairsTexture(), roughness: 1 }));
    pit.rotation.x = -Math.PI / 2; pit.position.set(0.5, FLOOR_Y + 0.012, 0.5); pit.receiveShadow = true;
    g.add(pit);
    for (const [w, d, x, z] of [[1, 0.1, 0.5, 0.05], [1, 0.1, 0.5, 0.95], [0.1, 0.8, 0.05, 0.5], [0.1, 0.8, 0.95, 0.5]])
      g.add(box(w, 0.1, d, stone, x, FLOOR_Y + 0.05, z));
  }
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: runeTexture(), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(2.2, 1.5, 0.7) }));
  rune.rotation.x = -Math.PI / 2; rune.position.set(0.5, FLOOR_Y + (modelled ? 0.07 : 0.02), 0.5);
  g.add(rune);
  g.userData.rune = rune;
  return g;
}

const trapIcons = new Map();
function trapTexture(type) {
  if (trapIcons.has(type)) return trapIcons.get(type);
  const c = T.canvas(256, 256);
  const g = c.getContext('2d');
  const palette = ['#3a2a1a', '#8a8a94', '#58c868', '#9a9aa4', '#b060ff', '#5aaa40', '#4a8ad0', '#ff70d0'][type];
  g.clearRect(0, 0, 256, 256);
  g.fillStyle = '#1a1612'; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.fill();
  g.strokeStyle = palette; g.lineWidth = 8; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.stroke();
  g.fillStyle = palette; g.strokeStyle = palette; g.lineWidth = 8;
  switch (type) {
    case D.T_DOOR: g.fillStyle = '#050403'; g.fillRect(60, 60, 136, 136); g.strokeStyle = '#6a4a2a'; g.lineWidth = 10; for (let x = 60; x <= 196; x += 34) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x, 196); g.stroke(); } break;
    case D.T_ARROW: for (const [x, y] of [[90, 90], [166, 90], [128, 166]]) { g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); } g.beginPath(); g.moveTo(60, 190); g.lineTo(196, 70); g.stroke(); break;
    case D.T_SLEEP: g.font = 'bold 120px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Zz', 128, 132); break;
    case D.T_BEAR: g.beginPath(); for (let i = 0; i < 8; i++) { g.lineTo(40 + i * 25, i % 2 ? 90 : 160); } g.stroke(); g.beginPath(); for (let i = 0; i < 8; i++) { g.lineTo(40 + i * 25, i % 2 ? 160 : 90); } g.stroke(); break;
    case D.T_TELEP: g.beginPath(); for (let a = 0; a < 18; a += 0.1) { const r = 6 + a * 5.5; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.stroke(); break;
    case D.T_DART: for (const [x, y] of [[80, 100], [128, 80], [176, 100], [104, 160], [152, 160]]) { g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); } break;
    case D.T_RUST: g.beginPath(); g.moveTo(128, 50); g.bezierCurveTo(60, 130, 80, 200, 128, 200); g.bezierCurveTo(176, 200, 196, 130, 128, 50); g.fill(); break;
    default: g.font = 'bold 150px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 128, 136);
  }
  const t = T.canvasTexture(c);
  trapIcons.set(type, t);
  return t;
}
export function buildTrap(type) {
  const g = new THREE.Group();
  if (hasModel(`kit_trap${type}`)) {
    const inst = placed(`kit_trap${type}`, 0, FLOOR_Y, 0);
    g.add(inst.root);
    g.userData.glow = inst.matList.filter((m) => m.emissive && m.emissive.getHex() > 0 && m.userData.baseEmissiveI > 0.01);
    g.userData.type = type;
    return g;
  }
  const em = [0, 0, 0.5, 0, 1.2, 0, 0.3, 1.0][type];
  const mat = new THREE.MeshStandardMaterial({ map: trapTexture(type), roughness: 0.6, metalness: 0.3, emissive: new THREE.Color(0xffffff), emissiveMap: trapTexture(type), emissiveIntensity: em * 0.6, transparent: true });
  const plate = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32), mat);
  plate.rotation.x = -Math.PI / 2; plate.position.set(0, FLOOR_Y + 0.014, 0); plate.receiveShadow = true;
  g.add(plate);
  if (type === D.T_ARROW || type === D.T_DART) {
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [0, 0.2]]) g.add(cone(0.02, 0.08, M(0xb8bcc8, { metal: 1, rough: 0.3 }), x, FLOOR_Y + 0.06, z, 5));
  }
  if (type === D.T_BEAR) {
    const j = M(0x8a8a94, { metal: 0.9, rough: 0.35 });
    for (let i = 0; i < 6; i++) { g.add(cone(0.035, 0.12, j, -0.2 + i * 0.08, FLOOR_Y + 0.07, -0.08, 4)); g.add(cone(0.035, 0.12, j, -0.2 + i * 0.08, FLOOR_Y + 0.07, 0.08, 4)); }
  }
  g.userData.plate = plate;
  g.userData.type = type;
  return g;
}

export function buildSconce() {
  const g = new THREE.Group();
  const modelled = hasModel('kit_sconce');
  if (modelled) g.add(instantiate('kit_sconce').root);
  const iron = M(0x2a2622, { metal: 0.8, rough: 0.5 });
  const wood = M(0x4a3018, { rough: 0.8 });
  if (!modelled) {
    g.add(box(0.1, 0.22, 0.04, iron, 0, 0, 0));
    const arm = cyl(0.014, 0.014, 0.14, iron, 0, 0.05, 0.08, 6); arm.rotation.x = Math.PI / 2; g.add(arm);
    const cup = cyl(0.045, 0.03, 0.06, iron, 0, 0.1, 0.14, 8); g.add(cup);
    g.add(cyl(0.022, 0.026, 0.2, wood, 0, 0.22, 0.14, 8));
  }
  const flame = new THREE.Group();
  flame.position.set(0, modelled ? 0.44 : 0.36, 0.14);
  const f1 = cone(0.055, 0.2, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.1, 0.25), transparent: true, opacity: 0.95 }), 0, 0, 0, 8);
  const f2 = cone(0.032, 0.13, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 2.6, 1.0), transparent: true, opacity: 1 }), 0, -0.02, 0, 8);
  f1.castShadow = f2.castShadow = false;
  flame.add(f1, f2);
  g.add(flame);
  g.userData.flame = flame;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color(3.0, 1.4, 0.5), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.9);
  halo.position.copy(flame.position);
  g.add(halo);
  g.userData.halo = halo;
  return g;
}
let _halo = null;
export function haloTexture() {
  if (_halo) return _halo;
  const c = T.canvas(128, 128);
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,255,255,.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  _halo = T.canvasTexture(c, false);
  return _halo;
}

// ------------------------------------------------------------------ tabletop clutter
function cardTexture(kind, w = 256, h = 360) {
  const c = T.canvas(w, h);
  const g = c.getContext('2d');
  const themes = { potion: ['#2a1f3a', '#8a4ae0'], sword: ['#2a2a2a', '#c0c0d0'], monster: ['#3a1a14', '#e07040'], scroll: ['#3a2f1a', '#e8d090'], armor: ['#1f2a33', '#90a8c0'], gem: ['#102a22', '#40d0a0'] };
  const [bg, fg] = themes[kind] || themes.sword;
  g.fillStyle = '#e8dcc0'; g.beginPath(); g.roundRect(0, 0, w, h, 16); g.fill();
  g.fillStyle = bg; g.beginPath(); g.roundRect(10, 10, w - 20, h - 20, 10); g.fill();
  const rg = g.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, w * 0.6);
  rg.addColorStop(0, fg + 'aa'); rg.addColorStop(1, bg);
  g.fillStyle = rg; g.fillRect(24, 40, w - 48, h * 0.55);
  g.save(); g.translate(w / 2 - 70, h * 0.45 - 70);
  const map = { potion: [D.POTION, 3], sword: [D.WEAPON, 1], monster: [D.WEAPON, 0], scroll: [D.SCROLL, 0], armor: [D.ARMOR, 4], gem: [D.RING, 0] };
  const [type, which] = map[kind] || map.sword;
  drawIcon(g, { type, which, color: fg }, 140);
  g.restore();
  g.fillStyle = '#e8dcc0'; g.font = 'bold 26px "Palatino Linotype", Georgia, serif'; g.textAlign = 'center';
  g.fillText(kind.toUpperCase(), w / 2, 34);
  g.font = '15px Georgia'; g.fillStyle = '#d8c8a0';
  for (let i = 0; i < 4; i++) g.fillRect(34, h * 0.68 + i * 22, w - 68 - (i % 2) * 40, 3);
  return T.canvasTexture(c);
}

function mugTexture() {
  const c = T.canvas(512, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < 200; i++) g.fillRect(Math.random() * 512, Math.random() * 256, 3, 3);
  // shield emblem
  g.save(); g.translate(256, 128);
  g.fillStyle = '#b8541c'; g.strokeStyle = '#4a2a10'; g.lineWidth = 6;
  g.beginPath(); g.moveTo(-60, -80); g.lineTo(60, -80); g.lineTo(60, 10); g.quadraticCurveTo(60, 70, 0, 95); g.quadraticCurveTo(-60, 70, -60, 10); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#2a1a0a'; g.beginPath(); g.moveTo(-30, -50); g.lineTo(0, 0); g.lineTo(30, -50); g.lineTo(30, 20); g.lineTo(0, 60); g.lineTo(-30, 20); g.closePath(); g.fill();
  g.fillStyle = '#f0c870'; g.font = 'bold 20px Georgia'; g.textAlign = 'center'; g.fillText('DUNGEON', 0, -86); g.restore();
  g.fillStyle = '#4a2a10'; g.font = 'bold 22px Georgia'; g.textAlign = 'center'; g.fillText('CRAWLER', 256, 240);
  return T.canvasTexture(g.canvas);
}

function bookTexture(title, sub) {
  const c = T.canvas(512, 700);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 700);
  gr.addColorStop(0, '#16100c'); gr.addColorStop(1, '#2a1410');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 700);
  g.strokeStyle = '#b8862a'; g.lineWidth = 6; g.strokeRect(16, 16, 480, 668);
  g.fillStyle = '#d83020'; g.font = 'bold 96px Georgia'; g.textAlign = 'center';
  g.shadowColor = '#000'; g.shadowBlur = 10;
  g.fillText(title, 256, 120);
  g.font = 'italic 30px Georgia'; g.fillStyle = '#f0d890';
  g.fillText(sub, 256, 180);
  g.shadowBlur = 0;
  // torch-lit figure
  const rg = g.createRadialGradient(256, 420, 10, 256, 420, 260);
  rg.addColorStop(0, '#f0a030'); rg.addColorStop(0.3, '#7a3a14'); rg.addColorStop(1, '#16100c');
  g.fillStyle = rg; g.fillRect(40, 230, 432, 430);
  g.fillStyle = '#0c0806'; g.beginPath(); g.ellipse(256, 420, 110, 150, 0, 0, 7); g.fill();
  g.fillStyle = '#d8a870'; g.beginPath(); g.ellipse(256, 380, 52, 62, 0, 0, 7); g.fill();
  g.fillStyle = '#2a3a5a'; g.beginPath(); g.ellipse(256, 345, 70, 60, 0, Math.PI, 0); g.fill();
  g.fillStyle = '#ffcc40'; g.beginPath(); g.ellipse(360, 330, 18, 36, 0, 0, 7); g.fill();
  return T.canvasTexture(c);
}

export function buildTableProps(parent, mapTexture) {
  const L = new THREE.Group(), R = new THREE.Group(), B = new THREE.Group(), Tt = new THREE.Group();
  parent.add(L, R, B, Tt);
  const rnd = (a, b) => a + Math.random() * (b - a);
  // mug (left, top-ish)
  const mug = new THREE.Group();
  const profile = [[0.0, 0], [0.62, 0], [0.64, 0.05], [0.66, 0.9], [0.62, 0.95], [0.58, 0.9], [0.56, 0.1], [0, 0.08]].map(([x, y]) => new THREE.Vector2(x, y));
  const mugMat = new THREE.MeshStandardMaterial({ map: mugTexture(), roughness: 0.25, metalness: 0, envMapIntensity: 1.4 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), mugMat);
  body.rotation.y = Math.PI / 2;
  body.castShadow = true; body.receiveShadow = true;
  mug.add(body);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 10, 20, Math.PI), mugMat);
  handle.position.set(0.62, 0.5, 0); handle.rotation.z = -Math.PI / 2; handle.castShadow = true;
  mug.add(handle);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshStandardMaterial({ color: 0x1a0d06, roughness: 0.15, envMapIntensity: 2 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.82;
  mug.add(coffee);
  mug.scale.setScalar(2.1);
  mug.position.set(-5.5, 0, -7);
  mug.rotation.y = -0.7;
  L.add(mug);

  // dice pouch
  const pouch = new THREE.Group();
  const lp = [[0, 0], [0.9, 0], [1.0, 0.25], [0.8, 0.9], [0.5, 1.15], [0.28, 1.3], [0.42, 1.55], [0.2, 1.45], [0.0, 1.4]].map(([x, y]) => new THREE.Vector2(x, y));
  const leather = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
  const pm = new THREE.Mesh(new THREE.LatheGeometry(lp, 20), leather);
  pm.castShadow = true; pm.scale.set(1, 1, 0.8);
  pouch.add(pm);
  pouch.scale.setScalar(1.6);
  pouch.position.set(-9, 0, -2.5);
  pouch.rotation.y = 0.5;
  L.add(pouch);
  const diceMat = [0x1a2a8a, 0x8a1a1a, 0x1a6a2a, 0x1a1a1a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.1, envMapIntensity: 1.6 }));
  const dgeo = new THREE.IcosahedronGeometry(0.55, 0);
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(dgeo, diceMat[i % 4]);
    d.position.set(rnd(-8, -4), 0.45, rnd(-4.5, 1.5));
    d.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    d.castShadow = true; L.add(d);
  }
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xc8c8d0, metalness: 1, roughness: 0.3, envMapIntensity: 1.5 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xb8703a, metalness: 1, roughness: 0.35, envMapIntensity: 1.5 });
  const cg = new THREE.CylinderGeometry(0.5, 0.5, 0.09, 24);
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Mesh(cg, i % 3 ? coinMat : copper);
    c.position.set(rnd(-9, -2), 0.06, rnd(-9, -4));
    c.rotation.y = Math.random() * 6; c.castShadow = true; L.add(c);
  }
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Mesh(cg, i % 2 ? coinMat : copper);
    c.position.set(rnd(3, 9), 0.06, rnd(-8, -2));
    c.rotation.y = Math.random() * 6; c.castShadow = true; R.add(c);
  }
  for (let s2 = 0; s2 < 3; s2++) for (let i = 0; i < 6 + s2 * 2; i++) {
    const c = new THREE.Mesh(cg, s2 % 2 ? coinMat : copper);
    c.position.set(8 + s2 * 1.3, 0.06 + i * 0.1, -4 + s2 * 0.4);
    c.castShadow = true; R.add(c);
  }
  // cards, left and right, slightly rotated
  const kinds = ['potion', 'sword', 'monster', 'scroll', 'armor', 'gem'];
  const cardGeo = new THREE.BoxGeometry(2.6, 0.04, 3.7);
  kinds.forEach((k, i) => {
    const t = cardTexture(k);
    const front = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.7 });
    const back = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.6 });
    const card = new THREE.Mesh(cardGeo, [edge, edge, front, back, edge, edge]);
    const left = i < 3;
    (left ? L : R).add(card);
    card.position.set(left ? -5 - (i % 2) * 3.4 : 5 + ((i - 3) % 2) * 3.4, 0.03, left ? 0 + i * 4.3 : 2 + (i - 3) * 4.3);
    card.rotation.y = (Math.random() - 0.5) * 0.7;
    card.castShadow = card.receiveShadow = true;
  });
  // rulebook
  const book = new THREE.Group();
  const cover = new THREE.MeshStandardMaterial({ map: bookTexture('YENDOR', 'The Amulet of'), roughness: 0.55 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
  const bk = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.7, 9.8), [paper, paper, cover, new THREE.MeshStandardMaterial({ color: 0x2a1410 }), paper, paper]);
  bk.castShadow = bk.receiveShadow = true;
  book.add(bk);
  book.position.set(9, 0.35, 12);
  book.rotation.y = 0.35;
  R.add(book);
  // parchment map
  if (mapTexture) {
    const pm2 = new THREE.Mesh(new THREE.PlaneGeometry(14, 10.5), new THREE.MeshStandardMaterial({ map: mapTexture, roughness: 0.9 }));
    pm2.rotation.x = -Math.PI / 2; pm2.position.set(10, 0.03, 7); pm2.rotation.z = 0.04;
    pm2.receiveShadow = true;
    B.add(pm2);
  }
  return { left: L, right: R, bottom: B, top: Tt };
}
