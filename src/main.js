// Rogue: The Tabletop — entry point. Wires the ported 1980s rules engine to the 3D table.
import * as THREE from 'three';
import * as D from './rogue/data.js';
import { S, io, onEvent, screen, standout, GameOver, emit, moat, chat, isupper } from './rogue/state.js';
import * as G from './rogue/game.js';
import * as I from './rogue/items.js';
import * as W from './rogue/world.js';
import { Stage, qualityPreset } from './render/stage.js';
import { BoardView, FLOOR_Y, TERR } from './render/board.js';
import { Entities } from './render/entities.js';
import { FX } from './render/fx.js';
import { Director } from './render/director.js';
import { buildTableProps } from './render/props.js';
import { Mini } from './render/minis.js';
import { audio } from './render/audio.js';
import { ui, levelName } from './ui/ui.js';
import { input, installKeyboard } from './ui/input.js';
import { findPath, pathKeys, snapDir, keyFor, walkable } from './ui/travel.js';
import * as ST from './rogue/state.js';
import { saveGame, loadGame, hasSave, deleteSave } from './save.js';
import { drawTombstone, recordScore, topScores } from './ui/endgame.js';

const $ = (s) => document.querySelector(s);
let stage, board, entities, fx, director;
const settings = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('rogue-tabletop-settings') || '{}'); } catch (e) { /* ignore */ }
  return { quality: s.quality || 'high', name: s.name || 'Rodney', autoSave: s.autoSave !== false, sound: s.sound !== false, fruit: s.fruit || 'slime-mold', terse: !!s.terse, passgo: s.passgo !== false };
})();
const persistSettings = () => {
  try { localStorage.setItem('rogue-tabletop-settings', JSON.stringify({ ...settings, name: S.whoami, fruit: S.fruit, terse: S.terse, passgo: S.passgo })); } catch (e) { /* ignore */ }
};

