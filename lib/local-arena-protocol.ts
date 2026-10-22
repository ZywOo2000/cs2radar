// Shared with the Local Arena panel. This wire format contains summaries only.
export const ARENA_SCHEMA = 'cs2-radar.local-arena';
export const ARENA_MODEL = 'local-arena-offline-v1';
export const ARENA_LABEL = 'Local Arena · 本机离线对局';
export const ARENA_MAX_BYTES = 256 * 1024;
export const ARENA_URL_LIMIT = 1800;
export const ARENA_TARGETS = ['https://cs2shuju.top/', 'https://cs2-radar-lab.moaniq12.chatgpt.site/'] as const;
export type ArenaRaw = {
  rounds: number; kills: number; deaths: number; assists: number; damage: number; headshots: number;
  survivedRounds?: number; kastRounds?: number; multikill2?: number; multikill3?: number;
  multikill4?: number; multikill5?: number; tradeKills?: number; clutchAttempts?: number; clutchesWon?: number;
};
export type ArenaPlayer = {
  id: string; name: string; teamId: 'A' | 'B' | ''; isBot: boolean;
  raw: ArenaRaw; rating?: number; warnings: string[];
};
export type ArenaPacket = {
  schema: typeof ARENA_SCHEMA; version: 1; appVersion: string; ratingModel: typeof ARENA_MODEL;
  preferredPlayerId: string; warnings: string[];
  match: { id: string; map: string; startedAt: string; endedAt: string | null;
    endReason: string | null; rounds: number; teamAScore: number; teamBScore: number; partial: boolean };
  players: ArenaPlayer[];
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('雷达数据对象格式无效。');
  return value as Record<string, unknown>;
};
const string = (value: unknown, max = 160) => {
  if (typeof value !== 'string' || value.length > max) throw Error('雷达数据文字字段无效或过长。');
  return value;
};
const integer = (value: unknown, max = 1_000_000_000) => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max)
    throw Error('雷达数据计数字段无效。');
  return value;
};
const warnings = (value: unknown) => {
  if (!Array.isArray(value) || value.length > 32) throw Error('数据质量说明格式无效。');
  return value.map(v => string(v, 500));
};
export function parseArenaPacket(input: unknown): ArenaPacket {
  const p = object(input);
  if (p.schema !== ARENA_SCHEMA || p.version !== 1 || p.ratingModel !== ARENA_MODEL)
    throw Error('不支持此 Local Arena 雷达数据版本。');
  const m = object(p.match), rounds = integer(m.rounds, 10000);
  if (!rounds) throw Error('对局没有有效回合。');
  if (!Array.isArray(p.players) || !p.players.length || p.players.length > 64)
    throw Error('对局选手数量无效。');
  const ids = new Set<string>();
  const players = p.players.map(value => {
    const q = object(value), r = object(q.raw), id = string(q.id, 100);
    if (!id || ids.has(id)) throw Error('对局选手标识缺失或重复。');
    ids.add(id);
    if (!['A', 'B', ''].includes(String(q.teamId)) || typeof q.isBot !== 'boolean') throw Error('选手队伍信息无效。');
    const raw: ArenaRaw = {
      rounds: integer(r.rounds, 10000), kills: integer(r.kills), deaths: integer(r.deaths),
      assists: integer(r.assists), damage: integer(r.damage), headshots: integer(r.headshots),
    };
    if (raw.rounds !== rounds || raw.deaths > rounds || raw.headshots > raw.kills)
      throw Error('选手统计与对局回合数不一致。');
    for (const key of ['survivedRounds', 'kastRounds', 'multikill2', 'multikill3', 'multikill4', 'multikill5', 'tradeKills', 'clutchAttempts', 'clutchesWon'] as const)
      if (r[key] !== undefined && r[key] !== null) raw[key] = integer(r[key]);
    for (const key of ['survivedRounds', 'kastRounds', 'multikill2', 'multikill3', 'multikill4', 'multikill5', 'clutchAttempts', 'clutchesWon'] as const)
      if (raw[key] !== undefined && raw[key]! > rounds) throw Error('回合统计超出对局范围。');
    const mk = [raw.multikill2, raw.multikill3, raw.multikill4, raw.multikill5];
    if (mk.every(v => v !== undefined) && mk.reduce<number>((sum, v) => sum + v!, 0) > rounds)
      throw Error('多杀回合数超出对局范围。');
    if (raw.survivedRounds !== undefined && (raw.survivedRounds !== rounds - raw.deaths ||
      (raw.kastRounds !== undefined && raw.kastRounds < raw.survivedRounds))) throw Error('存活与 KAST 统计冲突。');
    if (raw.clutchesWon !== undefined && raw.clutchAttempts !== undefined && raw.clutchesWon > raw.clutchAttempts)
      throw Error('残局统计冲突。');
    let rating: number | undefined;
    if (q.rating !== undefined && q.rating !== null) {
      if (typeof q.rating !== 'number' || !Number.isFinite(q.rating) || q.rating < 0 || q.rating > 3)
        throw Error('离线 Rating 无效。');
      rating = q.rating;
    }
    return { id, name: string(q.name, 120), teamId: q.teamId as ArenaPlayer['teamId'], isBot: q.isBot,
      raw, ...(rating !== undefined ? { rating } : {}), warnings: warnings(q.warnings) };
  });
  if (typeof m.partial !== 'boolean') throw Error('对局完整性标记无效。');
  return { schema: ARENA_SCHEMA, version: 1, appVersion: string(p.appVersion, 60), ratingModel: ARENA_MODEL,
    preferredPlayerId: string(p.preferredPlayerId, 100), warnings: warnings(p.warnings), players,
    match: { id: string(m.id, 100), map: string(m.map, 120), startedAt: string(m.startedAt, 100),
      endedAt: m.endedAt === null ? null : string(m.endedAt, 100),
      endReason: m.endReason === null ? null : string(m.endReason, 100), rounds,
      teamAScore: integer(m.teamAScore, 10000), teamBScore: integer(m.teamBScore, 10000), partial: m.partial } };
}
export function parseArenaJson(text: string) {
  if (new TextEncoder().encode(text).byteLength > ARENA_MAX_BYTES) throw Error('雷达数据文件超过 256 KB。');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw Error('雷达数据不是有效的 JSON 文件。'); }
  return parseArenaPacket(value);
}
async function limitedBytes(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > ARENA_MAX_BYTES) throw Error('解压后的雷达数据超过 256 KB。');
      chunks.push(result.value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function encodeArenaUrl(packet: ArenaPacket, target: string): Promise<string> {
  if (!(ARENA_TARGETS as readonly string[]).includes(target)) throw Error('雷达网站地址未获支持。');
  if (typeof CompressionStream === 'undefined') throw Error('当前环境不支持压缩链接，请导出雷达数据文件。');
  const json = JSON.stringify(parseArenaPacket(packet));
  if (new TextEncoder().encode(json).byteLength > ARENA_MAX_BYTES) throw Error('雷达数据超过 256 KB。');
  const compressed = await limitedBytes(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip')));
  let binary = ''; for (const byte of compressed) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = `${target}#arena=${encoded}`;
  if (url.length > ARENA_URL_LIMIT) throw Error('本场摘要超过压缩链接长度限制，请使用雷达数据文件。');
  return url;
}
export async function decodeArenaFragment(hash: string): Promise<ArenaPacket> {
  const encoded = new URLSearchParams(hash.replace(/^#/, '')).get('arena');
  if (!encoded || encoded.length > 40000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw Error('雷达导入链接无效或已截断，请使用数据文件。');
  if (typeof DecompressionStream === 'undefined') throw Error('当前浏览器不支持解压，请导入雷达数据文件。');
  const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const unpacked = await limitedBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
  return parseArenaJson(new TextDecoder('utf-8', { fatal: true }).decode(unpacked));
}
