import { build } from 'esbuild';
import { basename } from 'node:path';

// Build the current sources in memory so tests never depend on a stale ZIP build
// or overwrite the user's downloadable extension package.
const { outputFiles } = await build({
  entryPoints: ['extension/worker.mjs', 'extension/extractor.mjs'],
  outdir: '.checks/extension-tests',
  bundle: true,
  platform: 'browser',
  target: 'chrome120',
  format: 'iife',
  minify: true,
  write: false,
});

function script(name) {
  const file = outputFiles.find((entry) => basename(entry.path) === name);
  if (!file) throw new Error(`Missing test bundle: ${name}`);
  return file.text;
}

export const workerScript = script('worker.js');
export const extractorScript = script('extractor.js');
