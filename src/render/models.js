// Loads the Blender-made glTF models (inlined into the bundle) and instantiates rigged copies.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MODEL_DATA } from './assets.generated.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const store = {};

export async function loadModels(progress = () => {}) {
  const names = Object.keys(MODEL_DATA);
  await MeshoptDecoder.ready;
  let i = 0;
  for (const name of names) {
    const u8 = MODEL_DATA[name];
    const buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
    await new Promise((res, rej) => loader.parse(buf, '', (g) => { store[name] = g.scene; res(); }, rej));
    i++;
    if (i % 4 === 0) await progress(`Painting miniatures… ${i}/${names.length}`);
  }
}

export const hasModel = (n) => !!store[n];
export const modelNames = () => Object.keys(store);

// shared by nodes named like "legFL", "wingL", "jawA" ...
export function instantiate(name) {
  const src = store[name];
  if (!src) return null;
  const root = src.clone(true);
  const matMap = new Map();
  const matList = [];
  root.traverse((o) => {
    if (o.isMesh) {
      if (Array.isArray(o.material)) o.material = o.material.map((m) => clone(m));
      else o.material = clone(o.material);
      o.castShadow = !o.name.startsWith('flame') && !o.name.startsWith('noshadow');
      o.receiveShadow = true;
      o.frustumCulled = true;
    }
  });
  function clone(m) {
    if (matMap.has(m)) return matMap.get(m);
    const c = m.clone();
    c.userData.baseEmissive = c.emissive ? c.emissive.clone() : new THREE.Color(0);
    c.userData.baseEmissiveI = c.emissiveIntensity ?? 1;
    c.userData.baseOpacity = c.opacity;
    matMap.set(m, c);
    matList.push(c);
    return c;
  }
  // the exported empty carrying the model's name holds the custom properties
  const top = root.getObjectByName(name) || root;
  const extras = { ...top.userData };
  const f = (n) => root.getObjectByName(n) || null;
  const rig = {};
  for (const n of ['legL', 'legR', 'armL', 'armR', 'head', 'torso', 'cape', 'weapon', 'hand', 'torchHand', 'flame', 'torchTip', 'jaw', 'tail', 'rattle', 'body', 'hinge']) {
    const o = f(n);
    if (o) rig[n] = o;
  }
  const collect = (re) => { const out = []; root.traverse((o) => { if (re.test(o.name)) out.push(o); }); return out; };
  const legs = collect(/^leg(F|B)[LR]$|^leg\d$/);
  if (legs.length) rig.legs = legs;
  const arms = collect(/^arm\d$/);
  if (arms.length) rig.arms = arms;
  const wings = collect(/^wing[LR]$/).map((o) => ({ node: o, side: o.name.endsWith('L') ? 1 : -1 }));
  if (wings.length) rig.wings = wings;
  const jaws = collect(/^jaw[AB]$/).map((o) => ({ node: o, side: o.name.endsWith('A') ? 1 : -1 }));
  if (jaws.length) rig.jaws = jaws;
  const arms2 = collect(/^arm[A-D]$/);
  if (arms2.length) rig.arms = arms2;
  return { root, rig, matList, extras, kit: { matList } };
}

// Geometry of a kit piece with node transforms baked in (for InstancedMesh use).
export function kitMeshes(name, { lift = 0 } = {}) {
  const src = store[name];
  if (!src) return null;
  const root = src.clone(true);
  root.updateMatrixWorld(true);
  const out = [];
  root.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry.clone();
      // quantized (normalized int16) attributes would clip/wrap when transformed: widen to float first
      for (const key of ['position', 'normal', 'color', 'uv']) {
        const a = g.attributes[key];
        if (!a || a.array instanceof Float32Array) continue;
        const f = new Float32Array(a.count * a.itemSize);
        for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
        g.setAttribute(key, new THREE.BufferAttribute(f, a.itemSize));
      }
      g.applyMatrix4(o.matrixWorld);
      if (lift) g.translate(0, lift, 0);
      g.computeBoundingSphere();
      out.push({ geometry: g, material: o.material, name: o.name });
    }
  });
  return out;
}
