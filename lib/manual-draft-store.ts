import {
  emptyManual,
  MANUAL_STORAGE_KEY,
  restoreManual,
  type ManualDraft,
} from './manual-data';
import { emptyManualSide, emptyManualWorkspace, MANUAL_WORKSPACE_KEY, restoreManualWorkspace, type ManualSide, type ManualMode } from './manual-comparison';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
type Snapshot<T> = { draft: T; loaded: boolean; storageMessage: string };

function createPersistedDraftStore<T>(storage: () => Storage, key: string, initial: T, read: (db: Storage) => T) {
  let snapshot: Snapshot<T> = {
    draft: initial,
    loaded: false,
    storageMessage: '',
  };
  const serverSnapshot = snapshot;
  const listeners = new Set<() => void>();
  const emit = (next: Snapshot<T>) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe(this: void, listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load(this: void) {
      if (snapshot.loaded) return;
      try {
        emit({
          draft: read(storage()),
          loaded: true,
          storageMessage: '',
        });
      } catch {
        // Reading must not overwrite a corrupt or temporarily inaccessible draft.
        emit({
          ...snapshot,
          loaded: true,
          storageMessage: '草稿读取失败或格式损坏，当前填写仍可使用。',
        });
      }
    },
    setDraft(
      this: void,
      action: T | ((previous: T) => T),
    ) {
      if (!snapshot.loaded) return;
      const draft =
        typeof action === 'function' ? (action as (previous: T) => T)(snapshot.draft) : action;
      let storageMessage = '';
      try {
        storage().setItem(key, JSON.stringify(draft));
      } catch {
        storageMessage = '本机存储不可用，当前数据仅在本页保留，请先导出。';
      }
      emit({ draft, loaded: true, storageMessage });
    },
  };
}

// Retain the original store contract for existing callers.
export function createManualDraftStore(storage: () => Storage) {
  return createPersistedDraftStore(storage, MANUAL_STORAGE_KEY, emptyManual(),
    db => restoreManual(db.getItem(MANUAL_STORAGE_KEY)));
}

export function createManualWorkspaceStore(storage: () => Storage) {
  const store = createPersistedDraftStore(storage, MANUAL_WORKSPACE_KEY, emptyManualWorkspace(), db => {
    const current = db.getItem(MANUAL_WORKSPACE_KEY);
    return restoreManualWorkspace(current, current === null ? db.getItem(MANUAL_STORAGE_KEY) : null);
  });
  const setSideDraft = (side: ManualSide, action: ManualDraft | ((previous: ManualDraft) => ManualDraft)) =>
    store.setDraft(previous => ({ ...previous, drafts: { ...previous.drafts,
      [side]: typeof action === 'function' ? action(previous.drafts[side]) : action } }));
  return {
    ...store,
    setSideDraft,
    setA: (action: ManualDraft | ((previous: ManualDraft) => ManualDraft)) => setSideDraft('A', action),
    setMode: (mode: ManualMode) => store.setDraft(previous => ({ ...previous, mode })),
    swap: () => store.setDraft(previous => ({ ...previous, drafts: { A: previous.drafts.B, B: previous.drafts.A } })),
    clearSide: (side: ManualSide) => setSideDraft(side, emptyManualSide(side)),
  };
}
