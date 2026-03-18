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
import type { Place, UserProfile, Activity, Chat, ActivityCategory } from '@/lib/types';

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
  category: ActivityCategory;
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
    fiatBalance: 0, 
    escrowBalance: 0, 
    successfulReferrals: 0, 
    averageRating: 0, 
    ratingCount: 0, 
    kycStatus: 'unverified', 
    proximitySettings: {
      enabled: false,
      radiusKm: 5
    },
    isAdmin: false,
    role: 'user',
    isBanned: false
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
  category,
}: CreateActivityPayload) {
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }
  
  const isCustomActivity = !place;
  const placeIdValue = isCustomActivity ? "custom" : (place?.id || "unknown");
  
  if (!isCustomActivity && placeIdValue === "unknown") {
      throw new Error("Fehler: Orts-Identifikator konnte nicht aus dem Objekt extrahiert werden.");
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
  
  const placeCategories = place?.categories ? (Array.isArray(place.categories) ? place.categories : [place.categories]) : [];
  
  const activityData = {
    placeId: placeIdValue,
    placeName: place?.name || customLocationName || "Aktivität",
    activityDate: Timestamp.fromDate(startDate),
    hostId: user.uid,
    hostName: user.displayName || "Anonymer Host",
    hostPhotoURL: user.photoURL || null,
    participantIds: [user.uid],
    participantsPreview: [
      { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }
    ],
    createdAt: serverTimestamp() as Timestamp,
    isCustomActivity: isCustomActivity,
    isTimeFlexible: !!isTimeFlexible,
    category: category || 'Sonstiges',
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
    avgRating: 0,
    reviewCount: 0,
    stats: {
      impressions: 0,
      pushJoins: 0,
      referralJoins: 0
    },
    participantDetails: {
      [user.uid]: {
        displayName: user.displayName || "Anonymer Host",
        photoURL: user.photoURL || null,
        isPremium: isUserPremium,
        isSupporter: isUserSupporter,
        checkInStatus: 'pending',
        hasReviewed: false
      },
    },
    ...(place?.address && { placeAddress: place.address }),
    ...(place?.lat && { lat: place.lat }),
    ...(place?.lon && { lon: place.lon }),
    ...(endDate && { activityEndDate: Timestamp.fromDate(endDate) }),
    ...(finalMaxParticipants && finalMaxParticipants > 0 && { maxParticipants: finalMaxParticipants }),
  };
  
  batch.set(activityRef, activityData);

  const pRef = doc(db, 'activities', activityRef.id, 'participants', user.uid);
  batch.set(pRef, {
    uid: user.uid,
    displayName: user.displayName || "Anonymer Host",
    photoURL: user.photoURL || null,
    checkInStatus: 'pending',
    joinedAt: serverTimestamp(),
    hasReviewed: false
  });

  const chatRef = doc(db, 'chats', activityRef.id);
  batch.set(chatRef, {
    activityId: activityRef.id,
    createdAt: serverTimestamp(),
    participantIds: [user.uid],
    lastMessage: null,
    placeName: place?.name || customLocationName || "Aktivität",
    hostId: user.uid,
    participantDetails: {
      [user.uid]: {
        displayName: user.displayName || "Anonymer Host",
        photoURL: user.photoURL || null,
        isPremium: isUserPremium,
        isSupporter: isUserSupporter,
        checkInStatus: 'pending'
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

export async function joinActivity(activityId: string, user: User, source?: string | null, referralId?: string | null) {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!user) throw new Error('User is not authenticated.');

  const activityRef = doc(db, 'activities', activityId);
  const chatRef = doc(db, 'chats', activityId);
  const userRef = doc(db, 'users', user.uid);
  const pRef = doc(db, 'activities', activityId, 'participants', user.uid);

  try {
    await runTransaction(db, async (transaction) => {
      const activityDoc = await transaction.get(activityRef);
      const userDoc = await transaction.get(userRef);

      if (!activityDoc.exists()) {
        throw "Activity does not exist!";
      }

      const activityData = activityDoc.data() as Activity;
      
      if (activityData.isPaid && activityData.hostId !== user.uid) {
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
        [`participantDetails.${user.uid}`]: {
          displayName: user.displayName || "Unbekannter Teilnehmer",
          photoURL: user.photoURL || null,
          isPremium: userProfileData?.isPremium || false,
          isSupporter: userProfileData?.isSupporter || false,
          checkInStatus: 'pending',
          hasReviewed: false
        },
      };

      if (source === 'push') {
        updates["stats.pushJoins"] = increment(1);
      }

      if (referralId && referralId !== user.uid) {
        updates["stats.referralJoins"] = increment(1);
        const referrerRef = doc(db, 'users', referralId);
        transaction.update(referrerRef, {
          successfulReferrals: increment(1)
        });
      }

      transaction.update(activityRef, updates);

      transaction.set(pRef, {
        uid: user.uid,
        displayName: user.displayName || "Unbekannter Teilnehmer",
        photoURL: user.photoURL || null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });

      const currentPreviews = activityData.participantsPreview || [];
      if (currentPreviews.length < 5 && !currentPreviews.some(p => p.uid === user.uid)) {
        transaction.update(activityRef, {
          participantsPreview: arrayUnion({
            uid: user.uid,
            displayName: user.displayName || "Unbekannter Teilnehmer",
            photoURL: user.photoURL || null
          })
        });
      }

      transaction.update(chatRef, {
        participantIds: arrayUnion(user.uid),
        [`participantDetails.${user.uid}`]: {
          displayName: user.displayName || "Unbekannter Teilnehmer",
          photoURL: user.photoURL || null,
          isPremium: userProfileData?.isPremium || false,
          isSupporter: userProfileData?.isSupporter || false,
          checkInStatus: 'pending'
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

export async function joinPaidActivity(activityId: string, user: User, transactionToken: string, source?: string | null, referralId?: string | null) {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!transactionToken) throw new Error("Transaktions-Token fehlt. Beitritt verweigert.");

  const activityRef = doc(db, 'activities', activityId);
  const chatRef = doc(db, 'chats', activityId);
  const userRef = doc(db, 'users', user.uid);
  const pRef = doc(db, 'activities', activityId, 'participants', user.uid);
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
        [`participantDetails.${user.uid}`]: {
          displayName: user.displayName || "Unbekannter Teilnehmer",
          photoURL: user.photoURL || null,
          isPremium: userProfileData?.isPremium || false,
          isSupporter: userProfileData?.isSupporter || false,
          checkInStatus: 'pending',
          hasReviewed: false
        },
      };

      if (source === 'push') {
        updates["stats.pushJoins"] = increment(1);
      }

      if (referralId && referralId !== user.uid) {
        updates["stats.referralJoins"] = increment(1);
        const referrerRef = doc(db, 'users', referralId);
        transaction.update(referrerRef, {
          successfulReferrals: increment(1)
        });
      }

      transaction.update(activityRef, updates);

      const netAmount = (activityData.price || 0) * 0.9; 
      const hostRef = doc(db, 'users', activityData.hostId);
      transaction.update(hostRef, {
        escrowBalance: increment(netAmount)
      });

      transaction.set(pRef, {
        uid: user.uid,
        displayName: user.displayName || "Unbekannter Teilnehmer",
        photoURL: user.photoURL || null,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });

      const currentPreviews = activityData.participantsPreview || [];
      if (currentPreviews.length < 5 && !currentPreviews.some(p => p.uid === user.uid)) {
        transaction.update(activityRef, {
          participantsPreview: arrayUnion({
            uid: user.uid,
            displayName: user.displayName || "Unbekannter Teilnehmer",
            photoURL: user.photoURL || null
          })
        });
      }

      transaction.update(chatRef, {
        participantIds: arrayUnion(user.uid),
        [`participantDetails.${user.uid}`]: {
          displayName: user.displayName || "Unbekannter Teilnehmer",
          photoURL: user.photoURL || null,
          isPremium: userProfileData?.isPremium || false,
          isSupporter: userProfileData?.isSupporter || false,
          checkInStatus: 'pending'
        },
        [`unreadCount.${user.uid}`]: 0
      });

      transaction.set(transactionLogRef, {
        activityId,
        userId: user.uid,
        userName: user.displayName || "Unbekannter Nutzer",
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
    senderName: user.displayName || "Anonymer Nutzer",
    senderPhotoURL: user.photoURL || null,
    sentAt: serverTimestamp(),
    isPremium: userProfile?.isPremium || false,
    isSupporter: userProfile?.isSupporter || false,
  });

  const updates: any = {
    lastMessage: {
      text: text.trim(),
      senderName: user.displayName || "Anonymer Nutzer",
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
  const pRef = doc(db, 'activities', activityId, 'participants', userId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const activitySnap = await transaction.get(activityRef);
      if (!activitySnap.exists()) return;
      const activityData = activitySnap.data() as Activity;

      const updatedPreview = (activityData.participantsPreview || []).filter(p => p.uid !== userId);

      transaction.update(activityRef, {
        participantIds: arrayRemove(userId),
        participantsPreview: updatedPreview,
        [`participantDetails.${userId}`]: deleteField(),
      });

      transaction.delete(pRef);

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
  const participantsRef = collection(db, 'activities', activityId, 'participants');

  const messagesSnapshot = await getDocs(messagesRef);
  messagesSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  const participantsSnapshot = await getDocs(participantsRef);
  participantsSnapshot.forEach(doc => {
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
                displayName: fromUserProfile.displayName || "Jemand",
                photoURL: fromUserProfile.photoURL || null
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
  
  const activityRef = doc(db, 'activities', activityId);
  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (transaction) => {
    const activitySnap = await transaction.get(activityRef);
    if (!activitySnap.exists()) throw new Error("Activity not found.");
    const activityData = activitySnap.data() as Activity;

    transaction.update(activityRef, { status: 'completed' });

    if (!isPaid) {
      transaction.update(userRef, {
        successfulFreeHosts: increment(1)
      });
    } else if (activityData.price) {
      const payingParticipantsCount = Math.max(0, (activityData.participantIds?.length || 1) - 1);
      const releaseAmount = payingParticipantsCount * (activityData.price * 0.9);

      if (releaseAmount > 0) {
        transaction.update(userRef, {
          escrowBalance: increment(-releaseAmount),
          fiatBalance: increment(releaseAmount)
        });
      }
    }
  });
}

export const cancelActivity = async (activityId: string, hostId: string) => {
  if (!db) throw new Error('Firestore not initialized.');
  const activityRef = doc(db, 'activities', activityId);
  const activitySnap = await getDoc(activityRef);
  if (!activitySnap.exists()) throw new Error("Aktivität nicht gefunden.");
  const activity = activitySnap.data();

  const batch = writeBatch(db);
  batch.update(activityRef, { status: 'cancelled', updatedAt: serverTimestamp() });

  if (activity.isPaid && activity.price > 0) {
    const participantsRef = collection(db, 'activities', activityId, 'participants');
    const participantsSnap = await getDocs(participantsRef);
    const totalParticipants = participantsSnap.size;
    const escrowDeduction = totalParticipants * (activity.price * 0.9);

    if (escrowDeduction > 0) {
      batch.update(doc(db, 'users', hostId), { escrowBalance: increment(-escrowDeduction) });
    }

    participantsSnap.forEach((pDoc) => {
      const refundRef = doc(collection(db, 'refunds'));
      batch.set(refundRef, {
        activityId,
        userId: pDoc.id,
        amount: activity.price,
        status: 'pending',
        createdAt: serverTimestamp()
      });
    });
  }
  await batch.commit();
};

export async function checkIfUserReviewed(activityId: string, reviewerId: string): Promise<boolean> {
    if (!db) throw new Error('Firestore is not initialized.');
    const pRef = doc(db, 'activities', activityId, 'participants', reviewerId);
    const pSnap = await getDoc(pRef);
    return pSnap.exists() && pSnap.data().hasReviewed === true;
}

/**
 * MODUL 18: Persistent Multi-Peer Review Engine (v3).
 * Berechnet atomar Durchschnittswerte für User, Aktivität UND permanenten Ort (places collection).
 * Entkoppelt die Orts-Reputation von flüchtigen Aktivitäts-Dokumenten.
 */
export async function submitMultiReview(activityId: string, reviewerId: string, reviews: any[]) {
    if (!db) throw new Error('Firestore is not initialized.');

    try {
        await runTransaction(db, async (transaction) => {
            const activityRef = doc(db!, 'activities', activityId);
            const participantRef = doc(db!, 'activities', activityId, 'participants', reviewerId);
            
            const activitySnap = await transaction.get(activityRef);
            if (!activitySnap.exists()) throw new Error("Aktivität nicht gefunden.");
            const activityData = activitySnap.data() as Activity;

            // Permanenten Ort-Anker vorbereiten
            const placeId = activityData.placeId;
            const placeRef = placeId && placeId !== 'custom' ? doc(db!, 'places', placeId) : null;

            // Alle Ziel-Snapshots atomar abrufen
            const targetRefs = reviews.map(r => ({
                ref: r.targetType === 'user' ? doc(db!, 'users', r.targetId) : activityRef,
                review: r
            }));

            const targetSnaps = await Promise.all(targetRefs.map(entry => {
                if (entry.ref.id === activityId && entry.review.targetType === 'activity') {
                    return Promise.resolve(activitySnap);
                }
                return transaction.get(entry.ref);
            }));

            // Falls ein Place-Dokument existiert, dessen Snapshot ebenfalls laden (für persistente Aggregation)
            const placeSnap = placeRef ? await transaction.get(placeRef) : null;

            // REVIEWS VERARBEITEN
            targetRefs.forEach((entry, index) => {
                const snap = targetSnaps[index];
                const review = entry.review;
                
                const reviewRef = doc(collection(db!, 'reviews'));
                transaction.set(reviewRef, {
                    ...review,
                    activityId,
                    reviewerId,
                    createdAt: serverTimestamp()
                });

                if (snap.exists()) {
                    const data = snap.data();
                    const isUser = review.targetType === 'user';
                    
                    const currentCount = isUser ? (data.ratingCount || 0) : (data.reviewCount || 0);
                    const currentAvg = isUser ? (data.averageRating || 0) : (data.avgRating || 0);
                    
                    const newCount = currentCount + 1;
                    const newAvg = ((currentAvg * currentCount) + review.rating) / newCount;
                    
                    if (isUser) {
                        transaction.update(entry.ref, {
                            averageRating: newAvg,
                            ratingCount: newCount
                        });
                    } else {
                        transaction.update(entry.ref, {
                            avgRating: newAvg,
                            reviewCount: newCount
                        });

                        // --- MODUL 18: PERSISTENTE KASKADIERUNG ZUM ORT ---
                        if (placeRef) {
                            const pData = placeSnap?.exists() ? placeSnap.data() : { avgRating: 0, reviewCount: 0 };
                            const pCount = pData.reviewCount || 0;
                            const pAvg = pData.avgRating || 0;
                            
                            const newPCount = pCount + 1;
                            const newPAvg = ((pAvg * pCount) + review.rating) / newPCount;
                            
                            // Nutze set mit merge, falls der Ort noch nie bewertet wurde
                            transaction.set(placeRef, {
                                avgRating: newPAvg,
                                reviewCount: newPCount
                            }, { merge: true });
                        }
                    }
                }
            });

            transaction.update(participantRef, { hasReviewed: true });
            transaction.update(activityRef, {
                [`participantDetails.${reviewerId}.hasReviewed`]: true
            });
        });
    } catch (error) {
        console.error("Critical: Multi-Review Transaction failed", error);
        throw error;
    }
}

export const submitHostRating = async (activityId: string, hostId: string, reviewerId: string, rating: number) => {
  if (!db) throw new Error('Firestore not initialized.');
  if (rating < 1 || rating > 5) throw new Error("Invalides Rating");

  const hostRef = doc(db, 'users', hostId);
  const reviewRef = doc(collection(db, 'reviews'));

  await runTransaction(db, async (transaction) => {
    const hostDoc = await transaction.get(hostRef);
    if (!hostDoc.exists()) throw new Error("Host nicht gefunden");

    const currentData = hostDoc.data() as UserProfile;
    const currentRating = currentData.averageRating || 0;
    const currentCount = currentData.ratingCount || 0;

    const newCount = currentCount + 1;
    const newRating = ((currentRating * currentCount) + rating) / newCount;

    transaction.update(hostRef, {
      averageRating: newRating,
      ratingCount: newCount
    });

    transaction.set(reviewRef, {
      activityId,
      hostId,
      reviewerId,
      rating,
      createdAt: serverTimestamp(),
      type: 'host_rating'
    });
  });
};

export const verifyTicket = async (activityId: string, scannedUserId: string) => {
  if (!db) throw new Error('Firestore not initialized.');
  
  const activityRef = doc(db, 'activities', activityId);
  const participantRef = doc(db, 'activities', activityId, 'participants', scannedUserId);

  await runTransaction(db, async (transaction) => {
    const pDoc = await transaction.get(participantRef);
    
    if (!pDoc.exists()) throw new Error("Teilnehmer existiert nicht im System.");
    if (pDoc.data().checkInStatus === 'scanned') throw new Error("Ticket wurde bereits entwertet.");

    transaction.update(participantRef, {
      checkInStatus: 'scanned',
      checkInTime: serverTimestamp()
    });

    transaction.update(activityRef, {
      [`participantDetails.${scannedUserId}.checkInStatus`]: 'scanned',
      [`participantDetails.${scannedUserId}.checkInTime`]: serverTimestamp()
    });
  });
};

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
          displayName: user1Profile.displayName || "Nutzer 1",
          photoURL: user1Profile.photoURL || null,
          isPremium: user1Profile.isPremium || false,
          isSupporter: user1Profile.isSupporter || false
        },
        [user2Id]: {
          displayName: user2Profile.displayName || "Nutzer 2",
          photoURL: user2Profile.photoURL || null,
          isPremium: user2Profile.isPremium || false,
          isSupporter: user2Profile.isSupporter || false
        }
      },
      lastMessage: null,
      hostId: user1Id, 
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
  
  const reportRef = doc(collection(db, 'reports'));
  batch.set(reportRef, {
    activityId,
    reporterId,
    reason,
    createdAt: serverTimestamp(),
    status: 'open'
  });

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

export async function runMigrationParticipantsPreview() {
  if (!db) throw new Error("Firestore not initialized");
  
  const activitiesSnap = await getDocs(collection(db, "activities"));
  let processed = 0;

  for (const actDoc of activitiesSnap.docs) {
    const data = actDoc.data() as Activity;
    const pIds = data.participantIds?.slice(0, 5) || [];
    
    if (pIds.length > 0) {
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

export const requestPayout = async (userId: string, currentBalance: number) => {
  if (!db) throw new Error("Firestore not initialized");
  if (currentBalance < 50) throw new Error("Auszahlungslimit von 50€ nicht erreicht.");

  const batch = writeBatch(db);
  
  const userRef = doc(db, 'users', userId);
  batch.update(userRef, { fiatBalance: 0 }); 
  
  const payoutRef = doc(collection(db, 'payoutRequests'));
  batch.set(payoutRef, {
    userId,
    amount: currentBalance,
    status: 'pending',
    createdAt: serverTimestamp()
  });

  await batch.commit();
};

export async function processRefund(refundId: string) {
  if (!db) throw new Error('Firestore is not initialized.');
  const refundRef = doc(db, 'refunds', refundId);
  await updateDoc(refundRef, {
    status: 'completed',
    processedAt: serverTimestamp()
  });
}

export async function banUser(userId: string) {
  if (!db) throw new Error('Firestore is not initialized.');
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    isBanned: true
  });
}
