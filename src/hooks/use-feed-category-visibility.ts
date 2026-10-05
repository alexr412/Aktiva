'use client';

import { useCallback, useEffect, useState } from 'react';
import { parseHiddenFeedCategories } from '@/lib/feed-category-visibility';

const EMPTY_IDS: string[] = [];

/** Remember feed visibility on this browser separately for each signed-in account. */
export function useFeedCategoryVisibility(userId: string | undefined, knownIds: readonly string[]) {
  const storageKey = userId ? `activa-hidden-feed-categories:${userId}` : null;
  const [selection, setSelection] = useState<{ key: string | null; ids: string[] }>({ key: null, ids: EMPTY_IDS });

  useEffect(() => {
    if (!storageKey) {
      setSelection({ key: null, ids: EMPTY_IDS });
      return;
    }
    const load = () => {
      let ids: string[] = [];
      try {
        ids = parseHiddenFeedCategories(localStorage.getItem(storageKey), knownIds);
      } catch { /* Storage may be unavailable; visibility still works for this visit. */ }
      setSelection({ key: storageKey, ids });
    };
    load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey, knownIds]);

  const ready = selection.key === storageKey;
  const hiddenIds = ready ? selection.ids : EMPTY_IDS;
  const save = useCallback((ids: string[]) => {
    if (!storageKey || !ready) return;
    setSelection({ key: storageKey, ids });
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch { /* Keep the in-memory selection. */ }
  }, [storageKey, ready]);

  const toggle = useCallback((id: string) => {
    if (!knownIds.includes(id)) return;
    save(hiddenIds.includes(id) ? hiddenIds.filter(item => item !== id) : [...hiddenIds, id]);
  }, [knownIds, hiddenIds, save]);
  const showAll = useCallback(() => save([]), [save]);

  return { hiddenIds, ready, toggle, showAll };
}
