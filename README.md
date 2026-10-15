# ROGUE: The Tabletop

The 1980 classic **Rogue 5.4** — rules, level generator, monsters, items, hunger, daemons and
all — laid out as a living board game on a kitchen table: hand-painted miniatures, cut-stone
dungeon tiles, torches, dice, cards and a hand-painted map, rendered with three.js
(HDR, PBR bump-mapped procedural textures, soft shadows, bloom, depth of field).

## Run it

* **Double-click `index.html`** (the game is pre-built into `dist/game.js`), or
* `start.bat` / `npm start` → <http://localhost:5173> (rebuilds first), or
* `npm run build` to regenerate the minified `dist/game.js` after editing `src/`.

Needs a modern browser with WebGL2. The game auto-selects a lighter graphics level if it runs
slowly (`F2` cycles Ultra / High / Medium / Low; `?q=low` in the URL forces one).

## Controls — every original key works, and so does the mouse

| Keys | |
|---|---|
| `h j k l` `y u b n` (or arrows / numpad) | move · diagonals |
| `H J K L Y U B N` (Shift) | run |
| `Ctrl`+dir (or `Alt`+dir) | run until something interesting is adjacent |
| `f` / `F` + dir | fight to the near-death / to the death |
| `m` + dir · `t` + dir · `z` + dir · `^` + dir | move without pickup · throw · zap · identify trap |
| `s` `.` `,` `>` `<` | search · rest · pick up · down · up |
| `i` `I` `q` `r` `e` `w` `W` `T` `P` `R` `d` `c` | inventory · inspect · quaff · read · eat · wield · wear · take off · put on ring · remove ring · drop · call |
| `a` `)` `]` `=` `@` `D` `/` `o` `?` | repeat · weapon · armor · rings · stats · discoveries · identify symbol · options · help |
| `1`–`9…` then a command | repeat count |
| `Ctrl-P` `Ctrl-R` `Esc` `S` `Q` `v` | last message · redraw · cancel · save · quit · version |

Camera: wheel = zoom, drag = orbit/tilt, `Tab` = overview, `Home` = reset, `F11` = full screen.

**Mouse equivalents:** click the floor to walk (the path is previewed), click a monster to
attack, Shift-click to run, right-click for a context menu (look / throw / zap / travel),
click inventory cards to use them, click the parchment map to travel, and every command is on
the action bar or its ☰ *More* menu. Prompts ("which direction?", "which object?") highlight
the valid cards and show a compass.

Hovering shows what things are. Monsters sit on bases with the classic letter on the rim and a
ring colour that shows how dangerous they are (green → red).

## Blender asset pipeline

All miniatures (hero + 26 monsters) and the modular dungeon kit are modelled in Blender with
Python scripts, so they can be regenerated and tweaked:

```
blender -b -P blender/mini_humanoids.py     # hero, humanoid monsters
blender -b -P blender/mini_creatures.py     # animals, dragon, snake, etc.
blender -b -P blender/mini_specials.py      # flytrap, ghost-like and odd monsters
blender -b -P blender/dungeon_kit.py        # cobbled floors, cut-stone walls, flagstone caps
blender -b -P blender/dungeon_props.py      # door, stairs, 8 trap plates, sconce, dressing
node scripts/optimize.mjs                   # meshopt-compress -> src/render/assets.generated.js
node build.mjs                              # bundle (models are inlined, index.html still opens by double-click)
```

Models carry baked ambient occlusion, edge wear and zone colours in vertex colours, and named
nodes (`legL`, `armR`, `wingL`, `jawA`, `hinge`, …) that the game animates. The dungeon kit is
drawn with `InstancedMesh` (`src/render/kitboard.js`) with fog-of-war shading, a rising reveal
animation and the wall cut-away done in the vertex shader.

## How it is built

* `src/rogue/` — a faithful JavaScript port of the original C source (`rooms.c`, `passages.c`,
  `chase.c`, `fight.c`, `potions.c`, … including the original LCG random numbers and the
  monster tables). The only deviations are interface-driven (no `--More--`, no shell escape,
  identify can't soft-lock, wizard-mode omitted).
* `src/render/` — the table/board/props, FX, a director that turns game events into sequenced
  animation, and a tiny WebAudio synthesizer. Miniatures, dungeon floor/wall pieces, doors,
  stairs, traps, sconces and floor dressing are Blender models (see below); the old procedural
  versions stay as a fallback and are used by the *Low* quality preset's board.
* `src/ui/` — HUD, cards, prompts, input handling, travel path-finding, tombstone & scores.
* Saves and high scores live in the browser's `localStorage`.

Original game © 1980–1983, 1985, 1999 Michael Toy, Ken Arnold and Glenn Wichman — see
`LICENSE-ROGUE.txt`. The port and presentation layer are provided in the same spirit.
