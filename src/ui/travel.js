// Click-to-travel path finding over the part of the level the hero has already seen.
import * as D from '../rogue/data.js';
import { S, moat, chat, screen } from '../rogue/state.js';
import { diag_ok } from '../rogue/world.js';
import { TERR } from '../render/board.js';

const W = 80;
const DIRS = [[0, -1, 'k'], [0, 1, 'j'], [-1, 0, 'h'], [1, 0, 'l'], [-1, -1, 'y'], [1, -1, 'u'], [-1, 1, 'b'], [1, 1, 'n']];

export function keyFor(dx, dy) {
  const d = DIRS.find((q) => q[0] === dx && q[1] === dy);
  return d ? d[2] : null;
}

// nearest of the eight directions for an arbitrary vector
export function snapDir(dx, dy) {
  if (!dx && !dy) return null;
  const a = Math.atan2(dy, dx);
  const k = Math.round(a / (Math.PI / 4));
  const table = { 0: [1, 0], 1: [1, 1], 2: [0, 1], 3: [-1, 1], 4: [-1, 0], '-4': [-1, 0], '-3': [-1, -1], '-2': [0, -1], '-1': [1, -1] };
  return table[k];
}

export function walkable(board, x, y) {
  if (x < 0 || y < 1 || x >= W || y >= 23) return false;
  const k = y * W + x;
  if (!board.seen[k]) return false;
  const t = board.terr[k];
  return t === TERR.FLOOR || t === TERR.PASS || t === TERR.DOOR || t === TERR.STAIRS;
}

export function findPath(board, from, to, opts = {}) {
  if (from.x === to.x && from.y === to.y) return [];
  const goalOk = walkable(board, to.x, to.y) || (opts.allowTrapGoal && board.terr[to.y * W + to.x] === TERR.TRAP);
  if (!goalOk) return null;
  const prev = new Int32Array(W * 24).fill(-1);
  const q = [from.y * W + from.x];
  prev[q[0]] = q[0];
  const target = to.y * W + to.x;
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi];
    if (cur === target) break;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      const nk = ny * W + nx;
      if (nx < 0 || nx >= W || ny < 1 || ny >= 23 || prev[nk] !== -1) continue;
      if (!walkable(board, nx, ny)) continue;
      if (nk !== target) {
        // do not path through visible monsters
        const m = moat(ny, nx);
        if (m && /[A-Z]/.test(screen[nk])) continue;
      }
      if (!diag_ok({ x: cx, y: cy }, { x: nx, y: ny })) continue;
      // Rogue forbids sliding diagonally through doorways
      if (dx && dy && (chat(cy, cx) === D.DOOR || chat(ny, nx) === D.DOOR)) continue;
      prev[nk] = cur;
      q.push(nk);
    }
  }
  if (prev[target] === -1) return null;
  const path = [];
  for (let c = target; c !== from.y * W + from.x; c = prev[c]) path.push({ x: c % W, y: (c / W) | 0 });
  return path.reverse();
}

export function pathKeys(from, path) {
  const keys = [];
  let cx = from.x, cy = from.y;
  for (const p of path) { keys.push(keyFor(p.x - cx, p.y - cy)); cx = p.x; cy = p.y; }
  return keys;
}
