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
  setDoc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Place, UserProfile } from '@/lib/types';

type CreateActivityPayload = {
  place?: Place;
  customLocationName?: string;
  startDate: Date;
  endDate?: Date;
  user: User;
  isTimeFlexible?: boolean;
};

export async function createUserProfileDocument(user: User) {
  if (!db) throw new Error('Firestore is not initialized.');
  const userDocRef = doc(db, 'users', user.uid);
  const userProfile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    onboardingCompleted: false,
    friends: [],
    friendRequestsSent: [],
    friendRequestsReceived: [],
  };
  await setDoc(userDocRef, userProfile);
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!db) throw new Error('Firestore is not initialized.');
  const userDocRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userDocRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>) {
    if (!db) throw new Error('Firestore is not initialized.');
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, data);
}


export async function createActivity({
  place,
  customLocationName,
  startDate,
  endDate,
  user,
  isTimeFlexible,
}: CreateActivityPayload) {
  console.log('--- Debug: createActivity ---');
  console.time('createActivity Total');
  
  if (!db) {
    console.error('Firestore (db) is not initialized!');
    throw new Error('Firestore is not initialized.');
  }
  if (!place && !customLocationName) {
    throw new Error('Either a place or a custom location name must be provided.');
  }

  const batch = writeBatch(db);

  const activityRef = doc(collection(db, 'activities'));
  
  const isCustomActivity = !place;
  const placeCategories = place?.categories ? (Array.isArray(place.categories) ? place.categories : [place.categories]) : [];
  
  const activityData = {
    placeId: place?.id || "custom",
    placeName: place?.name || customLocationName,
    placeAddress: place?.address || null,
    activityDate: Timestamp.fromDate(startDate),
    activityEndDate: endDate ? Timestamp.fromDate(endDate) : null,
    creatorId: user.uid,
    creatorName: user.displayName,
    creatorPhotoURL: user.photoURL,
    participantIds: [user.uid],
    createdAt: serverTimestamp(),
    isCustomActivity: isCustomActivity,
    isTimeFlexible: !!isTimeFlexible,
    category: isCustomActivity ? "community" : (place?.categories[0].split('.')[0] || "other"),
    categories: isCustomActivity ? ["user_event"] : placeCategories,
    lastInteractionAt: serverTimestamp(),
  };
  batch.set(activityRef, activityData);
  console.log('1. Prepared activity document for batch.');

  const chatRef = doc(db, 'chats', activityRef.id);
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
  console.log('2. Prepared chat document for batch.');

  try {
    console.log('3. Committing batch write...');
    console.time('Firestore Batch Commit');
    await batch.commit();
    console.timeEnd('Firestore Batch Commit');
    console.log('4. Batch commit successful!');
    console.timeEnd('createActivity Total');
    return activityRef;
  } catch (error: any) {
    console.timeEnd('createActivity Total');
    console.error('!!! Critical Error creating activity and chat: ', error);
    if (error.message.includes('permission-denied') || error.message.includes('permission denied')) {
        throw new Error('Database permission denied. Please check your Firestore security rules.');
    }
    throw new Error(error.message || 'Could not create activity. Please try again later.');
  }
}

