// Canvas-drawn icons for items, used on inventory cards (DOM) and on the tabletop card props.
import * as D from '../rogue/data.js';

export const COLOR = {
  amber: '#ffbf00', aquamarine: '#7fffd4', black: '#262626', blue: '#2a5cff', brown: '#80502a', clear: '#dff3ff',
  crimson: '#dc143c', cyan: '#00d8e8', ecru: '#c2b280', gold: '#ffd24a', green: '#22bb44', grey: '#8f8f8f',
  magenta: '#ff2bff', orange: '#ff8000', pink: '#ff8fb8', plaid: '#c05a3a', purple: '#8a3be2', red: '#e02a2a',
  silver: '#cfd2da', tan: '#d2b48c', tangerine: '#f28500', topaz: '#ffc87c', turquoise: '#30d5c8',
  vermilion: '#e34234', violet: '#9a20ff', white: '#ffffff', yellow: '#ffee33',
  agate: '#b5651d', alexandrite: '#5a6aa0', amethyst: '#9966cc', carnelian: '#b31b1b', diamond: '#e8f8ff',
  emerald: '#50c878', germanium: '#aab8a8', granite: '#8a8a8a', garnet: '#8a2a35', jade: '#00a86b',
  kryptonite: '#7cfc00', 'lapis lazuli': '#26619c', moonstone: '#cfd8e8', obsidian: '#22222a', onyx: '#2a2a2a',
  opal: '#b0e0e6', pearl: '#f0eadc', peridot: '#b4c424', ruby: '#e0115f', sapphire: '#0f52ba',
  stibotantalite: '#a08060', 'tiger eye': '#b8860b', taaffeite: '#c080c0', zircon: '#c8a050',
  bone: '#e8e0c8', brass: '#c8a040', bronze: '#a0703a', copper: '#c0703a', iron: '#8a8a94', steel: '#b0b4c0',
  pewter: '#9a9aa0', platinum: '#d8dce4', tin: '#b8b8c0', zinc: '#a8b0b8', lead: '#707078', nickel: '#a8a8b0',
  aluminum: '#c8ccd4', beryllium: '#b0b8b8', electrum: '#d8c870', magnesium: '#c8c8cc', mercury: '#c0c4cc',
  silicon: '#7a8090', titanium: '#9aa0aa', tungsten: '#6a6e78',
  ebony: '#2a2018', elm: '#8a6a40', cedar: '#a0603a', cherry: '#8a3a28', maple: '#b88a50', teak: '#a07a40',
  walnut: '#5a3a24', pine: '#c8a068', birch: '#d8c8a0', oaken: '#9a7040', mahogany: '#6a3020', redwood: '#8a3a2a',
  rosewood: '#5a2a24', zebrawood: '#9a7a50', balsa: '#e0c898', bamboo: '#c8b868', holly: '#c8c0a0',
};
export function colorFor(name) {
  if (!name) return '#9a8a7a';
  if (COLOR[name]) return COLOR[name];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 45% 55%)`;
}

function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function shade(hex, f) {
  const c = document.createElement('canvas'); c.width = c.height = 1;
  const x = c.getContext('2d'); x.fillStyle = hex; x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  const m = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${m(d[0])},${m(d[1])},${m(d[2])})`;
}

