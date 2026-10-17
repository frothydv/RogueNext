// Bundles the game into dist/game.js so index.html also works when opened straight from disk.
import { build, context } from 'esbuild';

const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'dist/game.js',
  sourcemap: true,
  target: 'es2022',
  loader: { '.glb': 'binary', '.txt': 'text' },
  logLevel: 'info',
  minify: !process.argv.includes('--dev'),
};
if (process.argv.includes('--watch')) {
  const ctx = await context(opts);
  await ctx.watch();
} else {
  await build(opts);
}
