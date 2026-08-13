'use client';

import { useEffect, useState, useRef } from 'react';
import { useNotifications } from '@/contexts/notification-context';
import { useAuth } from '@/hooks/use-auth';
import type { Notification } from '@/lib/types';
import { getEffectiveNotificationPreferences } from '@/lib/types';
import { InAppNotificationBanner } from './InAppNotificationBanner';
import { playNotificationSound } from '@/lib/audio-chime';

function claimForegroundPresentation(notificationId: string): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return true;

  const tabId = (window as any).__activa_tab_id || ((window as any).__activa_tab_id = Math.random().toString(36).slice(2));
  const claimKey = `activa_fg_claim_${notificationId}`;
  const now = Date.now();
  const TTL_MS = 5000;

  // Cleanup old claim keys
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('activa_fg_claim_')) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || '{}');
          if (item.timestamp && now - item.timestamp > 10000) {
            keysToRemove.push(key);
          }
        } catch (e) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {}

  // Check existing claim
  try {
    const existingStr = localStorage.getItem(claimKey);
    if (existingStr) {
      const existing = JSON.parse(existingStr);
      if (existing.timestamp && now - existing.timestamp < TTL_MS && existing.tabId !== tabId) {
        return false;
      }
    }

    localStorage.setItem(claimKey, JSON.stringify({ tabId, timestamp: now }));
    return true;
  } catch (e) {
    return true;
  }
}

export function InAppNotificationContainer() {
  const { userProfile } = useAuth();
  const { newNotificationEvents, isInitialSnapshotDone } = useNotifications();
  const [activeBanners, setActiveBanners] = useState<Notification[]>([]);
  const processedNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isInitialSnapshotDone || newNotificationEvents.length === 0) return;

    const latestEvent = newNotificationEvents[newNotificationEvents.length - 1];
    if (!latestEvent || !latestEvent.id) return;

    // 1. Idempotency check: process each notificationId only once per client instance
    if (processedNotificationIdsRef.current.has(latestEvent.id)) return;
    processedNotificationIdsRef.current.add(latestEvent.id);

    // 2. Tab Visibility Check: only present foreground banners if document is visible
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }

    // 3. Category Preference Check
    const effectivePrefs = getEffectiveNotificationPreferences(userProfile);

    let isCategoryEnabled = true;
    switch (latestEvent.type) {
      case 'friend_request':
        isCategoryEnabled = effectivePrefs.friendRequests;
        break;
      case 'friend_accepted':
        isCategoryEnabled = effectivePrefs.friendAccepted;
        break;
      case 'chat_message':
      case 'chat_request':
        isCategoryEnabled = effectivePrefs.chatMessages;
        break;
      case 'activity_join_request':
      case 'join_request':
        isCategoryEnabled = effectivePrefs.activityRequests;
        break;
      case 'activity_join_response':
      case 'join_response':
      case 'activity_update':
        isCategoryEnabled = effectivePrefs.activityParticipants || effectivePrefs.activityUpdates;
        break;
      case 'activity_reminder':
        isCategoryEnabled = effectivePrefs.activityReminders;
        break;
      case 'nearby_activity':
      case 'nearby_spot':
        isCategoryEnabled = effectivePrefs.nearbyActivities ?? effectivePrefs.nearbySpots ?? true;
        break;
      case 'recommendation':
        isCategoryEnabled = effectivePrefs.recommendations;
        break;
      case 'engagement_reminder':
        isCategoryEnabled = effectivePrefs.engagementReminders;
        break;
      case 'system':
      default:
        isCategoryEnabled = true;
    }

    if (!isCategoryEnabled) return;

    // 4. Cross-Tab Deduplizierung (BroadcastChannel primary + localStorage TTL Lock fallback)
    let shouldClaim = true;

    // Check localStorage TTL Lock
    if (!claimForegroundPresentation(latestEvent.id)) {
      shouldClaim = false;
    }

    // BroadcastChannel fast channel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('activa_fg_notifications');
        if (document.hasFocus()) {
          channel.postMessage({
            type: 'CLAIM_PRESENTATION',
            id: latestEvent.id,
            timestamp: Date.now()
          });
        }
        setTimeout(() => channel.close(), 1000);
      }
    } catch (e) {}

    if (!shouldClaim) return;

    // 5. Present Banner (Max 3 in stack)
    setActiveBanners((prev) => {
      if (prev.some((b) => b.id === latestEvent.id)) return prev;
      const next = [latestEvent, ...prev];
      return next.slice(0, 3);
    });

    // 6. Play Notification Chime Sound if enabled
    if (effectivePrefs.soundEnabled) {
      playNotificationSound();
    }
  }, [newNotificationEvents, isInitialSnapshotDone, userProfile]);

  const handleClose = (id: string) => {
    setActiveBanners((prev) => prev.filter((b) => b.id !== id));
  };

  if (activeBanners.length === 0) return null;

  return (
    <div 
      className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[100] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {activeBanners.map((notification) => (
        <div key={notification.id} className="pointer-events-auto w-full flex justify-end">
          <InAppNotificationBanner
            notification={notification}
            onClose={handleClose}
          />
        </div>
      ))}
    </div>
  );
}