// Draws the icon into a (0..64) box scaled to ctx
export function drawIcon(ctx, spec, size = 64) {
  ctx.save();
  ctx.scale(size / 64, size / 64);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const { type, which } = spec;
  const col = spec.color || '#c0a070';
  switch (type) {
    case D.POTION: {
      const liquid = col;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(32, 58, 18, 4, 0, 0, 7); ctx.fill();
      // bottle body
      ctx.beginPath(); ctx.moveTo(26, 14); ctx.lineTo(26, 26); ctx.bezierCurveTo(10, 34, 12, 56, 32, 56); ctx.bezierCurveTo(52, 56, 54, 34, 38, 26); ctx.lineTo(38, 14); ctx.closePath();
      ctx.fillStyle = 'rgba(230,245,255,.35)'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = grad(ctx, 0, 30, 0, 58, [[0, liquid], [1, shade(liquid, 0.55)]]);
      ctx.fillRect(0, 34, 64, 30);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(32, 34, 20, 3, 0, 0, 7); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(21, 42, 2.2, 7, 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#a0703a'; ctx.fillRect(25, 8, 14, 8); ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 1.5; ctx.strokeRect(25, 8, 14, 8);
      break;
    }
    case D.SCROLL: {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(32, 56, 22, 4, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(32, 32); ctx.rotate(-0.5);
      ctx.fillStyle = grad(ctx, -8, 0, 8, 0, [[0, '#d8c08a'], [0.5, '#f4e6b8'], [1, '#c8aa70']]);
      ctx.fillRect(-9, -26, 18, 52);
      ctx.fillStyle = '#e8d29a'; for (const y of [-26, 26]) { ctx.beginPath(); ctx.ellipse(0, y, 11, 4, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a6a30'; ctx.lineWidth = 1.2; ctx.stroke(); }
      ctx.strokeStyle = '#b02020'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke();
      ctx.fillStyle = '#8a1010'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, 7); ctx.fill();
      ctx.restore();
      break;
    }
    case D.FOOD: {
      if (which === 1) {
        ctx.fillStyle = grad(ctx, 14, 14, 50, 50, [[0, '#9ae05a'], [1, '#3a8a24']]);
        ctx.beginPath(); ctx.ellipse(32, 36, 19, 17, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a6a1a'; ctx.beginPath(); ctx.ellipse(40, 16, 10, 5, -0.6, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.ellipse(24, 28, 5, 3, -0.6, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = grad(ctx, 0, 20, 0, 52, [[0, '#d8a860'], [1, '#8a5a24']]);
        ctx.beginPath(); ctx.moveTo(10, 40); ctx.bezierCurveTo(10, 16, 54, 16, 54, 40); ctx.lineTo(54, 46); ctx.lineTo(10, 46); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6a4010'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = '#c0803a'; ctx.lineWidth = 2; for (const x of [22, 32, 42]) { ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x - 2, 38); ctx.stroke(); }
        ctx.fillStyle = '#e8e0c8'; ctx.fillRect(8, 40, 48, 6); ctx.strokeStyle = '#8a7a50'; ctx.strokeRect(8, 40, 48, 6);
      }
      break;
    }
    case D.WEAPON: {
      const steel = grad(ctx, 0, 0, 64, 0, [[0, '#9aa0b0'], [0.5, '#e8ecf4'], [1, '#808898']]);
      const wood = '#7a4a22';
      ctx.save(); ctx.translate(32, 32); ctx.rotate(-Math.PI / 4);
      switch (which) {
        case D.MACE:
          ctx.fillStyle = wood; ctx.fillRect(-3, -6, 6, 40);
          ctx.fillStyle = '#8a8a94'; ctx.beginPath(); ctx.arc(0, -16, 11, 0, 7); ctx.fill();
          ctx.strokeStyle = '#4a4a52'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = '#6a6a74'; for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, -16 + Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 16, -16 + Math.sin(a) * 16); ctx.lineTo(Math.cos(a + 0.4) * 9, -16 + Math.sin(a + 0.4) * 9); ctx.fill(); }
          break;
        case D.SWORD: case D.TWOSWORD: {
          const L = which === D.TWOSWORD ? 52 : 44;
          ctx.fillStyle = steel; ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(-4, -L + 8); ctx.lineTo(0, -L); ctx.lineTo(4, -L + 8); ctx.lineTo(4, 8); ctx.fill();
          ctx.strokeStyle = '#555a68'; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.fillStyle = '#c8a040'; ctx.fillRect(-12, 6, 24, 5);
          ctx.fillStyle = wood; ctx.fillRect(-3, 11, 6, 14);
          ctx.fillStyle = '#c8a040'; ctx.beginPath(); ctx.arc(0, 28, 4, 0, 7); ctx.fill();
          break;
        }
        case D.DAGGER:
          ctx.fillStyle = steel; ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(-3, -18); ctx.lineTo(0, -26); ctx.lineTo(3, -18); ctx.lineTo(3, 6); ctx.fill();
          ctx.fillStyle = '#c8a040'; ctx.fillRect(-8, 5, 16, 4); ctx.fillStyle = wood; ctx.fillRect(-2.5, 9, 5, 12);
          break;
        case D.SPEAR:
          ctx.fillStyle = wood; ctx.fillRect(-2, -20, 4, 58);
          ctx.fillStyle = steel; ctx.beginPath(); ctx.moveTo(-6, -18); ctx.lineTo(0, -34); ctx.lineTo(6, -18); ctx.lineTo(0, -22); ctx.fill();
          break;
        case D.BOW:
          ctx.restore(); ctx.save(); ctx.translate(32, 32);
          ctx.strokeStyle = wood; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-6, 0, 26, -1.2, 1.2); ctx.stroke();
          ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6 + Math.cos(-1.2) * 26, Math.sin(-1.2) * 26); ctx.lineTo(-6 + Math.cos(1.2) * 26, Math.sin(1.2) * 26); ctx.stroke();
          break;
        case D.ARROW: case D.DART:
          for (const o of [-8, 0, 8]) {
            ctx.save(); ctx.translate(o, 0);
            ctx.strokeStyle = wood; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(0, -22); ctx.stroke();
            ctx.fillStyle = '#a0a6b4'; ctx.beginPath(); ctx.moveTo(-3, -20); ctx.lineTo(0, -28); ctx.lineTo(3, -20); ctx.fill();
            ctx.fillStyle = which === D.DART ? '#c04030' : '#e8e0c8'; ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(-4, 28); ctx.lineTo(0, 14); ctx.lineTo(4, 28); ctx.fill();
            ctx.restore();
          }
          break;
        case D.SHIRAKEN:
          ctx.restore(); ctx.save(); ctx.translate(32, 32);
          ctx.fillStyle = steel; ctx.strokeStyle = '#555a68'; ctx.lineWidth = 1.2;
          ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28 - 1.57, r = i % 2 ? 7 : 24; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
          break;
        default: ctx.fillStyle = steel; ctx.fillRect(-3, -20, 6, 40);
      }
      ctx.restore();
      break;
    }
    case D.ARMOR: {
      const c = spec.color || '#9a9aa4';
      const leather = which === D.LEATHER || which === D.STUDDED_LEATHER;
      const base = leather ? '#8a5a30' : c;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(32, 58, 22, 4, 0, 0, 7); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(14, 14); ctx.lineTo(24, 8); ctx.quadraticCurveTo(32, 16, 40, 8); ctx.lineTo(50, 14); ctx.lineTo(56, 26); ctx.lineTo(46, 30); ctx.lineTo(46, 54); ctx.lineTo(18, 54); ctx.lineTo(18, 30); ctx.lineTo(8, 26); ctx.closePath();
      ctx.fillStyle = grad(ctx, 0, 8, 64, 54, [[0, shade(base, 1.25)], [0.5, base], [1, shade(base, 0.6)]]);
      ctx.fill(); ctx.strokeStyle = shade(base, 0.35); ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = shade(base, 0.5); ctx.lineWidth = 1.2;
      if (which === D.RING_MAIL || which === D.CHAIN_MAIL) {
        for (let y = 16; y < 54; y += 6) for (let x = 18 + (y % 12 ? 3 : 0); x < 46; x += 6) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.stroke(); }
      } else if (which === D.SCALE_MAIL) {
        for (let y = 18; y < 54; y += 6) for (let x = 20 + (y % 12 ? 3 : 0); x < 46; x += 6) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI); ctx.stroke(); }
      } else if (which === D.SPLINT_MAIL || which === D.BANDED_MAIL) {
        for (let y = 18; y < 54; y += 7) { ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(46, y); ctx.stroke(); }
      } else if (which === D.PLATE_MAIL) {
        ctx.beginPath(); ctx.moveTo(32, 12); ctx.lineTo(32, 54); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(22, 18, 6, 26);
      } else if (which === D.STUDDED_LEATHER) {
        ctx.fillStyle = '#d8d8e0'; for (let y = 18; y < 54; y += 8) for (let x = 22; x < 46; x += 8) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, 7); ctx.fill(); }
      }
      break;
    }
    case D.RING: {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(32, 54, 20, 4, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = grad(ctx, 0, 20, 0, 56, [[0, '#ffe890'], [1, '#a07820']]); ctx.lineWidth = 7;
      ctx.beginPath(); ctx.ellipse(32, 38, 18, 16, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#6a4a10'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(32, 38, 21.5, 19.5, 0, 0, 7); ctx.stroke();
      const g = spec.color || '#e02a2a';
      ctx.fillStyle = grad(ctx, 22, 4, 42, 24, [[0, shade(g, 1.5)], [1, shade(g, 0.6)]]);
      ctx.beginPath(); ctx.moveTo(32, 6); ctx.lineTo(42, 14); ctx.lineTo(38, 24); ctx.lineTo(26, 24); ctx.lineTo(22, 14); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(28, 10); ctx.lineTo(33, 9); ctx.lineTo(30, 16); ctx.fill();
      break;
    }
    case D.STICK: {
      ctx.save(); ctx.translate(32, 32); ctx.rotate(-Math.PI / 4);
      const isStaff = spec.staff;
      ctx.fillStyle = isStaff ? grad(ctx, -3, 0, 3, 0, [[0, shade(col, 1.2)], [1, shade(col, 0.6)]]) : grad(ctx, -3, 0, 3, 0, [[0, shade(col, 1.3)], [1, shade(col, 0.55)]]);
      ctx.fillRect(isStaff ? -3 : -2.5, -24, isStaff ? 6 : 5, 56);
      ctx.fillStyle = '#d8d0b0'; ctx.fillRect(-4, 26, 8, 6);
      ctx.fillStyle = '#c8a040'; ctx.fillRect(-4, -4, 8, 3);
      const glow = ctx.createRadialGradient(0, -28, 0, 0, -28, 14);
      glow.addColorStop(0, 'rgba(160,230,255,.95)'); glow.addColorStop(1, 'rgba(160,230,255,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -28, 14, 0, 7); ctx.fill();
      ctx.fillStyle = '#a8e8ff'; ctx.beginPath(); ctx.arc(0, -28, 5, 0, 7); ctx.fill();
      ctx.restore();
      break;
    }
    case D.AMULET: {
      ctx.strokeStyle = '#e8c040'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(12, 6); ctx.quadraticCurveTo(32, 30, 52, 6); ctx.stroke();
      const rg = ctx.createRadialGradient(32, 40, 2, 32, 40, 18);
      rg.addColorStop(0, '#ff6070'); rg.addColorStop(0.6, '#c01030'); rg.addColorStop(1, '#601020');
      ctx.fillStyle = '#e8c040'; ctx.beginPath(); ctx.arc(32, 40, 17, 0, 7); ctx.fill();
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(32, 40, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(32, 40, 17, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(27, 34, 3, 2, -0.6, 0, 7); ctx.fill();
      break;
    }
    case D.GOLD: {
      for (const [x, y, r] of [[22, 44, 12], [40, 46, 12], [31, 34, 12], [20, 30, 9], [44, 32, 9]]) {
        ctx.fillStyle = grad(ctx, x - r, y - r, x + r, y + r, [[0, '#fff0a0'], [0.5, '#e8b830'], [1, '#9a6a10']]);
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.9, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#7a5008'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = '#b8801a'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.55, r * 0.5, 0, 0, 7); ctx.fill();
      }
      break;
    }
    default: {
      ctx.fillStyle = '#e8d8b0'; ctx.font = 'bold 40px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', 32, 34);
    }
  }
  ctx.restore();
}

export function iconCanvas(spec, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size * 2;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  drawIcon(ctx, spec, size);
  return c;
}
export function iconDataURL(spec, size = 64) { return iconCanvas(spec, size).toDataURL(); }

// colour of the thing as the player knows it (potion colour, ring stone, wand material...)
export function appearanceFor(S, o) {
  switch (o.o_type) {
    case D.POTION: return { type: o.o_type, which: o.o_which, color: colorFor(S.p_colors[o.o_which]) };
    case D.RING: return { type: o.o_type, which: o.o_which, color: colorFor(S.r_stones[o.o_which]) };
    case D.STICK: return { type: o.o_type, which: o.o_which, color: colorFor(S.ws_made[o.o_which]), staff: S.ws_type[o.o_which] === 'staff' };
    case D.ARMOR: return { type: o.o_type, which: o.o_which, color: ['#8a5a30', '#9aa0a8', '#8a5a30', '#b0a080', '#b8bcc8', '#a0a8b8', '#9aa0b0', '#d8dce8'][o.o_which] };
    default: return { type: o.o_type, which: o.o_which };
  }
}
