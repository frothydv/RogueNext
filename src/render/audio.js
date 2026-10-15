// A tiny procedural sound-effects synthesizer (no audio files): footsteps, blows, spells, coins, ambience.
let ctx = null, master = null, noiseBuf = null, enabled = true, ambience = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

function noise(dur, { type = 'lowpass', f0 = 800, f1 = f0, q = 0.7, vol = 0.4, attack = 0.005, delay = 0 } = {}) {
  const c = ensure(); if (!c || !enabled) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
function tone(freq, dur, { type = 'sine', f1 = freq, vol = 0.3, attack = 0.005, delay = 0, vib = 0 } = {}) {
  const c = ensure(); if (!c || !enabled) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  if (vib) { const l = c.createOscillator(); l.frequency.value = 9; const lg = c.createGain(); lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

const SFX = {
  step: () => noise(0.07, { f0: 500 + Math.random() * 300, f1: 200, vol: 0.12 }),
  hit: () => { noise(0.14, { f0: 2000, f1: 300, vol: 0.5 }); tone(130, 0.18, { f1: 50, vol: 0.5, type: 'triangle' }); },
  hitMonster: () => { noise(0.12, { f0: 1600, f1: 250, vol: 0.45 }); tone(160, 0.14, { f1: 70, vol: 0.4, type: 'triangle' }); },
  miss: () => noise(0.2, { type: 'bandpass', f0: 500, f1: 2400, q: 1.5, vol: 0.22 }),
  kill: () => { tone(200, 0.4, { f1: 40, vol: 0.4, type: 'sawtooth' }); noise(0.3, { f0: 900, f1: 120, vol: 0.3 }); },
  hurt: () => { tone(110, 0.3, { f1: 45, vol: 0.55, type: 'triangle' }); noise(0.2, { f0: 1500, f1: 200, vol: 0.4 }); },
  coin: () => { tone(1480, 0.12, { vol: 0.2 }); tone(1976, 0.2, { vol: 0.2, delay: 0.07 }); },
  pickup: () => tone(520, 0.12, { f1: 880, vol: 0.15 }),
  potion: () => { tone(300, 0.5, { f1: 900, vol: 0.2, vib: 40 }); noise(0.4, { type: 'bandpass', f0: 1200, f1: 3000, q: 2, vol: 0.1 }); },
  scroll: () => { noise(0.35, { type: 'highpass', f0: 3000, f1: 6000, vol: 0.2 }); tone(660, 0.4, { f1: 990, vol: 0.12, type: 'triangle', delay: 0.1 }); },
  flame: () => noise(0.6, { f0: 1800, f1: 300, vol: 0.5 }),
  ice: () => { tone(2200, 0.5, { f1: 1500, vol: 0.18, type: 'triangle' }); noise(0.3, { type: 'highpass', f0: 5000, f1: 4000, vol: 0.2 }); },
  bolt: () => { noise(0.3, { type: 'highpass', f0: 4000, f1: 1500, vol: 0.5 }); tone(90, 0.3, { f1: 40, vol: 0.4, type: 'sawtooth' }); },
  missile: () => tone(600, 0.45, { f1: 1500, vol: 0.2, type: 'square' }),
  stairs: () => { noise(0.8, { f0: 700, f1: 90, vol: 0.35 }); tone(220, 0.8, { f1: 70, vol: 0.2, type: 'triangle' }); },
  secret: () => { noise(0.5, { f0: 300, f1: 120, vol: 0.4 }); tone(70, 0.5, { f1: 55, vol: 0.3, type: 'triangle' }); },
  levelup: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { vol: 0.2, type: 'triangle', delay: i * 0.1 })),
  trap: () => { tone(900, 0.04, { vol: 0.3, type: 'square' }); noise(0.25, { f0: 600, f1: 100, vol: 0.4, delay: 0.05 }); },
  teleport: () => { tone(300, 0.6, { f1: 1800, vol: 0.2, type: 'sine', vib: 80 }); },
  wake: () => tone(900, 0.12, { f1: 600, vol: 0.12, type: 'square' }),
  door: () => noise(0.3, { f0: 400, f1: 150, vol: 0.2 }),
  throw: () => noise(0.18, { type: 'bandpass', f0: 800, f1: 2800, q: 2, vol: 0.2 }),
  eat: () => { for (let i = 0; i < 3; i++) noise(0.06, { f0: 1500, f1: 600, vol: 0.2, delay: i * 0.12 }); },
  gong: () => { tone(110, 2.2, { f1: 100, vol: 0.5, type: 'sine' }); tone(220, 1.6, { f1: 205, vol: 0.2, type: 'sine' }); },
  drip: () => tone(1500 + Math.random() * 500, 0.18, { f1: 700, vol: 0.06 }),
};

export const audio = {
  play(name) { if (!enabled) return; try { const f = SFX[name]; if (f) f(); } catch (e) { /* audio is optional */ } },
  setEnabled(v) { enabled = v; if (!v && master) master.gain.value = 0; else if (master) master.gain.value = 0.5; if (v) this.startAmbience(); },
  get enabled() { return enabled; },
  unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); if (c) this.startAmbience(); },
  startAmbience() {
    const c = ensure(); if (!c || ambience) return;
    const g = c.createGain(); g.gain.value = 0.05; g.connect(master);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160; f.connect(g);
    for (const fr of [55, 55.7, 82.4]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.connect(f); o.start(); }
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 50; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    ambience = { g };
    setInterval(() => { if (enabled && Math.random() < 0.35) SFX.drip(); }, 2500);
  },
};
