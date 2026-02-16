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
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }

  const batch = writeBatch(db);

  // 1. Create a new activity document (with a generated ID)
  const activityRef = doc(collection(db, 'activities'));
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
  batch.set(chatRef, {
    activityId: activityRef.id,
    createdAt: serverTimestamp(),
    participantIds: [user.uid],
    lastMessage: null,
  });

  try {
    await batch.commit();
    return activityRef;
  } catch (error) {
    console.error('Error creating activity and chat: ', error);
    throw new Error('Could not create activity. Please try again later.');
  }
}
