'use client';

import { openDB, IDBPDatabase } from 'idb';
import { Timestamp } from 'firebase/firestore';
import type { Chat, Message, Activity, Place } from '@/lib/types';

const DB_NAME = 'aktiva-client-cache';
const DB_VERSION = 3;

export interface SerializedChat {
  id: string;
  activityId?: string;
  hostId?: string;
  participantIds: string[];
  placeName?: string;
  placePhotoURL?: string;
  unreadCount?: { [userId: string]: number };
  lastMessage?: {
    text: string;
    senderId: string;
    senderName: string | null;
    sentAt: number | null; // Primitive millisecond value
  } | null;
  createdAt?: number | null; // Primitive millisecond value
  lastActivityAt?: number | null; // Primitive millisecond value
  [key: string]: any;
}

export interface CachedChatRecord {
  id: string; // Compound: `${userId}_${chatId}`
  userId: string;
  chatId: string;
  chat: SerializedChat;
  updatedAt: number;
  lastActivityAt: number;
  cachedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function initDB(): Promise<IDBPDatabase> | null {
  if (!isBrowser()) return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // Upgrade chats store
        let chatsStore;
        if (!db.objectStoreNames.contains('chats')) {
          chatsStore = db.createObjectStore('chats', { keyPath: 'id' });
        } else {
          chatsStore = transaction.objectStore('chats');
        }
        if (!chatsStore.indexNames.contains('userId')) {
          chatsStore.createIndex('userId', 'userId', { unique: false });
        }

        // Upgrade messages store
        let messagesStore;
        if (!db.objectStoreNames.contains('messages')) {
          messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
        } else {
          messagesStore = transaction.objectStore('messages');
        }
        if (!messagesStore.indexNames.contains('userId_chatId')) {
          messagesStore.createIndex('userId_chatId', ['userId', 'chatId'], { unique: false });
        }

        // Check and create other stores
        if (!db.objectStoreNames.contains('activities')) {
          db.createObjectStore('activities', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('places')) {
          db.createObjectStore('places', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

function serializeTimestamp(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') {
    return ts.toMillis();
  }
  if (ts instanceof Date) {
    return ts.getTime();
  }
  if (typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
  }
  if (typeof ts === 'number') {
    return ts;
  }
  return null;
}

function restoreTimestamp(val: any): Timestamp | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    try {
      return Timestamp.fromMillis(val);
    } catch (e) {
      console.error('Failed to restore timestamp from millis:', val, e);
      return null;
    }
  }
  if (typeof val.toMillis === 'function') return val;
  if (typeof val.seconds === 'number') {
    return Timestamp.fromMillis(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000));
  }
  return null;
}

export function serializeChat(chat: Chat): SerializedChat {
  const serialized: SerializedChat = {
    ...chat,
    createdAt: serializeTimestamp(chat.createdAt),
    lastActivityAt: serializeTimestamp(chat.lastActivityAt),
    lastMessage: chat.lastMessage
      ? {
          ...chat.lastMessage,
          sentAt: serializeTimestamp(chat.lastMessage.sentAt),
        }
      : null,
  };

  return serialized;
}

export function deserializeChat(serialized: SerializedChat): Chat {
  const chat: any = {
    ...serialized,
    createdAt: restoreTimestamp(serialized.createdAt),
    lastActivityAt: restoreTimestamp(serialized.lastActivityAt),
  };

  if (serialized.lastMessage) {
    chat.lastMessage = {
      ...serialized.lastMessage,
      sentAt: restoreTimestamp(serialized.lastMessage.sentAt),
    };
  }

  return chat as Chat;
}

export async function getCachedChats(userId: string): Promise<Chat[]> {
  const dbInstance = await initDB();
  if (!dbInstance) return [];
  try {
    const tx = dbInstance.transaction('chats', 'readonly');
    const index = tx.store.index('userId');
    const cachedEntries: CachedChatRecord[] = await index.getAll(userId);
    return cachedEntries.map(entry => deserializeChat(entry.chat));
  } catch (error) {
    console.error('Failed to get cached chats:', error);
    return [];
  }
}

export async function upsertCachedChats(userId: string, chats: Chat[]): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('chats', 'readwrite');
    for (const chat of chats) {
      const serializedChat = serializeChat(chat);
      
      let lastActivityAtMillis = 0;
      if (chat.lastActivityAt) {
        if (typeof chat.lastActivityAt.toMillis === 'function') lastActivityAtMillis = chat.lastActivityAt.toMillis();
        else if (chat.lastActivityAt instanceof Date) lastActivityAtMillis = chat.lastActivityAt.getTime();
        else if (typeof chat.lastActivityAt.seconds === 'number') lastActivityAtMillis = chat.lastActivityAt.seconds * 1000;
      }
      if (!lastActivityAtMillis && chat.lastMessage?.sentAt) {
        const sentAt = chat.lastMessage.sentAt;
        if (typeof sentAt.toMillis === 'function') lastActivityAtMillis = sentAt.toMillis();
        else if (sentAt instanceof Date) lastActivityAtMillis = sentAt.getTime();
        else if (typeof sentAt.seconds === 'number') lastActivityAtMillis = sentAt.seconds * 1000;
      }
      if (!lastActivityAtMillis && chat.createdAt) {
        if (typeof chat.createdAt.toMillis === 'function') lastActivityAtMillis = chat.createdAt.toMillis();
        else if (chat.createdAt instanceof Date) lastActivityAtMillis = chat.createdAt.getTime();
        else if (typeof chat.createdAt.seconds === 'number') lastActivityAtMillis = chat.createdAt.seconds * 1000;
      }

      const entry: CachedChatRecord = {
        id: `${userId}_${chat.id}`,
        userId,
        chatId: chat.id,
        chat: serializedChat,
        updatedAt: Date.now(),
        lastActivityAt: lastActivityAtMillis,
        cachedAt: Date.now()
      };
      await tx.store.put(entry);
    }
    await tx.done;
  } catch (error) {
    console.error('Failed to upsert cached chats:', error);
  }
}

