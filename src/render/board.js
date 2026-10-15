// The dungeon board: floor slabs, cut-stone walls (with cutaway near the hero), reveal animation,
// fog-of-war shading. Reads the remembered "screen" of the ported game and the real map.
import * as THREE from 'three';
import * as D from '../rogue/data.js';
import { S, screen, INDEX } from '../rogue/state.js';
import * as T from './textures.js';

const W = 80, H = 24;
export const WALL_H = 1.12;
export const FLOOR_Y = 0.2;

export const TERR = { ROCK: 0, FLOOR: 1, PASS: 2, DOOR: 3, STAIRS: 4, TRAP: 5, WALL: 6 };

export const shaderTime = { value: 0 };
export const shaderHero = { value: new THREE.Vector3() };
export const shaderCam = { value: new THREE.Vector2(0, 1) };
export const shaderCut = { value: 1 };

// vertex-shader patch: reveal rise + wall cutaway
function patch(mat, { wall = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shaderTime;
    sh.uniforms.uHero = shaderHero;
    sh.uniforms.uCamDir = shaderCam;
    sh.uniforms.uCut = shaderCut;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aStart; uniform float uTime; uniform vec3 uHero; uniform vec2 uCamDir; uniform float uCut;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float tt = clamp((uTime - aStart) / 0.55, 0.0, 1.0);
          float c1 = 1.70158, c3 = c1 + 1.0;
          float e = 1.0 + c3 * pow(tt - 1.0, 3.0) + c1 * pow(tt - 1.0, 2.0);
          if (tt <= 0.0) e = 0.0;
          ${wall ? `
          vec2 dd = position.xz - uHero.xz;
          float front = dot(dd, uCamDir);
          float dl = length(dd);
          float cutf = smoothstep(0.25, 0.95, front) * (1.0 - smoothstep(7.0, 13.0, dl)) * uCut;
          float hk = mix(1.0, 0.2, cutf);
          transformed.y = (transformed.y - ${FLOOR_Y.toFixed(3)}) * hk * e + ${FLOOR_Y.toFixed(3)} - (1.0 - e) * 0.05;
          ` : `
          transformed.y += (e - 1.0) * 0.7;
          `}
        }`);
    sh.fragmentShader = sh.fragmentShader;
  };
  mat.customProgramCacheKey = () => (wall ? 'boardwall' : 'boardfloor');
  return mat;
}

function depthPatch(kind, wall) {
  const m = kind === 'distance' ? new THREE.MeshDistanceMaterial() : new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shaderTime; sh.uniforms.uHero = shaderHero; sh.uniforms.uCamDir = shaderCam; sh.uniforms.uCut = shaderCut;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aStart; uniform float uTime; uniform vec3 uHero; uniform vec2 uCamDir; uniform float uCut;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float tt = clamp((uTime - aStart) / 0.55, 0.0, 1.0);
          float c1 = 1.70158, c3 = c1 + 1.0;
          float e = 1.0 + c3 * pow(tt - 1.0, 3.0) + c1 * pow(tt - 1.0, 2.0);
          if (tt <= 0.0) e = 0.0;
          ${wall ? `
          vec2 dd = position.xz - uHero.xz;
          float front = dot(dd, uCamDir);
          float dl = length(dd);
          float cutf = smoothstep(0.25, 0.95, front) * (1.0 - smoothstep(7.0, 13.0, dl)) * uCut;
          float hk = mix(1.0, 0.2, cutf);
          transformed.y = (transformed.y - ${FLOOR_Y.toFixed(3)}) * hk * e + ${FLOOR_Y.toFixed(3)} - (1.0 - e) * 0.05;
          ` : `transformed.y += (e - 1.0) * 0.7;`}
        }`);
  };
  m.customProgramCacheKey = () => `bd-${kind}-${wall}`;
  return m;
}

