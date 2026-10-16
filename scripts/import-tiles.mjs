// One-off importer for the textured dungeon tiles (wall / floor / door) delivered as high-poly PBR GLBs.
// Usage: node scripts/import-tiles.mjs <wall.glb> <floor.glb> <door.glb>
// Each is decimated, its textures are shrunk to 1024px WebP, and the result is written to assets/models/tile_*.glb
// (npm run assets then picks them up via assets.generated.js).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization, EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobs = [['wall', 0.06], ['floor', 0.045], ['door', 0.1]].map(([n, ratio], i) => ({ name: n, ratio, src: process.argv[2 + i] }));

// The door is one carved slab; cut the recessed leaf out of the arch so the game can swing it. Triangles are assigned
// by centroid to the 'leaf' (inside the arched opening) or the 'frame' (everything else), each as its own mesh node.
const LEAF_HALF = 0.335, LEAF_BOTTOM = 0.215, ARCH_SPRING = 1.1;
// The wall is scaled in-game to the height of the door arch, which makes it ~2.5 cells wide, so it is cut into
// three one-cell-wide upright segments (clipped on x, not stretched). Each is a different stretch of brickwork.
const SEG_W = 0.705, SEG_X = [-0.75, -SEG_W / 2, 0.045];
const clipSegments = (doc) => {
  const root = doc.getRoot();
  const mesh = root.listMeshes()[0], prim = mesh.listPrimitives()[0];
  const idx = prim.getIndices().getArray();
  const names = ['POSITION', 'NORMAL', 'TEXCOORD_0'];
  const attrs = names.map((n) => prim.getAttribute(n));
  const sizes = attrs.map((a) => a.getElementSize());
  const arrs = attrs.map((a) => a.getArray());
  const vert = (v) => { const o = []; arrs.forEach((a, i) => { for (let c = 0; c < sizes[i]; c++) o.push(a[v * sizes[i] + c]); }); return o; };
  const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  // clip a convex polygon of interleaved vertices (x is component 0) to one side of x = edge
  const clip = (poly, edge, keepGreater) => {
    const inside = (v) => (keepGreater ? v[0] >= edge : v[0] <= edge);
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ka = inside(a), kb = inside(b);
      if (ka) out.push(a);
      if (ka !== kb) out.push(lerp(a, b, (edge - a[0]) / (b[0] - a[0])));
    }
    return out;
  };
  const buf = root.listBuffers()[0], scene = root.listScenes()[0], mat = prim.getMaterial();
  SEG_X.forEach((lo, si) => {
    const hi = lo + SEG_W;
    const verts = [], ind = [];
    for (let t = 0; t < idx.length / 3; t++) {
      let poly = [0, 1, 2].map((k) => vert(idx[t * 3 + k]));
      const xs = poly.map((v) => v[0]);
      if (Math.max(...xs) < lo || Math.min(...xs) > hi) continue;
      poly = clip(clip(poly, lo, true), hi, false);
      if (poly.length < 3) continue;
      const base = verts.length;
      poly.forEach((v) => verts.push(v));
      for (let i = 1; i < poly.length - 1; i++) ind.push(base, base + i, base + i + 1);
    }
    const np = doc.createPrimitive().setMaterial(mat).setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(ind)).setBuffer(buf));
    let off = 0;
    attrs.forEach((a, i) => {
      const out = new Float32Array(verts.length * sizes[i]);
      verts.forEach((v, n) => { for (let c = 0; c < sizes[i]; c++) out[n * sizes[i] + c] = v[off + c]; });
      off += sizes[i];
      np.setAttribute(names[i], doc.createAccessor().setType(a.getType()).setArray(out).setBuffer(buf));
    });
    scene.addChild(doc.createNode(`seg${si}`).setMesh(doc.createMesh(`seg${si}`).addPrimitive(np)));
    console.log(`  seg${si}: ${ind.length / 3} source tris`);
  });
  for (const n of root.listNodes()) if (n.getName() === 'model') n.dispose();
  mesh.dispose(); prim.dispose();
};

const splitLeaf = (doc) => {
  const root = doc.getRoot();
  const mesh = root.listMeshes()[0], prim = mesh.listPrimitives()[0];
  const idx = prim.getIndices().getArray();
  const attrs = ['POSITION', 'NORMAL', 'TEXCOORD_0'].map((n) => [n, prim.getAttribute(n)]);
  const P = prim.getAttribute('POSITION').getArray();
  const inLeaf = (t) => {
    let cx = 0, cy = 0;
    for (let k = 0; k < 3; k++) { cx += P[idx[t * 3 + k] * 3]; cy += P[idx[t * 3 + k] * 3 + 1]; }
    cx /= 3; cy /= 3;
    return Math.abs(cx) <= LEAF_HALF && cy >= LEAF_BOTTOM && cy <= ARCH_SPRING + Math.sqrt(Math.max(0, LEAF_HALF ** 2 - cx * cx));
  };
  const buf = root.listBuffers()[0], scene = root.listScenes()[0], mat = prim.getMaterial();
  const parts = { frame: [], leaf: [] };
  for (let t = 0; t < idx.length / 3; t++) parts[inLeaf(t) ? 'leaf' : 'frame'].push(t);
  for (const [name, tris] of Object.entries(parts)) {
    const remap = new Map(), order = [];
    const ni = new Uint32Array(tris.length * 3);
    tris.forEach((t, i) => { for (let k = 0; k < 3; k++) { const v = idx[t * 3 + k]; if (!remap.has(v)) { remap.set(v, order.length); order.push(v); } ni[i * 3 + k] = remap.get(v); } });
    const np = doc.createPrimitive().setMaterial(mat).setIndices(doc.createAccessor().setType('SCALAR').setArray(ni).setBuffer(buf));
    for (const [n, a] of attrs) {
      const sz = a.getElementSize(), src = a.getArray(), out = new Float32Array(order.length * sz);
      order.forEach((v, i) => { for (let c = 0; c < sz; c++) out[i * sz + c] = src[v * sz + c]; });
      np.setAttribute(n, doc.createAccessor().setType(a.getType()).setArray(out).setBuffer(buf));
    }
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(np)));
    console.log(`  ${name}: ${tris.length} source tris`);
  }
  for (const n of root.listNodes()) if (n.getName() === 'model') n.dispose();
  mesh.dispose(); prim.dispose();
};
if (jobs.some((j) => !j.src)) { console.error('usage: node scripts/import-tiles.mjs <wall.glb> <floor.glb> <door.glb>'); process.exit(1); }
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization, EXTTextureWebP])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
for (const j of jobs) {
  const doc = await io.read(j.src);
  await doc.transform(dedup(), weld({ tolerance: 0.00002 }));
  if (j.name === 'door') splitLeaf(doc);
  if (j.name === 'wall') clipSegments(doc);
  await doc.transform(
    weld({ tolerance: 0.00002 }),
    simplify({ simplifier: MeshoptSimplifier, ratio: j.ratio, error: 0.004, lockBorder: j.name === 'wall' }),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 88 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  );
  const out = path.join(root, 'assets/models', `tile_${j.name}.glb`);
  await io.write(out, doc);
  const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((a, p) => a + p.getIndices().getCount() / 3, 0);
  console.log(`tile_${j.name}: ${tris} tris`);
}
