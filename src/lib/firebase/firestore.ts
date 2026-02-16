'use client';

import { db } from './client';
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  Timestamp,
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
  });

  try {
    console.log('Committing batch...');
    await batch.commit();
    console.log('Batch commit successful!');
    return activityRef;
  } catch (error: any) {
    console.error('!!! Critical Error creating activity and chat: ', error);
    throw new Error(error.message || 'Could not create activity. Please try again later.');
  }
}