function fatal(err) {
  console.error(err);
  const f = $('#fatal');
  f.classList.remove('hidden');
  f.textContent = `Something went wrong:\n\n${err && err.stack ? err.stack : err}`;
}
window.addEventListener('error', (e) => fatal(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => fatal(e.reason));

const progress = async (text, pct) => {
  $('#load-text').textContent = text;
  if (pct !== undefined) $('#load-bar').style.width = `${pct}%`;
  await new Promise((r) => setTimeout(r, 30));
};

// ------------------------------------------------------------------ boot
async function boot() {
  const params = new URLSearchParams(location.search);
  if (params.get('q')) settings.quality = params.get('q');
  stage = new Stage($('#viewport'), qualityPreset(settings.quality));
  await progress('Setting up the table…', 5);
  let step = 10;
  await stage.init(async (t) => { step += 18; await progress(t, step); });
  await progress('Unrolling the board…', 70);
  board = new BoardView(stage);
  entities = new Entities(stage, board);
  fx = new FX(stage);
  entities.fx = fx;
  G.newGame({ seed: params.get('seed') ? Number(params.get('seed')) : undefined });
  ui.build($('#hud'));
  $('#hud').classList.remove('hidden');
  stage.propAnchors = buildTableProps(stage.scene, ui.mapTexture);
  director = new Director({ stage, board, entities, fx, ui });
  ui.hooks = {
    sendKey: (k) => input.push(k),
    travelTo: (cell) => travelTo(cell),
    help: () => { if (!ui.modals.length) ui.showHelp(); },
    camera: (a) => cameraAction(a),
    setBoardLabel: (t) => stage.setBoardLabel(t),
    dirArrows: (on) => entities.showDirArrows(on),
    screen,
    graphics: settings,
    setQuality: (q) => { settings.quality = q; persistSettings(); setTimeout(() => location.reload(), 150); },
    graphicsChanged: persistSettings,
    toggleSound: () => { settings.sound = !settings.sound; audio.setEnabled(settings.sound); persistSettings(); if (settings.sound) audio.unlock(); return settings.sound; },
    soundOn: () => settings.sound,
  };
  S.whoami = settings.name; S.fruit = settings.fruit; S.terse = settings.terse; S.passgo = settings.passgo;
  onEvent((t, d) => director.handle(t, d));
  audio.setEnabled(settings.sound);
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  wireIO();
  installKeyboard(specialKeys);
  installPointer();
  window.addEventListener('resize', () => { fx.setAspect(); });
  fx.setAspect();
  // render loop
  let last = performance.now();
  let slow = 0, frames = 0, acc = 0;
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    stage.update(dt);
    stage.render();
    frames++; acc += dt;
    if (acc > 3) {
      const fps = frames / acc;
      if (fps < 22 && !params.get('q')) slow++; else slow = 0;
      if (slow >= 2) {
        const order = ['ultra', 'high', 'medium', 'low'];
        const i = order.indexOf(settings.quality);
        if (i < order.length - 1) { ui.toast(`Running slowly — switching to ${order[i + 1]} quality`); settings.quality = order[i + 1]; persistSettings(); setTimeout(() => location.reload(), 2500); }
        slow = 0;
      }
      frames = 0; acc = 0;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__rogue = { S, stage, board, entities, fx, director, ui, G, input, I, W, THREE, D, Mini, ST, revealAll: () => { for (let y = 1; y < 23; y++) for (let x = 0; x < 80; x++) { const p = ST.INDEX(y, x); if (p.p_ch !== ' ') screen[y * 80 + x] = p.p_ch; if (p.p_ch === '^' || !(p.p_flags & D.F_REAL)) {} } emit('turn_end'); }, drive: async (keys, ms = 350) => { for (const k of keys) { window.dispatchEvent(new KeyboardEvent('keydown', { key: k === '\x1b' ? 'Escape' : k, shiftKey: k.length === 1 && k !== k.toLowerCase(), bubbles: true, cancelable: true })); const t0 = performance.now(); while (performance.now() - t0 < ms) { stage.update(0.033); await new Promise((r) => setTimeout(r, 16)); } } stage.render(); }, spawn: (type, dx = 2, dy = 0, awake = true) => { const t = ST.new_item(); W.new_monster(t, type, { x: S.hero.x + dx, y: S.hero.y + dy }); if (awake) { t.t_flags |= D.ISRUN; t.t_dest = S.hero; } emit('turn_end'); return t; }, advance: (sec = 1) => { for (let i = 0; i < sec * 30; i++) stage.update(1 / 30); stage.render(); } };
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading').remove(), 800);
  await mainMenu(params);
}

// ------------------------------------------------------------------ game <-> UI glue
function wireIO() {
  let travelHp = 0;
  io.readchar = async () => {
    if (input.queue.some((q) => !q.auto)) director.skip();
    else await director.settle(800);
    ui.refresh();
    if (input.hasAuto()) {
      if (travelDanger(travelHp)) input.flushAuto();
    }
    const k = await input.next();
    if (!input.lastWasAuto) travelHp = S.player.t_stats.s_hpt;
    return k;
  };
  io.afterCommand = async () => {
    emit('turn_end');
    const busy = S.running || S.to_death || S.count || input.hasAuto();
    director.setRunning(!!busy);
    if (busy) {
      // a keypress interrupts runs, repeats and travel
      if (input.queue.some((q) => !q.auto)) { S.running = false; S.to_death = false; S.count = 0; input.flushAuto(); }
      else await director.settle(200);
    }
    if (!S.playing) return;
  };
  io.showList = (title, items, opts) => ui.showInventory(items, opts);
  io.waitSpace = (t) => ui.waitSpace(t);
  io.getString = (p, init) => ui.getString(p, init);
  io.options = () => ui.showOptions();
  io.showHelp = () => ui.showHelp();
  io.showDiscoveries = (d) => ui.showDiscoveries(d);
  io.saveGame = async () => {
    try { saveGame(); ui.toast('Game saved to this browser.'); emit('msg', { text: 'Game saved. (Your adventure continues; the save is kept.)' }); }
    catch (e) { ui.toast('Could not save: ' + e.message); }
  };
  travelDanger = (hp0) => {
    if (S.player.t_stats.s_hpt < hp0) return true;
    for (const m of S.mlist) {
      if (!isupper(screen[m.t_pos.y * 80 + m.t_pos.x])) continue;
      if ((m.t_flags & D.ISRUN) && Math.hypot(m.t_pos.x - S.hero.x, m.t_pos.y - S.hero.y) < 9) return true;
    }
    return false;
  };
}
let travelDanger = () => false;

function travelTo(cell) {
  if (ui.modals.length) return false;
  const from = { x: S.hero.x, y: S.hero.y };
  const path = findPath(board, from, cell);
  if (!path || !path.length) { if (path === null) ui.toast("No known path there yet — explore closer."); return false; }
  const keys = pathKeys(from, path);
  input.pushMany(keys, true);
  return true;
}

function cameraAction(a) {
  if (a === 'reset') stage.resetCamera();
  else if (a === 'overview') stage.toggleOverview();
  else if (a === 'tilt') stage.cam.pitchT = stage.cam.pitchT > 1.0 ? 0.62 : stage.cam.pitchT > 0.8 ? 1.2 : 0.9;
}

function specialKeys(e) {
  if (e.key === 'Tab') { if (!ui.modals.length) stage.toggleOverview(); return true; }
  if (e.key === 'Home' && !e.shiftKey && !e.ctrlKey && !ui.modals.length) { stage.resetCamera(); return true; }
  if (e.key === '[') { stage.zoom(1.12); return true; }
  if (e.key === ']' && e.shiftKey === false && e.altKey) { return false; }
  if (e.key === 'F2') {
    const order = ['ultra', 'high', 'medium', 'low'];
    ui.hooks.setQuality(order[(order.indexOf(settings.quality) + 1) % order.length]);
    return true;
  }
  if (e.key === 'F11') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); return true; }
  if (e.key === 'F1') { if (!ui.modals.length) ui.showHelp(); return true; }
  return false;
}

