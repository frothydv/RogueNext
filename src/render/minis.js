// Painted tabletop miniatures: the hero and all 26 monsters, built from primitives and animated
// procedurally (idle breathing, hopping walk, lunge attacks, hit flash, death).
import * as THREE from 'three';
import { hasModel, instantiate } from './models.js';

const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;

// ------------------------------------------------------------------ geometry helpers
class Kit {
  constructor() { this.mats = new Map(); this.matList = []; }
  mat(hex, o = {}) {
    const key = hex + JSON.stringify(o);
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: hex, roughness: o.rough ?? 0.5, metalness: o.metal ?? 0, emissive: o.emit ?? 0x000000,
        emissiveIntensity: o.emitI ?? 1, transparent: o.alpha !== undefined, opacity: o.alpha ?? 1,
        flatShading: !!o.flat, side: o.double ? THREE.DoubleSide : THREE.FrontSide,
      });
      if (o.envI !== undefined) m.envMapIntensity = o.envI;
      m.userData.baseEmissive = new THREE.Color(m.emissive);
      m.userData.baseEmissiveI = m.emissiveIntensity;
      m.userData.baseOpacity = m.opacity;
      this.mats.set(key, m);
      this.matList.push(m);
    }
    return m;
  }
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const sph = (r, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = mesh(new THREE.SphereGeometry(r, 18, 14), mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
const cyl = (rt, rb, h, mat, x, y, z, seg = 14) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const cone = (r, h, mat, x, y, z, seg = 12) => mesh(new THREE.ConeGeometry(r, h, seg), mat, x, y, z);
const cap = (r, len, mat, x, y, z) => mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat, x, y, z);
const tor = (r, t, mat, x, y, z) => mesh(new THREE.TorusGeometry(r, t, 8, 20), mat, x, y, z);
const ico = (r, mat, x, y, z, d = 0) => mesh(new THREE.IcosahedronGeometry(r, d), mat, x, y, z);

const A = (parent, child) => { parent.add(child); return child; };
function pivot(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); return g; }

function tube(points, radius, mat, seg = 40, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, seg, radius, radial, false);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// tapered tube
function taperTube(points, r0, r1, mat, seg = 40, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const frames = curve.computeFrenetFrames(seg, false);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, r = r0 + (r1 - r0) * t;
    const c = curve.getPointAt(t);
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j;
      const nx = nor.getX(idx), ny = nor.getY(idx), nz = nor.getZ(idx);
      pos.setXYZ(idx, c.x + nx * r, c.y + ny * r, c.z + nz * r);
    }
  }
  void frames;
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function eyes(kit, color, x, y, z, spread, r = 0.028, glow = true) {
  const g = new THREE.Group();
  const m = kit.mat(color, glow ? { emit: color, emitI: 2.2, rough: 0.3 } : { rough: 0.2 });
  for (const s of [-1, 1]) g.add(sph(r, m, x + s * spread, y, z));
  return g;
}

