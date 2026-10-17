// The table-top HUD: stat strip, message scroll, equipment and pack cards, action bar, minimap,
// prompts, tooltips, context menus and modal dialogs.
import * as D from '../rogue/data.js';
import { S, io, CTRL, unctrl } from '../rogue/state.js';
import * as I from '../rogue/items.js';
import { iconCanvas, appearanceFor } from '../render/icons.js';
import { input } from './input.js';
import { discoveries } from '../rogue/game.js';
import * as T from '../render/textures.js';

export const LEVEL_NAMES = ['The Antechamber', 'The Cellars', 'The Warrens', 'The Depths', 'The Fungal Caves', 'The Drowned Vault', 'The Bone Pits',
  'The Crypts', 'The Forgotten Halls', 'The Black Mines', 'The Ember Galleries', 'The Weeping Vaults', 'The Serpent Labyrinth', 'The Frozen Reach',
  'The Hollow Throne', 'The Gloom Market', 'The Ashen Keep', 'The Mirror Halls', 'The Wyrm Roost', 'The Sunken Cathedral', 'The Iron Catacombs',
  'The Night Gardens', 'The Starless Deep', 'The Vampire Court', 'The Abyssal Gate', 'The Vault of Yendor'];
export const levelName = (n) => LEVEL_NAMES[Math.min(n, LEVEL_NAMES.length) - 1] || 'Beyond the Veil';

