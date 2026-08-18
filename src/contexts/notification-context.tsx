'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { collection, doc, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { normalizeNotification, formatUnreadBadge } from '@/lib/types';
import { markNotificationAsRead, markAllNotificationsAsRead, deleteNotification as deleteNotificationFn } from '@/lib/firebase/firestore';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadBadgeLabel: string;
  loading: boolean;
  isInitialSnapshotDone: boolean;
  newNotificationEvents: Notification[];
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  unreadBadgeLabel: '',
  loading: true,
  isInitialSnapshotDone: false,
  newNotificationEvents: [],
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  deleteNotification: async () => {},
});

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialSnapshotDone, setIsInitialSnapshotDone] = useState(false);
  const [newNotificationEvents, setNewNotificationEvents] = useState<Notification[]>([]);

  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !db) {
      setNotifications([]);
      setTotalUnreadCount(0);
      setLoading(false);
      setIsInitialSnapshotDone(false);
      setNewNotificationEvents([]);
      return;
    }

    setLoading(true);

    const database = db;
    const metaRef = doc(database, 'users', user.uid, 'notification_meta', 'state');
    let unsubscribeUnreadQuery: (() => void) | null = null;

    const unsubscribeMeta = onSnapshot(
      metaRef,
      (metaSnap: any) => {
        if (metaSnap.exists() && typeof metaSnap.data().unreadCount === 'number') {
          setTotalUnreadCount(Math.max(0, metaSnap.data().unreadCount));
          if (unsubscribeUnreadQuery) {
            unsubscribeUnreadQuery();
            unsubscribeUnreadQuery = null;
          }
        } else {
          // Fallback to unread query if notification_meta doc is not yet created
          if (!unsubscribeUnreadQuery) {
            const unreadQuery = query(
              collection(database, 'notifications'),
              where('recipientId', '==', user.uid),
              where('isRead', '==', false)
            );
            unsubscribeUnreadQuery = onSnapshot(unreadQuery, (snap: any) => {
              setTotalUnreadCount(snap.size);
            });
          }
        }
      },
      (error: any) => {
        console.error('Error listening to notification_meta state:', error);
      }
    );

    // 2. Visible Inbox query (limited to 30 items)
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    let initialLoadCompleted = false;

    const unsubscribeInbox = onSnapshot(
      q,
      (snapshot) => {
        const parsedNotifications = snapshot.docs.map((docSnap) =>
          normalizeNotification({
            id: docSnap.id,
            ...docSnap.data(),
          })
        );

        if (!initialLoadCompleted) {
          initialLoadCompleted = true;
          setNotifications(parsedNotifications);
          setIsInitialSnapshotDone(true);
          setLoading(false);
        } else {
          // Detect truly newly added documents post-initial load
          const newlyAddedDocs: Notification[] = [];
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const normalized = normalizeNotification({
                id: change.doc.id,
                ...change.doc.data(),
              });
              newlyAddedDocs.push(normalized);
            }
          });

          setNotifications(parsedNotifications);
          if (newlyAddedDocs.length > 0) {
            setNewNotificationEvents((prev) => [...prev, ...newlyAddedDocs]);
          }
        }
      },
      (error) => {
        console.error('Error listening to notifications:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeMeta();
      if (unsubscribeUnreadQuery) unsubscribeUnreadQuery();
      unsubscribeInbox();
    };
  }, [user]);

  const unreadCount = totalUnreadCount;

  const unreadBadgeLabel = useMemo(
    () => formatUnreadBadge(unreadCount),
    [unreadCount]
  );

  const handleMarkAsRead = async (notificationId: string) => {
    if (!notificationId) return;
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    try {
      await markNotificationAsRead(notificationId);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllNotificationsAsRead(user.uid);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!notificationId) return;
    const target = notifications.find((n) => n.id === notificationId);
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    if (target && !target.isRead) {
      setTotalUnreadCount((prev) => Math.max(0, prev - 1));
    }
    try {
      await deleteNotificationFn(notificationId);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadBadgeLabel,
        loading,
        isInitialSnapshotDone,
        newNotificationEvents,
        markAsRead: handleMarkAsRead,
        markAllAsRead: handleMarkAllAsRead,
        deleteNotification: handleDeleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
