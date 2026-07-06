'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import type { Chat } from '@/lib/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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

  useEffect(() => {
    // Immediately wipe in-memory state on user change to prevent leakage
    setChats([]);
    setUnreadTotal(0);
    setCacheHydrated(false);
    setLastSyncedAt(null);

    if (!user || !db) {
      setRemoteLoading(false);
      setLoading(false);
      return;
    }

    setRemoteLoading(true);
    let active = true;

    // Visibility filter helper
    const shouldDisplayChat = (chat: Chat) => {
      if (!userProfile?.hiddenEntityIds) return true;
      if (chat.activityId && userProfile.hiddenEntityIds.includes(chat.activityId)) return false;
      
      const isDM = !chat.activityId;
      if (isDM) {
        const otherUserId = chat.participantIds.find((id) => id !== user!.uid);
        if (otherUserId && userProfile.hiddenEntityIds.includes(otherUserId)) return false;
      }
      return true;
    };

    async function loadCacheAndSync() {
      // 1. First, load cached chats from IndexedDB
      try {
        const cached = await getCachedChats(user!.uid);
        if (active) {
          // Filter cached chats using the visibility rules to prevent flashing hidden/blocked chats
          const visibleCached = cached.filter(shouldDisplayChat);
          const total = visibleCached.reduce((sum, chat) => sum + (chat.unreadCount?.[user!.uid] || 0), 0);
          setChats(visibleCached);
          setUnreadTotal(total);
          setCacheHydrated(true);
          // If we have cached chats, stop displaying a fullscreen skeleton
          if (visibleCached.length > 0) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error loading cached chats in ChatSyncProvider:', err);
      }

      if (!active) return;

      // 2. Start Firestore Listener
      const q = query(
        collection(db!, 'chats'),
        where('participantIds', 'array-contains', user!.uid)
      );

      const unsubscribe = onSnapshot(
        q,
        async (querySnapshot) => {
          if (!active) return;

          const userChats = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as Chat));



          // Process document removals and modifications to keep cache clean
          for (const change of querySnapshot.docChanges()) {
            const docId = change.doc.id;
            if (change.type === 'removed') {
              await deleteCachedChat(user!.uid, docId);
              await clearCachedMessagesForChat(user!.uid, docId);
              const chatData = change.doc.data();
              if (chatData?.activityId) {
                await deleteCachedActivity(user!.uid, chatData.activityId);
              }
            } else {
              // added or modified - check if visibility rules hide it now
              const chat = { id: docId, ...change.doc.data() } as Chat;
              if (!shouldDisplayChat(chat)) {
                await deleteCachedChat(user!.uid, docId);
                await clearCachedMessagesForChat(user!.uid, docId);
                if (chat.activityId) {
                  await deleteCachedActivity(user!.uid, chat.activityId);
                }
              }
            }
          }

          // Apply visibility filtering to display set
          const visibleChats = userChats.filter(shouldDisplayChat);

          // Update IndexedDB cache with the updated list of visible chats
          if (visibleChats.length > 0) {
            await upsertCachedChats(user!.uid, visibleChats);
          }

          // Sort visible chats by latest message or creation date
          visibleChats.sort((a, b) => {
            const aTime = a.lastMessage?.sentAt?.toMillis() || a.createdAt?.toMillis() || 0;
            const bTime = b.lastMessage?.sentAt?.toMillis() || b.createdAt?.toMillis() || 0;
            return bTime - aTime;
          });

          // Calculate unreadTotal count
          const total = visibleChats.reduce((sum, chat) => {
            return sum + (chat.unreadCount?.[user!.uid] || 0);
          }, 0);

          setChats(visibleChats);
          setUnreadTotal(total);
          setLoading(false);
          setRemoteLoading(false);
          setLastSyncedAt(Date.now());
          setError(null);
        },
        (err) => {
          console.error('Error fetching chats in ChatSyncContext:', err);
          setError(err as Error);
          setLoading(false);
          setRemoteLoading(false);
        }
      );

      return unsubscribe;
    }

    const unsubPromise = loadCacheAndSync();

    return () => {
      active = false;
      unsubPromise.then((unsub) => {
        if (unsub) unsub();
      });
    };
  }, [user, userProfile]);

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
