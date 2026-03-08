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
  limit,
  increment,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { Place, UserProfile, Activity, Chat } from '@/lib/types';

type CreateActivityPayload = {
  place?: Place;
  customLocationName?: string;
  startDate: Date;
  endDate?: Date;
  user: User;
  isTimeFlexible?: boolean;
  maxParticipants?: number;
  isBoosted?: boolean;
};

function generateFriendCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
    friendCode: generateFriendCode(),
    hiddenEntityIds: [],
    activeTabs: ['Gastronomy', 'Nature'],
    likedTags: [],
    dislikedTags: [],
    isPremium: false,
    isDonator: false,
    adTokens: 0,
    proximitySettings: {
      enabled: false,
      radiusKm: 5
    },
    isAdmin: false
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

export async function updateUserLocation(userId: string, lat: number, lng: number) {
  if (!db) return;
  const userDocRef = doc(db, 'users', userId);
  await updateDoc(userDocRef, {
    lastLocation: {
      lat,
      lng,
      updatedAt: serverTimestamp()
    }
  });
}


export async function createActivity({
  place,
  customLocationName,
  startDate,
  endDate,
  user,
  isTimeFlexible,
  maxParticipants,
  isBoosted = false,
}: CreateActivityPayload) {
  if (!db) {
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
    placeName: place?.name || customLocationName!,
    activityDate: Timestamp.fromDate(startDate),
    creatorId: user.uid,
    creatorName: user.displayName,
    creatorPhotoURL: user.photoURL,
    participantIds: [user.uid],
    createdAt: serverTimestamp() as Timestamp,
    isCustomActivity: isCustomActivity,
    isTimeFlexible: !!isTimeFlexible,
    category: isCustomActivity ? "community" : (place?.categories[0].split('.')[0] || "other"),
    categories: isCustomActivity ? ["user_event"] : placeCategories,
    lastInteractionAt: serverTimestamp() as Timestamp,
    status: 'active' as const,
    completionVotes: [],
    isBoosted: isBoosted,
    upvotes: 0,
    downvotes: 0,
    userVotes: {},
    ...(place?.address && { placeAddress: place.address }),
    ...(place?.lat && { lat: place.lat }),
    ...(place?.lon && { lon: place.lon }),
    ...(endDate && { activityEndDate: Timestamp.fromDate(endDate) }),
    ...(maxParticipants && maxParticipants > 0 && { maxParticipants }),
  };
  batch.set(activityRef, activityData);

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
    unreadCount: {
      [user.uid]: 0
    }
  });

  // If boosted, deduct token from user
  if (isBoosted) {
    const userRef = doc(db, 'users', user.uid);
    batch.update(userRef, {
      adTokens: increment(-1)
    });
  }

  try {
    await batch.commit();
    return activityRef;
  } catch (error: any) {
    console.error('!!! Critical Error creating activity and chat: ', error);
    if (error.message.includes('permission-denied') || error.message.includes('permission denied')) {
        throw new Error('Database permission denied. Please check your Firestore security rules.');
    }
    throw new Error(error.message || 'Could not create activity. Please try again later.');
  }
}

export async function voteActivity(activityId: string, userId: string, type: 'up' | 'down' | 'none') {
  if (!db) throw new Error('Firestore is not initialized.');
  const activityRef = doc(db, 'activities', activityId);

  await runTransaction(db, async (transaction) => {
    const activitySnap = await transaction.get(activityRef);
    if (!activitySnap.exists()) throw new Error("Activity not found.");

    const data = activitySnap.data() as Activity;
    const userVotes = data.userVotes || {};
    const previousVote = userVotes[userId];

    if (previousVote === type) return;

    let upvoteChange = 0;
    let downvoteChange = 0;

    if (previousVote === 'up') upvoteChange -= 1;
    if (previousVote === 'down') downvoteChange -= 1;

    if (type === 'up') {
      upvoteChange += 1;
      userVotes[userId] = 'up';
    } else if (type === 'down') {
      downvoteChange += 1;
      userVotes[userId] = 'down';
    } else {
      delete userVotes[userId];
    }

    transaction.update(activityRef, {
      upvotes: increment(upvoteChange),
      downvotes: increment(downvoteChange),
      userVotes: userVotes
    });
  });
}

