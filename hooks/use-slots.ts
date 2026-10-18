'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createSlotStore } from '@/lib/slot-store';

export function useSlots() {
  const [store] = useState(createSlotStore);
  const slots = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => () => store.cancelAll(), [store]);
  return { slots, store };
}
