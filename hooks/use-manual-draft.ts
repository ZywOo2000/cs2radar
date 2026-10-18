'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createManualDraftStore } from '@/lib/manual-draft-store';

export function useManualDraft() {
  const [store] = useState(() => createManualDraftStore(() => localStorage));
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  useEffect(() => store.load(), [store]);
  return { ...snapshot, setDraft: store.setDraft };
}
