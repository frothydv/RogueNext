// Procedural texture synthesis: colour + normal(bump) + roughness maps for wood, flagstone,
// cut-stone walls, parchment, felt, ceramic, etc.  Everything is generated at start-up so the
// game ships with no image assets.
import * as THREE from 'three';

export function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LAT = 256;
export class Noise {
  constructor(seed) {
    const r = mulberry(seed);
    this.v = new Float32Array(LAT * LAT);
    for (let i = 0; i < this.v.length; i++) this.v[i] = r();
  }
  // periodic value noise; (px,py) = period in lattice cells
  at(x, y, px = LAT, py = LAT) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
    const y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
    const v = this.v;
    const a = v[(y0 & 255) * LAT + (x0 & 255)], b = v[(y0 & 255) * LAT + (x1 & 255)];
    const c = v[(y1 & 255) * LAT + (x0 & 255)], d = v[(y1 & 255) * LAT + (x1 & 255)];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  fbm(x, y, oct = 4, px = LAT, py = LAT) {
    let amp = 0.5, sum = 0, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * this.at(x * f, y * f, px * f, py * f);
      norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// height (Float32Array, wraps) -> normal map canvas
function normalFromHeight(hf, w, h, strength = 2, flipY = false) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const ym = ((y - 1 + h) % h) * w, yp = ((y + 1) % h) * w, y0 = y * w;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w, xp = (x + 1) % w;
      const dx = (hf[y0 + xp] - hf[y0 + xm]) * strength;
      let dy = (hf[yp + x] - hf[ym + x]) * strength;
      if (flipY) dy = -dy;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y0 + x) * 4;
      d[i] = (-dx * inv * 0.5 + 0.5) * 255;
      d[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
      d[i + 2] = (inv * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function greyCanvas(arr, w, h) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = clamp01(arr[i]) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(canv, { srgb = false, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ wood table
export function makeWood(size = 1024) {
  const W = size, H = size;
  const n = new Noise(11), n2 = new Noise(77);
  const col = new Uint8ClampedArray(W * H * 4);
  const hf = new Float32Array(W * H);
  const rough = new Float32Array(W * H);
  const planks = 4, ph = H / planks;
  const r = mulberry(5);
  const plank = [];
  for (let i = 0; i < planks; i++) {
    plank.push({
      tone: 0.82 + r() * 0.3, hue: (r() - 0.5) * 0.06, ox: r() * 50, oy: r() * 50,
      joint: Math.floor(r() * W), freq: 22 + r() * 18,
      knots: Array.from({ length: 1 + Math.floor(r() * 2) }, () => ({ x: r() * W, y: (0.25 + r() * 0.5) * ph, rad: 26 + r() * 30 })),
    });
  }
  for (let y = 0; y < H; y++) {
    const pi = Math.floor(y / ph), p = plank[pi];
    const ly = y - pi * ph, v = ly / ph;
    for (let x = 0; x < W; x++) {
      const side = x > p.joint ? 1 : 0;
      const ox = p.ox + side * 17.3, oy = p.oy + side * 9.1;
      // distort grain lines
      let warp = n.fbm((x + ox * 40) / 190, (ly + oy * 20) / 60, 3, 5, 4) * 0.9;
      // knots
      let kd = 0;
      for (const k of p.knots) {
        const dx = x - k.x, dy = (ly - k.y) * 1.6;
        const dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < k.rad * 3) {
          const f = 1 - dd / (k.rad * 3);
          warp += Math.sin(dd * 0.35) * 0.08 * f + f * f * (dy > 0 ? 0.35 : -0.35) * 0.4;
          kd = Math.max(kd, smooth(k.rad, 0, dd));
        }
      }
      const ring = Math.sin((v + warp * 0.35) * p.freq + n2.at(x / 90, ly / 8, 11, 32) * 0.7);
      const fine = n.at(x / 3.2, ly / 0.8, 256, 256);
      const pores = n2.at(x / 1.7, ly / 0.55, 256, 256);
      let g = 0.5 + 0.28 * ring + 0.12 * (fine - 0.5) * 2;
      g = clamp01(g - kd * 0.35);
      const stain = n.fbm(x / 160 + 9, y / 160 + 4, 3, 6, 6);
      let tone = p.tone * (0.9 + (stain - 0.5) * 0.35);
      // base warm browns
      let rch = mix(0.25, 0.47, g) * tone;
      let gch = mix(0.165, 0.32, g) * tone;
      let bch = mix(0.10, 0.2, g) * tone;
      rch += p.hue; gch += p.hue * 0.4;
      // plank gaps
      const edge = Math.min(ly, ph - 1 - ly);
      let height = 0.55 + 0.1 * g - pores * 0.05;
      let rc = 0.55 + (pores - 0.5) * 0.1;
      if (edge < 4) {
        const f = 1 - edge / 4;
        rch *= 1 - f * 0.8; gch *= 1 - f * 0.8; bch *= 1 - f * 0.8;
        height -= f * 0.5;
      }
      // butt joint seam
      const jd = Math.abs(x - p.joint);
      if (jd < 2) { const f = 1 - jd / 2; rch *= 1 - f * 0.6; gch *= 1 - f * 0.6; bch *= 1 - f * 0.6; height -= f * 0.3; }
      // wear / scratches
      const scr = n2.at(x / 70, y / 1.3, 256, 256);
      if (scr > 0.86 && n.at(x / 25, y / 25) > 0.55) { rch += 0.06; gch += 0.05; bch += 0.035; height -= 0.05; }
      const i = (y * W + x) * 4;
      col[i] = clamp01(rch) * 255; col[i + 1] = clamp01(gch) * 255; col[i + 2] = clamp01(bch) * 255; col[i + 3] = 255;
      hf[y * W + x] = height + (g - 0.5) * 0.08;
      rough[y * W + x] = clamp01(rc + (n.at(x / 40, y / 40) - 0.5) * 0.35);
    }
  }
  const cc = canvas(W, H);
  cc.getContext('2d').putImageData(new ImageData(col, W, H), 0, 0);
  return {
    map: tex(cc, { srgb: true }),
    normalMap: tex(normalFromHeight(hf, W, H, 3.2)),
    roughnessMap: tex(greyCanvas(rough, W, H)),
  };
}

// ------------------------------------------------------------------ cobbled flagstone floor
function voronoi(W, H, count, seed) {
  const r = mulberry(seed);
  const pts = [];
  for (let i = 0; i < count; i++) pts.push([r() * W, r() * H]);
  // grid acceleration with wrap
  const cell = Math.sqrt((W * H) / count);
  const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
  const grid = Array.from({ length: gw * gh }, () => []);
  pts.forEach((p, i) => grid[Math.floor(p[1] / cell) % gh * gw + Math.floor(p[0] / cell) % gw].push(i));
  const d1 = new Float32Array(W * H), d2 = new Float32Array(W * H), id = new Int32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let a = 1e9, b = 1e9, ai = 0;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const gx = (cx + ox + gw * 4) % gw, gy = (cy + oy + gh * 4) % gh;
          const arr = grid[gy * gw + gx];
          for (let k = 0; k < arr.length; k++) {
            const p = pts[arr[k]];
            let dx = Math.abs(x - p[0]), dy = Math.abs(y - p[1]);
            if (dx > W / 2) dx = W - dx;
            if (dy > H / 2) dy = H - dy;
            const dd = Math.sqrt(dx * dx + dy * dy);
            if (dd < a) { b = a; a = dd; ai = arr[k]; }
            else if (dd < b) b = dd;
          }
        }
      const i = y * W + x;
      d1[i] = a; d2[i] = b; id[i] = ai;
    }
  return { d1, d2, id, pts };
}

export function makeFlagstone(size = 1024, opts = {}) {
  const W = size, H = size;
  const { stones = 90, seed = 3, mossy = 0.55, hue = 0 } = opts;
  const n = new Noise(seed * 13 + 1), n2 = new Noise(seed * 31 + 7);
  const vor = voronoi(W, H, stones, seed);
  const col = new Uint8ClampedArray(W * H * 4);
  const hf = new Float32Array(W * H);
  const rough = new Float32Array(W * H);
  const r = mulberry(seed + 99);
  const tint = vor.pts.map(() => ({ b: 0.62 + r() * 0.5, w: r() * 0.2 - 0.04, mo: r() }));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = tint[vor.id[i]];
      const edge = (vor.d2[i] - vor.d1[i]);
      const mortar = 1 - smooth(2.5, 10, edge);          // 1 in crevice
      const dome = smooth(0, 38, edge);                   // rounded stone surface
      const grain = n.fbm(x / 6, y / 6, 4, 170, 170);
      const blot = n2.fbm(x / 70 + 3, y / 70, 4, 14, 14);
      let L = t.b * (0.55 + 0.45 * grain) * (0.85 + 0.25 * blot);
      // warm / cool stone
      let rch = L * (0.47 + t.w + hue), gch = L * (0.43 + t.w * 0.6), bch = L * (0.39 + t.w * 0.2);
      // dirt in crevices
      const dirt = mortar * 0.8 + (1 - dome) * 0.2;
      rch = mix(rch, 0.09, dirt * 0.85); gch = mix(gch, 0.075, dirt * 0.85); bch = mix(bch, 0.06, dirt * 0.85);
      // moss
      const mm = n.fbm(x / 55 + 9, y / 55 + 1, 4, 18, 18);
      const moss = clamp01((mm - (0.62 - mossy * 0.25)) * 4.5) * (0.25 + 0.75 * (mortar * 0.8 + (1 - dome) * 0.6)) * (0.6 + t.mo * 0.7);
      rch = mix(rch, 0.17 + 0.05 * grain, moss * 0.85);
      gch = mix(gch, 0.30 + 0.12 * grain, moss * 0.85);
      bch = mix(bch, 0.075, moss * 0.85);
      // hairline cracks
      const crack = n2.at(x / 14, y / 14, 74, 74);
      if (Math.abs(crack - 0.5) < 0.012 && dome > 0.3) { rch *= 0.5; gch *= 0.5; bch *= 0.5; }
      col[i * 4] = clamp01(rch) * 255; col[i * 4 + 1] = clamp01(gch) * 255; col[i * 4 + 2] = clamp01(bch) * 255; col[i * 4 + 3] = 255;
      hf[i] = dome * 0.9 + (grain - 0.5) * 0.10 - mortar * 0.5 + moss * 0.12 + (blot - 0.5) * 0.1;
      rough[i] = clamp01(0.78 + (grain - 0.5) * 0.3 - moss * 0.1 + mortar * 0.1);
    }
  const cc = canvas(W, H);
  cc.getContext('2d').putImageData(new ImageData(col, W, H), 0, 0);
  return {
    map: tex(cc, { srgb: true }),
    normalMap: tex(normalFromHeight(hf, W, H, 9)),
    roughnessMap: tex(greyCanvas(rough, W, H)),
  };
}

// ------------------------------------------------------------------ cut stone wall
export function makeWall(size = 1024) {
  const W = size, H = size;
  const n = new Noise(41), n2 = new Noise(57);
  const col = new Uint8ClampedArray(W * H * 4);
  const hf = new Float32Array(W * H);
  const rough = new Float32Array(W * H);
  const rows = 8, rh = H / rows;
  const r = mulberry(8);
  const rowBricks = [];
  for (let i = 0; i < rows; i++) {
    const cnt = 4 + (i % 2);
    // random widths summing to W
    const w = Array.from({ length: cnt }, () => 0.7 + r() * 0.6);
    const sum = w.reduce((a, b) => a + b, 0);
    let acc = (i % 2) * 0.17 * W;
    const bricks = w.map((wi) => { const b = { x0: acc, w: (wi / sum) * W, tone: 0.72 + r() * 0.5, w2: r() * 0.14 - 0.05, mo: r() }; acc += b.w; return b; });
    rowBricks.push(bricks);
  }
  for (let y = 0; y < H; y++) {
    const ri = Math.floor(y / rh), ly = y - ri * rh;
    for (let x = 0; x < W; x++) {
      const bricks = rowBricks[ri];
      let b = bricks[0];
      const xx = ((x - 0) % W + W) % W;
      for (const bb of bricks) {
        const lx = (((xx - bb.x0) % W) + W) % W;
        if (lx < bb.w) { b = bb; break; }
      }
      let lx = (((xx - b.x0) % W) + W) % W;
      const dxe = Math.min(lx, b.w - lx), dye = Math.min(ly, rh - ly);
      const edge = Math.min(dxe, dye * 1.15);
      const mortar = 1 - smooth(2, 9, edge);
      const bevel = smooth(0, 16, edge);
      const grain = n.fbm(x / 7, y / 7, 4, 140, 140);
      const blot = n2.fbm(x / 80 + 3, y / 80, 4, 12, 12);
      let L = b.tone * (0.5 + 0.5 * grain) * (0.82 + 0.3 * blot);
      let rch = L * (0.50 + b.w2), gch = L * (0.46 + b.w2 * 0.6), bch = L * (0.42 + b.w2 * 0.3);
      const dirt = mortar * 0.85;
      rch = mix(rch, 0.08, dirt); gch = mix(gch, 0.07, dirt); bch = mix(bch, 0.06, dirt);
      // chips
      const chip = n2.at(x / 11, y / 11, 93, 93);
      if (chip > 0.8 && bevel < 0.7) { rch *= 0.7; gch *= 0.7; bch *= 0.7; }
      // moss creeping up from below & in grooves
      const mm = n.fbm(x / 60 + 5, y / 50 + 11, 4, 17, 17);
      const low = 1 - y / H;
      const moss = clamp01((mm - 0.56) * 4) * (0.2 + 0.8 * (mortar + (1 - bevel) * 0.5)) * (0.5 + b.mo * 0.7);
      rch = mix(rch, 0.17 + 0.05 * grain, moss * 0.8);
      gch = mix(gch, 0.29 + 0.1 * grain, moss * 0.8);
      bch = mix(bch, 0.075, moss * 0.8);
      void low;
      const i = y * W + x;
      col[i * 4] = clamp01(rch) * 255; col[i * 4 + 1] = clamp01(gch) * 255; col[i * 4 + 2] = clamp01(bch) * 255; col[i * 4 + 3] = 255;
      hf[i] = bevel * 0.85 + (grain - 0.5) * 0.14 - mortar * 0.6 + (chip > 0.8 ? -0.12 : 0) + moss * 0.1;
      rough[i] = clamp01(0.8 + (grain - 0.5) * 0.3 + mortar * 0.1);
    }
  }
  const cc = canvas(W, H);
  cc.getContext('2d').putImageData(new ImageData(col, W, H), 0, 0);
  return {
    map: tex(cc, { srgb: true }),
    normalMap: tex(normalFromHeight(hf, W, H, 8)),
    roughnessMap: tex(greyCanvas(rough, W, H)),
  };
}

// ------------------------------------------------------------------ small utility textures
export function makeFelt(size = 512) {
  const W = size, H = size;
  const n = new Noise(5);
  const col = new Uint8ClampedArray(W * H * 4);
  const hf = new Float32Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const weave = (Math.sin(x * 1.6) * Math.sin(y * 1.6)) * 0.5 + 0.5;
      const f = n.fbm(x / 9, y / 9, 3, 56, 56);
      const L = 0.05 + 0.025 * f + 0.012 * weave;
      const i = (y * W + x) * 4;
      col[i] = L * 255 * 0.95; col[i + 1] = L * 255 * 0.95; col[i + 2] = L * 255 * 1.0; col[i + 3] = 255;
      hf[y * W + x] = weave * 0.3 + f * 0.2;
    }
  const cc = canvas(W, H);
  cc.getContext('2d').putImageData(new ImageData(col, W, H), 0, 0);
  return { map: tex(cc, { srgb: true }), normalMap: tex(normalFromHeight(hf, W, H, 1.6)) };
}

export function makeParchmentCanvas(w = 1024, h = 768, seed = 4) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const n = new Noise(seed);
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const f = n.fbm(x / 120, y / 120, 5, 8, 6);
      const g = n.fbm(x / 6, y / 6, 2, 100, 100);
      const edgeD = Math.min(x, y, w - x, h - y) / 60;
      const burn = 1 - smooth(0, 1, edgeD);
      let L = 0.80 + (f - 0.5) * 0.42 + (g - 0.5) * 0.06 - burn * 0.28;
      const i = (y * w + x) * 4;
      img.data[i] = clamp01(L * 1.0 + 0.08) * 255; img.data[i + 1] = clamp01(L * 0.86 + 0.04) * 255;
      img.data[i + 2] = clamp01(L * 0.62 + 0.02) * 255; img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function canvasTexture(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export { tex, canvas, clamp01, mix, smooth, normalFromHeight, greyCanvas };