// ------------------------------------------------------------------ mouse
function cellAt(clientX, clientY) {
  const p = stage.pickPlane(clientX, clientY, 0.3);
  if (!p) return null;
  const x = Math.floor(p.x), y = Math.floor(p.z);
  if (x < 0 || x >= 80 || y < 1 || y > 22) return null;
  return { x, y };
}

function describeCell(c) {
  const k = c.y * 80 + c.x;
  const g = screen[k];
  const hero = S.hero;
  if (c.x === hero.x && c.y === hero.y) return { title: `${S.whoami} (you)`, meta: 'The adventurer.' };
  const mon = moat(c.y, c.x);
  if (mon && isupper(g)) {
    const name = D.monsters[mon.t_type.charCodeAt(0) - 65].m_name;
    const asleep = !(mon.t_flags & D.ISRUN) && !(mon.t_flags & D.ISHELD);
    const hpFrac = mon.t_stats.s_hpt / Math.max(1, mon.t_stats.s_maxhp);
    const tier = mon.t_stats.s_lvl - S.player.t_stats.s_lvl;
    const danger = tier >= 5 ? 'Deadly' : tier >= 2 ? 'Dangerous' : tier >= -1 ? 'Even match' : 'Weak';
    const tags = [`<span class="tag ${tier >= 2 ? 'red' : ''}">${danger}</span>`];
    tags.push(`<span class="tag">${mon.t_flags & D.ISHELD ? 'HELD' : asleep ? 'ASLEEP' : 'AWAKE'}</span>`);
    if (mon.t_flags & D.ISHASTE) tags.push('<span class="tag red">HASTED</span>');
    if (mon.t_flags & D.ISSLOW) tags.push('<span class="tag">SLOWED</span>');
    if (mon.t_flags & D.ISHUH) tags.push('<span class="tag">CONFUSED</span>');
    if (mon.t_flags & D.ISINVIS) tags.push('<span class="tag">INVISIBLE</span>');
    const hp = hpFrac < 1 ? `<div class="hpm"><i style="width:${Math.round(hpFrac * 100)}%"></i></div><div class="meta">${hpFrac > 0.66 ? 'Healthy' : hpFrac > 0.33 ? 'Wounded' : 'Nearly dead'}</div>` : '';
    return { title: name.replace(/^./, (s) => s.toUpperCase()) + ` (${mon.t_type})`, meta: `${D.monster_blurbs[mon.t_type] || ''}`, extra: tags.join('') + hp, monster: mon };
  }
  if (isupper(g)) return { title: 'A sensed creature', meta: 'You feel its presence.' };
  switch (g) {
    case '*': return { title: 'Gold', meta: 'Walk over it to pick it up.' };
    case '!': { const o = W.find_obj(c.y, c.x); return { title: o && o.o_type === g ? `A ${S.p_colors[o.o_which]} potion` : 'A potion', meta: 'Drink it to find out what it does… carefully.' }; }
    case '?': return { title: 'A scroll', meta: 'Read it to learn its magic.' };
    case ':': return { title: 'Food', meta: 'Eat before you starve.' };
    case ')': { const o = W.find_obj(c.y, c.x); return { title: o && o.o_type === g ? D.weap_info[o.o_which].oi_name.replace(/^./, (s) => s.toUpperCase()) : 'A weapon', meta: 'A weapon.' }; }
    case ']': { const o = W.find_obj(c.y, c.x); return { title: o && o.o_type === g ? D.arm_info[o.o_which].oi_name.replace(/^./, (s) => s.toUpperCase()) : 'Armor', meta: 'A suit of armor.' }; }
    case '=': { const o = W.find_obj(c.y, c.x); return { title: o && o.o_type === g ? `A ${S.r_stones[o.o_which]} ring` : 'A ring', meta: 'A magic ring.' }; }
    case '/': { const o = W.find_obj(c.y, c.x); return { title: o && o.o_type === g ? `A ${S.ws_made[o.o_which]} ${S.ws_type[o.o_which]}` : 'A wand or staff', meta: 'Zap it in a direction.' }; }
    case ',': return { title: 'The Amulet of Yendor', meta: 'The prize! Carry it back up to the surface.' };
    case '%': return { title: 'Stairs down', meta: 'Stand here and press > to descend.' };
    case '^': { const t = INDEX_flags(c.y, c.x) & D.F_TMASK; return { title: D.tr_name[t].replace(/^./, (s) => s.toUpperCase()), meta: 'A known trap. Avoid it.' }; }
    case '+': return { title: 'A doorway', meta: 'Rooms are joined by doors and corridors.' };
    case '#': return { title: 'Corridor', meta: 'A narrow stone passage.' };
    case '.': return { title: 'Flagstone floor', meta: '' };
    case '|': case '-': return { title: 'Stone wall', meta: 'Search (s) to find secret doors.' };
    default: return null;
  }
}
import { INDEX } from './rogue/state.js';
const INDEX_flags = (y, x) => INDEX(y, x).p_flags;

