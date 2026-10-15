// Tombstone rendering and the (local) high-score table.
import * as D from '../rogue/data.js';
import { vowelstr } from '../rogue/state.js';

const KEY = 'rogue-tabletop-scores-v1';

export function topScores() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}
export function recordScore(e) {
  const list = topScores();
  const entry = { ...e, id: Date.now() + Math.random(), date: new Date().toISOString() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  try { localStorage.setItem(KEY, JSON.stringify(top)); } catch (err) { /* ignore */ }
  if (!top.includes(entry)) top.push(entry);
  return entry;
}

export function drawTombstone({ name, purse, killer, monst }) {
  const c = document.createElement('canvas');
  c.width = 720; c.height = 540;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, '#0b0f1c'); sky.addColorStop(0.6, '#2a2236'); sky.addColorStop(1, '#14100c');
  g.fillStyle = sky; g.fillRect(0, 0, 720, 540);
  // moon
  const mg = g.createRadialGradient(560, 90, 4, 560, 90, 90);
  mg.addColorStop(0, '#fffbe0'); mg.addColorStop(0.2, '#f0e8c0'); mg.addColorStop(0.22, 'rgba(240,232,192,.25)'); mg.addColorStop(1, 'rgba(240,232,192,0)');
  g.fillStyle = mg; g.fillRect(400, 0, 320, 240);
  // ground
  g.fillStyle = '#1a2214'; g.beginPath(); g.moveTo(0, 440); g.quadraticCurveTo(360, 400, 720, 450); g.lineTo(720, 540); g.lineTo(0, 540); g.fill();
  // stone slab
  const sx = 170, sy = 70, sw = 380, sh = 400;
  const st = g.createLinearGradient(sx, sy, sx + sw, sy + sh);
  st.addColorStop(0, '#9a988c'); st.addColorStop(0.5, '#767468'); st.addColorStop(1, '#4a4a42');
  g.fillStyle = st;
  g.beginPath(); g.moveTo(sx, sy + sh); g.lineTo(sx, sy + 150); g.arc(sx + sw / 2, sy + 150, sw / 2, Math.PI, 0); g.lineTo(sx + sw, sy + sh); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 5; g.stroke();
  // speckle & moss
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,240'},${Math.random() * 0.12})`; g.fillRect(sx + Math.random() * sw, sy + Math.random() * sh, 2, 2); }
  g.fillStyle = 'rgba(70,110,40,.5)';
  for (let i = 0; i < 60; i++) { g.beginPath(); g.ellipse(sx + Math.random() * sw, sy + sh - Math.random() * 28, 14 + Math.random() * 20, 4 + Math.random() * 5, 0, 0, 7); g.fill(); }
  // inscription
  g.textAlign = 'center';
  g.fillStyle = '#26241e'; g.shadowColor = 'rgba(255,255,240,.35)'; g.shadowOffsetY = 2; g.shadowBlur = 0;
  g.font = 'bold 58px "Palatino Linotype", Georgia, serif'; g.fillText('R.I.P.', 360, 175);
  g.font = 'italic 24px Georgia'; g.fillText('Here lies', 360, 222);
  g.font = 'bold 36px Georgia'; g.fillText(name, 360, 272);
  g.font = '26px Georgia'; g.fillText(`${purse} Au`, 360, 312);
  const k = killer || 'something unknown';
  const art = monst && monst !== 's' && monst !== 'h' ? `killed by a${vowelstr(k)}` : 'killed by';
  g.font = 'italic 24px Georgia'; g.fillText(art, 360, 358);
  g.font = 'bold 30px Georgia'; g.fillText(k, 360, 396);
  g.font = '22px Georgia'; g.fillText(String(new Date().getFullYear()), 360, 436);
  // grass
  g.shadowColor = 'transparent';
  g.strokeStyle = '#2c4a20'; g.lineWidth = 2;
  for (let i = 0; i < 160; i++) { const x = Math.random() * 720, y = 450 + Math.random() * 80; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4, y - 10, x + (Math.random() - 0.5) * 12, y - 20 - Math.random() * 10); g.stroke(); }
  void D;
  return c;
}