// ------------------------------------------------------------------ humanoid builder
function humanoid(kit, o = {}) {
  const h = o.h ?? 0.8;
  const skin = kit.mat(o.skin ?? 0xd9a47a, { rough: 0.55 });
  const cloth = kit.mat(o.cloth ?? 0x6b4a2a, { rough: 0.7 });
  const cloth2 = kit.mat(o.cloth2 ?? 0x3a2a1a, { rough: 0.6 });
  const metal = kit.mat(o.metal ?? 0x9a9aa4, { rough: 0.3, metal: 0.8 });
  const fat = o.fat ?? 1, hunch = o.hunch ?? 0;
  const g = new THREE.Group();
  const rig = {};
  const legLen = h * 0.38, torsoH = h * 0.34, headR = h * (o.headScale ?? 0.17);
  const legY = 0.07 + legLen * 0.55;
  // legs
  for (const s of [-1, 1]) {
    const leg = pivot(s * 0.075 * fat, 0.07 + legLen, 0);
    leg.add(cap(0.052 * fat, legLen * 0.55, o.legsSkin ? skin : cloth2, 0, -legLen * 0.5, 0));
    leg.add(box(0.1 * fat, 0.045, 0.16, cloth2, 0, -legLen - 0.02, 0.025));
    g.add(leg);
    rig[s < 0 ? 'legL' : 'legR'] = leg;
  }
  void legY;
  const torsoY = 0.07 + legLen + torsoH * 0.5;
  const torso = pivot(0, torsoY, 0);
  torso.rotation.x = hunch;
  const tbody = cap(0.12 * fat, torsoH * 0.6, cloth, 0, 0, 0);
  tbody.scale.set(1, 1, 0.8);
  torso.add(tbody);
  if (o.belt !== false) A(torso, tor(0.115 * fat, 0.016, cloth2, 0, -torsoH * 0.28, 0)).rotation.x = Math.PI / 2;
  if (o.armor) {
    const plate = box(0.2 * fat, torsoH * 0.55, 0.09, metal, 0, 0.02, 0.06);
    torso.add(plate);
    torso.add(sph(0.085 * fat, metal, -0.14 * fat, torsoH * 0.38, 0, 1, 0.7, 1));
    torso.add(sph(0.085 * fat, metal, 0.14 * fat, torsoH * 0.38, 0, 1, 0.7, 1));
  }
  g.add(torso);
  rig.torso = torso;
  // arms
  for (const s of [-1, 1]) {
    const arm = pivot(s * (0.14 * fat + 0.02), torsoY + torsoH * 0.36, 0);
    const alen = h * 0.3;
    arm.add(cap(0.04 * fat, alen * 0.6, o.armsSkin === false ? cloth : skin, 0, -alen * 0.45, 0));
    arm.add(sph(0.05 * fat, skin, 0, -alen * 0.95, 0));
    if (o.armsFwd) arm.rotation.x = -1.35;
    g.add(arm);
    rig[s < 0 ? 'armL' : 'armR'] = arm;
  }
  // head
  const head = pivot(0, torsoY + torsoH * 0.5 + headR * 0.85, hunch ? 0.06 : 0);
  head.add(sph(headR, skin, 0, 0, 0, 1, 1.05, 1));
  if (o.eyeColor !== null) head.add(eyes(kit, o.eyeColor ?? 0x111111, 0, headR * 0.15, headR * 0.86, headR * 0.38, headR * 0.12, o.glowEyes ?? false));
  if (o.ears) for (const s of [-1, 1]) {
    const ear = cone(headR * 0.28, headR * 0.9, skin, s * headR * 1.0, headR * 0.1, 0);
    ear.rotation.z = -s * rad(75);
    head.add(ear);
  }
  if (o.nose) A(head, cone(headR * 0.16, headR * 0.5, skin, 0, -headR * 0.05, headR * 1.0)).rotation.x = Math.PI / 2;
  if (o.tusks) for (const s of [-1, 1]) {
    const t = cone(headR * 0.1, headR * 0.45, kit.mat(0xefe6c8, { rough: 0.4 }), s * headR * 0.38, -headR * 0.4, headR * 0.85);
    t.rotation.x = rad(-20);
    head.add(t);
  }
  if (o.fangs) for (const s of [-1, 1]) {
    const t = cone(headR * 0.06, headR * 0.3, kit.mat(0xffffff, { rough: 0.3 }), s * headR * 0.22, -headR * 0.42, headR * 0.9);
    t.rotation.x = Math.PI;
    head.add(t);
  }
  if (o.hat === 'hood') {
    const hood = sph(headR * 1.15, o.hoodMat ?? cloth, 0, headR * 0.1, -headR * 0.42, 1.05, 1.1, 1.0);
    head.add(hood);
    A(head, cone(headR * 0.9, headR * 0.9, o.hoodMat ?? cloth, 0, headR * 1.05, -headR * 0.55)).rotation.x = -0.35;
  }
  if (o.hat === 'helm') {
    head.add(sph(headR * 1.12, metal, 0, headR * 0.2, 0, 1, 0.8, 1));
    head.add(box(headR * 0.14, headR * 0.7, headR * 0.1, metal, 0, headR * 0.0, headR * 1.05));
  }
  if (o.hat === 'top') {
    const hc = kit.mat(o.hatColor ?? 0x2f8f3a, { rough: 0.6 });
    head.add(cyl(headR * 0.7, headR * 0.75, headR * 1.1, hc, 0, headR * 1.15, 0));
    head.add(cyl(headR * 1.25, headR * 1.25, headR * 0.1, hc, 0, headR * 0.62, 0));
    head.add(box(headR * 0.9, headR * 0.12, headR * 0.05, kit.mat(0xe8c040, { metal: 0.8, rough: 0.3 }), 0, headR * 0.9, headR * 0.73));
  }
  if (o.hat === 'crown') {
    const gold = kit.mat(0xe8c040, { metal: 0.9, rough: 0.25 });
    head.add(cyl(headR * 0.8, headR * 0.85, headR * 0.3, gold, 0, headR * 0.95, 0, 8));
  }
  if (o.horns) for (const s of [-1, 1]) {
    const hn = cone(headR * 0.18, headR * 1.1, kit.mat(0xe8dcc0, { rough: 0.45 }), s * headR * 0.65, headR * 1.0, 0);
    hn.rotation.z = -s * rad(25);
    head.add(hn);
  }
  if (o.hair) {
    const hm = kit.mat(o.hair, { rough: 0.6 });
    head.add(sph(headR * 1.07, hm, 0, headR * 0.15, -headR * 0.15, 1, 1.0, 1));
    if (o.longHair) head.add(cap(headR * 0.7, headR * 2.6, hm, 0, -headR * 1.6, -headR * 0.6));
  }
  if (o.beard) A(head, cone(headR * 0.7, headR * 1.2, kit.mat(o.beard, { rough: 0.8 }), 0, -headR * 0.9, headR * 0.5)).rotation.x = rad(160);
  if (o.snakes) {
    const sm = kit.mat(0x3f9a45, { rough: 0.5 });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const sn = tube([[Math.cos(a) * headR * 0.8, headR * 0.4, Math.sin(a) * headR * 0.8],
        [Math.cos(a) * headR * 1.4, headR * 1.0, Math.sin(a) * headR * 1.4],
        [Math.cos(a + 0.8) * headR * 1.7, headR * 1.7, Math.sin(a + 0.8) * headR * 1.7]], headR * 0.12, sm, 12, 6);
      head.add(sn);
      head.add(sph(headR * 0.15, sm, Math.cos(a + 0.8) * headR * 1.7, headR * 1.72, Math.sin(a + 0.8) * headR * 1.7));
    }
  }
  g.add(head);
  rig.head = head;
  if (o.cape) {
    const cm = kit.mat(o.capeColor ?? 0x5a1020, { rough: 0.7, double: true });
    const cp = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * fat, 0.22 * fat, h * 0.58, 14, 1, true, Math.PI * 0.55, Math.PI * 0.9), cm);
    cp.position.set(0, torsoY - h * 0.02, -0.06);
    cp.rotation.y = Math.PI;
    cp.castShadow = true;
    g.add(cp);
    rig.cape = cp;
  }
  if (o.collar) {
    const cm = kit.mat(o.capeColor ?? 0x5a1020, { rough: 0.7, double: true });
    const cc = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 12, 1, true), cm);
    cc.position.set(0, torsoY + torsoH * 0.5, -0.05);
    g.add(cc);
  }
  // weapon in right hand
  const hand = pivot(0, -h * 0.3 * 0.95, 0.02);
  rig.armR.add(hand);
  rig.hand = hand;
  switch (o.weapon) {
    case 'club': {
      const w = cyl(0.045, 0.02, 0.5, kit.mat(0x6b4a2a, { rough: 0.8 }), 0, 0.12, 0.06);
      w.rotation.x = rad(-20);
      hand.add(w);
      hand.add(sph(0.075, kit.mat(0x6b4a2a, { rough: 0.8 }), 0, 0.38, 0.1));
      rig.weapon = w; break;
    }
    case 'axe': {
      const w = cyl(0.02, 0.02, 0.5, kit.mat(0x6b4a2a, { rough: 0.8 }), 0, 0.12, 0.06);
      hand.add(w);
      hand.add(box(0.2, 0.15, 0.03, metal, 0.09, 0.32, 0.06));
      rig.weapon = w; break;
    }
    case 'sword': {
      hand.add(box(0.03, 0.34, 0.012, metal, 0, 0.26, 0.06));
      hand.add(box(0.12, 0.025, 0.03, kit.mat(0xc8a040, { metal: 0.8, rough: 0.3 }), 0, 0.08, 0.06));
      break;
    }
    case 'dagger': hand.add(box(0.025, 0.16, 0.01, metal, 0, 0.12, 0.05)); break;
    case 'staff': {
      hand.add(cyl(0.018, 0.018, 0.9, kit.mat(0x5a3a1c, { rough: 0.8 }), 0, 0.2, 0.04));
      hand.add(sph(0.05, kit.mat(0x66ddff, { emit: 0x66ddff, emitI: 2.5 }), 0, 0.66, 0.04));
      break;
    }
    case 'bow': {
      const b = tor(0.2, 0.012, kit.mat(0x6b4a2a, { rough: 0.7 }), 0, 0.1, 0.08);
      b.scale.set(0.5, 1, 1);
      hand.add(b);
      break;
    }
    case 'claws':
      for (let i = -1; i <= 1; i++) A(hand, cone(0.014, 0.1, kit.mat(0xe8e0d0, { rough: 0.4 }), i * 0.03, -0.06, 0.04)).rotation.x = Math.PI;
      break;
  }
  if (o.shield) {
    const sh = cyl(0.14, 0.14, 0.03, kit.mat(o.shield, { metal: 0.4, rough: 0.5 }), 0, -h * 0.3 * 0.7, 0.07);
    sh.rotation.z = Math.PI / 2;
    rig.armL.add(sh);
  }
  if (o.sack) {
    const sk = sph(0.09, kit.mat(0x8a6a3a, { rough: 0.9 }), 0, 0, 0);
    const sg = pivot(0, -h * 0.3 * 0.95, 0.02);
    sg.add(sk, cone(0.04, 0.06, kit.mat(0x8a6a3a, { rough: 0.9 }), 0, 0.1, 0));
    rig.armL.add(sg);
  }
  g.userData.rig = rig;
  g.scale.setScalar(o.scale ?? 1);
  return g;
}

