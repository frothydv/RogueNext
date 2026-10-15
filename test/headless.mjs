// Headless soak test: drive the ported game with random keys and check for exceptions.
import fs from 'node:fs';
import * as G from '../src/rogue/game.js';
import { S, io, onEvent, GameOver, cpy } from '../src/rogue/state.js';
const DIVE = !!process.env.DIVE;
let forceKey = null;

const crumb = process.env.CRUMB ? fs.openSync(process.env.CRUMB, 'w') : null;
const log = (s) => { if (crumb !== null) fs.writeSync(crumb, s); };
const keys = 'hjklyubnHJKLYUBN.s,><iqrewWTPRdcDI)]=@?/ a1234567890'.split('');
const seedArg = Number(process.argv[2] || 12345);
const N = Number(process.argv[3] || 4000);
const GAMES = Number(process.argv[4] || 30);
let rngState = seedArg;
const rr = () => { rngState = (Math.imul(rngState, 1103515245) + 12345) | 0; return (rngState >>> 8) & 0xffff; };
let fed = 0;
io.readchar = async () => {
  fed++;
  const k = forceKey ? (() => { const f = forceKey; forceKey = null; return f; })() : rr() % 7 === 0 ? '\x1b' : keys[rr() % keys.length];
  log(JSON.stringify(k) + ' ');
  return k;
};
io.showList = async () => {}; io.waitSpace = async () => {}; io.getString = async () => 'x';
io.options = async () => {}; io.showHelp = async () => {}; io.showDiscoveries = async () => {};
io.saveGame = async () => {}; io.afterCommand = async () => {};
let msgs = 0;
onEvent((t) => { if (t === 'msg') msgs++; });
let deaths = 0, maxLevel = 0;
for (let g = 0; g < GAMES; g++) {
  log(`\nGAME ${g} `);
  G.newGame({ seed: seedArg + g });
  try {
    for (let i = 0; i < N && S.playing; i++) {
      log(`[c${i} t${S.turns}] `);
      if (DIVE) { S.player.t_stats.s_hpt = S.player.t_stats.s_maxhp = 99; if (rr() % 6 === 0 && S.level < 40) { cpy(S.hero, S.stairs); forceKey = '>'; } }
      await G.command();
      maxLevel = Math.max(maxLevel, S.level);
    }
  } catch (e) {
    if (e instanceof GameOver) { deaths++; continue; }
    console.error('CRASH game', g, 'seed', seedArg + g, 'turn', S.turns, e.stack);
    process.exit(1);
  }
}
console.log(`ok: ${deaths} deaths, max level ${maxLevel}, msgs ${msgs}, keys ${fed}`);
