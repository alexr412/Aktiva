'use client';

import { db } from './client';
import {
  collection,
  doc,
  writeBatch,
  Timestamp,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Place } from '@/lib/types';

export async function createActivity(place: Place, date: Date, user: User) {
  console.log('Attempting to create activity...');
  if (!db) {
    console.error('Firestore (db) is not initialized!');
    throw new Error('Firestore is not initialized.');
  }
  console.log('Firestore is initialized. User:', user.uid);

  const batch = writeBatch(db);

  // 1. Create a new activity document (with a generated ID)
  const activityRef = doc(collection(db, 'activities'));
  console.log('Generated activityRef with id:', activityRef.id);
  const activityData = {
    placeId: place.id,
    placeName: place.name,
    placeAddress: place.address,
    activityDate: Timestamp.fromDate(date),
    creatorId: user.uid,
    creatorName: user.displayName,
    creatorPhotoURL: user.photoURL,
    participantIds: [user.uid],
    createdAt: serverTimestamp(),
  };
  batch.set(activityRef, activityData);

  // 2. Create a corresponding chat document with the same ID
  const chatRef = doc(db, 'chats', activityRef.id);
  console.log('Generated chatRef with same id:', chatRef.id);
  batch.set(chatRef, {
    activityId: activityRef.id,
    createdAt: serverTimestamp(),
    participantIds: [user.uid],
    lastMessage: null,
    placeName: place.name,
    participantDetails: {
      [user.uid]: {
        displayName: user.displayName,
        photoURL: user.photoURL,
      },
    },
  });

  try {
    console.log('Committing batch...');
    await batch.commit();
    console.log('Batch commit successful!');
    return activityRef;
  } catch (error: any) {
    console.error('!!! Critical Error creating activity and chat: ', error);
    if (error.message.includes('permission-denied') || error.message.includes('permission denied')) {
        throw new Error('Database permission denied. Please check your Firestore security rules.');
    }
    throw new Error(error.message || 'Could not create activity. Please try again later.');
  }
}

export async function sendMessage(chatId: string, text: string, user: User) {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!text.trim()) return;

  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const chatRef = doc(db, 'chats', chatId);

  const batch = writeBatch(db);

  const newMessageRef = doc(messagesRef);
  batch.set(newMessageRef, {
    text: text.trim(),
    senderId: user.uid,
    senderName: user.displayName,
    senderPhotoURL: user.photoURL,
    sentAt: serverTimestamp(),
  });

  batch.update(chatRef, {
    lastMessage: {
      text: text.trim(),
      senderName: user.displayName,
      sentAt: serverTimestamp(),
    },
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error('Error sending message:', error);
    throw new Error('Could not send message.');
  }
}

export async function deleteActivityAndChat(chatId: string) {
  if (!db) throw new Error('Firestore is not initialized.');

  const batch = writeBatch(db);

  const activityRef = doc(db, 'activities', chatId);
  const chatRef = doc(db, 'chats', chatId);
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  const messagesSnapshot = await getDocs(messagesRef);
  messagesSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  batch.delete(chatRef);
  batch.delete(activityRef);

  try {
    await batch.commit();
  } catch (error) {
    console.error('Error deleting activity and chat:', error);
    throw new Error('Could not delete activity.');
  }
}
