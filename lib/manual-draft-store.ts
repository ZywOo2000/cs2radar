import {
  emptyManual,
  MANUAL_STORAGE_KEY,
  restoreManual,
  type ManualDraft,
} from './manual-data';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
type Snapshot = { draft: ManualDraft; loaded: boolean; storageMessage: string };

export function createManualDraftStore(storage: () => Storage) {
  let snapshot: Snapshot = {
    draft: emptyManual(),
    loaded: false,
    storageMessage: '',
  };
  const serverSnapshot = snapshot;
  const listeners = new Set<() => void>();
  const emit = (next: Snapshot) => {
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
          draft: restoreManual(storage().getItem(MANUAL_STORAGE_KEY)),
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
      action: ManualDraft | ((previous: ManualDraft) => ManualDraft),
    ) {
      if (!snapshot.loaded) return;
      const draft =
        typeof action === 'function' ? action(snapshot.draft) : action;
      let storageMessage = '';
      try {
        storage().setItem(MANUAL_STORAGE_KEY, JSON.stringify(draft));
      } catch {
        storageMessage = '本机存储不可用，当前数据仅在本页保留，请先导出。';
      }
      emit({ draft, loaded: true, storageMessage });
    },
  };
}
