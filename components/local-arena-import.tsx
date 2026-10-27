'use client';
import { useEffect, useRef, useState } from 'react';
import type { Dataset } from '@/lib/stats';
import { ARENA_MAX_BYTES, decodeArenaFragment, parseArenaJson, type ArenaPacket } from '@/lib/local-arena-protocol';
import { createArenaImportController } from '@/lib/arena-import-controller';

export function LocalArenaImport({ dataset, currentPlayerId, disabled, onImport, onCompare, onVideo }: {
  dataset: Dataset | null; currentPlayerId: string; disabled: boolean;
  onImport: (packet: ArenaPacket) => void; onCompare: (id: string) => void; onVideo: (ids: string[]) => void;
}) {
  const [message, setMessage] = useState(''), [reading, setReading] = useState(false);
  const [other, setOther] = useState(''), [selection, setSelection] = useState<string[]>([]);
  const callback = useRef(onImport);
  callback.current = onImport;
  const controller = useRef<ReturnType<typeof createArenaImportController<ArenaPacket>> | null>(null);
  useEffect(() => {
    const task = createArenaImportController<ArenaPacket>({ busy: setReading, message: setMessage, commit: packet => callback.current(packet) });
    controller.current = task;
    const read = () => {
      const hash = window.location.hash;
      if (!new URLSearchParams(hash.slice(1)).has('arena')) { task.cancel(); return; }
      void task.run(() => decodeArenaFragment(hash), () => clearArenaHash(hash));
    };
    read(); window.addEventListener('hashchange', read);
    return () => { task.dispose(); if (controller.current === task) controller.current = null; window.removeEventListener('hashchange', read); };
  }, []);
  useEffect(() => {
    if (!dataset) return;
    const self = dataset.players.find(p => p.id === dataset.origin?.preferredPlayerId) || dataset.players.find(p => !p.isBot) || dataset.players[0];
    setOther(dataset.players.find(p => p.id !== self.id && p.team !== self.team)?.id || dataset.players.find(p => p.id !== self.id)?.id || '');
    const teammates = dataset.players.filter(p => p.id !== self.id && p.team === self.team);
    setSelection([self.id, ...teammates.map(p => p.id)].slice(0, 5));
  }, [dataset]);
  const locked = disabled || reading;
  return <section className="arena-import" aria-label="Local Arena 本地对局导入">
    <div className="arena-import-heading"><div><strong>Local Arena 本地对局</strong><p>从软件一键生成，或导入 .radar.json 文件。无需扩展。</p></div>
      <label className="button secondary arena-file-button" aria-disabled={locked}>
        {reading ? '正在读取…' : '导入本地对局'}
        <input type="file" accept=".json,.radar.json,application/json" disabled={locked} onChange={event => {
          const input = event.currentTarget, file = input.files?.[0]; input.value = ''; if (!file) return;
          void controller.current?.run(async () => {
            if (file.size > ARENA_MAX_BYTES) throw Error('雷达数据文件超过 256 KB。');
            return parseArenaJson(await file.text());
          });
        }} />
      </label>
    </div>
    {message && <output role="status" className="arena-message">{message}</output>}
    {dataset && <details className="arena-roster" open>
      <summary>{dataset.title} · {dataset.players.length} 位选手</summary>
      <p className="muted small">本机离线统计 · Rating 使用 Local Arena 自定义模型</p>
      <div className="arena-compare"><label>同场对手<select value={other} disabled={locked} onChange={event => setOther(event.target.value)}>
        <option value="">选择一位选手</option>{dataset.players.map(p => <option value={p.id} key={p.id}>{p.name} · {p.team}{p.isBot ? ' · BOT' : ''}</option>)}
      </select></label><button className="button secondary" disabled={locked || !other || other === currentPlayerId} onClick={() => onCompare(other)}>同场双人对比</button></div>
      <fieldset disabled={locked}><legend>本场视频选人（2–5 人，按勾选顺序）</legend><div className="arena-players">
        {dataset.players.map(p => <label key={p.id}><input type="checkbox" checked={selection.includes(p.id)} disabled={locked || (!selection.includes(p.id) && selection.length >= 5)} onChange={() => setSelection(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])} />{selection.includes(p.id) && <span>{selection.indexOf(p.id) + 1}.</span>}{p.name}<small>{p.team}{p.isBot ? ' · BOT' : ''}</small></label>)}
      </div><button className="button secondary" disabled={locked || selection.length < 2 || selection.length > 5} onClick={() => onVideo(selection)}>使用所选 {selection.length} 人制作视频</button></fieldset>
      {dataset.notes.slice(1).map((note, i) => <p className="arena-quality" key={i}>{note}</p>)}
    </details>}
  </section>;
}

function clearArenaHash(consumed: string) {
  // Remove the summary only after a successful import. No request uses it.
  if (window.location.hash !== consumed) return;
  const params = new URLSearchParams(window.location.hash.slice(1)); params.delete('arena');
  const rest = params.toString();
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + (rest ? '#' + rest : ''));
}