// ------------------------------------------------------------------ quadruped
function quadruped(kit, o = {}) {
  const g = new THREE.Group();
  const rig = {};
  const body = kit.mat(o.body ?? 0xb08050, { rough: 0.55 });
  const dark = kit.mat(o.dark ?? 0x3a2a1a, { rough: 0.6 });
  const L = o.len ?? 0.5, Hh = o.legH ?? 0.28;
  g.add(sph(0.2, body, 0, Hh + 0.15, 0, 0.8, 0.75, L * 1.9));
  rig.legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = pivot(sx * 0.1, Hh + 0.1, sz * L * 0.6);
    leg.add(cyl(0.04, 0.03, Hh + 0.05, body, 0, -Hh * 0.5, 0));
    leg.add(cyl(0.045, 0.045, 0.04, dark, 0, -Hh - 0.02, 0.0));
    g.add(leg);
    rig.legs.push(leg);
  }
  const neck = pivot(0, Hh + 0.27, L * 0.8);
  A(neck, cyl(0.065, 0.1, 0.32, body, 0, 0.1, 0.04)).rotation.x = rad(-25);
  const head = pivot(0, 0.28, 0.16);
  head.add(sph(0.085, body, 0, 0, 0, 0.9, 0.95, 1.4));
  head.add(sph(0.06, o.snout ?? body, 0, -0.03, 0.12, 0.9, 0.85, 1.1));
  head.add(eyes(kit, 0x111111, 0, 0.03, 0.08, 0.06, 0.016, false));
  for (const s of [-1, 1]) {
    const ear = cone(0.025, 0.07, body, s * 0.05, 0.1, -0.02);
    head.add(ear);
  }
  neck.add(head);
  g.add(neck);
  rig.head = head;
  const tail = pivot(0, Hh + 0.22, -L * 0.95);
  A(tail, cone(0.04, 0.3, dark, 0, -0.1, -0.05)).rotation.x = rad(-30);
  g.add(tail);
  rig.tail = tail;
  g.userData.rig = rig;
  g.userData.quad = true;
  g.scale.setScalar(o.scale ?? 1);
  return g;
}

