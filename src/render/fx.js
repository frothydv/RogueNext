// Visual effects: GPU-point particles, spell bolts, floating numbers, tumbling dice, rings and beams.
import * as THREE from 'three';
import { haloTexture } from './props.js';

const MAXP = 2400;

class Particles {
  constructor(scene, additive) {
    this.n = 0;
    this.pos = new Float32Array(MAXP * 3);
    this.vel = new Float32Array(MAXP * 3);
    this.col = new Float32Array(MAXP * 3);
    this.life = new Float32Array(MAXP);
    this.maxLife = new Float32Array(MAXP);
    this.size = new Float32Array(MAXP);
    this.grav = new Float32Array(MAXP);
    this.drag = new Float32Array(MAXP);
    this.alpha = new Float32Array(MAXP);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; float a = smoothstep(1.0, 0.0, r); a *= a; gl_FragColor = vec4(vC, a * vA); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 10 : 9;
    scene.add(this.points);
  }
  spawn(p, v, c, life, size, grav = 0, drag = 0.0) {
    if (this.n >= MAXP) return;
    const i = this.n++;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grav[i] = grav; this.drag[i] = drag; this.alpha[i] = 1;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const l = --this.n;
        if (i !== l) {
          for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[l * 3 + k]; this.vel[i * 3 + k] = this.vel[l * 3 + k]; this.col[i * 3 + k] = this.col[l * 3 + k]; }
          this.life[i] = this.life[l]; this.maxLife[i] = this.maxLife[l]; this.size[i] = this.size[l]; this.grav[i] = this.grav[l]; this.drag[i] = this.drag[l];
        }
        i--;
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.18 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.18; this.vel[i * 3 + 1] *= -0.3; }
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.2) * Math.min(1, (1 - t) * 18 + 0.2);
    }
    this.geo.setDrawRange(0, this.n);
    for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.attributes[a].needsUpdate = true;
  }
}