let drag = null;
function installPointer() {
  const cv = stage.renderer.domElement;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { e.preventDefault(); stage.zoom(e.deltaY > 0 ? 1.1 : 0.91); }, { passive: false });
  cv.addEventListener('pointerdown', (e) => {
    ui.closeMenu();
    cv.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, button: e.button, shift: e.shiftKey };
  });
  cv.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
      if (drag.moved) {
        stage.orbit(-dx * 0.005, dy * 0.004);
        drag.x = e.clientX; drag.y = e.clientY;
        ui.tooltip(0, 0, null);
        return;
      }
    }
    hover(e);
  });
  cv.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (!d || d.moved) return;
    const c = cellAt(e.clientX, e.clientY);
    if (!c) return;
    if (d.button === 2) { contextMenu(c, e); return; }
    if (d.button === 0) cellClick(c, e);
  });
  cv.addEventListener('pointerleave', () => { ui.tooltip(0, 0, null); entities.setHover(null); entities.setPath(null); });
}

function hover(e) {
  if (ui.modals.length) { ui.tooltip(0, 0, null); return; }
  const c = cellAt(e.clientX, e.clientY);
  if (!c) { entities.setHover(null); entities.setPath(null); ui.tooltip(0, 0, null); return; }
  const info = describeCell(c);
  const k = c.y * 80 + c.x;
  const seen = board.seen[k] || screen[k] !== ' ';
  if (!seen) { entities.setHover(null); entities.setPath(null); ui.tooltip(0, 0, null); return; }
  const isMon = info && info.monster;
  entities.setHover(c, isMon ? [3, 0.6, 0.4] : [2.5, 2.0, 0.8]);
  if (ui.promptState.dir) { entities.setPath(null); } else {
    const adj = Math.abs(c.x - S.hero.x) <= 1 && Math.abs(c.y - S.hero.y) <= 1;
    const path = !adj ? findPath(board, { x: S.hero.x, y: S.hero.y }, c) : null;
    entities.setPath(path && path.length > 1 ? path.slice(0, -1) : null);
  }
  if (info) ui.tooltip(e.clientX, e.clientY, `<b>${info.title}</b>${info.meta ? `<div class="meta">${info.meta}</div>` : ''}${info.extra || ''}`);
  else ui.tooltip(0, 0, null);
}