export async function deleteCachedChat(userId: string, chatId: string): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('chats', 'readwrite');
    await tx.store.delete(`${userId}_${chatId}`);
    await tx.done;
  } catch (error) {
    console.error(`Failed to delete cached chat ${chatId}:`, error);
  }
}

export async function clearCachedChatsForUser(userId: string): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('chats', 'readwrite');
    const index = tx.store.index('userId');
    const keys = await index.getAllKeys(userId);
    for (const key of keys) {
      await tx.store.delete(key);
    }
    await tx.done;
  } catch (error) {
    console.error(`Failed to clear cached chats for user ${userId}:`, error);
  }
}

export async function clearAllClientCache(): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction(['chats', 'messages', 'activities', 'places'], 'readwrite');
    await tx.objectStore('chats').clear();
    await tx.objectStore('messages').clear();
    await tx.objectStore('activities').clear();
    await tx.objectStore('places').clear();
    await tx.done;
  } catch (error) {
    console.error('Failed to clear all client caches:', error);
  }
}

// ─── MESSAGE CACHING HELPERS & TYPES ─────────────────────────────────────────

export interface SerializedMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string | null;
  senderPhotoURL: string | null;
  sentAt: number; // Primitive millisecond value
  isPremium?: boolean;
  isSupporter?: boolean;
  isCreator?: boolean;
  replyToId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  isEdited?: boolean;
  editedAt?: number | null; // Primitive millisecond value
  isSystem?: boolean;
  systemType?: string;
  [key: string]: any;
}

export interface CachedMessageRecord {
  id: string; // Compound: `${userId}_${chatId}_${messageId}`
  userId: string;
  chatId: string;
  messageId: string;
  message: SerializedMessage;
  sentAtMillis: number;
  cachedAtMillis: number;
}

