'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createManualWorkspaceStore } from '@/lib/manual-draft-store';

export function useManualDraft() {
  const [store] = useState(() => createManualWorkspaceStore(() => localStorage));
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  useEffect(() => store.load(), [store]);
  return { ...snapshot, workspace: snapshot.draft, draft: snapshot.draft.drafts.A,
    setDraft: store.setA, setSideDraft: store.setSideDraft, setMode: store.setMode,
    swap: store.swap, clearSide: store.clearSide };
}
