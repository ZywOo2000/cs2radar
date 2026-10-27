'use client';
import { useEffect, useRef } from 'react';
import { createRadarTools, type RadarTool, type RadarToolState } from '@/lib/radar-model-tools';

export function useRadarModelTools(state: RadarToolState) {
  const latest = useRef(state);
  useEffect(() => { latest.current = state; });
  useEffect(() => {
    const ctx = (document as Document & { modelContext?: {
      registerTool: (tool: RadarTool, options: { signal: AbortSignal }) => void | Promise<void>;
    } }).modelContext;
    if (!ctx?.registerTool) return;
    const life = new AbortController();
    for (const tool of createRadarTools(() => latest.current)) {
      try { void Promise.resolve(ctx.registerTool(tool, { signal: life.signal })).catch(() => {}); }
      catch { /* WebMCP support is optional. */ }
    }
    return () => life.abort();
  }, [state.store]);
}
