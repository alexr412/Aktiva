'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { parseHiddenFeedCategories } from '@/lib/feed-category-visibility';
import { normalizeFeedPreferences, type FeedPreferences } from '@/lib/feed-preferences';
import type { FeedSortMode } from '@/lib/feed-sort';

type Field = keyof FeedPreferences;
const DEFAULT: FeedPreferences = { sortBy: 'recommended', hiddenCategoryIds: [] };

/** Per-account local cache plus live synchronization; dotted writes preserve unrelated settings. */
export function useFeedCategoryVisibility(userId: string | undefined, knownIds: readonly string[]) {
  const storageKey = userId ? `activa-feed-preferences:${userId}` : 'activa-feed-preferences:guest';
  const [selection, setSelection] = useState<{ key: string | null; value: FeedPreferences }>({ key: null, value: DEFAULT });
  const [syncError, setSyncError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const actions = useRef<{ key: string; change: (field: Field, value: FeedPreferences[Field]) => void } | null>(null);

  useEffect(() => {
    actions.current = null;
    setSyncError(false);
    let active = true;
    let connected = false;
    let writing = false;
    let version = 0;
    let value = DEFAULT;
    let migrationPending = false;
    const pending = new Map<Field, number>();
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const stored = JSON.parse(raw);
        value = normalizeFeedPreferences(stored, knownIds);
        migrationPending = stored.migrationPending === true;
        for (const field of ['sortBy', 'hiddenCategoryIds'] as Field[]) {
          if (stored.pending?.includes(field)) pending.set(field, ++version);
        }
      } else {
        const legacy = userId ? localStorage.getItem(`activa-hidden-feed-categories:${userId}`) : null;
        if (legacy !== null) {
          value = { ...DEFAULT, hiddenCategoryIds: parseHiddenFeedCategories(legacy, knownIds) };
          pending.set('hiddenCategoryIds', ++version);
          migrationPending = true;
        }
      }
    } catch { /* The in-memory selection still works if browser storage is unavailable. */ }

    const publish = () => {
      if (!active) return;
      setSelection({ key: storageKey, value });
      try { localStorage.setItem(storageKey, JSON.stringify({ ...value, pending: [...pending.keys()], migrationPending })); } catch { /* Optional local cache. */ }
    };
    const flush = async () => {
      if (!active || !connected || writing || !db || !userId || !pending.size) return;
      writing = true;
      const sent = new Map(pending);
      const patch: Record<string, FeedPreferences[Field]> = {};
      for (const field of sent.keys()) patch[`feedPreferences.${field}`] = value[field];
      try {
        await updateDoc(doc(db, 'users', userId), patch);
        if (!active) return;
        for (const [field, sentVersion] of sent) if (pending.get(field) === sentVersion) pending.delete(field);
        if (!pending.has('hiddenCategoryIds')) migrationPending = false;
        setSyncError(false);
        publish();
      } catch {
        if (active) setSyncError(true);
        return; // Retain pending changes locally for retry or the next visit.
      } finally { writing = false; }
      if (active && pending.size) void flush();
    };
    const change = (field: Field, next: FeedPreferences[Field]) => {
      if (field === 'hiddenCategoryIds') migrationPending = false;
      value = normalizeFeedPreferences({ ...value, [field]: next }, knownIds);
      if (userId) pending.set(field, ++version);
      publish();
      void flush();
    };
    actions.current = { key: storageKey, change };
    publish();
    const unsubscribe = db && userId ? onSnapshot(doc(db, 'users', userId), { includeMetadataChanges: true }, snapshot => {
      if (!active) return;
      if (snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) return;
      const remoteData = snapshot.data()?.feedPreferences;
      // A stale browser-only setting must never replace an existing account setting.
      if (!connected && !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites && migrationPending && remoteData?.hiddenCategoryIds !== undefined) {
        pending.delete('hiddenCategoryIds');
        migrationPending = false;
      }
      const remote = normalizeFeedPreferences(remoteData, knownIds);
      value = {
        sortBy: pending.has('sortBy') ? value.sortBy : remote.sortBy,
        hiddenCategoryIds: pending.has('hiddenCategoryIds') ? value.hiddenCategoryIds : remote.hiddenCategoryIds,
      };
      publish();
      // Wait for the server before migrating a browser-only choice into the account.
      if (!snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) { connected = true; void flush(); }
    }, () => { if (active) setSyncError(true); }) : undefined;
    return () => { active = false; unsubscribe?.(); };
  }, [userId, storageKey, knownIds, retryVersion]);

  const ready = selection.key === storageKey;
  const current = ready ? selection.value : DEFAULT;
  const save = useCallback((field: Field, value: FeedPreferences[Field]) => {
    if (ready && actions.current?.key === storageKey) actions.current.change(field, value);
  }, [ready, storageKey]);
  const toggle = useCallback((id: string) => {
    if (!knownIds.includes(id)) return;
    save('hiddenCategoryIds', current.hiddenCategoryIds.includes(id)
      ? current.hiddenCategoryIds.filter(item => item !== id) : [...current.hiddenCategoryIds, id]);
  }, [knownIds, current.hiddenCategoryIds, save]);
  const showAll = useCallback(() => save('hiddenCategoryIds', []), [save]);
  const setSortBy = useCallback((sort: FeedSortMode) => save('sortBy', sort), [save]);
  return { hiddenIds: current.hiddenCategoryIds, sortBy: current.sortBy, setSortBy, ready, toggle, showAll, syncError, retrySync: () => setRetryVersion(version => version + 1) };
}
