import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL('../lib/', import.meta.url);
const bytes = (await readFile(new URL('local-arena-protocol.ts', base), 'utf8')).replace(/\r\n/g, '\n');
const expected = (await readFile(new URL('local-arena-protocol.sha256', base), 'utf8')).trim();
const actual = createHash('sha256').update(bytes).digest('hex');
if (actual !== expected) throw Error('Local Arena protocol changed; run scripts/sync-arena-protocol.mjs and synchronize the panel.');