export function serializeMessage(msg: Message): SerializedMessage {
  return {
    ...msg,
    sentAt: serializeTimestamp(msg.sentAt) || Date.now(),
    editedAt: serializeTimestamp(msg.editedAt),
  };
}

export function deserializeMessage(serialized: SerializedMessage): Message {
  return {
    ...serialized,
    sentAt: restoreTimestamp(serialized.sentAt) || Timestamp.now(),
    editedAt: restoreTimestamp(serialized.editedAt) || undefined,
  } as Message;
}

export async function getCachedMessages(
  userId: string,
  chatId: string,
  limit?: number
): Promise<Message[]> {
  const dbInstance = await initDB();
  if (!dbInstance) return [];
  try {
    const tx = dbInstance.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('userId_chatId');
    const cachedEntries: CachedMessageRecord[] = await index.getAll(IDBKeyRange.only([userId, chatId]));
    
    // Sort by sentAtMillis ascending
    cachedEntries.sort((a, b) => a.sentAtMillis - b.sentAtMillis);
    
    // Apply limit if specified
    const resultEntries = limit && cachedEntries.length > limit
      ? cachedEntries.slice(-limit)
      : cachedEntries;

    return resultEntries.map(entry => deserializeMessage(entry.message));
  } catch (error) {
    console.error('Failed to get cached messages:', error);
    return [];
  }
}

export async function upsertCachedMessages(
  userId: string,
  chatId: string,
  messages: Message[]
): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');

    for (const msg of messages) {
      const serializedMsg = serializeMessage(msg);
      const sentAtMillis = serializedMsg.sentAt;

      const entry: CachedMessageRecord = {
        id: `${userId}_${chatId}_${msg.id}`,
        userId,
        chatId,
        messageId: msg.id,
        message: serializedMsg,
        sentAtMillis,
        cachedAtMillis: Date.now()
      };
      await store.put(entry);
    }
    await tx.done;

    // Enforce storage limit: max 200 messages per chat
    await enforceMessageLimit(userId, chatId);
  } catch (error) {
    console.error('Failed to upsert cached messages:', error);
  }
}

async function enforceMessageLimit(userId: string, chatId: string): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const index = store.index('userId_chatId');
    const cachedEntries: CachedMessageRecord[] = await index.getAll(IDBKeyRange.only([userId, chatId]));

    if (cachedEntries.length > 500) {
      // Sort oldest first (ascending by sentAtMillis, then messageId)
      cachedEntries.sort((a, b) => {
        if (a.sentAtMillis !== b.sentAtMillis) {
          return a.sentAtMillis - b.sentAtMillis;
        }
        return a.messageId.localeCompare(b.messageId);
      });
      const toDelete = cachedEntries.slice(0, cachedEntries.length - 500);
      for (const entry of toDelete) {
        await store.delete(entry.id);
      }
    }
    await tx.done;
  } catch (error) {
    console.error('Failed to enforce message limit:', error);
  }
}

export async function getCachedMessagesBefore(
  userId: string,
  chatId: string,
  beforeSentAtMillis: number,
  beforeMessageId: string,
  limit: number
): Promise<Message[]> {
  const dbInstance = await initDB();
  if (!dbInstance) return [];
  try {
    const tx = dbInstance.transaction('messages', 'readonly');
    const store = tx.objectStore('messages');
    const index = store.index('userId_chatId');
    const cachedEntries: CachedMessageRecord[] = await index.getAll(IDBKeyRange.only([userId, chatId]));

    // Filter using the robust pagination logic
    const filtered = cachedEntries.filter((entry) => {
      const isBeforeTime = entry.sentAtMillis < beforeSentAtMillis;
      const isSameTimeButBeforeId = entry.sentAtMillis === beforeSentAtMillis && entry.messageId < beforeMessageId;
      return isBeforeTime || isSameTimeButBeforeId;
    });

    // Sort descending by sentAtMillis, then messageId
    filtered.sort((a, b) => {
      if (b.sentAtMillis !== a.sentAtMillis) {
        return b.sentAtMillis - a.sentAtMillis;
      }
      return b.messageId.localeCompare(a.messageId);
    });

    // Take the page limit
    const page = filtered.slice(0, limit);

    // Return ascending for UI rendering
    page.reverse();

    return page.map((entry) => deserializeMessage(entry.message));
  } catch (error) {
    console.error('Failed to get cached messages before:', error);
    return [];
  }
}