const SVG = {
  heart: '<svg viewBox="0 0 32 32"><path d="M16 28C5 20 3 13 6 9c3-4 8-3 10 1 2-4 7-5 10-1 3 4 1 11-10 19z" fill="#e0453a" stroke="#4a0a06" stroke-width="2"/><path d="M9 11c1-2 3-2.4 4-1.6" stroke="#ffb0a0" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
  fist: '<svg viewBox="0 0 32 32"><path d="M8 14c0-2 1-3 3-3h10c3 0 4 2 4 4v6c0 4-3 7-8 7h-3c-4 0-6-3-6-6z" fill="#e8a46a" stroke="#4a2008" stroke-width="2"/><path d="M12 11v6M16 11v6M20 11v6" stroke="#4a2008" stroke-width="1.6"/></svg>',
  shield: '<svg viewBox="0 0 32 32"><path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="#7fa0d8" stroke="#16264a" stroke-width="2"/><path d="M16 3v26" stroke="#16264a" stroke-width="1.5"/><path d="M16 3l11 4v8c0 7-5 12-11 14z" fill="rgba(255,255,255,.18)"/></svg>',
  star: '<svg viewBox="0 0 32 32"><path d="M16 3l4 9 10 1-7.5 6.5L25 29l-9-5-9 5 2.5-9.5L2 13l10-1z" fill="#ffd24a" stroke="#6a4408" stroke-width="2" stroke-linejoin="round"/></svg>',
  coin: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#f0c040" stroke="#6a4408" stroke-width="2"/><circle cx="16" cy="16" r="8" fill="none" stroke="#b8861a" stroke-width="2"/><path d="M16 10v12M13 13h5a2 2 0 010 4h-4a2 2 0 000 4h5" stroke="#8a5a0a" stroke-width="1.6" fill="none"/></svg>',
  depth: '<svg viewBox="0 0 32 32"><path d="M4 8h24v4H4zM8 14h20v4H8zM12 20h16v4H12zM16 26h12v3H16z" fill="#b9a27a" stroke="#3a2a14" stroke-width="1.5"/></svg>',
  food: '<svg viewBox="0 0 32 32"><path d="M6 20c0-8 20-8 20 0v4H6z" fill="#d8a45a" stroke="#5a3010" stroke-width="2"/><path d="M11 14l1 7M16 13l0 8M21 14l-1 7" stroke="#8a5a24" stroke-width="1.5"/></svg>',
  search: '<svg viewBox="0 0 32 32"><circle cx="13" cy="13" r="8" fill="rgba(180,220,255,.35)" stroke="#e8d098" stroke-width="3"/><path d="M19 19l9 9" stroke="#e8d098" stroke-width="4" stroke-linecap="round"/></svg>',
  rest: '<svg viewBox="0 0 32 32"><path d="M22 5a11 11 0 1 0 5 20A9 9 0 0 1 22 5z" fill="#cfe0ff" stroke="#e8d098" stroke-width="1.5"/><path d="M6 6h5l-5 6h5" stroke="#e8d098" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  hand: '<svg viewBox="0 0 32 32"><path d="M9 17V8a2 2 0 014 0v6V6a2 2 0 014 0v8V7a2 2 0 014 0v9l2-3a2 2 0 013 2c-2 6-4 12-10 12-6 0-9-4-9-9z" fill="#f2d4a8" stroke="#e8d098" stroke-width="1" /><path d="M9 17V8a2 2 0 014 0v6V6a2 2 0 014 0v8V7a2 2 0 014 0v9l2-3a2 2 0 013 2c-2 6-4 12-10 12-6 0-9-4-9-9z" fill="none" stroke="#4a2a10" stroke-width="1.8"/></svg>',
  down: '<svg viewBox="0 0 32 32"><path d="M4 6h8v6h8v6h8v8H4z" fill="#8a7a62" stroke="#e8d098" stroke-width="1.6"/><path d="M16 22l-5-5h3V10h4v7h3z" fill="#ffd24a" stroke="#4a2a08"/></svg>',
  up: '<svg viewBox="0 0 32 32"><path d="M4 26h8v-6h8v-6h8V6H4z" fill="#8a7a62" stroke="#e8d098" stroke-width="1.6"/><path d="M16 8l5 5h-3v7h-4v-7h-3z" fill="#ffd24a" stroke="#4a2a08"/></svg>',
  throw: '<svg viewBox="0 0 32 32"><path d="M4 26L24 8" stroke="#e8d098" stroke-width="3" stroke-linecap="round"/><path d="M20 4l8 0 0 8z" fill="#e8d098"/><path d="M4 26l-1-5 5 1z" fill="#c8a050"/></svg>',
  zap: '<svg viewBox="0 0 32 32"><path d="M19 2L7 18h8l-3 12 13-18h-8z" fill="#7fd8ff" stroke="#e8f4ff" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  equip: '<svg viewBox="0 0 32 32"><path d="M6 6l8 8M9 3l-3 3 3 3M26 6l-8 8m8 12l-6-6m-6-6l-4 4m-3-1l-4 5 3 3 5-4" stroke="#e8d098" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  drop: '<svg viewBox="0 0 32 32"><path d="M16 4v16m-6-6l6 6 6-6" stroke="#e8d098" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 26h22" stroke="#e8d098" stroke-width="3" stroke-linecap="round"/></svg>',
  pack: '<svg viewBox="0 0 32 32"><path d="M8 12c0-5 16-5 16 0v14c0 2-2 3-4 3H12c-2 0-4-1-4-3z" fill="#9a6a3a" stroke="#e8d098" stroke-width="1.6"/><path d="M11 17h10v6H11z" fill="#7a4a24" stroke="#e8d098" stroke-width="1.2"/><path d="M12 8c0-3 8-3 8 0" fill="none" stroke="#e8d098" stroke-width="2"/></svg>',
  book: '<svg viewBox="0 0 32 32"><path d="M5 5h10c2 0 3 1 3 3v19c0-2-1-3-3-3H5zM27 5H17c-2 0-3 1-3 3v19c0-2 1-3 3-3h10z" fill="#d8c08a" stroke="#e8d098" stroke-width="1.4"/><path d="M8 10h6M8 14h6M19 10h5M19 14h5" stroke="#6a4a20" stroke-width="1.4"/></svg>',
  help: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#3a5a8a" stroke="#e8d098" stroke-width="2"/><path d="M12 12c0-6 9-6 9 0 0 4-5 4-5 8" stroke="#fff4d0" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="16" cy="25" r="2" fill="#fff4d0"/></svg>',
  menu: '<svg viewBox="0 0 32 32"><path d="M5 9h22M5 16h22M5 23h22" stroke="#e8d098" stroke-width="3.5" stroke-linecap="round"/></svg>',
  reset: '<svg viewBox="0 0 32 32"><path d="M6 16a10 10 0 1 0 4-8" stroke="#e8d098" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M5 4v7h7" stroke="#e8d098" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  overview: '<svg viewBox="0 0 32 32"><path d="M4 8l8-3 8 3 8-3v19l-8 3-8-3-8 3z" fill="#c8a870" stroke="#e8d098" stroke-width="1.6"/><path d="M12 5v19M20 8v19" stroke="#6a4a20" stroke-width="1.2"/></svg>',
  sound: '<svg viewBox="0 0 32 32"><path d="M4 12h6l8-6v20l-8-6H4z" fill="#e8d098"/><path d="M22 11c3 3 3 7 0 10M25 8c5 5 5 11 0 16" stroke="#e8d098" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
  rotate: '<svg viewBox="0 0 32 32"><path d="M6 14a10 7 0 0 1 20 0M26 18a10 7 0 0 1-20 0" stroke="#e8d098" stroke-width="2.6" fill="none"/><path d="M24 9l3 5-5 1M8 23l-3-5 5-1" stroke="#e8d098" stroke-width="2.4" fill="none" stroke-linejoin="round"/></svg>',
};
export const svg = (n) => SVG[n] || '';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const ui = {
  root: null, hud: null, refs: {}, log: [], logOpen: false,
  promptState: { item: null, dir: false, hand: false, confirm: false },
  mapCtx: null, mapCanvas: null, mapTexture: null, mapTick: 0,
  modals: [],
  hooks: {},       // set by main: { sendKey, travelTo, camera, ... }
  lastHp: 0,

  build(root) {
    this.root = root;
    const hud = (this.hud = root);
    hud.innerHTML = '';
    // logo + depth
    const logo = el('div', 'logo-plate leather', '<div class="t">ROGUE</div><div class="lv">LEVEL <b id="u-level">1</b> · <span id="u-lname"></span></div>');
    // top stat strip
    const top = el('div', 'topbar leather');
    top.innerHTML = `
      <div class="stat hp" title="Hit points"><span class="ic">${SVG.heart}</span><div class="hpbar" id="u-hpbar"><i class="ghost" id="u-hpghost"></i><i id="u-hpfill"></i><span id="u-hptxt"></span></div></div>
      <div class="stat" title="Strength (maximum in brackets)"><span class="ic">${SVG.fist}</span><div><span class="v" id="u-str">16</span><span class="l">STRENGTH</span></div></div>
      <div class="stat" title="Armor protection (higher is better)"><span class="ic">${SVG.shield}</span><div><span class="v" id="u-arm">3</span><span class="l">ARMOR</span></div></div>
      <div class="stat" title="Experience level and progress"><span class="ic">${SVG.star}</span><div><span class="v" id="u-xl">1</span><span class="l" id="u-xp">0 XP</span><div class="xpbar"><i id="u-xpbar" style="width:0"></i></div></div></div>
      <div class="stat" title="Gold pieces"><span class="ic">${SVG.coin}</span><div><span class="v" id="u-gold">0</span><span class="l">GOLD</span></div></div>
      <div class="stat" title="Food"><span class="ic">${SVG.food}</span><div><span class="v" id="u-food">Fed</span><span class="l">STOMACH</span></div></div>`;
    const badges = el('div', 'badges');
    badges.id = 'u-badges';
    // log
    const log = el('div', 'log panel');
    log.id = 'u-log';
    log.title = 'Click to open the full message history';
    // side columns
    const left = el('div', 'side left');
    left.id = 'u-left';
    const right = el('div', 'side right');
    right.innerHTML = `<div class="leather"><div class="packhead"><span>PACK</span><span class="cnt" id="u-packcnt"></span></div><div class="packwrap" id="u-pack"></div></div>`;
    // action bar
    const actions = el('div', 'actions leather');
    actions.id = 'u-actions';
    // minimap
    const map = el('div', 'mapwrap panel', '<div class="cap">HAND PAINTED MAP</div><canvas id="u-map" width="660" height="240"></canvas>');
    map.id = 'u-mapwrap';
    // camera cluster
    const cam = el('div', 'cam');
    cam.innerHTML = '';
    // prompt slots
    const prompt = el('div', 'prompt panel hidden');
    prompt.id = 'u-prompt';
    const dirpad = el('div', 'dirpad leather hidden');
    dirpad.id = 'u-dirpad';
    const count = el('div', 'countbadge hidden');
    count.id = 'u-count';
    hud.append(logo, top, badges, log, left, right, map, cam, actions, prompt, dirpad, count);
    this.refs = {
      level: hud.querySelector('#u-level'), lname: hud.querySelector('#u-lname'), hpfill: hud.querySelector('#u-hpfill'), hpghost: hud.querySelector('#u-hpghost'),
      hptxt: hud.querySelector('#u-hptxt'), hpbar: hud.querySelector('#u-hpbar'), str: hud.querySelector('#u-str'), arm: hud.querySelector('#u-arm'),
      xl: hud.querySelector('#u-xl'), xp: hud.querySelector('#u-xp'), xpbar: hud.querySelector('#u-xpbar'), gold: hud.querySelector('#u-gold'),
      food: hud.querySelector('#u-food'), badges, log, left, pack: hud.querySelector('#u-pack'), packcnt: hud.querySelector('#u-packcnt'),
      actions, map: hud.querySelector('#u-map'), mapwrap: map, cam, prompt, dirpad, count,
    };
    this.mapCanvas = this.refs.map;
    this.mapCtx = this.mapCanvas.getContext('2d');
    this.parchment = T.makeParchmentCanvas(660, 240, 9);
    this.mapTexture = T.canvasTexture(this.mapCanvas);
    log.addEventListener('click', () => { this.logOpen = !this.logOpen; this.renderLog(); });
    this.buildActions();
    this.buildCam();
    this.mapCanvas.addEventListener('click', (e) => {
      const r = this.mapCanvas.getBoundingClientRect();
      const t = this.mapT || { ox: 0, oy: 0, cw: 660 / 80, ch: 10 };
      const x = Math.floor(((e.clientX - r.left) / r.width * 660 - t.ox) / t.cw), y = Math.floor(((e.clientY - r.top) / r.height * 240 - t.oy) / t.ch);
      this.hooks.travelTo && this.hooks.travelTo({ x, y });
    });
    this.refs.mapwrap.querySelector('.cap').addEventListener('click', () => this.refs.mapwrap.classList.toggle('collapsed'));
    this.refs.mapwrap.querySelector('.cap').style.cursor = 'pointer';
    this.refs.mapwrap.querySelector('.cap').title = 'Click to collapse/expand the map';
    this.refreshAll();
  },

  // ------------------------------------------------------------ action bar
  buildActions() {
    const a = this.refs.actions;
    a.innerHTML = '';
    const mk = (icon, name, key, fn, id) => {
      const b = el('button', 'abtn');
      b.innerHTML = `${icon.startsWith('<') ? icon : svg(icon)}<span class="n">${name}</span>${key ? `<span class="k">${esc(key)}</span>` : ''}`;
      b.title = `${name}${key ? ` (${key})` : ''}`;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(b, e); });
      if (id) b.dataset.id = id;
      return b;
    };
    const send = (k) => () => this.hooks.sendKey(k);
    const sep = () => el('div', 'asep');
    const potion = () => { const c = iconCanvas({ type: D.POTION, color: '#c040e0' }, 26); return c.outerHTML; };
    const bar = [
      mk('search', 'Search', 's', send('s')), mk('rest', 'Rest', '.', send('.')), mk('hand', 'Pick up', ',', send(',')),
      mk('down', 'Stairs', '> <', (b) => this.stairsMenu(b), 'stairs'), sep(),
      mk('<span class="abicon"></span>', 'Quaff', 'q', send('q'), 'quaff'), mk('<span class="abicon"></span>', 'Read', 'r', send('r'), 'read'),
      mk('food', 'Eat', 'e', send('e')), mk('throw', 'Throw', 't', send('t')), mk('zap', 'Zap', 'z', send('z')), sep(),
      mk('equip', 'Equip', 'w W', (b) => this.equipMenu(b)), mk('drop', 'Drop', 'd', send('d')), sep(),
      mk('pack', 'Pack', 'i', send('i')), mk('book', 'Known', 'D', send('D')), mk('help', 'Help', '?', () => this.hooks.help()),
      mk('menu', 'More', '', (b) => this.moreMenu(b)),
    ];
    // custom icons for quaff / read
    bar.forEach((b) => {
      if (b.dataset.id === 'quaff') { b.querySelector('.abicon').replaceWith(iconCanvas({ type: D.POTION, color: '#d060ff' }, 26)); }
      if (b.dataset.id === 'read') { b.querySelector('.abicon').replaceWith(iconCanvas({ type: D.SCROLL }, 26)); }
      a.appendChild(b);
    });
  },
  menuAt(btn, items, title) {
    const r = btn.getBoundingClientRect();
    this.showMenu(r.left, r.top, items, title, true);
  },
  stairsMenu(b) {
    this.menuAt(b, [
      { label: 'Descend', key: '>', fn: () => this.hooks.sendKey('>') },
      { label: 'Ascend (needs the Amulet)', key: '<', fn: () => this.hooks.sendKey('<') },
    ], 'STAIRS');
  },
  equipMenu(b) {
    this.menuAt(b, [
      { label: 'Wield a weapon', key: 'w', fn: () => this.hooks.sendKey('w') },
      { label: 'Wear armor', key: 'W', fn: () => this.hooks.sendKey('W') },
      { label: 'Take armor off', key: 'T', fn: () => this.hooks.sendKey('T') },
      { label: 'Put on a ring', key: 'P', fn: () => this.hooks.sendKey('P') },
      { label: 'Remove a ring', key: 'R', fn: () => this.hooks.sendKey('R') },
    ], 'EQUIPMENT');
  },
  moreMenu(b) {
    const k = (c) => () => this.hooks.sendKey(c);
    this.menuAt(b, [
      { label: 'Call (name) an item', key: 'c', fn: k('c') },
      { label: 'Identify a map symbol', key: '/', fn: k('/') },
      { label: 'Look at one pack item', key: 'I', fn: k('I') },
      { label: 'Find a trap\'s type', key: '^', fn: k('^') },
      { label: 'Move without picking up', key: 'm', fn: k('m') },
      { label: 'Fight to the death', key: 'f', fn: k('f') },
      { label: 'Repeat last command', key: 'a', fn: k('a') },
      { label: 'Current weapon', key: ')', fn: k(')') },
      { label: 'Current armor', key: ']', fn: k(']') },
      { label: 'Current rings', key: '=', fn: k('=') },
      { label: 'Show my stats', key: '@', fn: k('@') },
      { label: 'Repeat last message', key: '^P', fn: k(CTRL('p')) },
      { label: 'Options', key: 'o', fn: k('o') },
      { label: 'Save game', key: 'S', fn: k('S') },
      { label: 'Quit', key: 'Q', fn: k('Q') },
    ], 'MORE COMMANDS');
  },
  buildCam() {
    const c = this.refs.cam;
    c.innerHTML = '';
    const mk = (icon, title, fn) => { const b = el('button', 'abtn'); b.innerHTML = svg(icon); b.title = title; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
    c.append(
      mk('reset', 'Reset camera (Home)', () => this.hooks.camera('reset')),
      mk('overview', 'Overview of the whole board (Tab)', () => this.hooks.camera('overview')),
      mk('rotate', 'Tilt the table (right-drag also orbits)', () => this.hooks.camera('tilt')),
      (() => { const b = mk('sound', 'Sound on/off', () => { const on = this.hooks.toggleSound(); b.style.opacity = on ? 1 : 0.45; }); setTimeout(() => { b.style.opacity = this.hooks.soundOn && this.hooks.soundOn() ? 1 : 0.45; }, 0); return b; })(),
    );
  },

  // ------------------------------------------------------------ menus / tooltip
  showMenu(x, y, items, title, above = false) {
    this.closeMenu();
    const m = el('div', 'menu leather');
    if (title) m.appendChild(el('div', 'hd', esc(title)));
    for (const it of items) {
      const b = el('button', '', `<span>${esc(it.label)}</span>${it.key ? `<kbd>${esc(it.key)}</kbd>` : ''}`);
      if (it.disabled) { b.disabled = true; b.style.opacity = .4; }
      b.addEventListener('click', (e) => { e.stopPropagation(); this.closeMenu(); it.fn(); });
      m.appendChild(b);
    }
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    let px = Math.min(x, innerWidth - r.width - 8), py = above ? y - r.height - 8 : y;
    py = Math.max(8, Math.min(py, innerHeight - r.height - 8));
    m.style.left = `${Math.max(8, px)}px`; m.style.top = `${py}px`;
    this.menuEl = m;
    setTimeout(() => window.addEventListener('pointerdown', this._menuAway = (e) => { if (!m.contains(e.target)) this.closeMenu(); }, { once: true, capture: true }), 0);
  },
  closeMenu() { if (this.menuEl) { this.menuEl.remove(); this.menuEl = null; } },

  tooltip(x, y, html) {
    if (!this.tipEl) { this.tipEl = el('div', 'tooltip panel'); document.body.appendChild(this.tipEl); }
    if (!html) { this.tipEl.style.display = 'none'; return; }
    this.tipEl.style.display = 'block';
    if (this.tipEl._html !== html) { this.tipEl.innerHTML = html; this.tipEl._html = html; }
    const r = this.tipEl.getBoundingClientRect();
    const px = x + 14 + r.width > innerWidth ? x - r.width - 20 : x;
    const py = y + 14 + r.height > innerHeight ? y - r.height - 20 : y;
    this.tipEl.style.left = `${px}px`; this.tipEl.style.top = `${py}px`;
  },

  toast(text) {
    const t = el('div', 'hint-toast leather', esc(text));
    this.hud.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  },

  // ------------------------------------------------------------ messages
  message(text) {
    if (/\(\* for list\)|^which direction|^direction:|^character you want help|^what do you want identified|hand or right hand|left or right ring|^really quit|^item: |^which item do you wish|^call it: |^what do you want to call it/i.test(text.trim())) return;
    this.log.push({ text, n: this.log.length });
    if (this.log.length > 400) this.log.shift();
    this.renderLog();
  },
  renderLog() {
    const l = this.refs.log;
    if (!l) return;
    l.classList.toggle('open', this.logOpen);
    const n = this.logOpen ? Math.min(this.log.length, 120) : 6;
    const items = this.log.slice(-n);
    l.innerHTML = '';
    items.forEach((m, i) => {
      const age = items.length - 1 - i;
      const d = el('div', 'm' + (age === 0 ? ' new' : age < 3 ? '' : age < 5 ? ' old' : ' older'), esc(m.text));
      l.appendChild(d);
    });
    if (!this.log.length) l.appendChild(el('div', 'm', '<i>Welcome to the Dungeons of Doom…</i>'));
    l.appendChild(el('div', 'hint', this.logOpen ? 'CLICK TO CLOSE' : 'CLICK FOR HISTORY'));
    if (this.logOpen) l.scrollTop = l.scrollHeight;
  },

  levelChanged() {
    this.refs.level.textContent = S.level;
    this.refs.lname.textContent = levelName(S.level);
    this.hooks.setBoardLabel && this.hooks.setBoardLabel(`LEVEL ${S.level}: ${levelName(S.level).toUpperCase()}`);
    this.refreshAll();
  },

  // ------------------------------------------------------------ stats
  refresh() {
    const p = S.player.t_stats;
    const r = this.refs;
    if (!r.hpfill) return;
    const pct = Math.max(0, Math.min(100, (p.s_hpt / Math.max(1, p.s_maxhp)) * 100));
    r.hpfill.style.width = `${pct}%`;
    r.hpghost.style.width = `${Math.max(pct, this._hpGhost ?? pct)}%`;
    if (pct < (this._hpGhost ?? pct)) { clearTimeout(this._ghostT); this._ghostT = setTimeout(() => { r.hpghost.style.width = `${pct}%`; this._hpGhost = pct; }, 50); }
    this._hpGhost = pct;
    r.hpbar.classList.toggle('low', pct < 30);
    r.hptxt.textContent = `${Math.max(0, p.s_hpt)} / ${p.s_maxhp}`;
    r.str.textContent = `${p.s_str}${S.max_stats.s_str !== p.s_str ? `/${S.max_stats.s_str}` : ''}`;
    const arm = S.cur_armor !== null ? S.cur_armor.o_arm : p.s_arm;
    r.arm.textContent = 10 - arm;
    r.xl.textContent = `Lv ${p.s_lvl}`;
    const lo = p.s_lvl > 1 ? D.e_levels[p.s_lvl - 2] : 0, hi = D.e_levels[p.s_lvl - 1] || lo + 1;
    r.xp.textContent = `${p.s_exp} XP`;
    r.xpbar.style.width = `${Math.max(0, Math.min(100, ((p.s_exp - lo) / (hi - lo)) * 100))}%`;
    r.gold.textContent = S.purse;
    r.food.textContent = ['Fed', 'Hungry', 'Weak', 'Faint'][S.hungry_state];
    r.food.style.color = S.hungry_state ? (S.hungry_state > 1 ? '#ff7a6a' : '#ffd24a') : '';
    r.level.textContent = S.level;
    this.renderBadges();
    const now = performance.now();
    if (now - this.mapTick > 120) { this.mapTick = now; this.drawMap(); }
    this.updateActionStates();
  },
  refreshAll() { this.refresh(); this.renderPack(); this.renderLog(); this.drawMap(); },

  renderBadges() {
    const f = S.player.t_flags;
    const out = [];
    const add = (cls, text, tip) => out.push(`<div class="badge ${cls}" title="${esc(tip)}">${text}</div>`);
    if (S.no_command > 0) add('bad', '💤 Helpless', 'You cannot act for a few turns');
    if (f & D.ISHELD) add('bad', '🕸 Held', 'A creature has you in its grip — kill it or teleport');
    if (S.no_move > 0) add('bad', '🪤 Trapped', 'Stuck in a bear trap');
    if (f & D.ISHUH) add('bad', '💫 Confused', 'You stumble in random directions');
    if (f & D.ISBLIND) add('bad', '🕶 Blind', 'You cannot see');
    if (f & D.ISHALU) add('warn', '🌈 Hallucinating', 'Everything looks strange');
    if (f & D.ISHASTE) add('good', '⚡ Hasted', 'You move twice as fast');
    if (f & D.ISLEVIT) add('good', '🕊 Levitating', 'You float — no stairs, traps or pickups');
    // no badge for see invisible or monster detection: the original never tells you, and a badge
    // would identify the potion or ring for free
    if (f & D.CANHUH) add('good', '🔥 Glowing hands', 'Your next hit confuses the monster');
    if (S.hungry_state === 1) add('warn', '🍞 Hungry', 'Eat something soon');
    if (S.hungry_state === 2) add('bad', '🍞 Weak', 'You are weak from hunger — eat now!');
    if (S.hungry_state === 3) add('bad', '🍞 Fainting', 'You are fainting from hunger!');
    const html = out.join('');
    if (this._badgeHtml !== html) { this._badgeHtml = html; this.refs.badges.innerHTML = html; }
  },

  updateActionStates() {
    // highlight context-sensitive stairs/pickup
  },

  // ------------------------------------------------------------ pack & equipment cards
  cardFor(o, opts = {}) {
    // (no "cursed" marking: the original only says so when you try to take a cursed thing off)
    const c = el('div', 'card');
    const ic = el('div', 'ic');
    ic.appendChild(iconCanvas(appearanceFor(S, o), 38));
    const nm = el('div', 'nm');
    const was = S.inv_describe; S.inv_describe = false;
    nm.textContent = I.inv_name(o, false);
    S.inv_describe = was;
    const tags = [];
    if (o === S.cur_weapon) tags.push('WIELDED');
    if (o === S.cur_armor) tags.push('WORN');
    if (o === S.cur_ring[D.LEFT]) tags.push('LEFT HAND');
    if (o === S.cur_ring[D.RIGHT]) tags.push('RIGHT HAND');
    for (const t of tags) nm.appendChild(el('div', 'eq', t));
    c.append(ic, nm, el('div', 'ltr', esc(o.o_packch)));
    c.dataset.letter = o.o_packch;
    if (!opts.noClick) c.addEventListener('click', (e) => { e.stopPropagation(); this.cardClick(o, c); });
    return c;
  },

  renderPack() {
    const r = this.refs;
    if (!r.pack) return;
    const pack = S.player.t_pack;
    r.pack.innerHTML = '';
    r.packcnt.textContent = `${pack.length} / ${D.MAXPACK}`;
    for (const o of pack) r.pack.appendChild(this.cardFor(o));
    if (!pack.length) r.pack.appendChild(el('div', 'slot', '<div class="empty">empty-handed</div>'));
    // equipment column
    const L = r.left;
    L.innerHTML = '';
    const slot = (label, obj, keyEmpty, hintEmpty) => {
      const s = el('div', 'slot leather');
      s.appendChild(el('div', 'lbl', label));
      if (obj) s.appendChild(this.cardFor(obj));
      else {
        const e = el('div', 'empty', hintEmpty);
        e.addEventListener('click', () => this.hooks.sendKey(keyEmpty));
        s.appendChild(e);
      }
      return s;
    };
    L.append(
      slot('WEAPON', S.cur_weapon, 'w', 'bare hands · click to wield'),
      slot('ARMOR', S.cur_armor, 'W', 'none · click to wear'),
      slot('LEFT RING', S.cur_ring[D.LEFT], 'P', 'empty · click to put on'),
      slot('RIGHT RING', S.cur_ring[D.RIGHT], 'P', 'empty · click to put on'),
    );
    this.applyPromptToCards();
  },
  packChanged() { this.renderPack(); this.refresh(); },

  actionsFor(o) {
    const k = (c) => () => this.useCard(o, c);
    const a = [];
    switch (o.o_type) {
      case D.POTION: a.push(['Quaff (drink)', 'q'], ['Drop', 'd'], ['Call it…', 'c']); break;
      case D.SCROLL: a.push(['Read', 'r'], ['Drop', 'd'], ['Call it…', 'c']); break;
      case D.FOOD: a.push(['Eat', 'e'], ['Drop', 'd']); break;
      case D.WEAPON:
        if (o === S.cur_weapon) a.push(['Unwield (wield another)', 'w']); else a.push(['Wield', 'w']);
        a.push(['Throw / fire', 't'], ['Drop', 'd'], ['Call it…', 'c']); break;
      case D.ARMOR:
        if (o === S.cur_armor) a.push(['Take off', 'T']); else a.push(['Wear', 'W']);
        a.push(['Drop', 'd'], ['Call it…', 'c']); break;
      case D.RING:
        if (o === S.cur_ring[0] || o === S.cur_ring[1]) a.push(['Remove', 'R']); else a.push(['Put on', 'P']);
        a.push(['Drop', 'd'], ['Call it…', 'c']); break;
      case D.STICK: a.push(['Zap', 'z'], ['Drop', 'd'], ['Call it…', 'c']); break;
      default: a.push(['Drop', 'd']);
    }
    return a.map(([label, key]) => ({ label, key, fn: k(key) }));
  },
  useCard(o, key) {
    input.autoLetter = o.o_packch;
    if (key === 'R' && S.cur_ring[0] && S.cur_ring[1]) { this.hooks.sendKey('R'); return; }
    this.hooks.sendKey(key);
  },
  cardClick(o, node) {
    if (this.promptState.item) { this.hooks.sendKey(o.o_packch); return; }
    const r = node.getBoundingClientRect();
    const items = this.actionsFor(o);
    this.showMenu(Math.max(8, r.left - 200), r.top, items, I.inv_name(o, false).slice(0, 30));
  },

  applyPromptToCards() {
    const ps = this.promptState.item;
    document.querySelectorAll('#hud .card').forEach((c) => c.classList.remove('eligible', 'dim'));
    if (!ps) return;
    const pack = S.player.t_pack;
    document.querySelectorAll('#hud .card').forEach((c) => {
      const o = pack.find((x) => x.o_packch === c.dataset.letter);
      if (!o) return;
      const ok = I.typeMatches(o, ps.type) || !ps.type;
      c.classList.add(ok ? 'eligible' : 'dim');
    });
  },

  // ------------------------------------------------------------ prompts
  promptEvent(type, data) {
    const P = this.refs.prompt, pad = this.refs.dirpad;
    const showPrompt = (html, buttons = []) => {
      P.className = 'prompt panel';
      P.innerHTML = html;
      if (buttons.length) {
        const row = el('div', 'row');
        for (const [label, fn] of buttons) { const b = el('button', 'btn', esc(label)); b.addEventListener('click', fn); row.appendChild(b); }
        P.appendChild(row);
      }
    };
    switch (type) {
      case 'prompt_item':
        if (data.active) {
          this.promptState.item = { purpose: data.purpose, type: data.type };
          const verbs = { quaff: 'Quaff which potion?', read: 'Read which scroll?', eat: 'Eat what?', wield: 'Wield which weapon?', wear: 'Wear which armor?', 'put on': 'Put on which ring?', drop: 'Drop what?', throw: 'Throw what?', 'zap with': 'Zap with which wand or staff?', call: 'Call which item?', identify: 'Identify which item?', inspect: 'Inspect which item?' };
          showPrompt(`${esc(verbs[data.purpose] || `Which object do you want to ${data.purpose}?`)}<div class="sub">Click a glowing card — or press its letter · Esc to cancel</div>`, [['Cancel', () => this.hooks.sendKey('\x1b')]]);
          this.applyPromptToCards();
          if (input.autoLetter) { const l = input.autoLetter; input.autoLetter = null; setTimeout(() => this.hooks.sendKey(l), 0); }
        } else { this.promptState.item = null; P.className = 'prompt panel hidden'; this.applyPromptToCards(); }
        break;
      case 'prompt_dir':
        this.promptState.dir = !!data.active;
        if (data.active) {
          pad.className = 'dirpad leather';
          pad.innerHTML = '';
          const dirs = [['y', '↖'], ['k', '↑'], ['u', '↗'], ['h', '←'], ['', '✕'], ['l', '→'], ['b', '↙'], ['j', '↓'], ['n', '↘']];
          for (const [k, ch] of dirs) {
            const b = el('button', 'btn' + (k ? '' : ' mid'), ch);
            b.addEventListener('click', () => this.hooks.sendKey(k || '\x1b'));
            pad.appendChild(b);
          }
          showPrompt('Which direction?<div class="sub">Click a direction, click the board toward your target, or press h j k l y u b n · Esc cancels</div>');
          this.hooks.dirArrows && this.hooks.dirArrows(true);
          if (input.autoDir) { const d = input.autoDir; input.autoDir = null; setTimeout(() => this.hooks.sendKey(d), 0); }
        } else { pad.className = 'dirpad leather hidden'; P.className = 'prompt panel hidden'; this.hooks.dirArrows && this.hooks.dirArrows(false); }
        break;
      case 'prompt_hand':
        if (data.active) showPrompt('Which hand?', [['Left hand', () => this.hooks.sendKey('l')], ['Right hand', () => this.hooks.sendKey('r')], ['Cancel', () => this.hooks.sendKey('\x1b')]]);
        else P.className = 'prompt panel hidden';
        break;
      case 'confirm':
        showPrompt(esc(data.text), [['Yes', () => this.hooks.sendKey('y')], ['No', () => this.hooks.sendKey('n')]]);
        break;
      case 'confirm_end': P.className = 'prompt panel hidden'; break;
      case 'help_prompt':
        if (data.active) showPrompt(data.identify ? 'What do you want identified?' : 'Which key do you want help with?', [['Show all keys', () => { this.hooks.sendKey('\x1b'); this.hooks.help(); }], ['Cancel', () => this.hooks.sendKey('\x1b')]]);
        else P.className = 'prompt panel hidden';
        break;
      case 'count':
        this.refs.count.classList.toggle('hidden', !data.count);
        this.refs.count.textContent = data.count ? `× ${data.count}` : '';
        break;
      case 'show_stats': break;
    }
  },

  // ------------------------------------------------------------ minimap
  drawMap() {
    const c = this.mapCtx;
    if (!c || !this.hooks.screen) return;
    const W = 660, H = 240;
    c.drawImage(this.parchment, 0, 0, W, H);
    const scr = this.hooks.screen;
    let x0 = 80, x1 = -1, y0 = 24, y1 = -1;
    for (let y = 1; y < 23; y++) for (let x = 0; x < 80; x++) if (scr[y * 80 + x] !== ' ') { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { x0 = 0; x1 = 79; y0 = 1; y1 = 22; }
    x0 = Math.max(0, x0 - 3); x1 = Math.min(79, x1 + 3); y0 = Math.max(1, y0 - 2); y1 = Math.min(22, y1 + 2);
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const cw = Math.min(W / bw, (H / bh) * 0.8, 22), ch = cw * 1.25;
    const ox = (W - bw * cw) / 2 - x0 * cw, oy = (H - bh * ch) / 2 - y0 * ch;
    this.mapT = { ox, oy, cw, ch };
    c.font = `${Math.round(ch * 0.95)}px "Palatino Linotype", Georgia, serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let y = 1; y < 23; y++)
      for (let x = 0; x < 80; x++) {
        const g = scr[y * 80 + x];
        if (g === ' ') continue;
        const cx = ox + x * cw + cw / 2, cy = oy + y * ch + ch / 2;
        if (g === '|' || g === '-') { c.strokeStyle = '#3a2410'; c.lineWidth = 2; c.beginPath(); if (g === '|') { c.moveTo(cx, cy - ch / 2); c.lineTo(cx, cy + ch / 2); } else { c.moveTo(cx - cw / 2, cy); c.lineTo(cx + cw / 2, cy); } c.stroke(); continue; }
        if (g === '.') { c.fillStyle = 'rgba(120,90,40,.28)'; c.fillRect(cx - cw / 2, cy - ch / 2, cw, ch); continue; }
        if (g === '#') { c.fillStyle = '#6a4a22'; c.fillRect(cx - 1.2, cy - 1.2, 2.4, 2.4); continue; }
        c.fillStyle = g === '@' ? '#c01808' : g === '+' ? '#7a3a10' : g === '%' ? '#1a6a2a' : (g >= 'A' && g <= 'Z') ? '#9a1a10' : g === '*' ? '#a07808' : '#2a1808';
        if (g === '@') c.font = `bold ${Math.round(ch * 1.2)}px Georgia`;
        c.fillText(g, cx, cy + 0.5);
        if (g === '@') c.font = `${Math.round(ch * 0.95)}px "Palatino Linotype", Georgia, serif`;
      }
    if (this.mapTexture) this.mapTexture.needsUpdate = true;
  },

  // ------------------------------------------------------------ modals
  modal({ title, body, buttons = [], onClose, cls = '', wide = false }) {
    const scrim = el('div', 'scrim');
    const m = el('div', `modal panel ${cls}`);
    if (title) m.appendChild(el('h2', '', esc(title)));
    const b = el('div', 'body');
    if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
    m.appendChild(b);
    const foot = el('div', 'foot');
    const api = {
      el: m, body: b, scrim,
      close: (val) => { scrim.remove(); this.modals = this.modals.filter((x) => x !== api); input.modal = this.modals.length ? this.modals[this.modals.length - 1].keyHandler : null; if (onClose) onClose(val); },
    };
    for (const [label, fn, primary] of buttons) {
      const bt = el('button', 'btn' + (primary ? ' primary' : ''), esc(label));
      bt.addEventListener('click', () => { const r = fn ? fn(api) : undefined; if (r !== false) api.close(label); });
      foot.appendChild(bt);
    }
    if (buttons.length) m.appendChild(foot);
    scrim.appendChild(m);
    if (wide) m.style.width = 'min(1000px, 94vw)';
    document.body.appendChild(scrim);
    api.keyHandler = (k) => {
      if (k === '\x1b' || k === ' ' || k === '\n') { if (api.noKeyClose) return true; api.close(); return true; }
      return true; // modal swallows keys
    };
    this.modals.push(api);
    input.modal = api.keyHandler;
    scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim && !api.noScrimClose) api.close(); });
    return api;
  },

  showInventory(items, opts) {
    return new Promise((res) => {
      const wrap = el('div', 'invgrid');
      for (const o of items) wrap.appendChild(this.cardFor(o, { noClick: false }));
      const m = this.modal({ title: opts && opts.type ? 'Matching items' : 'Your Pack', body: wrap, buttons: [['Close', null, true]], onClose: () => res() });
      wrap.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { m.close(); }));
    });
  },

  waitSpace(text) {
    return new Promise((res) => {
      const t = el('div', 'prompt panel');
      t.innerHTML = `${esc(text)}<div class="sub">Press space or click to continue</div>`;
      this.hud.appendChild(t);
      let done = false;
      const fin = () => { if (done) return; done = true; t.remove(); input.modal = null; res(); };
      t.addEventListener('click', fin);
      input.modal = (k) => { if (k === ' ' || k === '\x1b' || k === '\n') fin(); return true; };
    });
  },

  getString(promptText, initial) {
    return new Promise((res) => {
      let done = false;
      const fin = (v) => { if (done) return; done = true; res(v); };
      const inp = el('input', 'textin');
      inp.type = 'text'; inp.value = initial || ''; inp.maxLength = 40;
      const m = this.modal({
        title: promptText, body: inp,
        buttons: [['OK', () => { fin(inp.value); }, true], ['Cancel', () => { fin(null); }]],
        onClose: () => fin(null),
      });
      m.noKeyClose = true; m.noScrimClose = true;
      m.keyHandler = () => true;
      input.modal = () => false;
      setTimeout(() => inp.focus(), 30);
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { fin(inp.value); m.close(); }
        if (e.key === 'Escape') { fin(null); m.close(); }
      });
    });
  },

  showHelp() {
    return new Promise((res) => {
      const groups = [
        ['Moving', [['h j k l', 'Move left · down · up · right'], ['y u b n', 'Move diagonally'], ['Arrows / numpad', 'Same as h j k l (Home PgUp End PgDn: diagonals)'], ['Shift + dir', 'Run that way (H J K L Y U B N)'], ['Ctrl/Alt + dir', 'Run until something interesting is adjacent'], ['f / F + dir', 'Fight until one of you is nearly / fully dead'], ['m + dir', 'Move onto an item without picking it up'], ['1-9 then key', 'Repeat a command that many times']]],
        ['Exploring', [['s', 'Search for secret doors and traps'], ['.', 'Rest one turn'], [',', 'Pick something up'], ['>  <', 'Go down / up a staircase'], ['^ + dir', 'Identify a trap'], ['i  I', 'Pack inventory · inspect one item']]],
        ['Using things', [['q', 'Quaff a potion'], ['r', 'Read a scroll'], ['e', 'Eat food'], ['w  W  T', 'Wield weapon · Wear armor · Take armor off'], ['P  R', 'Put on / Remove a ring'], ['d', 'Drop an object'], ['t + dir', 'Throw something (fire arrows with the bow wielded)'], ['z + dir', 'Zap a wand or staff'], ['c', 'Call (name) an unknown item']]],
        ['Information', [['? / /', 'Help · identify a map symbol'], ['D', 'What you have discovered so far'], ['@', 'Show your stats'], [') ] =', 'Current weapon · armor · rings'], ['a', 'Repeat the last command'], ['Ctrl-P', 'Repeat the last message'], ['o', 'Options'], ['S  Q', 'Save · Quit'], ['Esc', 'Cancel any prompt']]],
        ['Mouse', [['Left-click floor', 'Walk there (path is previewed)'], ['Click a monster', 'Attack when adjacent, otherwise walk toward it'], ['Shift-click', 'Run in that direction'], ['Right-click', 'Menu: look, throw, zap, travel…'], ['Click a card', 'Use / equip / drop the item'], ['Wheel', 'Zoom the camera'], ['Drag', 'Orbit and tilt the table (Home resets)'], ['Click the map', 'Travel to that spot']]],
        ['Camera & view', [['Tab', 'Overview of the whole board'], ['Home', 'Reset camera'], ['[  ]', 'Zoom out / in'], ['F2', 'Cycle graphics quality'], ['F11', 'Full screen']]],
      ];
      const body = el('div', 'keytbl');
      for (const [g, rows] of groups) {
        body.appendChild(el('h3', '', esc(g)));
        for (const [k, d] of rows) body.appendChild(el('div', 'keyrow', `<kbd>${esc(k)}</kbd><span>${esc(d)}</span>`));
      }
      this.modal({ title: 'The Rulebook', body, buttons: [['Close', null, true]], onClose: () => res() });
    });
  },

  showDiscoveries(data) {
    return new Promise((res) => {
      const body = el('div', 'disc');
      for (const g of data) {
        const col = el('div', 'col');
        col.appendChild(el('h3', '', `${esc(g.title)} (${g.items.length}/${g.total})`));
        if (!g.items.length) col.appendChild(el('div', 'none', 'nothing yet'));
        for (const it of g.items) col.appendChild(el('div', '', `${it.known ? '✔' : '✎'} ${esc(it.text)}`));
        body.appendChild(col);
      }
      this.modal({ title: 'What You Have Discovered', body, buttons: [['Close', null, true]], onClose: () => res() });
    });
  },

  showOptions() {
    return new Promise((res) => {
      const g = this.hooks.graphics;
      const body = el('div', 'opts');
      const row = (label, hint, ctl) => { const l = el('label', '', `${esc(label)}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}`); body.append(l, ctl); };
      const cb = (get, set) => { const i = el('input'); i.type = 'checkbox'; i.checked = get(); i.addEventListener('change', () => set(i.checked)); return i; };
      row('Terse messages', 'Shorter text, like the original "terse" option', cb(() => S.terse, (v) => { S.terse = v; }));
      row('Show lamp-lit floor in dark rooms', 'The original "seefloor" option', cb(() => S.see_floor, (v) => { S.see_floor = v; }));
      row('Follow corridors when running', 'The original "passgo" option', cb(() => S.passgo, (v) => { S.passgo = v; }));
      row('Describe equipped items in the pack', 'The original "inven" detail', cb(() => S.inv_describe, (v) => { S.inv_describe = v; this.renderPack(); }));
      row('Ask me to name unknown items after use', 'As the original does; turn off to use the "c" command instead', cb(() => !!S.autoNamePrompt, (v) => { S.autoNamePrompt = v; }));
      const name = el('input'); name.type = 'text'; name.value = S.whoami; name.maxLength = 20; name.addEventListener('change', () => { S.whoami = name.value || 'Rodney'; });
      row('Your name', 'Appears on your tombstone', name);
      const fruit = el('input'); fruit.type = 'text'; fruit.value = S.fruit; fruit.maxLength = 20; fruit.addEventListener('change', () => { S.fruit = fruit.value || 'slime-mold'; });
      row('Favourite fruit', 'The original "fruit" option', fruit);
      const q = el('select');
      for (const [v, l] of [['ultra', 'Ultra (4K HDR, MSAA, DOF)'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low (fastest)']]) q.appendChild(el('option', '', l)).value = v;
      q.value = g.quality;
      q.addEventListener('change', () => this.hooks.setQuality(q.value));
      row('Graphics quality', 'Changing this reloads the table (your game is kept)', q);
      const ab = el('input'); ab.type = 'checkbox'; ab.checked = g.autoSave !== false;
      row('Autosave each level', '', cb(() => g.autoSave !== false, (v) => { g.autoSave = v; this.hooks.graphicsChanged(); }));
      this.modal({ title: 'Options', body, buttons: [['Done', null, true]], onClose: () => { this.hooks.graphicsChanged(); res(); } });
    });
  },
};
