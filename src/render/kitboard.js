// Dungeon board built from the Blender kit: real 3D cobbles and cut-stone wall panels placed with
// instancing, with the same fog-of-war shading, reveal animation and wall cutaway as the textured board.
import * as THREE from 'three';
import { S } from '../rogue/state.js';
import { BoardView, TERR, FLOOR_Y, shaderTime, shaderHero, shaderCam, shaderCut } from './board.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { kitMeshes, hasModel } from './models.js';

const W = 80, H = 24, CH = 10;
const WALL_H = 1.02;

const RISE = `
  float tt = clamp((uTime - aStart) / 0.55, 0.0, 1.0);
  float c1 = 1.70158, c3 = c1 + 1.0;
  float e = 1.0 + c3 * pow(tt - 1.0, 3.0) + c1 * pow(tt - 1.0, 2.0);
  if (tt <= 0.0) e = 0.0;`;
const WALL_CUT = `
  vec4 wpI = instanceMatrix * vec4(transformed, 1.0);
  vec2 dd = wpI.xz - uHero.xz;
  float front = dot(dd, uCamDir);
  float dl = length(dd);
  float cutf = smoothstep(0.25, 0.95, front) * (1.0 - smoothstep(7.0, 13.0, dl)) * uCut;
  transformed.y = transformed.y * mix(1.0, 0.2, cutf) * e;`;
const FLOOR_RISE = 'transformed.y += (e - 1.0) * 0.7;';