function cellClick(c, e) {
  if (ui.modals.length) return;
  const hero = S.hero;
  const dx = c.x - hero.x, dy = c.y - hero.y;
  if (ui.promptState.dir) {
    const d = snapDir(dx, dy);
    if (d) input.push(keyFor(d[0], d[1]));
    return;
  }
  if (ui.promptState.item || ui.refs.prompt.querySelector('.row')) return;
  if (dx === 0 && dy === 0) { selfMenu(e); return; }
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
    const k = keyFor(dx, dy);
    input.push(e.shiftKey ? k.toUpperCase() : k);
    return;
  }
  if (e.shiftKey) {
    const d = snapDir(dx, dy);
    if (d) input.push(keyFor(d[0], d[1]).toUpperCase());
    return;
  }
  const info = describeCell(c);
  // clicking a distant monster walks toward it
  if (info && info.monster) {
    const path = findPath(board, { x: hero.x, y: hero.y }, c);
    if (path && path.length > 1) input.pushMany(pathKeys({ x: hero.x, y: hero.y }, path.slice(0, -1)), true);
    return;
  }
  travelTo(c);
}

function selfMenu(e) {
  const items = [];
  const here = W.find_obj(S.hero.y, S.hero.x);
  const onStairs = chat(S.hero.y, S.hero.x) === D.STAIRS;
  const k = (c) => () => input.push(c);
  if (here) items.push({ label: 'Pick up', key: ',', fn: k(',') });
  if (onStairs) items.push({ label: 'Descend the stairs', key: '>', fn: k('>') });
  items.push({ label: 'Search for secrets', key: 's', fn: k('s') }, { label: 'Rest a turn', key: '.', fn: k('.') }, { label: 'Open your pack', key: 'i', fn: k('i') });
  if (S.amulet && onStairs) items.push({ label: 'Climb the stairs', key: '<', fn: k('<') });
  ui.showMenu(e.clientX, e.clientY, items, S.whoami.toUpperCase());
}

