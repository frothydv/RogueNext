// The "kitchen table": renderer, camera rig, lights, post-processing, table surface and backdrop.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as T from './textures.js';

export const BOARD = { x0: -1, x1: 81, z0: 0, z1: 24 };
export const BOARD_CX = (BOARD.x0 + BOARD.x1) / 2, BOARD_CZ = (BOARD.z0 + BOARD.z1) / 2;

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uVignette: { value: 0.42 }, uGrain: { value: 0.035 },
    uTint: { value: new THREE.Vector3(1.0, 0.97, 0.92) }, uDesat: { value: 0 }, uHue: { value: 0 },
    uChroma: { value: 0.0006 }, uWobble: { value: 0 }, uBlind: { value: 0 }, uRed: { value: 0 },
    uFlash: { value: new THREE.Vector4(1, 1, 1, 0) }, uAspect: { value: 1.7 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uDesat, uHue, uChroma, uWobble, uBlind, uRed, uAspect;
    uniform vec3 uTint; uniform vec4 uFlash; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    vec3 hueRot(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a), sa = sin(a); return c*ca + cross(k,c)*sa + k*dot(k,c)*(1.0-ca); }
    void main(){
      vec2 uv = vUv;
      if (uWobble > 0.0) { uv += vec2(sin(uv.y*18.0+uTime*3.0), cos(uv.x*15.0+uTime*2.3)) * 0.006 * uWobble; }
      vec2 d = uv - 0.5;
      float r2 = dot(d*vec2(uAspect,1.0), d*vec2(uAspect,1.0));
      vec2 ca = d * uChroma * (1.0 + r2*6.0 + uWobble*4.0 + abs(uHue)*3.0);
      vec3 col = vec3(texture2D(tDiffuse, uv + ca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - ca).b);
      if (uHue != 0.0) col = hueRot(col, uHue);
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col, vec3(l), uDesat);
      col *= uTint;
      col = mix(col, uFlash.rgb, uFlash.a);
      float v = smoothstep(0.95, 0.15, sqrt(r2));
      col *= mix(1.0 - uVignette, 1.0, v);
      col = mix(col, col * vec3(1.0,0.35,0.3) * 0.8, uRed * (1.0 - v * 0.5));
      col *= 1.0 - uBlind * (0.55 + 0.45 * smoothstep(0.0, 0.6, sqrt(r2)));
      float g = hash(uv * 1500.0 + fract(uTime) * 91.7) - 0.5;
      col += g * uGrain * (1.0 - l * 0.5);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Stage {
  constructor(parent, settings) {
    this.parent = parent;
    this.settings = settings;
    this.clock = new THREE.Clock();
    this.time = 0;
    this.updaters = [];
    this.focus = new THREE.Vector3(40, 0, 12);
    this.focusTarget = new THREE.Vector3(40, 0, 12);
    this.cam = { yaw: 0, pitch: 46 * Math.PI / 180, dist: 22, yawT: 0, pitchT: 46 * Math.PI / 180, distT: 22, shake: 0, punch: 0 };
    this.overview = false;
  }

  async init(progress = () => {}) {
    const s = this.settings;
    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: !s.post, powerPreference: 'high-performance', stencil: false }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, s.pixelRatioCap));
    renderer.setSize(this.parent.clientWidth, this.parent.clientHeight);
    renderer.shadowMap.enabled = s.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.parent.appendChild(renderer.domElement);
    renderer.domElement.id = 'gl';

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x1a1410);
    scene.fog = new THREE.Fog(0x120d09, 140, 330);
    this.camera = new THREE.PerspectiveCamera(33, this.parent.clientWidth / this.parent.clientHeight, 0.5, 600);

    // image-based lighting for subtle reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.14;

    await progress('Carving the table…');
    this.tex = {};
    this.tex.wood = T.makeWood(s.texSize);
    await progress('Quarrying flagstones…');
    this.tex.floor = T.makeFlagstone(s.texSize, { seed: 3 });
    await progress('Laying walls…');
    this.tex.wall = T.makeWall(s.texSize);
    this.tex.felt = T.makeFelt(512);

    this.buildLights();
    this.buildTable();
    this.buildBackdrop();
    this.buildPost();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // -------------------------------------------------------------- lights
  buildLights() {
    const s = this.settings, scene = this.scene;
    this.hemi = new THREE.HemisphereLight(0xffe2bf, 0x2a1d14, 0.42);
    scene.add(this.hemi);
    // the "window" key light
    const key = (this.key = new THREE.DirectionalLight(0xfff0dc, 3.4));
    key.castShadow = s.shadows;
    key.shadow.mapSize.set(s.shadowRes, s.shadowRes);
    const sc = key.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 140;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04; key.shadow.radius = 4;
    scene.add(key, key.target);
    // cool fill from the right to separate warm torchlight from daylight
    const fill = new THREE.DirectionalLight(0x9bb7e8, 0.45);
    fill.position.set(60, 30, 20);
    scene.add(fill, fill.target);
    // the hero's torch
    const torch = (this.heroLight = new THREE.PointLight(0xffa24d, 26, 30, 1.7));
    torch.castShadow = s.torchShadows;
    torch.shadow.mapSize.set(1024, 1024);
    torch.shadow.bias = -0.002; torch.shadow.normalBias = 0.05; torch.shadow.radius = 3;
    torch.shadow.camera.near = 0.3; torch.shadow.camera.far = 30;
    scene.add(torch);
    // pool of wall-torch lights
    this.torchPool = [];
    for (let i = 0; i < s.torchLights; i++) {
      const l = new THREE.PointLight(0xff8a3a, 0, 14, 2);
      l.userData.base = 1;
      scene.add(l);
      this.torchPool.push(l);
    }
  }

  // -------------------------------------------------------------- the table
  buildTable() {
    const { wood } = this.tex;
    for (const t of [wood.map, wood.normalMap, wood.roughnessMap]) t.repeat.set(7, 4);
    const mat = new THREE.MeshStandardMaterial({
      map: wood.map, normalMap: wood.normalMap, normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: wood.roughnessMap, roughness: 0.75, metalness: 0.0, color: 0xcfc4b8,
    });
    const geo = new THREE.PlaneGeometry(380, 260);
    geo.rotateX(-Math.PI / 2);
    this.table = new THREE.Mesh(geo, mat);
    this.table.position.set(BOARD_CX, 0, BOARD_CZ + 5);
    this.table.receiveShadow = true;
    this.scene.add(this.table);
    // table edge/front lip (visible when camera orbits low)
    const lip = new THREE.Mesh(new THREE.BoxGeometry(380, 3, 2), new THREE.MeshStandardMaterial({ color: 0x4a2f1b, roughness: 0.7 }));
    lip.position.set(BOARD_CX, -1.5, BOARD_CZ + 5 + 130);
    this.scene.add(lip);

    // the board: a felt mat that grows as the dungeon is explored
    this.mat = { x0: 30, x1: 54, z0: 4, z1: 20 };
    this.matT = { ...this.mat };
    const top = new THREE.MeshStandardMaterial({ map: this.tex.felt.map, normalMap: this.tex.felt.normalMap, roughness: 0.95, color: 0xffffff });
    this.feltTop = top;
    const side = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.8 });
    this.board = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 1), [side, side, top, side, side, side]);
    this.board.receiveShadow = true;
    this.board.castShadow = true;
    this.scene.add(this.board);
    // printed level title along the mat's border (drawn twice, once upside-down for the far side)
    this.labelCanvas = T.canvas(2048, 128);
    this.labelTex = T.canvasTexture(this.labelCanvas);
    this.labelTex.anisotropy = 16;
    const lmat = new THREE.MeshStandardMaterial({ map: this.labelTex, transparent: true, depthWrite: false, roughness: 0.6, emissive: 0x302820, emissiveMap: this.labelTex });
    this.labels = [new THREE.Mesh(new THREE.PlaneGeometry(32, 2), lmat), new THREE.Mesh(new THREE.PlaneGeometry(32, 2), lmat)];
    for (const l of this.labels) { l.rotation.x = -Math.PI / 2; l.renderOrder = 1; this.scene.add(l); }
    this.labels[1].rotation.z = Math.PI;
    this.updateMat(1);
    this.setBoardLabel('LEVEL 1: THE ANTECHAMBER');
  }

  setMatTarget(x0, x1, z0, z1) {
    const minW = 26, minD = 15;
    let cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = Math.max(minW, x1 - x0), d = Math.max(minD, z1 - z0);
    this.matT = { x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 };
  }

  updateMat(dt) {
    const k = dt >= 1 ? 1 : 1 - Math.exp(-dt * 3);
    const m = this.mat, t = this.matT;
    for (const key of ['x0', 'x1', 'z0', 'z1']) m[key] += (t[key] - m[key]) * k;
    const w = m.x1 - m.x0, d = m.z1 - m.z0, cx = (m.x0 + m.x1) / 2, cz = (m.z0 + m.z1) / 2;
    this.board.scale.set(w, 1, d);
    this.board.position.set(cx, 0.08, cz);
    this.feltTop.map.repeat.set(w / 3, d / 3);
    this.feltTop.normalMap.repeat.set(w / 3, d / 3);
    this.labels[0].position.set(cx, 0.172, m.z1 - 0.62);
    this.labels[1].position.set(cx, 0.172, m.z0 + 0.62);
    if (this.propAnchors) {
      const A = this.propAnchors;
      A.left.position.set(m.x0, 0, cz); A.right.position.set(m.x1, 0, cz);
      A.bottom.position.set(cx, 0, m.z1); A.top.position.set(cx, 0, m.z0);
    }
  }

  setBoardLabel(text) {
    const c = this.labelCanvas, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.font = 'bold 66px "Palatino Linotype", Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#d9d0c0';
    g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 5;
    try { g.letterSpacing = '9px'; } catch (e) { /* older browsers */ }
    g.fillText(text, c.width / 2, c.height / 2 + 4);
    this.labelTex.needsUpdate = true;
  }

  buildBackdrop() {
    // painted kitchen, blurred; the depth-of-field pass blurs it further
    const W = 2048, H = 1024;
    const c = T.canvas(W, H);
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#6b5238'); grd.addColorStop(0.5, '#a07a55'); grd.addColorStop(1, '#4a3322');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // backsplash tiles
    g.fillStyle = '#d9cbb2'; g.fillRect(0, 380, W, 300);
    g.strokeStyle = 'rgba(80,60,40,.35)'; g.lineWidth = 3;
    for (let x = 0; x < W; x += 64) { g.beginPath(); g.moveTo(x, 380); g.lineTo(x, 680); g.stroke(); }
    for (let y = 380; y < 680; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // upper cabinets
    g.fillStyle = '#8a5a32';
    for (let i = 0; i < 6; i++) {
      g.fillRect(40 + i * 340, 60, 310, 300);
      g.fillStyle = '#6e4524'; g.fillRect(60 + i * 340, 80, 270, 260); g.fillStyle = '#8a5a32';
      g.fillStyle = '#d8b46a'; g.fillRect(180 + i * 340, 300, 30, 12); g.fillStyle = '#8a5a32';
    }
    // window with daylight
    const wg = g.createRadialGradient(1000, 250, 20, 1000, 250, 360);
    wg.addColorStop(0, '#fffbe8'); wg.addColorStop(0.6, '#ffe9b0'); wg.addColorStop(1, '#e8c37a');
    g.fillStyle = wg; g.fillRect(780, 100, 440, 340);
    g.fillStyle = '#5a3a20'; g.fillRect(780, 100, 440, 14); g.fillRect(780, 426, 440, 14);
    g.fillRect(780, 100, 14, 340); g.fillRect(1206, 100, 14, 340); g.fillRect(993, 100, 14, 340); g.fillRect(780, 262, 440, 12);
    // plants
    g.fillStyle = '#35552d';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(1290 + Math.random() * 120, 360 - Math.random() * 120, 40, 14, Math.random() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#7a4a2a'; g.fillRect(1290, 360, 120, 70);
    g.fillStyle = '#2f4a28';
    for (let i = 0; i < 30; i++) { g.beginPath(); g.ellipse(330 + Math.random() * 100, 560 - Math.random() * 100, 36, 12, Math.random() * 3, 0, 7); g.fill(); }
    // counter
    g.fillStyle = '#b79a72'; g.fillRect(0, 680, W, 80);
    g.fillStyle = '#5d3b21'; g.fillRect(0, 760, W, 264);
    // hanging utensils
    g.fillStyle = '#2b2118';
    for (let i = 0; i < 9; i++) g.fillRect(1500 + i * 38, 380, 10, 140 + (i % 3) * 20);
    g.filter = 'blur(10px)';
    g.drawImage(c, 0, 0);
    g.filter = 'none';
    const t = T.canvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.5, 1.4, 1.25), fog: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(460, 215), mat);
    back.position.set(BOARD_CX, -20, BOARD_CZ - 128);
    this.scene.add(back);
    // bokeh-ish warm lights
    const dotMat = new THREE.SpriteMaterial({ color: new THREE.Color(3.2, 2.2, 1.1), transparent: true, opacity: 0.55, depthWrite: false, fog: false });
    for (let i = 0; i < 26; i++) {
      const sp = new THREE.Sprite(dotMat);
      sp.position.set(BOARD_CX + (Math.random() - 0.5) * 360, 10 + Math.random() * 60, BOARD_CZ - 124);
      sp.scale.setScalar(4 + Math.random() * 8);
      this.scene.add(sp);
    }
  }

  // -------------------------------------------------------------- post
  buildPost() {
    const s = this.settings, renderer = this.renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer = null;
    if (!s.post) return;
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: s.msaa });
    const composer = (this.composer = new EffectComposer(renderer, rt));
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (s.dof) {
      this.bokeh = new BokehPass(this.scene, this.camera, { focus: 27, aperture: 0.00007, maxblur: 0.012 });
      composer.addPass(this.bokeh);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), s.bloom, 0.65, 0.92);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    composer.addPass(this.final);
  }

  resize() {
    const w = this.parent.clientWidth, h = this.parent.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
    }
    if (this.final) this.final.uniforms.uAspect.value = w / h;
  }

  // -------------------------------------------------------------- camera rig
  setFocus(x, z, snap = false) {
    this.focusTarget.set(x, 0, z);
    if (snap) this.focus.copy(this.focusTarget);
  }
  orbit(dyaw, dpitch) {
    this.cam.yawT = THREE.MathUtils.clamp(this.cam.yawT + dyaw, -1.1, 1.1);
    this.cam.pitchT = THREE.MathUtils.clamp(this.cam.pitchT + dpitch, 0.28, 1.5);
  }
  zoom(f) {
    this.cam.distT = THREE.MathUtils.clamp(this.cam.distT * f, 9, 95);
  }
  resetCamera() {
    this.cam.yawT = 0; this.cam.pitchT = 46 * Math.PI / 180; this.cam.distT = 22; this.overview = false;
  }
  toggleOverview() {
    this.overview = !this.overview;
    if (this.overview) { this.cam.distT = 88; this.cam.pitchT = 62 * Math.PI / 180; this.cam.yawT = 0; }
    else this.resetCamera();
  }
  shake(a) { this.cam.shake = Math.max(this.cam.shake, a); }

  update(dt) {
    this.time += dt;
    this.updateMat(dt);
    const c = this.cam;
    const k = 1 - Math.exp(-dt * 5);
    this.focus.lerp(this.focusTarget, 1 - Math.exp(-dt * (this.overview ? 3 : 4.5)));
    c.yaw += (c.yawT - c.yaw) * k;
    c.pitch += (c.pitchT - c.pitch) * k;
    c.dist += (c.distT - c.dist) * k;
    let fx = this.focus.x, fz = this.focus.z;
    if (this.overview) { fx = BOARD_CX; fz = BOARD_CZ + 2; }
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const d = c.dist * (1 - c.punch * 0.03);
    this.camera.position.set(fx + Math.sin(c.yaw) * cp * d, sp * d + 0.5, fz + Math.cos(c.yaw) * cp * d);
    if (c.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * c.shake;
      this.camera.position.y += (Math.random() - 0.5) * c.shake;
      c.shake *= Math.exp(-dt * 9);
    }
    this.camera.lookAt(fx, 0.4, fz - (this.overview ? 0 : 0.6));
    c.punch *= Math.exp(-dt * 7);
    // lights follow the focus
    const key = this.key;
    key.position.set(fx - 24, 46, fz + 16);
    key.target.position.set(fx, 0, fz);
    key.target.updateMatrixWorld();
    if (this.bokeh) {
      this.bokeh.uniforms.focus.value = this.camera.position.distanceTo(this.focus) * (this.overview ? 0.9 : 1.0);
      this.bokeh.uniforms.aperture.value = this.overview ? 0.00001 : this.settings.aperture;
    }
    if (this.final) this.final.uniforms.uTime.value = this.time;
    for (const u of this.updaters) u(dt, this.time);
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // ray from client pixel to the board plane (y = h)
  pickPlane(clientX, clientY, h = 0.2) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -h);
    const out = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, out) ? out : null;
  }
  project(v3) {
    const v = v3.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top, behind: v.z > 1 };
  }
}

export function qualityPreset(name) {
  const base = { pixelRatioCap: 2, texSize: 1024, torchLights: 6, aperture: 0.00007 };
  switch (name) {
    case 'ultra': return { ...base, post: true, dof: true, bloom: 0.42, msaa: 4, shadows: true, shadowRes: 4096, torchShadows: true, pixelRatioCap: 2 };
    case 'high': return { ...base, post: true, dof: true, bloom: 0.4, msaa: 4, shadows: true, shadowRes: 2048, torchShadows: true };
    case 'medium': return { ...base, post: true, dof: false, bloom: 0.28, msaa: 2, shadows: true, shadowRes: 2048, torchShadows: false, pixelRatioCap: 1.5, torchLights: 4 };
    default: return { ...base, post: false, dof: false, bloom: 0, msaa: 0, shadows: false, shadowRes: 1024, torchShadows: false, pixelRatioCap: 1, torchLights: 2, texSize: 512 };
  }
}