function injectVertex(sh, wall) {
  sh.uniforms.uTime = shaderTime; sh.uniforms.uHero = shaderHero; sh.uniforms.uCamDir = shaderCam; sh.uniforms.uCut = shaderCut;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
      attribute float aStart; uniform float uTime; uniform vec3 uHero; uniform vec2 uCamDir; uniform float uCut;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      {${RISE}
      ${wall ? WALL_CUT : FLOOR_RISE}
      }`);
}
function patchInst(mat, wall) {
  mat.onBeforeCompile = (sh) => injectVertex(sh, wall);
  mat.customProgramCacheKey = () => (wall ? 'kitwall' : 'kitfloor');
  return mat;
}
function depthInst(kind, wall) {
  const m = kind === 'distance' ? new THREE.MeshDistanceMaterial() : new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => injectVertex(sh, wall);
  m.customProgramCacheKey = () => `kd-${kind}-${wall}`;
  return m;
}

const hash = (x, y, s = 0) => (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791 + 1013904223)) >>> 0);

export class KitBoard extends BoardView {
  constructor(stage) {
    super(stage);
    this.floorMesh.visible = this.corrMesh.visible = this.wallMesh.visible = false;
    this.kitGroup = new THREE.Group();
    this.group.add(this.kitGroup);
    this.pieces = {};
    // The stone kit pieces carry all their colour in vertex colours, so every primitive of a piece is merged into
    // one geometry/one material (one draw call per piece); `merge: false` keeps per-material primitives (emissive etc.).
    const load = (key, names, lift, wall, cast, merge = true) => {
      this.pieces[key] = names.filter(hasModel).map((n) => {
        const prims = kitMeshes(n, { lift });
        const mk = (geometry, material) => {
          const m = material.clone();
          m.vertexColors = true;
          if (merge) { m.roughness = 0.94; m.metalness = 0; }
          patchInst(m, wall);
          return { geometry, material: m, castShadow: cast };
        };
        if (!merge || prims.length === 1) return prims.map(({ geometry, material }) => mk(geometry, material));
        const geos = prims.map((p) => { const g = p.geometry; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; });
        return [mk(mergeGeometries(geos, false), prims[0].material)];
      });
    };
    load('floor', ['kit_floor0', 'kit_floor1', 'kit_floor2', 'kit_floor3', 'kit_floor4', 'kit_floor5'], 0, false, false);
    load('corr', ['kit_corr0', 'kit_corr1', 'kit_corr2', 'kit_corr3'], 0, false, false);
    load('wall', ['kit_wall0', 'kit_wall1', 'kit_wall2', 'kit_wall3', 'kit_wall4'], 0, true, true);
    load('cap', ['kit_cap0', 'kit_cap1', 'kit_cap2'], WALL_H, true, true);
    this.decorNames = ['bones', 'rubble', 'mushrooms', 'pottery', 'crate', 'cobweb'];
    load('decor', this.decorNames.map((n) => `kit_d_${n}`), 0, false, false, false);
    this.ownFloor = hasModel('kit_door') && hasModel('kit_stairs') && hasModel('kit_trap0');
    this.depthWall = depthInst('depth', true);
    this.distWall = depthInst('distance', true);
    this.meshes = [];
    this.ready = this.pieces.floor.length > 0 && this.pieces.wall.length > 0 && this.pieces.cap.length > 0;
  }

  clearKit() {
    for (const m of this.meshes) { this.kitGroup.remove(m); m.geometry.dispose(); m.dispose(); }
    this.meshes = [];
  }

  // one InstancedMesh per (piece primitive, chunk) so the camera can cull whole chunks
  buildInstances(records, kind, wall) {
    const groups = new Map();
    for (const r of records) {
      const key = `${r.variant}:${r.cx}:${r.cy}`;
      let g = groups.get(key);
      if (!g) { g = []; groups.set(key, g); }
      g.push(r);
    }
    const mtx = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
    for (const list of groups.values()) {
      const variant = this.pieces[kind][list[0].variant];
      for (const prim of variant) {
        const geo = prim.geometry.clone();
        const start = new Float32Array(list.length);
        const cells = new Int32Array(list.length);
        const im = new THREE.InstancedMesh(geo, prim.material, list.length);
        list.forEach((r, i) => {
          mtx.compose(r.pos, r.quat, one);
          im.setMatrixAt(i, mtx);
          start[i] = r.start;
          cells[i] = r.cell;
        });
        geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(start, 1));
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(list.length * 3).fill(1), 3);
        im.instanceColor.setUsage(THREE.DynamicDrawUsage);
        im.userData.cells = cells;
        im.userData.kind = kind;
        im.castShadow = prim.castShadow;
        im.receiveShadow = true;
        if (wall) { im.customDepthMaterial = this.depthWall; im.customDistanceMaterial = this.distWall; }
        im.computeBoundingSphere();
        if (im.boundingSphere) im.boundingSphere.radius += 1.5;
        this.kitGroup.add(im);
        this.meshes.push(im);
      }
    }
  }

  rebuildFloors() {
    if (!this.ready) return super.rebuildFloors();
    this.rebuildAll();
  }
  rebuildWalls() {
    if (!this.ready) return super.rebuildWalls();
    this.rebuildAll();
  }

  rebuildAll() {
    this.floorDirty = this.wallDirty = false;
    this.clearKit();
    const fl = [], co = [], wl = [], cp = [], dc = [];
    const up = new THREE.Vector3(0, 1, 0);
    const yq = (a) => new THREE.Quaternion().setFromAxisAngle(up, a);
    const nF = this.pieces.floor.length, nC = this.pieces.corr.length, nW = this.pieces.wall.length, nP = this.pieces.cap.length;
    for (let k = 0; k < W * H; k++) {
      if (!this.seen[k]) continue;
      const t = this.terr[k];
      const x = k % W, y = (k / W) | 0;
      const h = hash(x, y, S.dnum);
      const rec = (variant) => ({ variant, cx: (x / CH) | 0, cy: (y / CH) | 0, pos: new THREE.Vector3(x + 0.5, FLOOR_Y - 0.035, y + 0.5), quat: yq((h & 3) * Math.PI / 2), start: this.revealAt[k], cell: k });
      if (t === TERR.PASS && nC) co.push(rec((h >>> 3) % nC));
      else if (t === TERR.PASS || t === TERR.FLOOR || (!this.ownFloor && (t === TERR.DOOR || t === TERR.STAIRS || t === TERR.TRAP))) fl.push(rec((h >>> 3) % nF));
      if (t === TERR.FLOOR && this.pieces.decor.length) this.dressing(x, y, h, dc, rec);
    }
    this.buildInstances(fl, 'floor', false);
    if (nC) this.buildInstances(co, 'corr', false);
    this.buildInstances(dc, 'decor', false);
    const dirs = [[0, -1, Math.PI], [0, 1, 0], [-1, 0, -Math.PI / 2], [1, 0, Math.PI / 2]];
    for (let y = 1; y < H - 1; y++)
      for (let x = 0; x < W; x++) {
        if (!this.isWallCell(x, y)) continue;
        const k = y * W + x;
        const h = hash(x, y, S.dnum + 7);
        const start = this.revealAt[k];
        const cx = (x / CH) | 0, cy = (y / CH) | 0;
        cp.push({ variant: h % nP, cx, cy, pos: new THREE.Vector3(x + 0.5, FLOOR_Y, y + 0.5), quat: yq(((h >>> 4) & 3) * Math.PI / 2), start, cell: k });
        dirs.forEach(([dx, dy, ang], di) => {
          if (this.isWallCell(x + dx, y + dy)) return;
          wl.push({ variant: ((h >>> (3 + di * 3)) + di * 5) % nW, cx, cy, pos: new THREE.Vector3(x + 0.5 + dx * 0.5, FLOOR_Y, y + 0.5 + dy * 0.5), quat: yq(ang), start, cell: k });
        });
      }
    this.buildInstances(wl, 'wall', true);
    this.buildInstances(cp, 'cap', true);
    this.colorDirty = true;
  }

  // sparse clutter along the walls: bones, rubble, fungus, pots, crates and corner cobwebs
  dressing(x, y, h, out, rec) {
    const wN = this.isWallCell(x, y - 1), wS = this.isWallCell(x, y + 1), wW = this.isWallCell(x - 1, y), wE = this.isWallCell(x + 1, y);
    if (!(wN || wS || wW || wE)) return;
    const r = ((h >>> 7) & 255) / 255;
    const corner = (wN || wS) && (wW || wE);
    const names = this.decorNames, nD = this.pieces.decor.length;
    const up = new THREE.Vector3(0, 1, 0);
    const key = (n) => names.indexOf(n);
    if (corner && r < 0.7) {
      const i = key('cobweb');
      if (i < 0 || i >= nD) return;
      // the model's web sits in the north-east corner; rotate it to whichever corner is walled
      const ang = wN && wE ? 0 : wN && wW ? Math.PI / 2 : wS && wW ? Math.PI : -Math.PI / 2;
      const o = rec(i);
      o.quat = new THREE.Quaternion().setFromAxisAngle(up, ang);
      o.pos.y = FLOOR_Y + 0.0;
      out.push(o);
      return;
    }
    if (r > 0.16) return;
    const pool = names.filter((n) => n !== 'cobweb').map(key).filter((i) => i >= 0 && i < nD);
    if (!pool.length) return;
    const o = rec(pool[(h >>> 15) % pool.length]);
    o.pos.y = FLOOR_Y + 0.035;
    out.push(o);
  }

  recolor() {
    if (!this.ready) return super.recolor();
    this.colorDirty = false;
    const ao = (k) => {
      const x = k % W, y = (k / W) | 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.isWallCell(x + dx, y + dy)) n += (dx && dy) ? 0.5 : 1;
      return Math.max(0.35, 1 - n * 0.14);
    };
    for (const im of this.meshes) {
      const cells = im.userData.cells;
      const arr = im.instanceColor.array;
      const floorLike = im.userData.kind === 'floor' || im.userData.kind === 'corr' || im.userData.kind === 'decor';
      for (let i = 0; i < cells.length; i++) {
        const k = cells[i];
        const b = this.brightness(k);
        const tn = this.tint[k];
        let r = b * (0.92 + tn * 0.16), g = r, bl = r;
        if (!(this.vis[k] > 0.5)) { r *= 0.92; g *= 0.98; bl *= 1.1; }
        if (floorLike) { const a = ao(k); r *= a; g *= a; bl *= a; }
        arr[i * 3] = r; arr[i * 3 + 1] = g; arr[i * 3 + 2] = bl;
      }
      im.instanceColor.needsUpdate = true;
    }
  }
}
