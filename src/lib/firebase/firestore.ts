'use client';

import { db } from './client';
import {
  collection,
  doc,
  writeBatch,
  Timestamp,
  serverTimestamp,
  getDocs,
  arrayUnion,
  runTransaction,
  arrayRemove,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Place } from '@/lib/types';

type CreateActivityPayload = {
  place?: Place;
  customLocationName?: string;
  date: Date;
  user: User;
};

export async function createActivity({
  place,
  customLocationName,
  date,
  user,
}: CreateActivityPayload) {
  console.log('Attempting to create activity...');
  if (!db) {
    console.error('Firestore (db) is not initialized!');
    throw new Error('Firestore is not initialized.');
  }
  if (!place && !customLocationName) {
    throw new Error('Either a place or a custom location name must be provided.');
  }
  console.log('Firestore is initialized. User:', user.uid);

  const batch = writeBatch(db);

  const activityRef = doc(collection(db, 'activities'));
  console.log('Generated activityRef with id:', activityRef.id);
  
  const isCustomActivity = !place;
  const finalCategories = isCustomActivity ? ["user_event"] : (place?.categories || []);

  const activityData = {
    placeId: place?.id || null,
    placeName: place?.name || customLocationName,
    placeAddress: place?.address || null,
    activityDate: Timestamp.fromDate(date),
    creatorId: user.uid,
    creatorName: user.displayName,
    creatorPhotoURL: user.photoURL,
    participantIds: [user.uid],
    createdAt: serverTimestamp(),
    lastInteractionAt: serverTimestamp(),
    isCustomActivity: isCustomActivity,
    categories: finalCategories,
  };
  batch.set(activityRef, activityData);

  const chatRef = doc(db, 'chats', activityRef.id);
  console.log('Generated chatRef with same id:', chatRef.id);
  batch.set(chatRef, {
    activityId: activityRef.id,
    createdAt: serverTimestamp(),
    participantIds: [user.uid],
    lastMessage: null,
    placeName: place?.name || customLocationName,
    creatorId: user.uid,
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

export async function joinActivity(activityId: string, user: User) {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!user) throw new Error('User is not authenticated.');

  const activityRef = doc(db, 'activities', activityId);
  const chatRef = doc(db, 'chats', activityId);

  try {
    await runTransaction(db, async (transaction) => {
      const activityDoc = await transaction.get(activityRef);
      if (!activityDoc.exists()) {
        throw "Activity does not exist!";
      }

      const activityData = activityDoc.data();
      
      // Server-side validation: Already a participant
      if (activityData.participantIds.includes(user.uid)) {
        throw new Error("Benutzer ist bereits Teilnehmer dieser Aktivität.");
      }
      
      // Speicher-Limitierung (Storage Limitation)
      const MAX_PARTICIPANTS = 50;
      if (activityData.participantIds.length >= MAX_PARTICIPANTS) {
        throw `This activity has reached its maximum of ${MAX_PARTICIPANTS} participants.`;
      }

      // Update activity
      transaction.update(activityRef, {
        participantIds: arrayUnion(user.uid),
        lastInteractionAt: serverTimestamp(),
      });

      // Update chat
      transaction.update(chatRef, {
        participantIds: arrayUnion(user.uid),
        [`participantDetails.${user.uid}`]: {
          displayName: user.displayName,
          photoURL: user.photoURL,
        }
      });
    });
  } catch (e: any) {
    console.error("Join Activity Transaction failed: ", e);
     // Propagate specific, user-facing errors
    if (typeof e === 'string') {
        throw new Error(e);
    }
    if (e instanceof Error) {
        throw e;
    }
    // Generic fallback error
    throw new Error("Could not join the activity. Please try again.");
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

export async function leaveActivity(activityId: string, userId: string) {
  if (!db) throw new Error('Firestore is not initialized.');

  const activityRef = doc(db, 'activities', activityId);
  const chatRef = doc(db, 'chats', activityId);
  
  const batch = writeBatch(db);

  batch.update(activityRef, {
    participantIds: arrayRemove(userId),
  });

  batch.update(chatRef, {
    participantIds: arrayRemove(userId),
    [`participantDetails.${userId}`]: deleteField(),
  });

  try {
    await batch.commit();
  } catch (error) {
    console.error('Error leaving activity:', error);
    throw new Error('Could not leave activity.');
  }
}


export async function deleteActivity(activityId: string) {
  if (!db) throw new Error('Firestore is not initialized.');

  const batch = writeBatch(db);

  const activityRef = doc(db, 'activities', activityId);
  const chatRef = doc(db, 'chats', activityId);
  const messagesRef = collection(db, 'chats', activityId, 'messages');

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

export async function fetchUserActivities(userId: string) {
  if (!db) throw new Error('Firestore is not initialized.');

  const q = query(
    collection(db, 'activities'),
    where('participantIds', 'array-contains', userId),
    orderBy('activityDate', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