export async function deleteCachedMessage(
  userId: string,
  chatId: string,
  messageId: string
): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('messages', 'readwrite');
    await tx.objectStore('messages').delete(`${userId}_${chatId}_${messageId}`);
    await tx.done;
  } catch (error) {
    console.error(`Failed to delete cached message ${messageId}:`, error);
  }
}

export async function clearCachedMessagesForChat(userId: string, chatId: string): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const index = store.index('userId_chatId');
    const keys = await index.getAllKeys(IDBKeyRange.only([userId, chatId]));
    for (const key of keys) {
      await store.delete(key);
    }
    await tx.done;
  } catch (error) {
    console.error(`Failed to clear cached messages for chat ${chatId}:`, error);
  }
}

export async function clearCachedMessagesForUser(userId: string): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('messages', 'readwrite');
    const store = tx.objectStore('messages');
    const index = store.index('userId_chatId');
    const keys = await index.getAllKeys(IDBKeyRange.bound([userId, ''], [userId, '\uffff']));
    for (const key of keys) {
      await store.delete(key);
    }
    await tx.done;
  } catch (error) {
    console.error(`Failed to clear cached messages for user ${userId}:`, error);
  }
}

// ─── ACTIVITY & PLACE CACHING HELPERS & TYPES ───────────────────────────────

export interface CachedActivityRecord {
  id: string; // `${userId}_${activityId}`
  userId: string;
  activityId: string;
  activity: any; // SerializedActivity
  updatedAtMillis: number;
  cachedAtMillis: number;
}

export interface CachedPlaceRecord {
  id: string; // `${userId}_${placeId}`
  userId: string;
  placeId: string;
  place: any; // SerializedPlace
  updatedAtMillis: number;
  cachedAtMillis: number;
}

export function serializeActivity(activity: Activity): any {
  const serialized: any = {
    ...activity,
    activityDate: serializeTimestamp(activity.activityDate) || Date.now(),
    activityEndDate: serializeTimestamp(activity.activityEndDate),
    createdAt: serializeTimestamp(activity.createdAt) || Date.now(),
    updatedAt: serializeTimestamp(activity.updatedAt),
    cancelledAt: serializeTimestamp(activity.cancelledAt),
    lastInteractionAt: serializeTimestamp(activity.lastInteractionAt),
  };

  if (activity.participantDetails) {
    const details: any = {};
    for (const [uid, detail] of Object.entries(activity.participantDetails)) {
      details[uid] = {
        ...detail,
        checkInTime: serializeTimestamp(detail.checkInTime),
      };
    }
    serialized.participantDetails = details;
  }

  return serialized;
}

export function deserializeActivity(serialized: any): Activity {
  const deserialized: any = {
    ...serialized,
    activityDate: restoreTimestamp(serialized.activityDate) || Timestamp.now(),
    activityEndDate: restoreTimestamp(serialized.activityEndDate) || undefined,
    createdAt: restoreTimestamp(serialized.createdAt) || Timestamp.now(),
    updatedAt: restoreTimestamp(serialized.updatedAt) || undefined,
    cancelledAt: restoreTimestamp(serialized.cancelledAt) || undefined,
    lastInteractionAt: restoreTimestamp(serialized.lastInteractionAt) || undefined,
  };

  if (serialized.participantDetails) {
    const details: any = {};
    for (const [uid, detail] of Object.entries(serialized.participantDetails)) {
      const d: any = detail;
      details[uid] = {
        ...d,
        checkInTime: restoreTimestamp(d.checkInTime) || undefined,
      };
    }
    deserialized.participantDetails = details;
  }

  return deserialized as Activity;
}