// pure room lookup (no messages)
export function roomAt(y, x) {
  const fl = INDEX(y, x).p_flags;
  if (fl & D.F_PASS) return S.passages[fl & D.F_PNUM];
  for (const rp of S.rooms)
    if (!(rp.r_flags & D.ISGONE) && x <= rp.r_pos.x + rp.r_max.x && rp.r_pos.x <= x && y <= rp.r_pos.y + rp.r_max.y && rp.r_pos.y <= y) return rp;
  return null;
}

export function cellVisibleNow(y, x) {
  const hero = S.hero;
  if (D.ISBLIND & S.player.t_flags) return y === hero.y && x === hero.x;
  const d = (x - hero.x) * (x - hero.x) + (y - hero.y) * (y - hero.y);
  if (d < D.LAMPDIST) return true;
  const rm = roomAt(y, x);
  return rm !== null && rm === S.player.t_room && !(rm.r_flags & D.ISDARK);
}

export class BoardView {
  constructor(stage) {
    this.stage = stage;
    this.group = new THREE.Group();
    stage.scene.add(this.group);
    this.seen = new Uint8Array(W * H);
    this.terr = new Uint8Array(W * H);
    this.virtualWall = new Uint8Array(W * H);
    this.vis = new Float32Array(W * H);
    this.visT = new Float32Array(W * H);
    this.revealAt = new Float32Array(W * H).fill(-10);
    this.tint = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) this.tint[i] = Math.random();
    this.wallDirty = true;
    this.floorDirty = true;
    this.colorDirty = true;
    this.wallCells = [];
    this.doorCells = [];
    this.torchSites = [];
    this.knownDark = new Uint8Array(W * H);
    this.listeners = { reveal: [] };

    const { floor, wall } = stage.tex;
    floor.map.repeat.set(0.25, 0.25); floor.normalMap.repeat.set(0.25, 0.25); floor.roughnessMap.repeat.set(0.25, 0.25);
    this.corridorTex = T.makeFlagstone(stage.settings.texSize, { seed: 9, mossy: 0.85, hue: -0.02 });
    for (const t of [this.corridorTex.map, this.corridorTex.normalMap, this.corridorTex.roughnessMap]) t.repeat.set(0.28, 0.28);
    for (const t of [wall.map, wall.normalMap, wall.roughnessMap]) t.repeat.set(1, 1);

    const mk = (tx, wallMode) => patch(new THREE.MeshStandardMaterial({
      map: tx.map, normalMap: tx.normalMap, roughnessMap: tx.roughnessMap, roughness: 1, vertexColors: true,
      normalScale: new THREE.Vector2(2.6, 2.6), envMapIntensity: 0.35,
    }), { wall: wallMode });
    this.floorMat = mk(floor, false);
    this.corrMat = mk(this.corridorTex, false);
    this.wallMat = mk(wall, true);

    this.floorGeo = this.makeGeo(W * H * 4);
    this.corrGeo = this.makeGeo(W * H * 4);
    this.wallGeo = this.makeGeo(W * H * 24);
    this.floorMesh = new THREE.Mesh(this.floorGeo, this.floorMat);
    this.corrMesh = new THREE.Mesh(this.corrGeo, this.corrMat);
    this.wallMesh = new THREE.Mesh(this.wallGeo, this.wallMat);
    for (const m of [this.floorMesh, this.corrMesh]) { m.receiveShadow = true; m.frustumCulled = false; m.castShadow = false; }
    this.wallMesh.receiveShadow = true; this.wallMesh.castShadow = true; this.wallMesh.frustumCulled = false;
    this.wallMesh.customDepthMaterial = depthPatch('depth', true);
    this.wallMesh.customDistanceMaterial = depthPatch('distance', true);
    this.group.add(this.floorMesh, this.corrMesh, this.wallMesh);