// ------------------------------------------------------------------ individual monsters
export const MONSTER_ART = {
  A(kit) { // aquator: water elemental
    const g = new THREE.Group();
    const w = kit.mat(0x4fb3e6, { rough: 0.05, alpha: 0.78, emit: 0x1a5f99, emitI: 0.6, envI: 2.0 });
    const w2 = kit.mat(0x8fd8ff, { rough: 0.05, alpha: 0.6, emit: 0x2a7fc0, emitI: 0.6, envI: 2.0 });
    g.add(sph(0.3, w, 0, 0.3, 0, 1, 0.8, 1));
    g.add(sph(0.2, w2, 0, 0.62, 0, 1, 1, 1));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      g.add(tube([[Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2], [Math.cos(a) * 0.42, 0.2, Math.sin(a) * 0.42], [Math.cos(a + 0.4) * 0.5, 0.08, Math.sin(a + 0.4) * 0.5]], 0.06, w2, 14, 6));
    }
    g.add(eyes(kit, 0xffffff, 0, 0.66, 0.17, 0.07, 0.03, true));
    g.userData.rig = { blob: g };
    g.userData.blob = true;
    return g;
  },
  B(kit) { // bat
    const g = new THREE.Group();
    const f = kit.mat(0x3a2f3f, { rough: 0.8 });
    const wm = kit.mat(0x2a2030, { rough: 0.9, double: true });
    g.add(sph(0.1, f, 0, 0.1, 0, 1, 1, 1.3));
    g.add(sph(0.075, f, 0, 0.15, 0.13));
    for (const s of [-1, 1]) g.add(cone(0.025, 0.07, f, s * 0.05, 0.23, 0.12));
    g.add(eyes(kit, 0xff3030, 0, 0.17, 0.19, 0.035, 0.014, true));
    const rig = { wings: [] };
    for (const s of [-1, 1]) {
      const wing = pivot(s * 0.07, 0.13, 0);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.06); shape.lineTo(0.38, 0.1); shape.lineTo(0.32, -0.02); shape.lineTo(0.22, 0.02);
      shape.lineTo(0.16, -0.08); shape.lineTo(0.08, -0.02); shape.lineTo(0, -0.06);
      const geo = new THREE.ShapeGeometry(shape);
      const wmesh = new THREE.Mesh(geo, wm);
      wmesh.rotation.x = -Math.PI / 2;
      wmesh.castShadow = true;
      wmesh.scale.x = s;
      wing.add(wmesh);
      g.add(wing);
      rig.wings.push({ node: wing, side: s });
    }
    g.userData.rig = rig;
    g.userData.fly = 0.35;
    return g;
  },
  C(kit) { // centaur
    const g = quadruped(kit, { body: 0x9a6a3a, dark: 0x2a1c10, scale: 1, len: 0.5 });
    const rig = g.userData.rig;
    // swap the horse head for a human torso
    rig.head.parent.visible = false;
    const skin = kit.mat(0xd9a47a, { rough: 0.55 });
    const tor_ = cap(0.1, 0.22, skin, 0, 0.78, 0.24);
    const hd = sph(0.075, skin, 0, 1.0, 0.25);
    const hair = sph(0.08, kit.mat(0x3a2a14, { rough: 0.7 }), 0, 1.03, 0.22, 1, 0.9, 1);
    g.add(tor_, hd, hair, eyes(kit, 0x111111, 0, 1.0, 0.32, 0.03, 0.012, false));
    const bow = tor(0.2, 0.012, kit.mat(0x6b4a2a, { rough: 0.7 }), 0.17, 0.84, 0.3);
    bow.scale.set(0.5, 1, 1);
    g.add(bow);
    for (const s of [-1, 1]) A(g, cap(0.032, 0.18, skin, s * 0.14, 0.82, 0.28)).rotation.x = rad(40);
    return g;
  },
  D(kit) { // dragon
    const g = new THREE.Group();
    const sc = kit.mat(0xb02a22, { rough: 0.45 });
    const sc2 = kit.mat(0x7a1a16, { rough: 0.5 });
    const belly = kit.mat(0xe0b060, { rough: 0.6 });
    const bone = kit.mat(0xf0e6cc, { rough: 0.4 });
    g.add(sph(0.3, sc, 0, 0.42, 0, 0.9, 0.85, 1.5));
    g.add(sph(0.25, belly, 0, 0.32, 0.06, 0.8, 0.7, 1.3));
    g.add(taperTube([[0, 0.5, 0.3], [0, 0.78, 0.5], [0, 0.95, 0.72]], 0.1, 0.07, sc, 18, 8));
    const head = pivot(0, 0.98, 0.78);
    head.add(sph(0.12, sc, 0, 0, 0, 1, 0.85, 1.4));
    head.add(sph(0.08, sc, 0, -0.03, 0.17, 1, 0.7, 1.5));
    head.add(eyes(kit, 0xffcc20, 0, 0.05, 0.1, 0.08, 0.03, true));
    for (const s of [-1, 1]) {
      const hn = cone(0.03, 0.2, bone, s * 0.07, 0.12, -0.04);
      hn.rotation.x = rad(-40);
      head.add(hn);
      A(head, cone(0.012, 0.05, bone, s * 0.06, -0.06, 0.28)).rotation.x = Math.PI;
    }
    const jaw = pivot(0, -0.05, 0.1);
    jaw.add(sph(0.07, sc2, 0, -0.02, 0.1, 1, 0.5, 1.5));
    head.add(jaw);
    g.add(head);
    g.add(taperTube([[0, 0.4, -0.35], [0, 0.35, -0.65], [0.15, 0.2, -0.95], [0.1, 0.1, -1.2]], 0.15, 0.02, sc, 24, 8));
    const rig = { head, jaw, wings: [], legs: [] };
    for (const s of [-1, 1]) {
      const wing = pivot(s * 0.15, 0.62, -0.05);
      const mem = kit.mat(0x7a1a16, { rough: 0.7, double: true });
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(0.9, 0.5); shape.lineTo(0.85, 0.12); shape.lineTo(0.62, 0.2);
      shape.lineTo(0.55, -0.1); shape.lineTo(0.3, 0.0); shape.lineTo(0.2, -0.3); shape.lineTo(0, -0.2);
      const wm = new THREE.Mesh(new THREE.ShapeGeometry(shape), mem);
      wm.rotation.x = -Math.PI / 2; wm.rotation.z = 0; wm.scale.x = s; wm.castShadow = true;
      wing.add(wm);
      wing.add(tube([[0, 0, 0], [s * 0.45, 0.08, -0.1], [s * 0.9, 0.04, -0.28]], 0.02, sc2, 10, 5));
      g.add(wing);
      rig.wings.push({ node: wing, side: s });
      const leg = pivot(s * 0.16, 0.3, 0.18);
      leg.add(cyl(0.06, 0.04, 0.3, sc, 0, -0.15, 0));
      leg.add(box(0.12, 0.04, 0.16, sc2, 0, -0.3, 0.04));
      g.add(leg);
      rig.legs.push(leg);
    }
    for (let i = 0; i < 6; i++) g.add(cone(0.035, 0.08, bone, 0, 0.7 - i * 0.05, 0.4 - i * 0.18));
    g.userData.rig = rig;
    g.userData.big = 1.55;
    return g;
  },
  E(kit) { // emu
    const g = new THREE.Group();
    const f = kit.mat(0x7a6048, { rough: 0.9 });
    const f2 = kit.mat(0x5a4636, { rough: 0.9 });
    const sk = kit.mat(0x6a7a8a, { rough: 0.6 });
    g.add(sph(0.2, f, 0, 0.62, 0, 0.9, 0.9, 1.2));
    g.add(sph(0.15, f2, 0, 0.58, -0.16, 0.9, 0.9, 1.1));
    const rig = { legs: [] };
    for (const s of [-1, 1]) {
      const leg = pivot(s * 0.09, 0.5, 0);
      leg.add(cyl(0.02, 0.025, 0.46, sk, 0, -0.25, 0));
      leg.add(box(0.1, 0.02, 0.15, sk, 0, -0.5, 0.04));
      g.add(leg);
      rig.legs.push(leg);
    }
    g.add(taperTube([[0, 0.7, 0.12], [0, 0.95, 0.2], [0, 1.1, 0.18]], 0.045, 0.03, sk, 14, 6));
    const head = pivot(0, 1.12, 0.2);
    head.add(sph(0.06, f2, 0, 0, 0, 1, 1, 1.3));
    A(head, cone(0.025, 0.12, kit.mat(0x303030, { rough: 0.5 }), 0, -0.01, 0.14)).rotation.x = Math.PI / 2;
    head.add(eyes(kit, 0xffaa00, 0, 0.03, 0.05, 0.045, 0.014, false));
    g.add(head);
    rig.head = head;
    g.userData.rig = rig;
    return g;
  },
  F(kit) { // venus flytrap
    const g = new THREE.Group();
    const gr = kit.mat(0x2f8a3a, { rough: 0.55 });
    const red = kit.mat(0xb02040, { rough: 0.4 });
    const tooth = kit.mat(0xf0f0d0, { rough: 0.3 });
    g.add(taperTube([[0, 0.06, 0], [0.05, 0.3, 0.02], [0, 0.55, 0.05]], 0.07, 0.045, gr, 14, 8));
    const rig = { jaws: [] };
    const hinge = pivot(0, 0.6, 0.05);
    for (const s of [-1, 1]) {
      const jaw = pivot(0, 0, 0);
      const half = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12, 0, Math.PI, 0, Math.PI), s > 0 ? gr : red);
      half.scale.set(1, 0.7, 1.1);
      half.castShadow = true;
      half.rotation.x = s > 0 ? 0 : Math.PI;
      half.rotation.y = Math.PI / 2;
      jaw.add(half);
      for (let i = 0; i < 7; i++) {
        const a = (i / 6) * Math.PI;
        const t = cone(0.018, 0.09, tooth, 0, 0, 0);
        t.position.set(0, 0, Math.cos(a) * 0.2 * 1.1 - 0);
        t.position.set(Math.sin(a) * 0.2 * 0, 0, 0);
        t.position.set(0, 0, 0);
        const ang = a;
        t.position.set(Math.cos(ang) * 0.0, 0, 0);
        t.position.set(0, 0, Math.cos(ang) * 0.22);
        t.position.x = Math.sin(ang) * 0.2 * (s > 0 ? 1 : 1) * 0 + 0;
        t.position.y = 0;
        t.rotation.x = s > 0 ? Math.PI : 0;
        jaw.add(t);
      }
      hinge.add(jaw);
      rig.jaws.push({ node: jaw, side: s });
    }
    g.add(hinge);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.5;
      g.add(taperTube([[0, 0.1, 0], [Math.cos(a) * 0.2, 0.25, Math.sin(a) * 0.2], [Math.cos(a) * 0.42, 0.14, Math.sin(a) * 0.42]], 0.05, 0.015, gr, 14, 6));
    }
    g.userData.rig = rig;
    g.userData.flytrap = true;
    return g;
  },
  G(kit) { // griffin
    const g = quadruped(kit, { body: 0xc89a50, dark: 0x7a5a28, len: 0.55, scale: 1.1 });
    const rig = g.userData.rig;
    rig.head.parent.visible = false;
    const white = kit.mat(0xf0e8d8, { rough: 0.6 });
    const gold = kit.mat(0xe8b830, { rough: 0.4 });
    const neck = tube([[0, 0.55, 0.3], [0, 0.78, 0.42], [0, 0.92, 0.46]], 0.075, white, 12, 8);
    g.add(neck);
    const head = pivot(0, 0.95, 0.5);
    head.add(sph(0.09, white, 0, 0, 0, 1, 1, 1.2));
    A(head, cone(0.05, 0.16, gold, 0, -0.02, 0.15)).rotation.x = Math.PI / 2;
    head.add(eyes(kit, 0xffaa00, 0, 0.03, 0.08, 0.055, 0.018, true));
    g.add(head);
    rig.head = head;
    rig.wings = [];
    for (const s of [-1, 1]) {
      const wing = pivot(s * 0.15, 0.6, 0.0);
      const feather = kit.mat(0xf2ead8, { rough: 0.7, double: true });
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(0.7, 0.35); shape.lineTo(0.72, 0.1); shape.lineTo(0.55, 0.12); shape.lineTo(0.45, -0.1);
      shape.lineTo(0.25, 0.02); shape.lineTo(0.15, -0.2); shape.lineTo(0, -0.15);
      const wm = new THREE.Mesh(new THREE.ShapeGeometry(shape), feather);
      wm.rotation.x = -Math.PI / 2; wm.scale.x = s; wm.castShadow = true;
      wing.add(wm);
      g.add(wing);
      rig.wings.push({ node: wing, side: s });
    }
    g.userData.big = 1.1;
    return g;
  },
  H(kit) { return humanoid(kit, { h: 0.85, skin: 0xd0663a, cloth: 0x7a3a2a, cloth2: 0x3a2418, ears: true, nose: true, eyeColor: 0xffe040, glowEyes: true, weapon: 'club', fat: 1.15, hat: null, armor: false, fangs: true }); },
  I(kit) { // ice monster
    const g = new THREE.Group();
    const ice = kit.mat(0x9fe8ff, { rough: 0.08, alpha: 0.82, emit: 0x2a9fd0, emitI: 0.6, envI: 2.5, flat: true });
    const deep = kit.mat(0x4fb8e8, { rough: 0.1, alpha: 0.85, emit: 0x1a6aa0, emitI: 0.7, envI: 2.5, flat: true });
    g.add(ico(0.2, deep, 0, 0.25, 0));
    const t = ico(0.24, ice, 0, 0.52, 0); t.scale.set(1, 1.3, 0.8); g.add(t);
    g.add(ico(0.14, ice, 0, 0.88, 0, 0));
    for (const s of [-1, 1]) {
      const a = pivot(s * 0.26, 0.7, 0);
      a.add(cone(0.07, 0.38, ice, 0, -0.2, 0, 6));
      a.rotation.z = s * 0.3;
      g.add(a);
      g.userData.rig = g.userData.rig || {};
      (g.userData.rig.arms = g.userData.rig.arms || []).push(a);
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      const sp = cone(0.04, 0.2, ice, Math.cos(a) * 0.12, 1.02, Math.sin(a) * 0.12, 5);
      sp.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
      g.add(sp);
    }
    g.add(eyes(kit, 0xffffff, 0, 0.9, 0.12, 0.05, 0.025, true));
    A(g, cone(0.1, 0.25, deep, 0, 0.1, 0, 6)).rotation.x = Math.PI;
    return g;
  },
  J(kit) { // jabberwock
    const g = new THREE.Group();
    const sc = kit.mat(0x5a3a7a, { rough: 0.5 });
    const sc2 = kit.mat(0x3a2450, { rough: 0.55 });
    const belly = kit.mat(0xb8a070, { rough: 0.6 });
    g.add(sph(0.3, sc, 0, 0.5, 0, 0.9, 1.0, 1.3));
    g.add(sph(0.22, belly, 0, 0.42, 0.1, 0.8, 0.9, 1.1));
    g.add(taperTube([[0, 0.7, 0.25], [0, 0.98, 0.42], [0, 1.1, 0.55]], 0.11, 0.07, sc, 16, 8));
    const head = pivot(0, 1.12, 0.6);
    head.add(sph(0.13, sc, 0, 0, 0, 1, 0.9, 1.3));
    head.add(eyes(kit, 0xff4040, 0, 0.07, 0.1, 0.09, 0.04, true));
    const rig = { head, jaw: pivot(0, -0.05, 0.08), arms: [], legs: [] };
    rig.jaw.add(sph(0.08, sc2, 0, -0.02, 0.1, 1.1, 0.45, 1.6));
    const tooth = kit.mat(0xf8f0d8, { rough: 0.3 });
    for (let i = -2; i <= 2; i++) rig.jaw.add(cone(0.012, 0.06, tooth, i * 0.026, 0.03, 0.16));
    head.add(rig.jaw);
    for (const s of [-1, 1]) A(head, cone(0.035, 0.16, tooth, s * 0.1, 0.1, -0.02)).rotation.z = -s * 0.5;
    g.add(head);
    g.add(taperTube([[0, 0.45, -0.3], [0, 0.35, -0.6], [0.1, 0.2, -0.85]], 0.14, 0.02, sc, 20, 8));
    for (const s of [-1, 1]) {
      const arm = pivot(s * 0.28, 0.62, 0.15);
      A(arm, cap(0.05, 0.22, sc, 0, -0.14, 0.05)).rotation.x = -0.4;
      for (let i = -1; i <= 1; i++) A(arm, cone(0.014, 0.1, tooth, i * 0.03, -0.3, 0.14)).rotation.x = Math.PI * 0.75;
      g.add(arm);
      rig.arms.push(arm);
      const leg = pivot(s * 0.18, 0.3, -0.05);
      leg.add(cyl(0.07, 0.05, 0.3, sc, 0, -0.15, 0));
      leg.add(box(0.13, 0.04, 0.18, sc2, 0, -0.3, 0.05));
      g.add(leg);
      rig.legs.push(leg);
    }
    for (let i = 0; i < 6; i++) g.add(cone(0.035, 0.1, sc2, 0, 0.8 - i * 0.04, 0.2 - i * 0.12));
    g.userData.rig = rig;
    g.userData.big = 1.5;
    return g;
  },
  K(kit) { // kestrel
    const g = new THREE.Group();
    const f = kit.mat(0xa0683a, { rough: 0.85 });
    const f2 = kit.mat(0xe8d8b8, { rough: 0.85 });
    g.add(sph(0.1, f, 0, 0.1, 0, 0.9, 0.9, 1.4));
    g.add(sph(0.08, f2, 0, 0.07, 0.04, 0.8, 0.8, 1.2));
    g.add(sph(0.065, f, 0, 0.17, 0.14));
    A(g, cone(0.02, 0.06, kit.mat(0x303030), 0, 0.15, 0.2)).rotation.x = Math.PI / 2;
    g.add(eyes(kit, 0xffffff, 0, 0.19, 0.17, 0.035, 0.013, false));
    A(g, cone(0.05, 0.16, f, 0, 0.08, -0.17)).rotation.x = -Math.PI / 2 - 0.2;
    const rig = { wings: [] };
    for (const s of [-1, 1]) {
      const wing = pivot(s * 0.07, 0.13, 0);
      const wm = new THREE.Mesh(new THREE.ShapeGeometry((() => { const sh = new THREE.Shape(); sh.moveTo(0, 0.07); sh.lineTo(0.32, 0.06); sh.lineTo(0.34, -0.03); sh.lineTo(0.2, -0.05); sh.lineTo(0, -0.07); return sh; })()), kit.mat(0x8a5430, { rough: 0.9, double: true }));
      wm.rotation.x = -Math.PI / 2; wm.scale.x = s; wm.castShadow = true;
      wing.add(wm);
      g.add(wing);
      rig.wings.push({ node: wing, side: s });
    }
    g.userData.rig = rig;
    g.userData.fly = 0.4;
    return g;
  },
  L(kit) { return humanoid(kit, { h: 0.55, skin: 0xe0a880, cloth: 0x2f9a3f, cloth2: 0x1a5a2a, ears: true, nose: true, hat: 'top', beard: 0xd05a20, sack: true, headScale: 0.2, belt: true }); },
  M(kit) { return humanoid(kit, { h: 0.9, skin: 0x8fbf6a, cloth: 0x2a6a4a, cloth2: 0x1a3a2a, snakes: true, eyeColor: 0xfff030, glowEyes: true, hair: null, fat: 0.92, cape: true, capeColor: 0x1d4a34 }); },
  N(kit) { return humanoid(kit, { h: 0.82, skin: 0xf0d0c0, cloth: 0x4fa08a, cloth2: 0x2a6a58, hair: 0x2a1a3a, longHair: true, eyeColor: 0x40c0ff, glowEyes: true, fat: 0.85, cape: true, capeColor: 0x3a8a78 }); },
  O(kit) { return humanoid(kit, { h: 0.85, skin: 0x6f9a4a, cloth: 0x5a4a30, cloth2: 0x2a2018, ears: true, tusks: true, hat: 'helm', armor: true, weapon: 'axe', shield: 0x6a5030, fat: 1.2, eyeColor: 0xff3030, glowEyes: true }); },
  P(kit) { // phantom
    const g = new THREE.Group();
    const gh = kit.mat(0x8a9ab8, { rough: 0.2, alpha: 0.38, emit: 0x4a6a9a, emitI: 0.9, double: true });
    g.add(taperTube([[0, 0.85, 0], [0.04, 0.5, 0.02], [-0.04, 0.2, -0.04], [0.08, 0.02, -0.1]], 0.2, 0.03, gh, 24, 12));
    g.add(sph(0.14, gh, 0, 0.95, 0));
    g.add(eyes(kit, 0x80e0ff, 0, 0.97, 0.12, 0.06, 0.04, true));
    for (const s of [-1, 1]) g.add(taperTube([[s * 0.17, 0.7, 0], [s * 0.3, 0.55, 0.1], [s * 0.34, 0.4, 0.18]], 0.05, 0.015, gh, 10, 6));
    g.userData.rig = {};
    g.userData.fly = 0.2;
    g.userData.ghost = true;
    return g;
  },
  Q(kit) { // quagga
    const g = quadruped(kit, { body: 0xd8c8a8, dark: 0x201810, scale: 1, len: 0.55 });
    const dk = kit.mat(0x1c1410, { rough: 0.6 });
    for (let i = 0; i < 5; i++) {
      const st = box(0.005, 0.3, 0.07, dk, 0, 0.43, 0.3 - i * 0.17);
      const left = st.clone(); left.position.x = -0.17; const right = st.clone(); right.position.x = 0.17;
      for (const m of [left, right]) { m.scale.set(30, 1, 1); g.add(m); }
    }
    return g;
  },
  R(kit) { // rattlesnake
    const g = new THREE.Group();
    const sk = kit.mat(0xb08a50, { rough: 0.5 });
    const dk = kit.mat(0x4a3220, { rough: 0.5 });
    const pts = [];
    for (let i = 0; i <= 22; i++) { const a = i * 0.55, r = 0.33 - i * 0.008; pts.push([Math.cos(a) * r, 0.06 + i * 0.012, Math.sin(a) * r]); }
    g.add(taperTube(pts, 0.065, 0.04, sk, 60, 8));
    for (let i = 2; i < 22; i += 2) g.add(sph(0.045, dk, pts[i][0], pts[i][1] + 0.05, pts[i][2], 1, 0.6, 1));
    const last = pts[22];
    const head = pivot(last[0], last[1] + 0.12, last[2]);
    head.add(sph(0.075, sk, 0, 0.06, 0.04, 1, 0.8, 1.3));
    head.add(eyes(kit, 0xffcc00, 0, 0.1, 0.1, 0.045, 0.015, true));
    head.add(taperTube([[0, 0.02, 0.1], [0, 0.0, 0.2], [0.02, 0.0, 0.24]], 0.008, 0.004, kit.mat(0xd02030), 6, 4));
    g.add(head);
    const rat = pivot(pts[0][0] + 0.05, 0.1, pts[0][2]);
    for (let i = 0; i < 4; i++) rat.add(sph(0.035 - i * 0.004, kit.mat(0xe8dcc0, { rough: 0.5 }), 0.06 * i, 0, 0.0));
    g.add(rat);
    g.userData.rig = { head, rattle: rat };
    g.userData.serpent = true;
    return g;
  },
  S(kit) { // snake
    const g = new THREE.Group();
    const sk = kit.mat(0x4a9a3a, { rough: 0.45 });
    const dk = kit.mat(0xc8d070, { rough: 0.5 });
    const pts = [];
    for (let i = 0; i <= 18; i++) { const a = i * 0.62, r = 0.3 - i * 0.009; pts.push([Math.cos(a) * r, 0.05 + i * 0.01, Math.sin(a) * r]); }
    g.add(taperTube(pts, 0.05, 0.03, sk, 50, 8));
    for (let i = 1; i < 18; i += 3) g.add(sph(0.035, dk, pts[i][0], pts[i][1] + 0.035, pts[i][2], 1, 0.5, 1));
    const last = pts[18];
    const head = pivot(last[0], last[1] + 0.1, last[2]);
    head.add(sph(0.065, sk, 0, 0.05, 0.03, 1, 0.8, 1.3));
    head.add(eyes(kit, 0xffee00, 0, 0.09, 0.08, 0.04, 0.013, true));
    head.add(taperTube([[0, 0.01, 0.08], [0, 0.0, 0.17], [0.025, 0.0, 0.2]], 0.006, 0.004, kit.mat(0xd02030), 6, 4));
    g.add(head);
    g.userData.rig = { head };
    g.userData.serpent = true;
    return g;
  },
  T(kit) { return humanoid(kit, { h: 1.15, skin: 0x5f8a4a, cloth: 0x6a5a3a, cloth2: 0x3a2e1e, ears: false, nose: true, tusks: true, weapon: 'club', fat: 1.55, hunch: 0.35, armsFwd: false, eyeColor: 0xffd020, glowEyes: true, headScale: 0.15, hat: null }); },
  U(kit) { // black unicorn
    const g = quadruped(kit, { body: 0x26232c, dark: 0x0c0a10, len: 0.55, scale: 1.1 });
    const rig = g.userData.rig;
    const horn = cone(0.025, 0.28, kit.mat(0xf8f4ff, { rough: 0.25, emit: 0xaaaaff, emitI: 0.8 }), 0, 0.22, 0.04);
    horn.rotation.x = rad(30);
    rig.head.add(horn);
    const mane = kit.mat(0x8a4af0, { rough: 0.5, emit: 0x5a2ab0, emitI: 0.5 });
    for (let i = 0; i < 6; i++) g.add(sph(0.05, mane, 0, 0.82 - i * 0.04, 0.5 - i * 0.07, 0.5, 1, 1));
    rig.head.children.forEach((c) => { if (c.material && c.material.color && c.material.color.getHex() === 0x111111) c.material = kit.mat(0xff4040, { emit: 0xff4040, emitI: 2 }); });
    return g;
  },
  V(kit) { return humanoid(kit, { h: 0.9, skin: 0xe8e0e8, cloth: 0x181420, cloth2: 0x0c0a10, hair: 0x101018, fangs: true, eyeColor: 0xff2020, glowEyes: true, cape: true, capeColor: 0x7a0f20, collar: true, fat: 0.95, nose: true }); },
  W(kit) { // wraith
    const g = new THREE.Group();
    const rb = kit.mat(0x2a2e3e, { rough: 0.7, alpha: 0.9, double: true });
    const rb2 = kit.mat(0x14161e, { rough: 0.8, double: true });
    const cloak = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.34, 0.78, 16, 5, true), rb);
    cloak.position.y = 0.42;
    const pos = cloak.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < -0.2) pos.setY(i, y - Math.abs(Math.sin(pos.getX(i) * 20 + pos.getZ(i) * 17)) * 0.1); }
    cloak.castShadow = true;
    g.add(cloak);
    g.add(sph(0.14, rb2, 0, 0.85, 0, 1, 1.1, 1));
    g.add(sph(0.1, kit.mat(0x050508, { rough: 1 }), 0, 0.83, 0.07, 1, 1, 0.6));
    g.add(eyes(kit, 0x70ffa0, 0, 0.85, 0.13, 0.04, 0.025, true));
    for (const s of [-1, 1]) {
      const arm = pivot(s * 0.15, 0.7, 0);
      arm.add(taperTube([[0, 0, 0], [s * 0.08, -0.1, 0.1], [s * 0.06, -0.15, 0.22]], 0.05, 0.015, rb, 10, 6));
      g.add(arm);
    }
    g.userData.rig = {};
    g.userData.fly = 0.12;
    return g;
  },
  X(kit) { // xeroc: arcane copy-machine golem
    const g = new THREE.Group();
    const st = kit.mat(0x7a8aa0, { rough: 0.35, metal: 0.5 });
    const gl = kit.mat(0x40ffd0, { emit: 0x20ffc0, emitI: 2.2 });
    g.add(box(0.42, 0.5, 0.34, st, 0, 0.3, 0));
    g.add(box(0.46, 0.06, 0.38, kit.mat(0x3a4658, { rough: 0.4, metal: 0.6 }), 0, 0.57, 0));
    const lid = pivot(0, 0.6, -0.17);
    lid.add(box(0.44, 0.03, 0.34, kit.mat(0x5a6a80, { rough: 0.4, metal: 0.6 }), 0, 0.015, 0.17));
    lid.rotation.x = -0.5;
    g.add(lid);
    g.add(box(0.3, 0.012, 0.24, gl, 0, 0.6, 0.0));
    for (const s of [-1, 1]) {
      const arm = pivot(s * 0.3, 0.42, 0.05);
      arm.add(cap(0.045, 0.22, st, 0, -0.1, 0));
      g.add(arm);
    }
    g.add(eyes(kit, 0x40ffd0, 0, 0.38, 0.175, 0.1, 0.035, true));
    g.userData.rig = {};
    return g;
  },
  Y(kit) { return humanoid(kit, { h: 1.0, skin: 0x8fd0e8, cloth: 0xf0f4f8, cloth2: 0xe0e8f0, armsSkin: false, legsSkin: false, fat: 1.45, hunch: 0.28, tusks: true, eyeColor: 0x1a2a3a, glowEyes: false, headScale: 0.16, weapon: 'claws', belt: false }); },
  Z(kit) { return humanoid(kit, { h: 0.82, skin: 0x8aa078, cloth: 0x4a4636, cloth2: 0x2a281e, armsFwd: true, eyeColor: 0xe8e060, glowEyes: true, hunch: 0.12, fat: 0.95, weapon: 'claws' }); },
};