export async function joinActivity(activityId: string, user: User) {
  console.log(`--- Debug: User ${user.uid} joining activity ${activityId} ---`);
  console.time('joinActivity Total');
  if (!db) throw new Error('Firestore is not initialized.');
  if (!user) throw new Error('User is not authenticated.');

  const activityRef = doc(db, 'activities', activityId);
  const chatRef = doc(db, 'chats', activityId);

  try {
    console.time('Firestore Transaction');
    await runTransaction(db, async (transaction) => {
      console.log('1. Starting transaction to join activity.');
      console.time('Transaction Get');
      const activityDoc = await transaction.get(activityRef);
      console.timeEnd('Transaction Get');

      if (!activityDoc.exists()) {
        throw "Activity does not exist!";
      }

      const activityData = activityDoc.data();
      
      if (activityData.participantIds.includes(user.uid)) {
        console.log('User is already a participant.');
        return;
      }
      
      const MAX_PARTICIPANTS = 50;
      if (activityData.participantIds.length >= MAX_PARTICIPANTS) {
        throw `This activity has reached its maximum of ${MAX_PARTICIPANTS} participants.`;
      }
      
      console.log('2. Preparing transaction updates.');
      transaction.update(activityRef, {
        participantIds: arrayUnion(user.uid),
        lastInteractionAt: serverTimestamp(),
      });

      transaction.update(chatRef, {
        participantIds: arrayUnion(user.uid),
        [`participantDetails.${user.uid}`]: {
          displayName: user.displayName,
          photoURL: user.photoURL,
        }
      });
      console.log('3. Transaction updates prepared.');
    });
    console.timeEnd('Firestore Transaction');
    console.log('4. Transaction completed successfully.');
  } catch (e: any) {
    console.error("Join Activity Transaction failed: ", e);
    if (typeof e === 'string') {
        throw new Error(e);
    }
    if (e instanceof Error) {
        throw e;
    }
    throw new Error("Could not join the activity. Please try again.");
  } finally {
    console.timeEnd('joinActivity Total');
    console.log('--- Debug: Finished joinActivity ---');
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


export async function sendFriendRequest(fromUserId: string, toUserId: string) {
    if (!db) throw new Error('Firestore is not initialized.');
    const fromUserRef = doc(db, 'users', fromUserId);
    const toUserRef = doc(db, 'users', toUserId);

    await runTransaction(db, async (transaction) => {
        transaction.update(fromUserRef, { friendRequestsSent: arrayUnion(toUserId) });
        transaction.update(toUserRef, { friendRequestsReceived: arrayUnion(fromUserId) });
    });
}

export async function cancelFriendRequest(fromUserId: string, toUserId: string) {
    if (!db) throw new Error('Firestore is not initialized.');
    const fromUserRef = doc(db, 'users', fromUserId);
    const toUserRef = doc(db, 'users', toUserId);

    await runTransaction(db, async (transaction) => {
        transaction.update(fromUserRef, { friendRequestsSent: arrayRemove(toUserId) });
        transaction.update(toUserRef, { friendRequestsReceived: arrayRemove(fromUserId) });
    });
}

export async function acceptFriendRequest(userId: string, requestingUserId: string) {
    if (!db) throw new Error('Firestore is not initialized.');
    const userRef = doc(db, 'users', userId);
    const requestingUserRef = doc(db, 'users', requestingUserId);

    await runTransaction(db, async (transaction) => {
        // Remove from requests
        transaction.update(userRef, { friendRequestsReceived: arrayRemove(requestingUserId) });
        transaction.update(requestingUserRef, { friendRequestsSent: arrayRemove(userId) });

        // Add to friends
        transaction.update(userRef, { friends: arrayUnion(requestingUserId) });
        transaction.update(requestingUserRef, { friends: arrayUnion(userId) });
    });
}

export async function declineFriendRequest(userId: string, decliningUserId: string) {
    // This is the same logic as cancelling a request, just initiated by the receiver
    if (!db) throw new Error('Firestore is not initialized.');
    const userRef = doc(db, 'users', userId);
    const decliningUserRef = doc(db, 'users', decliningUserId);
    
    await runTransaction(db, async (transaction) => {
        transaction.update(userRef, { friendRequestsReceived: arrayRemove(decliningUserId) });
        transaction.update(decliningUserRef, { friendRequestsSent: arrayRemove(userId) });
    });
}

export async function removeFriend(userId: string, friendId: string) {
  if (!db) throw new Error('Firestore is not initialized.');
  const userRef = doc(db, 'users', userId);
  const friendRef = doc(db, 'users', friendId);

  await runTransaction(db, async (transaction) => {
      transaction.update(userRef, { friends: arrayRemove(friendId) });
      transaction.update(friendRef, { friends: arrayRemove(userId) });
  });
}

export async function deleteUserDocument(userId: string) {
  if (!db) throw new Error('Firestore is not initialized.');
  const userDocRef = doc(db, 'users', userId);
  // Note: This is a simplified deletion. A production app should use a
  // backend function to clean up all user-related data (e.g., remove from
  // activities, chats, friend lists) for data integrity.
  await deleteDoc(userDocRef);
}