function contextMenu(c, e) {
  if (ui.modals.length) return;
  const info = describeCell(c);
  const hero = S.hero;
  const dx = c.x - hero.x, dy = c.y - hero.y;
  const items = [];
  const aligned = (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) && (dx || dy);
  const dirKey = aligned ? keyFor(Math.sign(dx), Math.sign(dy)) : null;
  if (dx === 0 && dy === 0) { selfMenu(e); return; }
  if (info && info.monster) {
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) items.push({ label: 'Attack', key: keyFor(dx, dy), fn: () => input.push(keyFor(dx, dy)) });
    if (aligned) {
      items.push({ label: 'Throw something at it', key: 't', fn: () => { input.autoDir = dirKey; input.push('t'); } });
      items.push({ label: 'Zap a wand at it', key: 'z', fn: () => { input.autoDir = dirKey; input.push('z'); } });
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) items.push({ label: 'Fight to the death', key: 'f', fn: () => { input.autoDir = dirKey; input.push('f'); } });
    } else items.push({ label: '(line up orthogonally or diagonally to throw/zap)', disabled: true });
  }
  if (walkable(board, c.x, c.y)) items.push({ label: 'Travel here', fn: () => travelTo(c) });
  if (aligned && !(info && info.monster)) {
    items.push({ label: 'Throw in that direction', key: 't', fn: () => { input.autoDir = dirKey; input.push('t'); } });
    items.push({ label: 'Zap in that direction', key: 'z', fn: () => { input.autoDir = dirKey; input.push('z'); } });
  }
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) items.push({ label: 'Move without picking up', key: 'm', fn: () => { input.autoDir = keyFor(dx, dy); input.push('m'); } });
  if (!items.length) items.push({ label: 'Nothing to do there', disabled: true });
  ui.showMenu(e.clientX, e.clientY, items, info ? info.title : 'THE TABLE');
}

// ------------------------------------------------------------------ title / game over
async function mainMenu(params) {
  for (;;) {
    previewLevel();
    const choice = await titleScreen(params);
    params = null;
    if (choice === 'continue') {
      try { loadGame(); } catch (e) { ui.toast('That save could not be loaded: ' + e.message); deleteSave(); continue; }
    } else {
      G.newGame({ seed: params && params.get('seed') ? Number(params.get('seed')) : undefined });
    }
    await playSession();
  }
}

function previewLevel() {
  G.newGame();
  board.reset(); entities.reset();
  if (entities.hero) { entities.hero.root.visible = true; entities.hero.dead = false; entities.hero.death = null; entities.hero.setAlpha(1); entities.hero.root.scale.setScalar(1); entities.hero.root.position.y = 0.2; }
  director.fade = 0; director.sink = null;
  fx.screen.red = 0;
  emit('new_level', { level: 1 });
  emit('turn_end');
}

function titleScreen(params) {
  return new Promise((res) => {
    $('#hud').classList.add('hidden');
    const spin = (dt) => { stage.cam.yawT = Math.sin(stage.time * 0.12) * 0.45; };
    stage.updaters.push(spin);
    const t = document.createElement('div');
    t.className = 'title';
    const save = hasSave();
    t.innerHTML = `
      <div class="big">ROGUE</div>
      <div class="tag">THE DUNGEONS OF DOOM</div>
      <div class="menu-col">
        <button class="btn primary" data-a="new">New Adventure</button>
        ${save ? '<button class="btn" data-a="continue">Continue Saved Game</button>' : ''}
        <button class="btn" data-a="how">How to Play</button>
        <button class="btn" data-a="opts">Options</button>
      </div>
      <div class="credit">The classic 1980 game by Michael Toy, Ken Arnold &amp; Glenn Wichman — Rogue 5.4 rules, faithfully ported, now laid out on the kitchen table.<br>Press any movement key in the dungeon to begin. Mouse works everywhere.</div>`;
    document.body.appendChild(t);
    stage.cam.distT = 30; stage.cam.pitchT = 0.36;
    stage.setFocus(40, 12, true);
    const fin = (v) => { t.remove(); input.modal = null; stage.updaters.splice(stage.updaters.indexOf(spin), 1); $('#hud').classList.remove('hidden'); stage.resetCamera(); res(v); };
    t.addEventListener('click', async (e) => {
      const a = e.target.dataset && e.target.dataset.a;
      if (!a) return;
      if (a === 'new' || a === 'continue') fin(a);
      if (a === 'how') { await ui.showHelp(); }
      if (a === 'opts') { await ui.showOptions(); }
    });
    input.modal = (k) => { if (k === '\n') { fin('new'); } return true; };
    if (params && params.get('autostart')) setTimeout(() => fin('new'), 200);
  });
}