// the hero: a hooded adventurer with a torch, mace and ring mail
export function buildHero(kit) {
  const g = humanoid(kit, { h: 0.86, skin: 0xe0b08a, cloth: 0x3a5a8a, cloth2: 0x3a2a1c, hat: 'hood', hoodMat: kit.mat(0x1c3552, { rough: 0.85 }), cape: true, capeColor: 0x8a2a1a, armor: true, weapon: 'club', shield: null, eyeColor: 0x1a1a1a, fat: 1.0 });
  const rig = g.userData.rig;
  // torch in the left hand
  const hand = pivot(0, -0.26 * 0.95 * 1.0, 0.02);
  const stick = cyl(0.016, 0.02, 0.36, kit.mat(0x5a3a1c, { rough: 0.9 }), 0, 0.16, 0.04);
  hand.add(stick);
  const flame = new THREE.Group();
  const fm = kit.mat(0xff9a30, { emit: 0xff8020, emitI: 1.6, alpha: 0.95 });
  const f1 = cone(0.05, 0.16, fm, 0, 0.42, 0.04); f1.castShadow = false;
  const f2 = cone(0.03, 0.1, kit.mat(0xffe090, { emit: 0xffd060, emitI: 2 }), 0, 0.42, 0.04); f2.castShadow = false;
  flame.add(f1, f2);
  hand.add(flame);
  rig.armL.add(hand);
  rig.torchHand = hand;
  rig.flame = flame;
  rig.torchTip = new THREE.Object3D();
  rig.torchTip.position.set(0, 0.45, 0.04);
  hand.add(rig.torchTip);
  g.userData.hero = true;
  return g;
}

