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
  documentId,
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
  isPaid?: boolean;
  price?: number;
};

const MAX_FREE_PARTICIPANTS = 4;

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
    activeTabs: ['Sights', 'Nature', 'Restaurants'],
    likedTags: [],
    dislikedTags: [],
    isPremium: false,
    isSupporter: false,
    tokens: 0,
    successfulFreeHosts: 0,
    fiatBalance: 0, // Modul 8
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
  isPaid = false,
  price = 0,
}: CreateActivityPayload) {
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }
  if (!place && !customLocationName) {
    throw new Error('Either a place or a custom location name must be provided.');
  }

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const userProfileData = userSnap.data() as UserProfile | undefined;
  
  if (isBoosted && (userProfileData?.tokens || 0) < 1) {
    throw new Error('Insufficient tokens to boost activity.');
  }

  if (isPaid && (userProfileData?.successfulFreeHosts || 0) < 5) {
    throw new Error('Proof of Community nicht erfüllt. Bezahlte Aktivitäten sind gesperrt.');
  }

  const isUserPremium = userProfileData?.isPremium || false;
  const isUserSupporter = userProfileData?.isSupporter || false;

  let finalMaxParticipants = maxParticipants;
  if (!isUserPremium) {
    if (!finalMaxParticipants || finalMaxParticipants > MAX_FREE_PARTICIPANTS) {
      finalMaxParticipants = MAX_FREE_PARTICIPANTS;
    }
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
    participantsPreview: [
      { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }
    ],
    createdAt: serverTimestamp() as Timestamp,
    isCustomActivity: isCustomActivity,
    isTimeFlexible: !!isTimeFlexible,
    category: isCustomActivity ? "community" : (place?.categories[0].split('.')[0] || "other"),
    categories: isCustomActivity ? ["user_event"] : placeCategories,
    lastInteractionAt: serverTimestamp() as Timestamp,
    status: 'active' as const,
    completionVotes: [],
    isBoosted: isBoosted,
    boostedAt: isBoosted ? serverTimestamp() : null,
    isPaid: isPaid,
    price: isPaid ? price : 0,
    upvotes: 0,
    downvotes: 0,
    userVotes: {},
    reportCount: 0,
    stats: {
      impressions: 0,
      pushJoins: 0
    },
    ...(place?.address && { placeAddress: place.address }),
    ...(place?.lat && { lat: place.lat }),
    ...(place?.lon && { lon: place.lon }),
    ...(endDate && { activityEndDate: Timestamp.fromDate(endDate) }),
    ...(finalMaxParticipants && finalMaxParticipants > 0 && { maxParticipants: finalMaxParticipants }),
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
        isPremium: isUserPremium,
        isSupporter: isUserSupporter
      },
    },
    unreadCount: {
      [user.uid]: 0
    }
  });

  if (isBoosted) {
    batch.update(userRef, {
      tokens: increment(-1)
    });
  }

  try {
    await batch.commit();
    return activityRef;
  } catch (error: any) {
    console.error('!!! Critical Error creating activity and chat: ', error);
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

export async function joinActivity(activityId: string, user: User, source?: string | null) {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!user) throw new Error('User is not authenticated.');

  const activityRef = doc(db, 'activities', activityId);
  const chatRef = doc(db, 'chats', activityId);
  const userRef = doc(db, 'users', user.uid);

  try {
    await runTransaction(db, async (transaction) => {
      const activityDoc = await transaction.get(activityRef);
      const userDoc = await transaction.get(userRef);

      if (!activityDoc.exists()) {
        throw "Activity does not exist!";
      }

      const activityData = activityDoc.data() as Activity;
      
      if (activityData.isPaid && activityData.creatorId !== user.uid) {
        throw "Sicherheits-Gate: Beitritt zu bezahltem Event nur nach Zahlungsnachweis möglich.";
      }

      const userProfileData = userDoc.data() as UserProfile | undefined;
      
      if (activityData.participantIds.includes(user.uid)) {
        return;
      }
      
      if (activityData.maxParticipants && activityData.participantIds.length >= activityData.maxParticipants) {
        throw `This activity has reached its maximum of ${activityData.maxParticipants} participants.`;
      }
      
      const updates: any = {
        participantIds: arrayUnion(user.uid),
        lastInteractionAt: serverTimestamp(),
      };

      if (source === 'push') {
        updates["stats.pushJoins"] = increment(1);
      }

      transaction.update(activityRef, updates);

      // Update previews (max 5) - Harden against duplicates
      const currentPreviews = activityData.participantsPreview || [];
      if (currentPreviews.length < 5 && !currentPreviews.some(p => p.uid === user.uid)) {
        transaction.update(activityRef, {
          participantsPreview: arrayUnion({
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL
          })
        });
      }

      transaction.update(chatRef, {
        participantIds: arrayUnion(user.uid),
        [`participantDetails.${user.uid}`]: {
          displayName: user.displayName,
          photoURL: user.photoURL,
          isPremium: userProfileData?.isPremium || false,
          isSupporter: userProfileData?.isSupporter || false
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

export async function joinPaidActivity(activityId: string, user: User, transactionToken: string, source?: string | null) {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!transactionToken) throw new Error("Transaktions-Token fehlt. Beitritt verweigert.");

  const activityRef = doc(db, 'activities', activityId);
  const chatRef = doc(db, 'chats', activityId);
  const userRef = doc(db, 'users', user.uid);
  const transactionLogRef = doc(collection(db, 'transactions'));

  try {
    await runTransaction(db, async (transaction) => {
      const activityDoc = await transaction.get(activityRef);
      const userDoc = await transaction.get(userRef);

      if (!activityDoc.exists()) throw "Aktivität nicht gefunden.";
      const activityData = activityDoc.data() as Activity;
      const userProfileData = userDoc.data() as UserProfile | undefined;

      if (activityData.participantIds.includes(user.uid)) return;
      if (activityData.maxParticipants && activityData.participantIds.length >= activityData.maxParticipants) {
        throw `Maximale Teilnehmerzahl von ${activityData.maxParticipants} erreicht.`;
      }

      const updates: any = {
        participantIds: arrayUnion(user.uid),
        lastInteractionAt: serverTimestamp(),
      };

      if (source === 'push') {
        updates["stats.pushJoins"] = increment(1);
      }

      transaction.update(activityRef, updates);

      // --- MODUL 8: FINANZ-CLEARING (Host Gutschrift) ---
      const netAmount = (activityData.price || 0) * 0.9; // 10% Gebühr
      const hostRef = doc(db, 'users', activityData.creatorId);
      transaction.update(hostRef, {
        fiatBalance: increment(netAmount)
      });

      // Update previews (max 5) - Harden against duplicates
      const currentPreviews = activityData.participantsPreview || [];
      if (currentPreviews.length < 5 && !currentPreviews.some(p => p.uid === user.uid)) {
        transaction.update(activityRef, {
          participantsPreview: arrayUnion({
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL
          })
        });
      }

      transaction.update(chatRef, {
        participantIds: arrayUnion(user.uid),
        [`participantDetails.${user.uid}`]: {
          displayName: user.displayName,
          photoURL: user.photoURL,
          isPremium: userProfileData?.isPremium || false,
          isSupporter: userProfileData?.isSupporter || false
        },
        [`unreadCount.${user.uid}`]: 0
      });

      transaction.set(transactionLogRef, {
        activityId,
        userId: user.uid,
        userName: user.displayName,
        amount: activityData.price || 0,
        currency: 'EUR',
        status: 'completed',
        transactionToken,
        createdAt: serverTimestamp(),
      });
    });
  } catch (e: any) {
    console.error("Join Paid Activity Transaction failed: ", e);
    throw new Error(typeof e === 'string' ? e : "Zahlungsverifikation fehlgeschlagen.");
  }
}

export async function sendMessage(chatId: string, text: string, user: User, userProfile?: UserProfile | null) {
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
    isPremium: userProfile?.isPremium || false,
    isSupporter: userProfile?.isSupporter || false,
  });

  const updates: any = {
    lastMessage: {
      text: text.trim(),
      senderName: user.displayName,
      sentAt: serverTimestamp(),
    },
  };

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
  
  // Transition to transaction for safe state management (Preview removal)
  try {
    await runTransaction(db, async (transaction) => {
      const activitySnap = await transaction.get(activityRef);
      if (!activitySnap.exists()) return;
      const activityData = activitySnap.data() as Activity;

      // Filter user from preview list
      const updatedPreview = (activityData.participantsPreview || []).filter(p => p.uid !== userId);

      transaction.update(activityRef, {
        participantIds: arrayRemove(userId),
        participantsPreview: updatedPreview
      });

      transaction.update(chatRef, {
        participantIds: arrayRemove(userId),
        [`participantDetails.${userId}`]: deleteField(),
        [`unreadCount.${userId}`]: deleteField(),
      });
    });
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
    where('participantIds', 'array-contains', userId)
  );

  const querySnapshot = await getDocs(q);
  const activities = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Activity[];
  
  return activities.sort((a, b) => {
    const timeA = a.activityDate?.toMillis() || 0;
    const timeB = b.activityDate?.toMillis() || 0;
    return timeB - timeA;
  });
}


export async function sendFriendRequest(fromUserId: string, toUserId: string) {
    if (!db) throw new Error('Firestore is not initialized.');
    
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

        transaction.update(fromUserRef, { friendRequestsSent: arrayUnion(toUserId) });
        transaction.update(toUserRef, { friendRequestsReceived: arrayUnion(fromUserId) });

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
        transaction.update(userRef, { friendRequestsReceived: arrayRemove(requestingUserId) });
        transaction.update(requestingUserRef, { friendRequestsSent: arrayRemove(userId) });

        transaction.update(userRef, { friends: arrayUnion(requestingUserId) });
        transaction.update(requestingUserRef, { friends: arrayUnion(userId) });
    });
}

export async function declineFriendRequest(userId: string, decliningUserId: string) {
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

export async function completeActivity(activityId: string, userId: string, isPaid: boolean) {
  if (!db) throw new Error('Firestore is not initialized.');
  const batch = writeBatch(db);
  const activityRef = doc(db, 'activities', activityId);
  const userRef = doc(db, 'users', userId);

  batch.update(activityRef, { status: 'completed' });

  if (!isPaid) {
    batch.update(userRef, {
      successfulFreeHosts: increment(1)
    });
  }

  await batch.commit();
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

export async function findUserByFriendCode(friendCode: string): Promise<UserProfile | null> {
    if (!db) throw new Error('Firestore is not initialized.');
    
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
          isPremium: user1Profile.isPremium || false,
          isSupporter: user1Profile.isSupporter || false
        },
        [user2Id]: {
          displayName: user2Profile.displayName,
          photoURL: user2Profile.photoURL,
          isPremium: user2Profile.isPremium || false,
          isSupporter: user2Profile.isSupporter || false
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

  const reportRef = doc(collection(db, 'reports'));
  batch.set(reportRef, {
    reporterId,
    reportedEntityId,
    entityType,
    reason,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  const userRef = doc(db, 'users', reporterId);
  batch.update(userRef, {
    hiddenEntityIds: arrayUnion(reportedEntityId),
  });

  if (entityType === 'activity') {
    const activityRef = doc(db, 'activities', reportedEntityId);
    batch.update(activityRef, {
      reportCount: increment(1)
    });
  }

  await batch.commit();
}

export async function submitReport(activityId: string, reporterId: string, reason: string) {
  if (!db) throw new Error('Firestore is not initialized.');
  const batch = writeBatch(db);
  
  // 1. Audit-Log in separater Collection anlegen
  const reportRef = doc(collection(db, 'reports'));
  batch.set(reportRef, {
    activityId,
    reporterId,
    reason,
    createdAt: serverTimestamp(),
    status: 'open'
  });

  // 2. Report-Counter der Aktivität inkrementieren
  const activityRef = doc(db, 'activities', activityId);
  batch.update(activityRef, {
    reportCount: increment(1)
  });

  await batch.commit();
}

export async function earnToken(userId: string) {
  if (!db) throw new Error('Firestore is not initialized.');
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    tokens: increment(1)
  });
}

/**
 * MIGRATION SCRIPT: Befüllt das Feld participantsPreview für alle bestehenden Aktivitäten.
 * Greift auf participantIds zurück und lädt die zugehörigen Profile.
 */
export async function runMigrationParticipantsPreview() {
  if (!db) throw new Error("Firestore not initialized");
  
  const activitiesSnap = await getDocs(collection(db, "activities"));
  let processed = 0;

  for (const actDoc of activitiesSnap.docs) {
    const data = actDoc.data() as Activity;
    const pIds = data.participantIds?.slice(0, 5) || [];
    
    if (pIds.length > 0) {
      // Chunked Profile Fetch (max 10 IDs per query)
      const userSnap = await getDocs(query(collection(db, "users"), where(documentId(), "in", pIds)));
      const preview = userSnap.docs.map(u => ({
        uid: u.id,
        displayName: u.data().displayName || "User",
        photoURL: u.data().photoURL || null
      }));
      
      await updateDoc(actDoc.ref, { participantsPreview: preview });
      processed++;
    }
  }
  
  return processed;
}

export async function trackActivityView(activityId: string) {
  if (!db) return;
  const activityRef = doc(db, 'activities', activityId);
  await updateDoc(activityRef, {
    "stats.impressions": increment(1)
  });
}

/**
 * MODUL 8: AUSZAHLUNGSSYSTEM
 */
export const requestPayout = async (userId: string, currentBalance: number) => {
  if (!db) throw new Error("Firestore not initialized");
  if (currentBalance < 50) throw new Error("Auszahlungslimit von 50€ nicht erreicht.");

  const batch = writeBatch(db);
  
  // 1. Hard-Reset des Ledgers
  const userRef = doc(db, 'users', userId);
  batch.update(userRef, { fiatBalance: 0 }); 
  
  // 2. Audit-Dokument für Administratoren/Stripe erstellen
  const payoutRef = doc(collection(db, 'payoutRequests'));
  batch.set(payoutRef, {
    userId,
    amount: currentBalance,
    status: 'pending',
    createdAt: serverTimestamp()
  });

  await batch.commit();
};