function textSprite(text, { color = '#fff', size = 64, stroke = '#000', font = 'bold', family = '"Palatino Linotype", Georgia, serif' } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `${font} ${size}px ${family}`;
  const w = Math.ceil(g.measureText(text).width) + 24;
  c.width = w; c.height = size + 24;
  g.font = `${font} ${size}px ${family}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = size / 6; g.strokeStyle = stroke; g.lineJoin = 'round';
  g.strokeText(text, w / 2, c.height / 2 + 2);
  g.fillStyle = color; g.fillText(text, w / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set((w / c.height) * 0.55, 0.55, 1);
  s.renderOrder = 40;
  return s;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(stage) {
    this.stage = stage;
    this.scene = stage.scene;
    this.add = new Particles(this.scene, true);
    this.norm = new Particles(this.scene, false);
    this.floaters = [];
    this.rings = [];
    this.bolts = [];
    this.projectiles = [];
    this.dice = [];
    this.flashes = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.screen = { red: 0, flash: new THREE.Vector4(1, 1, 1, 0), shakeK: 0 };
    stage.updaters.push((dt, t) => this.update(dt, t));
    this.ambientT = 0;
  }

  setAspect() {
    const h = this.stage.renderer.domElement.height;
    const k = h / (2 * Math.tan((this.stage.camera.fov * Math.PI) / 360));
    this.add.mat.uniforms.uScale.value = k; this.norm.mat.uniforms.uScale.value = k;
  }

  burst(p, { count = 20, color = [1, 1, 1], speed = 2, life = 0.8, size = 0.2, gravity = 0, up = 0.5, spread = 1, additive = true, drag = 1.5, jitter = 0.3 } = {}) {
    const sys = additive ? this.add : this.norm;
    const c = Array.isArray(color) ? new THREE.Color(...color) : new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.283, r = Math.random() * spread;
      const v = V(Math.cos(a) * r * speed, up * speed * (0.4 + Math.random()), Math.sin(a) * r * speed);
      const q = new THREE.Color(c.r * rnd(0.8, 1.2), c.g * rnd(0.8, 1.2), c.b * rnd(0.8, 1.2));
      sys.spawn(V(p.x + rnd(-jitter, jitter) * 0.3, p.y + rnd(-jitter, jitter) * 0.2, p.z + rnd(-jitter, jitter) * 0.3), v, q, life * rnd(0.6, 1.2), size * rnd(0.6, 1.3), gravity, drag);
    }
  }

  text(p, str, opts = {}) {
    const s = textSprite(str, opts);
    s.position.copy(p);
    this.group.add(s);
    this.floaters.push({ s, t: 0, dur: opts.dur || 1.1, vy: opts.vy ?? 1.0, x0: p.x });
    return s;
  }

  ring(p, color, radius = 1.2, dur = 0.6, thick = 0.08) {
    const m = new THREE.Mesh(new THREE.RingGeometry(1 - thick, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(p);
    this.group.add(m);
    this.rings.push({ m, t: 0, dur, radius });
  }

  beam(p, color, dur = 0.8, height = 4) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, height, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(p.x, p.y + height / 2, p.z);
    this.group.add(m);
    this.rings.push({ m, t: 0, dur, beam: true, height });
  }

  flashLight(p, color, intensity = 60, dur = 0.4, dist = 10) {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.copy(p);
    this.scene.add(l);
    this.flashes.push({ l, t: 0, dur, base: intensity });
  }

  halo(p, color, scale = 1.5, dur = 0.5) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color(...color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(p);
    s.scale.setScalar(scale);
    this.group.add(s);
    this.floaters.push({ s, t: 0, dur, vy: 0, grow: 1.4, halo: true });
  }

  // a travelling magic bolt along world points; returns duration
  bolt(points, kind) {
    const palette = {
      flame: { c: [3.5, 1.4, 0.3], light: 0xff8a30, trail: [3, 1.0, 0.2], size: 0.5 },
      ice: { c: [1.2, 2.6, 3.5], light: 0x60c8ff, trail: [0.8, 2.0, 3.2], size: 0.42 },
      bolt: { c: [3, 3, 4], light: 0xb0c8ff, trail: [2, 2.5, 4], size: 0.4 },
      missile: { c: [3, 1.0, 3.4], light: 0xe060ff, trail: [2.4, 0.8, 3], size: 0.3 },
    }[kind] || { c: [3, 3, 3], light: 0xffffff, trail: [2, 2, 2], size: 0.35 };
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color(...palette.c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(palette.size * 2.2);
    this.group.add(s);
    const light = new THREE.PointLight(palette.light, 40, 9, 2);
    this.scene.add(light);
    const speed = kind === 'bolt' ? 22 : 14;
    let len = 0;
    for (let i = 1; i < points.length; i++) len += points[i].distanceTo(points[i - 1]);
    const dur = Math.max(0.2, len / speed);
    this.bolts.push({ s, light, points, t: 0, dur, kind, palette, lines: null });
    if (kind === 'bolt') {
      const geo = new THREE.BufferGeometry();
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(3, 3.4, 4), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
      line.frustumCulled = false;
      this.group.add(line);
      this.bolts[this.bolts.length - 1].lines = line;
    }
    return dur;
  }

  // a flying thrown/fired object; returns duration
  projectile(mesh, from, to, dur, spin = 0, arc = 0.5) {
    mesh.position.copy(from);
    this.group.add(mesh);
    this.projectiles.push({ mesh, from: from.clone(), to: to.clone(), t: 0, dur, spin, arc });
    return dur;
  }

  // dice: d20 shows the attack roll
  rollDice(from, to, value, need, hit, big = true) {
    const geo = new THREE.IcosahedronGeometry(big ? 0.3 : 0.22, 0);
    const mat = new THREE.MeshStandardMaterial({ color: hit ? 0x1e7a3a : 0x8a1a1a, roughness: 0.25, metalness: 0.2, emissive: hit ? 0x0a3a14 : 0x3a0808, flatShading: true, envMapIntensity: 1.6 });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.position.copy(from);
    this.group.add(m);
    const dur = 0.62;
    const label = textSprite(`${value}`, { color: hit ? '#9dffb0' : '#ff9d9d', size: 52 });
    label.visible = false;
    this.group.add(label);
    this.dice.push({ m, label, from: from.clone(), to: to.clone(), t: 0, dur, spin: V(rnd(8, 16), rnd(8, 16), rnd(6, 12)), hit, need });
  }

  update(dt, t) {
    this.add.update(dt); this.norm.update(dt);
    // floaters
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      const p = f.t / f.dur;
      if (p >= 1) { this.group.remove(f.s); f.s.material.dispose(); this.floaters.splice(i, 1); continue; }
      f.s.position.y += (f.vy || 0) * dt * (1 - p);
      f.s.material.opacity = f.halo ? (1 - p) : p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.55) / 0.45);
      if (f.grow) f.s.scale.multiplyScalar(1 + dt * f.grow);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const p = r.t / r.dur;
      if (p >= 1) { this.group.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); continue; }
      if (r.beam) { r.m.scale.set(1 + p * 0.4, 1, 1 + p * 0.4); r.m.material.opacity = (1 - p) * 0.9; r.m.position.y = r.height / 2 + 0.2; }
      else { const e = 1 - Math.pow(1 - p, 2); r.m.scale.setScalar(r.radius * e + 0.01); r.m.material.opacity = (1 - p) * 0.9; }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const p = f.t / f.dur;
      if (p >= 1) { this.scene.remove(f.l); f.l.dispose(); this.flashes.splice(i, 1); continue; }
      f.l.intensity = f.base * (1 - p) * (1 - p);
    }
    // bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      const p = Math.min(1, b.t / b.dur);
      const pts = b.points;
      const total = pts.length - 1;
      const f = p * total;
      const k = Math.min(total - 1, Math.floor(f));
      const a = pts[Math.max(0, k)], c = pts[Math.min(total, k + 1)] || a;
      const frac = f - k;
      const pos = a.clone().lerp(c, frac);
      b.s.position.copy(pos);
      b.light.position.copy(pos);
      b.light.intensity = 40 * (1 - Math.max(0, p - 0.8) * 5);
      const jitter = b.kind === 'bolt' ? 0.04 : 0.08;
      for (let n = 0; n < 4; n++) {
        const col = new THREE.Color(...b.palette.trail);
        this.add.spawn(V(pos.x + rnd(-jitter, jitter), pos.y + rnd(-jitter, jitter), pos.z + rnd(-jitter, jitter)), V(rnd(-0.5, 0.5), rnd(0, 0.8), rnd(-0.5, 0.5)), col, rnd(0.25, 0.5), b.palette.size * rnd(0.5, 1.1), b.kind === 'flame' ? -0.6 : 0, 2);
      }
      if (b.lines) {
        const seg = [];
        const from = pts[0];
        for (let s = 0; s <= 14; s++) {
          const q = from.clone().lerp(pos, s / 14);
          const j = (s === 0 || s === 14) ? 0 : 0.18;
          q.x += rnd(-j, j); q.y += rnd(-j, j) * 0.6; q.z += rnd(-j, j);
          seg.push(q);
        }
        b.lines.geometry.setFromPoints(seg);
      }
      if (p >= 1) {
        this.group.remove(b.s); b.s.material.dispose();
        this.scene.remove(b.light); b.light.dispose();
        if (b.lines) { this.group.remove(b.lines); b.lines.geometry.dispose(); }
        this.burst(pts[pts.length - 1], { count: 26, color: b.palette.trail, speed: 2.6, life: 0.6, size: 0.35, spread: 1, up: 0.7, gravity: b.kind === 'flame' ? -0.5 : 1 });
        this.flashLight(pts[pts.length - 1], b.palette.light, 50, 0.35, 8);
        this.bolts.splice(i, 1);
      }
    }
    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.mesh.position.lerpVectors(p.from, p.to, k);
      p.mesh.position.y += Math.sin(k * Math.PI) * p.arc;
      if (p.spin) p.mesh.rotation.y += dt * p.spin;
      else p.mesh.lookAt(p.mesh.position.x + (p.to.x - p.from.x), p.mesh.position.y, p.mesh.position.z + (p.to.z - p.from.z));
      if (k >= 1) { this.group.remove(p.mesh); this.projectiles.splice(i, 1); }
    }
    // dice
    for (let i = this.dice.length - 1; i >= 0; i--) {
      const d = this.dice[i];
      d.t += dt;
      const p = Math.min(1, d.t / d.dur);
      const e = 1 - Math.pow(1 - p, 2);
      d.m.position.lerpVectors(d.from, d.to, e);
      d.m.position.y = 0.3 + Math.abs(Math.sin(p * Math.PI * 2.4)) * (1 - p) * 1.3 + (1 - p) * 0.4;
      d.m.rotation.x += d.spin.x * dt * (1 - p); d.m.rotation.y += d.spin.y * dt * (1 - p); d.m.rotation.z += d.spin.z * dt * (1 - p);
      if (p >= 1) {
        d.label.visible = true;
        d.label.position.set(d.to.x, 1.1 + (d.t - d.dur) * 0.4, d.to.z);
        d.label.material.opacity = Math.max(0, 1 - (d.t - d.dur) / 0.9);
        if (d.t - d.dur > 0.9) {
          this.group.remove(d.m); this.group.remove(d.label);
          d.m.geometry.dispose(); d.m.material.dispose(); d.label.material.dispose();
          this.dice.splice(i, 1);
        }
      }
    }
    // screen effects decay
    this.screen.red *= Math.exp(-dt * 3.2);
    this.screen.flash.w *= Math.exp(-dt * 5);
    // ambient dust motes drifting through the window light
    this.ambientT += dt;
    const heroP = this.stage.heroWorld;
    if (heroP && this.ambientT > 0.12) {
      this.ambientT = 0;
      const c = new THREE.Color(1.6, 1.4, 1.0);
      this.norm.spawn(V(heroP.x + rnd(-14, 14), rnd(0.5, 5), heroP.z + rnd(-9, 9)), V(rnd(-0.1, 0.1), rnd(-0.03, 0.08), rnd(-0.1, 0.1)), c, rnd(5, 9), rnd(0.03, 0.06), 0, 0.1);
    }
  }

  // convenience: rising embers from a flame position
  embers(p) {
    this.add.spawn(V(p.x + rnd(-0.03, 0.03), p.y, p.z + rnd(-0.03, 0.03)), V(rnd(-0.15, 0.15), rnd(0.4, 0.9), rnd(-0.15, 0.15)), new THREE.Color(3, 1.2, 0.3), rnd(0.8, 1.6), 0.07, -0.05, 0.3);
  }
}
