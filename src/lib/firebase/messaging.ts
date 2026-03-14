'use client';

import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "./client";

/**
 * Fordert Berechtigungen für Benachrichtigungen an und gibt den FCM-Token zurück.
 */
export const requestAndGetFCMToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || !app) return null;

  try {
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Hinweis: vapidKey muss aus der Firebase Console generiert werden.
      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      });
      return token;
    }
  } catch (error) {
    console.warn("FCM Token retrieval failed:", error);
  }
  return null;
};

/**
 * Listener für Nachrichten im Vordergrund.
 */
export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (typeof window === 'undefined' || !app) return;
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
};