export async function votePlace(placeId: string, userId: string, type: 'up' | 'down' | 'none') {
  if (!db) throw new Error('Firestore is not initialized.');
  const placeRef = doc(db, 'places', placeId);

  await runTransaction(db, async (transaction) => {
    const placeSnap = await transaction.get(placeRef);
    
    let data: any = { upvotes: 0, downvotes: 0, userVotes: {} };
    if (placeSnap.exists()) {
      data = placeSnap.data();
    }

    const userVotes = data.userVotes || {};
    const previousVote = userVotes[userId];

    if (previousVote === type) return;

    let upvoteChange = 0;
    let downvoteChange = 0;

    if (previousVote === 'up') upvoteChange -= 1;
    if (previousVote === 'down') downvoteChange -= 1;

    if (type === 'up') {
      upvoteChange += 1;
      userVotes[userId] = 'up';
    } else if (type === 'down') {
      downvoteChange += 1;
      userVotes[userId] = 'down';
    } else {
      delete userVotes[userId];
    }

    transaction.set(placeRef, {
      upvotes: increment(upvoteChange),
      downvotes: increment(downvoteChange),
      userVotes: userVotes
    }, { merge: true });
  });
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

      const activityData = activityDoc.data() as Activity;
      
      if (activityData.participantIds.includes(user.uid)) {
        return;
      }
      
      if (activityData.maxParticipants && activityData.participantIds.length >= activityData.maxParticipants) {
        throw `This activity has reached its maximum of ${activityData.maxParticipants} participants.`;
      }
      
      transaction.update(activityRef, {
        participantIds: arrayUnion(user.uid),
        lastInteractionAt: serverTimestamp(),
      });

      transaction.update(chatRef, {
        participantIds: arrayUnion(user.uid),
        [`participantDetails.${user.uid}`]: {
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        [`unreadCount.${user.uid}`]: 0
      });
    });
  } catch (e: any) {
    console.error("Join Activity Transaction failed: ", e);
    if (typeof e === 'string') {
        throw new Error(e);
    }
    if (e instanceof Error) {
        throw e;
    }
    throw new Error("Could not join the activity. Please try again.");
  }
}

export async function sendMessage(chatId: string, text: string, user: User) {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!text.trim()) return;

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) return;
  const chatData = chatSnap.data() as Chat;

  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const batch = writeBatch(db);

  const newMessageRef = doc(messagesRef);
  batch.set(newMessageRef, {
    text: text.trim(),
    senderId: user.uid,
    senderName: user.displayName,
    senderPhotoURL: user.photoURL,
    sentAt: serverTimestamp(),
  });

  const updates: any = {
    lastMessage: {
      text: text.trim(),
      senderName: user.displayName,
      sentAt: serverTimestamp(),
    },
  };

  // Increment unreadCount for all other participants
  chatData.participantIds.forEach(pid => {
    if (pid !== user.uid) {
      updates[`unreadCount.${pid}`] = increment(1);
    }
  });

  batch.update(chatRef, updates);

  try {
    await batch.commit();
  } catch (error) {
    console.error('Error sending message:', error);
    throw new Error('Could not send message.');
  }
}