    this.floorCells = []; this.corrCells = [];
    stage.updaters.push((dt, t) => this.update(dt, t));
  }

  makeGeo(nv) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nv * 2), 2).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aStart', new THREE.BufferAttribute(new Float32Array(nv), 1).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array((nv / 4) * 6), 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    return g;
  }

  reset() {
    this.seen.fill(0); this.terr.fill(0); this.vis.fill(0); this.visT.fill(0); this.virtualWall.fill(0);
    this.revealAt.fill(-10); this.knownDark.fill(0);
    this.wallDirty = this.floorDirty = this.colorDirty = true;
    this.updateMatTarget();
    this.stage.updateMat(1);
    for (let i = 0; i < W * H; i++) this.tint[i] = Math.random();
  }

  terrainOf(y, x) {
    const pp = INDEX(y, x);
    const c = pp.p_ch;
    if (c === ' ') return TERR.ROCK;
    if (c === '|' || c === '-') return TERR.WALL;
    if (c === D.DOOR) return TERR.DOOR;
    if (c === D.STAIRS) return TERR.STAIRS;
    if (c === D.TRAP) return TERR.TRAP;
    if (c === D.PASSAGE) return TERR.PASS;
    if (pp.p_flags & D.F_PASS) return TERR.PASS;       // item lying in a corridor
    return TERR.FLOOR;
  }

  // Called after each game command and by the director: reconcile with the game's screen memory.
  sync(now) {
    let changedSeen = false;
    const hero = S.hero;
    for (let y = 1; y < H - 1; y++)
      for (let x = 0; x < W; x++) {
        const k = y * W + x;
        const g = screen[k];
        if (g !== ' ' && !this.seen[k]) {
          // glyph newly displayed: remember terrain
          const t = this.terrainOf(y, x);
          if (t !== TERR.ROCK) {
            this.seen[k] = 1;
            this.terr[k] = t;
            const dd = Math.hypot(x - hero.x, y - hero.y);
            this.revealAt[k] = this.stage.time + 0.03 * dd + Math.random() * 0.05;
            changedSeen = true;
          }
        } else if (this.seen[k]) {
          // terrain may change (secret door found, trap discovered)
          const t = this.terrainOf(y, x);
          if (t !== this.terr[k] && t !== TERR.ROCK) {
            const wasWall = this.terr[k] === TERR.WALL;
            this.terr[k] = t;
            changedSeen = true;
            if (wasWall && t === TERR.DOOR) this.revealAt[k] = this.stage.time;
          }
        }
      }
    if (changedSeen) this.recomputeStructure();
    this.computeVisibility();
  }

  // mark magic-mapped rooms as known floors
  revealRooms() {
    for (const rp of S.rooms) {
      if (rp.r_flags & D.ISGONE || rp.r_flags & D.ISMAZE) continue;
      for (let y = rp.r_pos.y + 1; y < rp.r_pos.y + rp.r_max.y - 1; y++)
        for (let x = rp.r_pos.x + 1; x < rp.r_pos.x + rp.r_max.x - 1; x++) {
          const k = y * W + x;
          if (!this.seen[k] && this.terrainOf(y, x) !== TERR.ROCK) {
            this.seen[k] = 1; this.terr[k] = this.terrainOf(y, x);
            this.revealAt[k] = this.stage.time + 0.02 * Math.hypot(x - S.hero.x, y - S.hero.y);
          }
        }
    }
    this.recomputeStructure();
    this.computeVisibility();
  }

  computeVisibility() {
    const dark = S.player.t_flags & D.ISBLIND;
    for (let y = 1; y < H - 1; y++)
      for (let x = 0; x < W; x++) {
        const k = y * W + x;
        if (!this.seen[k] && !this.virtualWall[k]) { this.visT[k] = 0; continue; }
        let v = 0;
        if (this.virtualWall[k]) {
          // visible if any neighbouring walkable seen cell is visible
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 1 || nx >= W || ny >= H - 1) continue;
            const nk = ny * W + nx;
            if (this.seen[nk] && this.terr[nk] !== TERR.WALL && cellVisibleNow(ny, nx)) v = 1;
          }
        } else v = cellVisibleNow(y, x) ? 1 : 0;
        this.visT[k] = dark && v ? 0.6 : v;
      }
    this.colorDirty = true;
  }

  updateMatTarget() {
    let x0 = 80, x1 = -1, y0 = 24, y1 = -1;
    for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) { const k = y * W + x; if (this.seen[k] || this.virtualWall[k]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) { x0 = S.hero.x - 6; x1 = S.hero.x + 6; y0 = S.hero.y - 4; y1 = S.hero.y + 4; }
    this.stage.setMatTarget(x0 - 3, x1 + 4, y0 - 3, y1 + 4);
  }

  recomputeStructure() {
    const seen = this.seen, terr = this.terr;
    this.virtualWall.fill(0);
    const walkable = (t) => t === TERR.FLOOR || t === TERR.PASS || t === TERR.DOOR || t === TERR.STAIRS || t === TERR.TRAP;
    for (let y = 1; y < H - 1; y++)
      for (let x = 0; x < W; x++) {
        const k = y * W + x;
        if (!seen[k] || !(terr[k] === TERR.PASS || terr[k] === TERR.DOOR)) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 1 || nx >= W || ny >= H - 1) continue;
          const nk = ny * W + nx;
          if (!seen[nk] && this.terrainOf(ny, nx) === TERR.ROCK) {
            this.virtualWall[nk] = 1;
            if (this.revealAt[nk] < -5) this.revealAt[nk] = this.stage.time + 0.05 * Math.hypot(nx - S.hero.x, ny - S.hero.y);
          }
        }
      }
    this.floorDirty = true;
    this.wallDirty = true;
    this.updateMatTarget();
    this.buildDoorsAndTorches();
  }

  isWallCell(x, y) {
    if (x < 0 || y < 1 || x >= W || y >= H - 1) return false;
    const k = y * W + x;
    return (this.seen[k] && this.terr[k] === TERR.WALL) || this.virtualWall[k] === 1;
  }

  buildDoorsAndTorches() {
    this.doorCells = [];
    this.torchSites = [];
    for (let y = 1; y < H - 1; y++)
      for (let x = 0; x < W; x++) {
        const k = y * W + x;
        if (this.seen[k] && this.terr[k] === TERR.DOOR) {
          const horiz = this.isWallCell(x - 1, y) || this.isWallCell(x + 1, y); // door set in a horizontal wall
          this.doorCells.push({ x, y, k, horiz });
        }
        if (this.seen[k] && this.terr[k] === TERR.WALL) {
          // torch sconces on lit-room walls: hash-selected
          const h = ((x * 73856093) ^ (y * 19349663) ^ (S.dnum * 83492791 + S.level * 7919)) >>> 0;
          if (h % 9 === 0) {
            const rm = roomAt(y, x);
            if (rm && !(rm.r_flags & D.ISDARK) && !(rm.r_flags & D.ISMAZE)) {
              // face towards the interior
              const faces = [[0, 1], [0, -1], [1, 0], [-1, 0]];
              for (const [dx, dy] of faces) {
                const nx = x + dx, ny = y + dy;
                const nk = ny * W + nx;
                if (nx >= 0 && ny > 0 && ny < H - 1 && this.seen[nk] === 1 && (this.terr[nk] === TERR.FLOOR) && !this.isWallCell(nx, ny)) {
                  // not next to a door cell
                  this.torchSites.push({ x, y, dx, dy, k });
                  break;
                }
              }
            }
          }
        }
      }
    for (const l of this.listeners.reveal) l();
  }

  update(dt, t) {
    shaderTime.value = t;
    const hero = S.hero;
    const hx = hero.x + 0.5, hz = hero.y + 0.5;
    shaderHero.value.set(this.heroX ?? hx, 0, this.heroZ ?? hz);
    const cam = this.stage.camera.position;
    const dx = cam.x - shaderHero.value.x, dz = cam.z - shaderHero.value.z;
    const l = Math.hypot(dx, dz) || 1;
    shaderCam.value.set(dx / l, dz / l);
    // lerp visibility
    let moving = false;
    const rate = 1 - Math.exp(-dt * 7);
    for (let i = 0; i < W * H; i++) {
      const d = this.visT[i] - this.vis[i];
      if (Math.abs(d) > 0.004) { this.vis[i] += d * rate; moving = true; }
      else if (d !== 0) this.vis[i] = this.visT[i];
    }
    if (moving) this.colorDirty = true;
    if (this.floorDirty) this.rebuildFloors();
    if (this.wallDirty) this.rebuildWalls();
    if (this.colorDirty) this.recolor();
  }

  brightness(k) {
    const v = this.vis[k];
    return 0.42 + 0.58 * v;
  }

  rebuildFloors() {
    this.floorDirty = false;
    const fill = (geo, cells) => {
      const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, uv = geo.attributes.uv.array;
      const st = geo.attributes.aStart.array, idx = geo.index.array;
      let n = 0;
      for (const k of cells) {
        const x = k % W, y = (k / W) | 0;
        const o = n * 4;
        const x0 = x, x1 = x + 1, z0 = y, z1 = y + 1, yy = FLOOR_Y;
        const P = [[x0, yy, z0], [x1, yy, z0], [x1, yy, z1], [x0, yy, z1]];
        for (let i = 0; i < 4; i++) {
          pos.set(P[i], (o + i) * 3);
          nor.set([0, 1, 0], (o + i) * 3);
          uv[(o + i) * 2] = P[i][0]; uv[(o + i) * 2 + 1] = P[i][2];
          st[o + i] = this.revealAt[k];
        }
        idx.set([o, o + 2, o + 1, o, o + 3, o + 2], n * 6);
        n++;
      }
      geo.setDrawRange(0, n * 6);
      for (const a of ['position', 'normal', 'uv', 'aStart']) geo.attributes[a].needsUpdate = true;
      geo.index.needsUpdate = true;
    };
    this.floorCells = []; this.corrCells = [];
    for (let k = 0; k < W * H; k++) {
      if (!this.seen[k]) continue;
      const t = this.terr[k];
      if (t === TERR.PASS) this.corrCells.push(k);
      else if (t === TERR.FLOOR || t === TERR.DOOR || t === TERR.STAIRS || t === TERR.TRAP) this.floorCells.push(k);
    }
    fill(this.floorGeo, this.floorCells);
    fill(this.corrGeo, this.corrCells);
    this.colorDirty = true;
  }

  rebuildWalls() {
    this.wallDirty = false;
    const geo = this.wallGeo;
    const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, uv = geo.attributes.uv.array;
    const st = geo.attributes.aStart.array, idx = geo.index.array;
    let n = 0;
    this.wallCells = [];
    const cap = pos.length / 12;
    const quad = (p, nrm, uvs, k, start) => {
      if (n >= cap) return;
      const o = n * 4;
      for (let i = 0; i < 4; i++) {
        pos[(o + i) * 3] = p[i][0]; pos[(o + i) * 3 + 1] = p[i][1]; pos[(o + i) * 3 + 2] = p[i][2];
        nor[(o + i) * 3] = nrm[0]; nor[(o + i) * 3 + 1] = nrm[1]; nor[(o + i) * 3 + 2] = nrm[2];
        uv[(o + i) * 2] = uvs[i][0]; uv[(o + i) * 2 + 1] = uvs[i][1];
        st[o + i] = start;
      }
      idx.set([o, o + 1, o + 2, o, o + 2, o + 3], n * 6);
      this.wallCells.push(k);
      n++;
    };
    const y0 = FLOOR_Y, y1 = FLOOR_Y + WALL_H;
    const US = 0.5, VS = 0.5;
    for (let y = 1; y < H - 1; y++)
      for (let x = 0; x < W; x++) {
        if (!this.isWallCell(x, y)) continue;
        const k = y * W + x;
        const st0 = this.revealAt[k];
        const hj = y1 + ((k * 7919) % 5) * 0.004;
        // top
        quad([[x, hj, y], [x, hj, y + 1], [x + 1, hj, y + 1], [x + 1, hj, y]], [0, 1, 0],
          [[x * 0.5, y * 0.5], [x * 0.5, (y + 1) * 0.5], [(x + 1) * 0.5, (y + 1) * 0.5], [(x + 1) * 0.5, y * 0.5]], k, st0);
        // sides: north (-z), south (+z), west (-x), east (+x)
        if (!this.isWallCell(x, y - 1))
          quad([[x + 1, y0, y], [x, y0, y], [x, hj, y], [x + 1, hj, y]], [0, 0, -1],
            [[(x + 1) * US, y0 * VS], [x * US, y0 * VS], [x * US, hj * VS], [(x + 1) * US, hj * VS]], k, st0);
        if (!this.isWallCell(x, y + 1))
          quad([[x, y0, y + 1], [x + 1, y0, y + 1], [x + 1, hj, y + 1], [x, hj, y + 1]], [0, 0, 1],
            [[x * US, y0 * VS], [(x + 1) * US, y0 * VS], [(x + 1) * US, hj * VS], [x * US, hj * VS]], k, st0);
        if (!this.isWallCell(x - 1, y))
          quad([[x, y0, y], [x, y0, y + 1], [x, hj, y + 1], [x, hj, y]], [-1, 0, 0],
            [[y * US, y0 * VS], [(y + 1) * US, y0 * VS], [(y + 1) * US, hj * VS], [y * US, hj * VS]], k, st0);
        if (!this.isWallCell(x + 1, y))
          quad([[x + 1, y0, y + 1], [x + 1, y0, y], [x + 1, hj, y], [x + 1, hj, y + 1]], [1, 0, 0],
            [[(y + 1) * US, y0 * VS], [y * US, y0 * VS], [y * US, hj * VS], [(y + 1) * US, hj * VS]], k, st0);
      }
    geo.setDrawRange(0, n * 6);
    for (const a of ['position', 'normal', 'uv', 'aStart']) geo.attributes[a].needsUpdate = true;
    geo.index.needsUpdate = true;
    this.colorDirty = true;
  }

  recolor() {
    this.colorDirty = false;
    const paint = (geo, cells, groupSize, extra) => {
      const col = geo.attributes.color.array;
      let o = 0;
      for (let ci = 0; ci < cells.length; ci++) {
        const k = cells[ci];
        const b = this.brightness(k);
        const tn = this.tint[k];
        let r = b * (0.9 + tn * 0.18), g = b * (0.9 + tn * 0.18), bl = b * (0.9 + tn * 0.18);
        if (!(this.vis[k] > 0.5)) { r *= 0.92; g *= 0.98; bl *= 1.12; } // remembered: cool, dim
        if (extra) { const e = extra(k, tn); r *= e[0]; g *= e[1]; bl *= e[2]; }
        for (let i = 0; i < groupSize; i++, o += 3) { col[o] = r; col[o + 1] = g; col[o + 2] = bl; }
      }
      geo.attributes.color.needsUpdate = true;
    };
    const ao = (k) => { const x = k % W, y = (k / W) | 0; let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.isWallCell(x + dx, y + dy)) n += (dx && dy) ? 0.5 : 1; return Math.max(0.3, 1 - n * 0.17); };
    paint(this.floorGeo, this.floorCells, 4, (k, tn) => { const a = ao(k); const t = tn > 0.78 ? [0.82, 1.02, 0.78] : tn < 0.15 ? [1.05, 0.98, 0.9] : [1, 1, 1]; return [t[0] * a, t[1] * a, t[2] * a]; });
    paint(this.corrGeo, this.corrCells, 4, (k, tn) => { const a = ao(k); const t = tn > 0.6 ? [0.84, 1.0, 0.82] : [0.95, 0.95, 0.92]; return [t[0] * a, t[1] * a, t[2] * a]; });
    paint(this.wallGeo, this.wallCells, 4, (k, tn) => (tn > 0.7 ? [0.92, 1.02, 0.9] : [1, 1, 1]));
  }

  cellCenter(x, y) { return new THREE.Vector3(x + 0.5, FLOOR_Y, y + 0.5); }
}
