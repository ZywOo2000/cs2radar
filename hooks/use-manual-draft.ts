'use client';
import { useEffect, useState } from 'react';
import { emptyManual, MANUAL_STORAGE_KEY, restoreManual } from '@/lib/manual-data';

export function useManualDraft() {
  const [draft, setDraft] = useState(emptyManual);
  const [loaded, setLoaded] = useState(false);
  const [storageMessage, setStorageMessage] = useState('');
  useEffect(() => {
    try { setDraft(restoreManual(localStorage.getItem(MANUAL_STORAGE_KEY))); }
    catch { setStorageMessage('草稿读取失败或格式损坏，当前填写仍可使用。'); }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(MANUAL_STORAGE_KEY, JSON.stringify(draft)); }
    catch { setStorageMessage('本机存储不可用，当前数据仅在本页保留，请先导出。'); }
  }, [draft, loaded]);
  return { draft, setDraft, loaded, storageMessage };
}