export async function markChatAsRead(chatId: string, userId: string) {
  if (!db) throw new Error('Firestore is not initialized.');
  const chatRef = doc(db, 'chats', chatId);
  try {
    await updateDoc(chatRef, {
      [`unreadCount.${userId}`]: 0
    });
  } catch (error) {
    console.error("Error marking chat as read:", error);
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
    [`unreadCount.${userId}`]: deleteField(),
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
    
    // Selbst-Referenz-Sperre
    if (!fromUserId || fromUserId === toUserId) {
      console.error("Self-referential friend requests are prohibited.");
      return; 
    }

    const fromUserRef = doc(db, 'users', fromUserId);
    const toUserRef = doc(db, 'users', toUserId);
    const notificationRef = doc(collection(db, 'notifications'));

    await runTransaction(db, async (transaction) => {
        const fromUserSnap = await transaction.get(fromUserRef);
        if (!fromUserSnap.exists()) {
            throw new Error("Sender's user profile does not exist.");
        }
        const fromUserProfile = fromUserSnap.data() as UserProfile;

        // Update friend request arrays
        transaction.update(fromUserRef, { friendRequestsSent: arrayUnion(toUserId) });
        transaction.update(toUserRef, { friendRequestsReceived: arrayUnion(fromUserId) });

        // Create notification
        transaction.set(notificationRef, {
            recipientId: toUserId,
            senderId: fromUserId,
            senderProfile: {
                displayName: fromUserProfile.displayName,
                photoURL: fromUserProfile.photoURL
            },
            type: 'friend_request',
            isRead: false,
            createdAt: serverTimestamp()
        });
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

export async function voteToCompleteActivity(activityId: string, userId: string) {
  if (!db) throw new Error('Firestore is not initialized.');
  const activityRef = doc(db, 'activities', activityId);

  try {
    await runTransaction(db, async (transaction) => {
      const activityDoc = await transaction.get(activityRef);
      if (!activityDoc.exists()) {
        throw new Error("Activity does not exist!");
      }

      const activityData = activityDoc.data() as Activity;
      
      const currentVotes = activityData.completionVotes || [];
      const newVotes = [...new Set([...currentVotes, userId])];
      
      transaction.update(activityRef, {
        completionVotes: newVotes
      });
      
      const participantIds = activityData.participantIds;
      const allVoted = participantIds.every(id => newVotes.includes(id)) && newVotes.length === participantIds.length;

      if (allVoted) {
        transaction.update(activityRef, {
          status: 'completed'
        });
      }
    });
  } catch (error: any) {
    console.error("Vote to complete transaction failed: ", error);
    throw new Error(error.message || "Could not process your vote.");
  }
}

export async function checkIfUserReviewed(activityId: string, reviewerId: string): Promise<boolean> {
    if (!db) throw new Error('Firestore is not initialized.');
    const reviewsQuery = query(
        collection(db, 'reviews'),
        where('activityId', '==', activityId),
        where('reviewerId', '==', reviewerId)
    );
    const snapshot = await getDocs(reviewsQuery);
    return !snapshot.empty;
}

export async function submitReviews(
    activityId: string,
    reviewerId: string,
    otherParticipantIds: string[],
    rating: number,
    text?: string,
) {
    if (!db) throw new Error('Firestore is not initialized.');
    const batch = writeBatch(db);

    otherParticipantIds.forEach(targetUserId => {
        const reviewRef = doc(collection(db, 'reviews'));
        batch.set(reviewRef, {
            activityId,
            reviewerId,
            targetUserId,
            rating,
            text: text || '',
            createdAt: serverTimestamp()
        });
    });

    await batch.commit();
}

/**
 * findUserByFriendCode - Bereinigte Abfrage-Pipeline.
 * Limitiert ausschließlich auf den friendCode, um Selbstreferenz-Sperren auf API-Ebene zu vermeiden.
 */
export async function findUserByFriendCode(friendCode: string): Promise<UserProfile | null> {
    if (!db) throw new Error('Firestore is not initialized.');
    
    // Friend codes are stored in uppercase
    const userQuery = query(
        collection(db, 'users'), 
        where('friendCode', '==', friendCode.toUpperCase()),
        limit(1)
    );

    const querySnapshot = await getDocs(userQuery);

    if (querySnapshot.empty) {
        return null;
    }

    return querySnapshot.docs[0].data() as UserProfile;
}

export async function markNotificationAsRead(notificationId: string) {
    if (!db) throw new Error('Firestore is not initialized.');
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { isRead: true });
}

export async function getOrCreateDirectChat(user1Id: string, user2Id: string): Promise<string> {
  if (!db) throw new Error('Firestore is not initialized.');
  const chatId = [user1Id, user2Id].sort().join('_');
  const chatRef = doc(db, 'chats', chatId);

  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    // Create the chat document if it doesn't exist
    const user1Profile = await getUserProfile(user1Id);
    const user2Profile = await getUserProfile(user2Id);

    if (!user1Profile || !user2Profile) {
        throw new Error("Could not find user profiles to start chat.");
    }

    await setDoc(chatRef, {
      participantIds: [user1Id, user2Id],
      createdAt: serverTimestamp(),
      participantDetails: {
        [user1Id]: {
          displayName: user1Profile.displayName,
          photoURL: user1Profile.photoURL,
        },
        [user2Id]: {
          displayName: user2Profile.displayName,
          photoURL: user2Profile.photoURL,
        }
      },
      lastMessage: null,
      unreadCount: {
        [user1Id]: 0,
        [user2Id]: 0
      }
    });
  }

  return chatId;
}

export async function submitReportAndHide(
  reporterId: string,
  reportedEntityId: string,
  entityType: 'activity' | 'user',
  reason: string
) {
  if (!db) throw new Error('Firestore is not initialized.');
  const batch = writeBatch(db);

  // 1. Create a report document
  const reportRef = doc(collection(db, 'reports'));
  batch.set(reportRef, {
    reporterId,
    reportedEntityId,
    entityType,
    reason,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  // 2. Add entity to reporter's hidden list
  const userRef = doc(db, 'users', reporterId);
  batch.update(userRef, {
    hiddenEntityIds: arrayUnion(reportedEntityId),
  });

  await batch.commit();
}

export async function earnToken(userId: string) {
  if (!db) throw new Error('Firestore is not initialized.');
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    adTokens: increment(1)
  });
}