// ------------------------------------------------------------------ the Mini wrapper (animation)
let miniId = 0;
export class Mini {
  constructor(letter, art) {
    this.id = ++miniId;
    this.letter = letter;
    this.kit = new Kit();
    this.root = new THREE.Group();
    const modelName = art === 'hero' ? 'hero' : letter;
    const inst = hasModel(modelName) ? instantiate(modelName) : null;
    if (inst) {
      this.kit = inst.kit;
      const bk = new Kit();
      this.kit.mat = (h, o) => { const m = bk.mat(h, o); if (!this.kit.matList.includes(m)) this.kit.matList.push(m); return m; };
      this.body = inst.root;
      Object.assign(this.body.userData, inst.extras, { rig: inst.rig, model: true });
      if (art === 'hero') this.body.userData.hero = true;
    } else this.body = art === 'hero' ? buildHero(this.kit) : (MONSTER_ART[letter] || MONSTER_ART.H)(this.kit);
    this.rig = this.body.userData.rig || {};
    this.isHero = art === 'hero';
    this.root.add(this.body);
    this.seed = Math.random() * 10;
    this.fly = this.body.userData.fly || 0;
    this.big = this.body.userData.big || 1;
    this.x = 0; this.z = 0;       // world position
    this.yaw = 0; this.yawT = 0;
    this.mv = null;               // current move tween
    this.walkPhase = 0;
    this.speed = 0;
    this.lunge = null;
    this.flash = 0;
    this.death = null;
    this.dead = false;
    this.sleeping = false;
    this.held = false;
    this.levit = false;
    this.alpha = 1;
    this.scaleK = 1;
    this.bounce = 0;
    this.hover = 0;
    this.appear = 0;
    this.baseR = 0.36 * Math.min(1.4, this.big);
    // base (a round plastic disc with a coloured ring) lives outside the body so it doesn't hop
    const baseMat = this.kit.mat(0x14110e, { rough: 0.5, metal: 0.1 });
    this.ringMat = this.kit.mat(art === 'hero' ? 0x3a8aff : 0xaa2a2a, { rough: 0.35, metal: 0.2 });
    const r = this.baseR;
    this.base = new THREE.Group();
    this.base.add(cyl(r, r + 0.02, 0.06, baseMat, 0, 0.03, 0, 28));
    A(this.base, mesh(new THREE.TorusGeometry(r - 0.005, 0.016, 8, 36), this.ringMat, 0, 0.065, 0)).rotation.x = Math.PI / 2;
    this.base.children[1].castShadow = false;
    this.root.add(this.base);
    this.body.position.y = 0.06;
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
    // glyph on the base
    if (letter && art !== 'hero') this.setGlyph(letter);
    this.zzz = null;
    this.tag = null;
    this.setScale(inst ? (this.body.userData.scale || 1.3) : 1.4);
  }

