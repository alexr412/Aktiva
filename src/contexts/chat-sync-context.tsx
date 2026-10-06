'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import type { Activity, Chat } from '@/lib/types';
import { collection, doc, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import { hydrateActivityChatMetadata } from '@/lib/chat-activity-metadata';
import { getCachedChats, upsertCachedChats, deleteCachedChat, clearCachedMessagesForChat, deleteCachedActivity } from '@/lib/db/indexed-db';

interface ChatSyncContextType {
  chats: Chat[];
  loading: boolean;
  error: Error | null;
  unreadTotal: number;
  getChatById: (chatId: string) => Chat | undefined;
  cacheHydrated: boolean;
  remoteLoading: boolean;
  lastSyncedAt: number | null;
  retry: () => void;
}

const ChatSyncContext = createContext<ChatSyncContextType | undefined>(undefined);

export function ChatSyncProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const userId = user?.uid;
  const hiddenEntityKey = JSON.stringify(userProfile?.hiddenEntityIds || []);

  useEffect(() => {
    // Immediately wipe in-memory state on user change to prevent leakage
    setChats([]);
    setUnreadTotal(0);
    setCacheHydrated(false);
    setLastSyncedAt(null);
    setError(null);
    setLoading(!!userId);

    if (!user || !db) {
      setRemoteLoading(false);
      setLoading(false);
      return;
    }

    setRemoteLoading(true);
    let active = true;
    let revision = 0;
    let cacheWrites: Promise<void> = Promise.resolve();
    const hiddenEntityIds: string[] = JSON.parse(hiddenEntityKey);
    const activityMetadata = new Map<string, Promise<Partial<Activity> | null>>();
    const hydrateChat = (chat: Chat) => hydrateActivityChatMetadata(chat, (activityId) => {
      let pending = activityMetadata.get(activityId);
      if (!pending) {
        pending = getDoc(doc(db!, 'activities', activityId))
          .then(async snapshot => {
            if (!snapshot.exists()) return null;
            const activity = snapshot.data() as Partial<Activity>;
            if (activity.placeId && activity.placeId !== 'custom' && !activity.placeCategories?.length) {
              const place = await getDoc(doc(db!, 'places', activity.placeId)).catch(() => null);
              if (place?.exists()) return { ...activity, placeCategories: place.data().categories || [] };
            }
            return activity;
          })
          .catch(() => null);
        activityMetadata.set(activityId, pending);
      }
      return pending;
    });

    // Visibility filter helper
    const shouldDisplayChat = (chat: Chat) => {
      if (chat.activityId && hiddenEntityIds.includes(chat.activityId)) return false;
      
      const isDM = !chat.activityId;
      if (isDM) {
        const otherUserId = chat.participantIds.find((id) => id !== user!.uid);
        if (otherUserId && hiddenEntityIds.includes(otherUserId)) return false;
      }
      return true;
    };

    const publish = (visibleChats: Chat[]) => {
      visibleChats.sort((a, b) => (b.lastMessage?.sentAt?.toMillis() || b.createdAt?.toMillis() || 0)
        - (a.lastMessage?.sentAt?.toMillis() || a.createdAt?.toMillis() || 0));
      setChats(visibleChats);
      setUnreadTotal(visibleChats.reduce((sum, chat) => sum + (chat.unreadCount?.[userId!] || 0), 0));
    };

    async function loadCache() {
      // 1. First, load cached chats from IndexedDB
      try {
        const cached = await getCachedChats(user!.uid);
        if (active && revision === 0) {
          // Filter cached chats using the visibility rules to prevent flashing hidden/blocked chats
          const visibleCached = cached.filter(shouldDisplayChat);
          publish(visibleCached);
          setCacheHydrated(true);
          // If we have cached chats, stop displaying a fullscreen skeleton
          if (visibleCached.length > 0) {
            setLoading(false);
          }
          const hydrated = await Promise.all(visibleCached.map(hydrateChat));
          if (active && revision === 0) publish(hydrated);
        }
      } catch (err) {
        console.error('Error loading cached chats in ChatSyncProvider:', err);
      }

    }
    void loadCache();

      // Start the listener immediately; neither IndexedDB nor metadata delay it.
      const q = query(
        collection(db!, 'chats'),
        where('participantIds', 'array-contains', user!.uid)
      );

      const unsubscribe = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (querySnapshot) => {
          if (!active) return;
          // An empty SDK cache is not evidence that the account has no chats.
          if (querySnapshot.metadata.fromCache && querySnapshot.empty) return;
          const currentRevision = ++revision;

          const userChats = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Chat));



          const visibleChats = userChats.filter(shouldDisplayChat);
          publish(visibleChats);
          setLoading(querySnapshot.metadata.fromCache && visibleChats.length === 0);
          setCacheHydrated(true);
          setRemoteLoading(querySnapshot.metadata.fromCache);
          if (!querySnapshot.metadata.fromCache) setLastSyncedAt(Date.now());
          setError(null);

          // Serialize cache writes so an older snapshot cannot restore deleted chats.
          const hydration = Promise.all(visibleChats.map(hydrateChat));
          void hydration.then(hydrated => {
            if (active && currentRevision === revision) publish(hydrated);
          });
          cacheWrites = cacheWrites.then(async () => {
          const hydrated = await hydration;
          if (!active || currentRevision !== revision) return;
          // Reconcile the full authoritative snapshot, including removals in skipped revisions.
          if (!querySnapshot.metadata.fromCache) {
            const retained = new Set(visibleChats.map(chat => chat.id));
            const previous = await getCachedChats(userId!);
            for (const chat of previous) {
              if (!active || currentRevision !== revision) return;
              if (!retained.has(chat.id)) {
                await deleteCachedChat(userId!, chat.id);
                await clearCachedMessagesForChat(userId!, chat.id);
                if (chat.activityId) await deleteCachedActivity(userId!, chat.activityId);
              }
            }
          }

          // Apply visibility filtering to display set
          if (active && currentRevision === revision && hydrated.length) await upsertCachedChats(userId!, hydrated);
          }).catch(err => console.error('Error updating chat cache:', err));
        },
        (err) => {
          if (!active) return;
          console.error('Error fetching chats in ChatSyncContext:', err);
          setError(err as Error);
          setLoading(false);
          setRemoteLoading(false);
        }
      );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, hiddenEntityKey, retryVersion]);

  const getChatById = (chatId: string) => {
    return chats.find((c) => c.id === chatId);
  };

  return (
    <ChatSyncContext.Provider
      value={{
        chats,
        loading,
        error,
        unreadTotal,
        getChatById,
        cacheHydrated,
        remoteLoading,
        lastSyncedAt,
        retry: () => setRetryVersion(version => version + 1),
      }}
    >
      {children}
    </ChatSyncContext.Provider>
  );
}

export function useChatSync() {
  const context = useContext(ChatSyncContext);
  if (context === undefined) {
    throw new Error('useChatSync must be used within a ChatSyncProvider');
  }
  return context;
}
