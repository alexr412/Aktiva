'use client';

import { getMessaging, getToken, onMessage, deleteToken } from "firebase/messaging";
import { app } from "./client";

// NOTE: Single-Device-Limitation: FCM token is stored as a single string field on the user profile document (users/{uid}.fcmToken). Multiple active devices are not concurrently supported.

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
 * Löscht das aktuelle FCM-Token best-effort aus dem FCM-Backend.
 */
export const deleteFCMToken = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !app) return false;
  try {
    const messaging = getMessaging(app);
    return await deleteToken(messaging);
  } catch (error) {
    console.warn("FCM Token deletion failed:", error);
    return false;
  }
};

/**
 * Listener für Nachrichten im Vordergrund.
 */
export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (typeof window === 'undefined' || !app) return;
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
};