async function playSession() {
  ui.log = [];
  ui.logOpen = false;
  board.reset(); entities.reset();
  if (entities.hero) { entities.hero.root.visible = true; entities.hero.dead = false; entities.hero.death = null; entities.hero.setAlpha(1); entities.hero.root.scale.setScalar(1); entities.hero.root.position.y = 0.2; }
  stage.resetCamera();
  emit('new_level', { level: S.level });
  ui.refreshAll();
  ui.message(`Welcome, ${S.whoami}! Find the Amulet of Yendor in the depths of the dungeon — and bring it back up alive.`);
  ui.toast('Click the floor to walk · right-click for options · ? for the rulebook');
  let autosaveLevel = S.level;
  const orig = io.afterCommand;
  io.afterCommand = async () => {
    await orig();
    if (settings.autoSave && S.level !== autosaveLevel) { autosaveLevel = S.level; try { saveGame(); } catch (e) { /* ignore */ } }
  };
  try {
    await G.playit();
  } catch (e) {
    if (!(e instanceof GameOver)) throw e;
    io.afterCommand = orig;
    await endGame(e);
    return;
  }
  io.afterCommand = orig;
}

async function endGame(e) {
  deleteSave();
  persistSettings();
  const d = e.data;
  // let the final blow play out, then the camera lingers on the fallen hero
  emit('turn_end');
  await director.settle(1500);
  const hero = entities.hero;
  if (e.kind === 'death' && hero) { hero.die(stage.time, 1.1); hero.setAlpha(1); fx.screen.red = 1; stage.cam.distT = 16; }
  await new Promise((r) => setTimeout(r, 1300));
  if (hero && hero.death) hero.dead = true;
  const entry = recordScore({ name: S.whoami, score: d.purse, level: S.level, maxLevel: S.max_level, killer: d.killer || (e.kind === 'win' ? 'escaped alive' : e.kind === 'quit' ? 'quit' : '?'), kind: e.kind, amulet: S.amulet });
  const scores = topScores();
  await new Promise((res) => {
    const body = document.createElement('div');
    body.className = 'tomb';
    if (e.kind === 'death') body.appendChild(drawTombstone({ name: S.whoami, purse: d.purse, killer: d.killer, monst: d.monst }));
    else if (e.kind === 'win') {
      const rows = d.rows.map((r) => `<tr><td>${r.ch})</td><td style="text-align:right">${r.worth}</td><td>${r.name}</td></tr>`).join('');
      body.innerHTML = `<p style="font-size:18px"><b>Congratulations, you have made it to the light of day!</b><br>You journey home and sell all your loot at a great profit and are admitted to the Fighters' Guild.</p>
        <div class="scores"><table><tr><th>Item</th><th>Worth</th><th></th></tr>${rows}<tr><td></td><td style="text-align:right">${d.oldpurse}</td><td>Gold pieces</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>${d.purse}</b></td><td></td></tr></table></div>`;
    } else body.innerHTML = `<p style="font-size:18px">You quit with ${d.purse} gold pieces.</p>`;
    const tbl = document.createElement('div');
    tbl.className = 'scores';
    tbl.innerHTML = `<h3 style="font-family:var(--serif);letter-spacing:3px;margin:12px 0 4px">TOP ADVENTURERS</h3><table><tr><th>#</th><th>Name</th><th>Score</th><th>Depth</th><th>Fate</th></tr>${scores.map((s, i) => `<tr class="${s.id === entry.id ? 'me' : ''}"><td>${i + 1}</td><td>${s.name}</td><td>${s.score}</td><td>${s.maxLevel}</td><td>${s.kind === 'win' ? 'escaped alive!' : s.kind === 'quit' ? 'quit' : 'killed by ' + (s.killer || '?')}</td></tr>`).join('')}</table>`;
    body.appendChild(tbl);
    const m = ui.modal({ title: e.kind === 'win' ? 'Victory!' : e.kind === 'quit' ? 'Farewell' : 'Requiescat in Pace', body, buttons: [['Play Again', null, true]], onClose: res, wide: true });
    m.noScrimClose = true; m.noKeyClose = true;
    m.keyHandler = (k) => { if (k === '\n' || k === ' ') m.close(); return true; };
    input.modal = m.keyHandler;
  });
  stage.resetCamera();
}

boot().catch(fatal);