  setGlyph(ch) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = '#e8c070';
    g.font = 'bold 74px "Palatino Linotype", Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#000'; g.shadowBlur = 3;
    g.fillText(ch, 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const mm = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: true });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(this.baseR * 1.3, this.baseR * 1.3), mm);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, 0.063, this.baseR * 0.0 + 0.0);
    // put glyph at the front rim
    plane.position.z = this.baseR * 0.0;
    this.glyphPlane = plane;
    plane.position.set(0, 0.064, 0);
    this.base.add(plane);
    plane.visible = false; // the figure covers the centre; show glyph on rim below instead
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), mm);
    rim.rotation.x = -Math.PI / 2 + 0.0;
    rim.position.set(0, 0.067, this.baseR * 0.78);
    this.base.add(rim);
  }

  setRingColor(hex) { this.ringMat.color.setHex(hex); }
  setScale(s) { this.scaleK = s; this.root.scale.setScalar(s); }

  placeAt(x, z) { this.x = x; this.z = z; this.mv = null; this.root.position.set(x, 0.2, z); }

  moveTo(x, z, dur, now) {
    const dx = x - this.x, dz = z - this.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.001) this.yawT = Math.atan2(dx, dz);
    this.mv = { fx: this.x, fz: this.z, tx: x, tz: z, t0: now, dur };
  }
  face(dx, dz) { if (dx || dz) this.yawT = Math.atan2(dx, dz); }

  attack(dx, dz, now, dur = 0.34) {
    const l = Math.hypot(dx, dz) || 1;
    this.face(dx, dz);
    this.lunge = { dx: dx / l, dz: dz / l, t0: now, dur };
  }
  hurt() { this.flash = 1; this.bounce = 1; }
  die(now, dur = 0.7) { this.death = { t0: now, dur }; }
  vanish(now, dur = 0.3) { this.vanishing = { t0: now, dur }; }
  unvanish() { this.vanishing = null; this.setAlpha(1); this.root.visible = true; }

  update(dt, now) {
    if (this.dead) return;
    const body = this.body;
    // movement tween
    let px = this.x, pz = this.z, hop = 0;
    if (this.mv) {
      const m = this.mv;
      let t = (now - m.t0) / m.dur;
      if (t >= 1) { this.x = m.tx; this.z = m.tz; this.mv = null; px = this.x; pz = this.z; this.speed = 0; }
      else if (t >= 0) {
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        px = m.fx + (m.tx - m.fx) * e; pz = m.fz + (m.tz - m.fz) * e;
        hop = Math.sin(Math.min(1, t) * Math.PI);
        this.speed = Math.hypot(m.tx - m.fx, m.tz - m.fz) / m.dur;
      } else { px = m.fx; pz = m.fz; }
    }
    // lunge offset
    let ox = 0, oz = 0, swing = 0;
    if (this.lunge) {
      const l = this.lunge;
      const t = (now - l.t0) / l.dur;
      if (t >= 1) this.lunge = null;
      else if (t >= 0) {
        const k = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
        const e = Math.sin(k * Math.PI * 0.5);
        ox = l.dx * 0.42 * e; oz = l.dz * 0.42 * e;
        swing = Math.sin(t * Math.PI);
      }
    }
    // facing
    let dy = this.yawT - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * (1 - Math.exp(-dt * 14));
    body.rotation.y = this.yaw;
    // walk cycle
    const moving = this.mv && this.speed > 0.05;
    if (moving) this.walkPhase += dt * 16;
    const ph = this.walkPhase;
    const rig = this.rig;
    const swingAmp = moving ? 0.7 : 0;
    if (rig.legL) { rig.legL.rotation.x = Math.sin(ph) * swingAmp; rig.legR.rotation.x = -Math.sin(ph) * swingAmp; }
    if (rig.legs) rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i % 2) * Math.PI) * swingAmp * 0.9; });
    if (rig.armL && !this.body.userData.big) {
      const base = this.body.userData.hero ? -0.2 : (rig.armL.rotation.x < -1 ? -1.35 : 0);
      rig.armL.rotation.x = (rig.armL.userData.base ?? (rig.armL.userData.base = rig.armL.rotation.x)) + (moving ? -Math.sin(ph) * 0.6 : 0);
      void base;
    }
    if (rig.armR) {
      const b = rig.armR.userData.base ?? (rig.armR.userData.base = rig.armR.rotation.x);
      rig.armR.rotation.x = b + (moving ? Math.sin(ph) * 0.6 : 0) - swing * 2.4;
      rig.armR.rotation.z = (rig.armR.userData.bz ?? 0) + swing * 0.3;
    }
    if (rig.arms) rig.arms.forEach((a, i) => { a.rotation.x = (moving ? Math.sin(ph + i * Math.PI) * 0.5 : 0) - swing * 1.4; });
    if (rig.jaw) rig.jaw.rotation.x = swing * 0.7 + Math.max(0, Math.sin(now * 2 + this.seed)) * 0.08;
    if (rig.jaws) rig.jaws.forEach((j) => { const open = this.held ? 0 : 0.55 + Math.sin(now * 3 + this.seed) * 0.12 - swing * 0.5; j.node.rotation.x = j.side * open; });
    if (rig.wings) {
      const f = Math.sin(now * (this.big > 1.2 ? 4 : 17) + this.seed) * (this.big > 1.2 ? 0.45 : 0.75) + 0.2;
      rig.wings.forEach((w) => { w.node.rotation.z = -w.side * f; });
    }
    if (rig.tail) rig.tail.rotation.y = Math.sin(now * 2 + this.seed) * 0.4;
    if (rig.head && this.sleeping) rig.head.rotation.x = 0.5;
    else if (rig.head && !rig.jaw) rig.head.rotation.x = Math.sin(now * 1.3 + this.seed) * 0.05;
    if (rig.cape) rig.cape.rotation.x = (moving ? 0.25 : 0.05) + Math.sin(now * 2.4 + this.seed) * 0.03;
    if (rig.flame) {
      const fl = 1 + Math.sin(now * 23) * 0.12 + Math.sin(now * 37) * 0.08;
      const bs = rig.flame.userData.bs || (rig.flame.userData.bs = rig.flame.scale.clone());
      rig.flame.scale.set(fl * bs.x, fl * (1.15 + Math.sin(now * 17) * 0.1) * bs.y, fl * bs.z);
    }
    if (rig.rattle) rig.rattle.rotation.z = Math.sin(now * 40) * 0.1 * (this.sleeping ? 0 : 1);
    // idle breathing / body bob
    const breathe = Math.sin(now * 1.7 + this.seed) * 0.012;
    let by = 0.06 + hop * 0.09 + breathe;
    if (this.fly) by += this.fly + Math.sin(now * 3 + this.seed) * 0.05;
    if (this.levit) { this.hover += (0.32 - this.hover) * (1 - Math.exp(-dt * 6)); } else this.hover += (0 - this.hover) * (1 - Math.exp(-dt * 6));
    by += this.hover + (this.levit ? Math.sin(now * 3) * 0.03 : 0);
    // blob wobble
    if (this.body.userData.blob) { body.scale.set(1 + Math.sin(now * 3 + this.seed) * 0.05, 1 - Math.sin(now * 3 + this.seed) * 0.05, 1 + Math.cos(now * 2.7) * 0.05); }
    if (this.bounce > 0) { by += this.bounce * 0.1; this.bounce = Math.max(0, this.bounce - dt * 5); }
    body.position.y = by;
    // sleeping pose: tilt slightly & slump
    const sleepK = this.sleeping ? 1 : 0;
    this.sleepK = (this.sleepK ?? 0) + (sleepK - (this.sleepK ?? 0)) * (1 - Math.exp(-dt * 6));
    body.rotation.x = this.sleepK * 0.25 + (moving ? 0.08 : 0);
    // hit flash
    if (this.flash > 0 || this._flashOn) {
      this.flash = Math.max(0, this.flash - dt * 4);
      for (const m of this.kit.matList) {
        m.emissive.setRGB(1, 0.15, 0.1);
        m.emissiveIntensity = this.flash * 1.6 + (this.flash > 0 ? 0 : 0);
        if (this.flash === 0) { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEmissiveI; }
      }
      this._flashOn = this.flash > 0;
    }
    if (this.vanishing) {
      const t = (now - this.vanishing.t0) / this.vanishing.dur;
      if (t >= 1) { this.dead = true; this.root.visible = false; return; }
      this.setAlpha(1 - Math.max(0, t));
    }
    // death
    if (this.death) {
      const t = (now - this.death.t0) / this.death.dur;
      if (t >= 1) { this.dead = true; this.root.visible = false; return; }
      const e = Math.max(0, t);
      body.rotation.z = e * 1.5 * (this.seed > 5 ? 1 : -1);
      body.position.y = by * (1 - e) - e * 0.05;
      const a = 1 - Math.max(0, (t - 0.55) / 0.45);
      this.setAlpha(a);
      this.root.scale.setScalar(this.scaleK * (1 - e * 0.25));
    } else if (this.appear < 1) {
      this.appear = Math.min(1, this.appear + dt * 5);
      this.root.scale.setScalar(this.scaleK * (0.4 + 0.6 * easeOutBack(this.appear)));
    }
    this.root.position.set(px + ox, 0.2, pz + oz);
    if (this.zzz) {
      this.zzz.visible = this.sleeping && !this.death;
      this.zzz.position.y = 1.15 * this.big + Math.sin(now * 2) * 0.05;
    }
    if (this.status) {
      this.status.position.y = 1.35 * Math.min(1.4, this.big);
    }
  }

  setAlpha(a) {
    if (this.alpha === a) return;
    this.alpha = a;
    for (const m of this.kit.matList) {
      if (a < 1) { m.transparent = true; m.opacity = m.userData.baseOpacity * a; m.depthWrite = false; }
      else { m.transparent = m.userData.baseOpacity < 1; m.opacity = m.userData.baseOpacity; m.depthWrite = true; }
      m.needsUpdate = true;
    }
  }

  dispose() {
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of this.kit.matList) m.dispose();
  }
}

const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
