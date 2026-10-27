import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// Run from the authoritative website checkout. The optional argument is the
// Local Arena Panel directory; its vendor copy never imports outside the ZIP.
const source = new URL('../lib/local-arena-protocol.ts', import.meta.url);
const bytes = (await readFile(source, 'utf8')).replace(/\r\n/g, '\n');
const hash = createHash('sha256').update(bytes).digest('hex') + '\n';
await writeFile(new URL('../lib/local-arena-protocol.sha256', import.meta.url), hash);
if (process.argv[2]) {
  const panel = resolve(process.argv[2]);
  await writeFile(resolve(panel, 'src/lib/radar-protocol.ts'), bytes);
  await writeFile(resolve(panel, 'src/lib/radar-protocol.sha256'), hash);
}
console.log('Local Arena protocol synchronized:', hash.trim());