export function serializePlace(place: Place): any {
  return place;
}

export function deserializePlace(serialized: any): Place {
  return serialized as Place;
}

export async function getCachedActivity(userId: string, activityId: string): Promise<Activity | null> {
  const dbInstance = await initDB();
  if (!dbInstance) return null;
  try {
    const tx = dbInstance.transaction('activities', 'readonly');
    const record: CachedActivityRecord | undefined = await tx.objectStore('activities').get(`${userId}_${activityId}`);
    if (!record) return null;
    return deserializeActivity(record.activity);
  } catch (error) {
    console.error('Failed to get cached activity:', error);
    return null;
  }
}

export async function upsertCachedActivity(userId: string, activityId: string, activity: Activity): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('activities', 'readwrite');
    const entry: CachedActivityRecord = {
      id: `${userId}_${activityId}`,
      userId,
      activityId,
      activity: serializeActivity(activity),
      updatedAtMillis: Date.now(),
      cachedAtMillis: Date.now(),
    };
    await tx.objectStore('activities').put(entry);
    await tx.done;
  } catch (error) {
    console.error('Failed to upsert cached activity:', error);
  }
}

export async function deleteCachedActivity(userId: string, activityId: string): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('activities', 'readwrite');
    await tx.objectStore('activities').delete(`${userId}_${activityId}`);
    await tx.done;
  } catch (error) {
    console.error('Failed to delete cached activity:', error);
  }
}

export async function getCachedPlace(userId: string, placeId: string): Promise<Place | null> {
  const dbInstance = await initDB();
  if (!dbInstance) return null;
  try {
    const tx = dbInstance.transaction('places', 'readonly');
    const record: CachedPlaceRecord | undefined = await tx.objectStore('places').get(`${userId}_${placeId}`);
    if (!record) return null;
    return deserializePlace(record.place);
  } catch (error) {
    console.error('Failed to get cached place:', error);
    return null;
  }
}

export async function upsertCachedPlace(userId: string, placeId: string, place: Place): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('places', 'readwrite');
    const entry: CachedPlaceRecord = {
      id: `${userId}_${placeId}`,
      userId,
      placeId,
      place: serializePlace(place),
      updatedAtMillis: Date.now(),
      cachedAtMillis: Date.now(),
    };
    await tx.objectStore('places').put(entry);
    await tx.done;
  } catch (error) {
    console.error('Failed to upsert cached place:', error);
  }
}

export async function deleteCachedPlace(userId: string, placeId: string): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('places', 'readwrite');
    await tx.objectStore('places').delete(`${userId}_${placeId}`);
    await tx.done;
  } catch (error) {
    console.error('Failed to delete cached place:', error);
  }
}

export async function clearCachedActivitiesForUser(userId: string): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('activities', 'readwrite');
    const store = tx.objectStore('activities');
    // Using a keybound range over the compound keys starting with `${userId}_`
    const keys = await store.getAllKeys(IDBKeyRange.bound(`${userId}_`, `${userId}_\uffff`));
    for (const key of keys) {
      await store.delete(key);
    }
    await tx.done;
  } catch (error) {
    console.error(`Failed to clear cached activities for user ${userId}:`, error);
  }
}

export async function clearCachedPlacesForUser(userId: string): Promise<void> {
  const dbInstance = await initDB();
  if (!dbInstance) return;
  try {
    const tx = dbInstance.transaction('places', 'readwrite');
    const store = tx.objectStore('places');
    // Using a keybound range over the compound keys starting with `${userId}_`
    const keys = await store.getAllKeys(IDBKeyRange.bound(`${userId}_`, `${userId}_\uffff`));
    for (const key of keys) {
      await store.delete(key);
    }
    await tx.done;
  } catch (error) {
    console.error(`Failed to clear cached places for user ${userId}:`, error);
  }
}
