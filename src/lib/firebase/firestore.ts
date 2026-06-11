'use client';

import { db, app } from './client';
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
import { calculateDistance } from '../geo-utils';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { User } from 'firebase/auth';
import type { Place, UserProfile, Activity, Chat, ActivityCategory } from '@/lib/types';
import { validateChatMessage } from '@/lib/moderation/blacklist';

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
  description?: string;
  requirements?: {
    ageRange?: { min?: number; max?: number };
    gender?: string[];
    requireProfilePicture?: boolean;
    requireVerification?: boolean;
    minimumRating?: number;
  };
  joinMode?: 'direct' | 'request';
  creationSource?: 'community' | 'place_activity';
};

const MAX_FREE_PARTICIPANTS = 4;
const SMOOTHING_FACTOR = 5;


export async function createUserProfileDocument(user: User, additionalData?: Partial<UserProfile>) {
  if (!db) throw new Error('Firestore is not initialized.');
  const userDocRef = doc(db, 'users', user.uid);
  
  // Safely filter out server-side referral/points properties
  const { referralCode, referredBy, pointsBalance, pointsLifetime, level, ...filteredAdditionalData } = additionalData || {};

  const userProfile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: null,
    onboardingCompleted: false,
    ...filteredAdditionalData,
    friends: [],
    friendRequestsSent: [],
    friendRequestsReceived: [],
    hiddenEntityIds: [],
    activeTabs: ['Sights', 'Nature', 'Restaurants'],
    likedTags: [],
    dislikedTags: [],
    categoryAffinities: {},
    isPremium: false,
    isSupporter: false,
    isCreator: false,
    tokens: 0,
    successfulFreeHosts: 0,
    fiatBalance: 0, 
    escrowBalance: 0, 
    balancesInCents: true,
    successfulReferrals: 0, 
    pointsBalance: 0,
    pointsLifetime: 0,
    level: 1,
    averageRating: 0, 
    ratingCount: 0, 
    kycStatus: 'unverified', 
    blacklist: {
      soft: [],
      hard: []
    },
    proximitySettings: {
      enabled: false,
      radiusKm: 5
    },
    notificationSettings: {
      localHighlights: false,
      nearbyFriendActivityNotifications: true,
      friendRequests: true,
      activityInvites: true,
      chatMessages: true
    },
    role: 'user',
    isBanned: false
  };
  await setDoc(userDocRef, userProfile, { merge: true });
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

export async function getPublicProfileClient(targetUserId: string): Promise<UserProfile | null> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app || undefined, 'us-central1');
  const getProfileFn = httpsCallable<{ targetUserId: string }, UserProfile>(functions, 'getPublicProfile');
  try {
    const result = await getProfileFn({ targetUserId });
    return result.data;
  } catch (error: any) {
    console.error("Error in getPublicProfileClient:", error);
    throw error;
  }
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>) {
    if (!db) throw new Error('Firestore is not initialized.');
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, data);
}

export async function updatePresetAvatar(userId: string, avatarUrl: string) {
    if (!db) throw new Error('Firestore is not initialized.');
    
    const { auth } = await import('./auth');
    const { updateProfile } = await import('firebase/auth');

    if (!auth?.currentUser || auth.currentUser.uid !== userId) {
        throw new Error("You are not authorized to perform this action.");
    }

    const userDocRef = doc(db, 'users', userId);

    // Optional Storage cleanup of old custom avatar before overwriting
    try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
            const currentPhotoURL = snap.data().photoURL;
            const { isStorageAvatarPath } = await import('@/lib/avatar-utils');
            if (isStorageAvatarPath(currentPhotoURL, userId)) {
                const { getStorage, ref: storageRef, deleteObject } = await import('firebase/storage');
                const storage = getStorage();
                const fileRef = storageRef(storage, currentPhotoURL);
                await deleteObject(fileRef);
            }
        }
    } catch (storageError) {
        // Suppress storage cleanup errors
        console.warn("Firebase Storage old avatar deletion failed:", storageError);
    }

    await updateDoc(userDocRef, {
        photoURL: avatarUrl
    });

    await updateProfile(auth.currentUser, {
        photoURL: avatarUrl
    });
}

export async function removeUserAvatar(userId: string, currentPhotoURL: string | null) {
    if (!db) throw new Error('Firestore is not initialized.');

    const { auth } = await import('./auth');
    const { updateProfile } = await import('firebase/auth');

    if (!auth?.currentUser || auth.currentUser.uid !== userId) {
        throw new Error("You are not authorized to perform this action.");
    }

    // 1. Update Firestore (photoURL to null, and updatedAt)
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
        photoURL: null,
        updatedAt: serverTimestamp()
    });

    // 2. Update Firebase Auth Profile
    await updateProfile(auth.currentUser, {
        photoURL: null
    });

    // 3. Optional storage cleanup: decode and verify storage path before deleting
    const { isStorageAvatarPath } = await import('@/lib/avatar-utils');
    if (isStorageAvatarPath(currentPhotoURL, userId)) {
        try {
            const { getStorage, ref: storageRef, deleteObject } = await import('firebase/storage');
            const storage = getStorage();
            const fileRef = storageRef(storage, currentPhotoURL!);
            await deleteObject(fileRef);
        } catch (storageError) {
            // Suppress storage cleanup errors, only log
            console.warn("Firebase Storage avatar file deletion failed:", storageError);
        }
    }
}

export async function updateUserLocation(userId: string, lat: number, lng: number, city?: string) {
  if (!db) return;
  const userDocRef = doc(db, 'users', userId);
  
  try {
    // Optimierung: Nur updaten wenn die Position sich signifikant geändert hat (> 500m) oder die Stadt neu ist
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const current = snap.data().lastLocation;
      if (current && current.lat && current.lng) {
        const distance = calculateDistance(lat, lng, current.lat, current.lng);

        // Wenn < 500m Unterschied und gleiche Stadt -> Update überspringen
        if (distance < 0.5 && current.city === (city || null)) {
          return;
        }
      }
    }

    await setDoc(userDocRef, {
      lastLocation: {
        lat,
        lng,
        city: city || null,
        updatedAt: serverTimestamp()
      }
    }, { merge: true });
  } catch (e) {
    console.warn("Update user location failed:", e);
  }
}

export const APP_ONLY_CATEGORIES = new Set(["community", "user_event", "favorites", "highlights"]);

export function isGeoapifyCategory(c: string): boolean {
  const geoapifyPrefixes = [
    'accommodation', 'activity', 'airport', 'amenity', 'area', 'building',
    'catering', 'commercial', 'education', 'entertainment', 'leisure',
    'natural', 'office', 'parking', 'pet', 'power', 'railway', 'rental',
    'route', 'service', 'shopping', 'sport', 'tourism', 'public_transport',
    'religion', 'highway', 'man_made', 'waterway', 'wheelchair'
  ];
  const lower = c.toLowerCase();
  return lower.includes('.') || geoapifyPrefixes.includes(lower);
}

export function getNormalizedCategory(categories: string[]): string {
  if (!categories || !Array.isArray(categories)) return 'other';
  const cats = categories.map(c => c.toLowerCase());
  
  if (cats.some(c => c === 'community' || c.startsWith('community.'))) {
    return 'community';
  }
  if (cats.some(c => c === 'entertainment.cinema' || c.startsWith('entertainment.cinema.'))) {
    return 'cinema';
  }
  if (cats.some(c => c === 'entertainment.miniature_golf' || c.startsWith('entertainment.miniature_golf.'))) {
    return 'minigolf';
  }
  if (cats.some(c => c === 'sport' || c.startsWith('sport.'))) {
    return 'sport';
  }
  if (cats.some(c => c === 'catering.restaurant' || c.startsWith('catering.restaurant.'))) {
    return 'restaurant';
  }
  if (cats.some(c => c === 'catering.cafe' || c.startsWith('catering.cafe.'))) {
    return 'cafe';
  }
  if (cats.some(c => c === 'catering.bar' || c.startsWith('catering.bar.'))) {
    return 'bar';
  }
  if (cats.some(c => c === 'catering.pub' || c.startsWith('catering.pub.'))) {
    return 'pub';
  }
  
  const firstTag = categories.find(c => c !== 'user_event') || '';
  if (firstTag) {
    const lastPart = firstTag.split('.').pop() || firstTag;
    return lastPart.toLowerCase();
  }
  return 'other';
}

export function normalizeActivityDocument(data: Partial<Activity> & Record<string, unknown>, docId?: string): Activity {
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const category = (data.category as string) || '';
  
  const hasUserEvent = categories.includes("user_event");
  const hasPlaceId = Boolean(data.placeId);
  
  const isUserEvent = hasUserEvent && !hasPlaceId;
  const normalizedCategory = isUserEvent ? "community" : (getNormalizedCategory(categories) || category.toLowerCase() || "other");
  const visibleCategories = categories.filter(c => c !== "user_event" && !isGeoapifyCategory(c));
  
  return {
    ...data,
    id: data.id || docId,
    isUserEvent,
    normalizedCategory,
    categories: visibleCategories,
    category: data.category || 'Sonstiges',
    sourceType: 'activity' as const,
  } as Activity;
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
  description,
  requirements,
  joinMode = 'request',
  creationSource: creationSourceParam,
}: CreateActivityPayload) {
  if (!db) {
    throw new Error('Firestore is not initialized.');
  }

  if (description && !validateChatMessage(description)) {
    throw new Error('Diese Nachricht enthält nicht erlaubte Inhalte.');
  }

  const isPlaceBasedActivity = Boolean(place?.id);
  const placeIdValue = isPlaceBasedActivity ? place!.id : "custom";
  
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const userProfileData = userSnap.data() as UserProfile | undefined;
  
  const displayNameToUse = userProfileData?.displayName ?? "User";
  const photoURLToUse = userProfileData?.photoURL ?? null;
  
  if (isBoosted && (userProfileData?.tokens || 0) < 1) {
    throw new Error('Insufficient tokens to boost activity.');
  }

  if (isPaid) {
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isLocal) {
      throw new Error('Bezahlte Aktivitäten sind in dieser Version deaktiviert.');
    }
    if ((userProfileData?.successfulFreeHosts || 0) < 5) {
      throw new Error('Proof of Community nicht erfüllt. Bezahlte Aktivitäten sind gesperrt.');
    }
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
  
  const finalCategory = category || 'Sonstiges';

  const activityData: any = {
    placeName: place?.name || customLocationName || "Aktivität",
    activityDate: Timestamp.fromDate(startDate),
    hostId: user.uid,
    hostName: displayNameToUse,
    hostPhotoURL: photoURLToUse,
    participantIds: [user.uid],
    participantsPreview: [
      { uid: user.uid, displayName: displayNameToUse, photoURL: photoURLToUse }
    ],
    createdAt: serverTimestamp() as Timestamp,
    isCustomActivity: !isPlaceBasedActivity,
    isTimeFlexible: !!isTimeFlexible,
    category: finalCategory,
    description: description || null,
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
    globalScore: 0,
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
        displayName: displayNameToUse,
        photoURL: photoURLToUse,
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
    ...(requirements && { requirements }),
    joinMode: joinMode,
  };

  const resolvedCreationSource = creationSourceParam || (isPlaceBasedActivity ? 'place_activity' : 'community');

  if (isPlaceBasedActivity) {
    activityData.placeId = placeIdValue;
    activityData.categories = [finalCategory];
    activityData.isUserEvent = false;
    activityData.sourceType = "activity";
    activityData.creationSource = resolvedCreationSource;
  } else {
    // Free Community Event
    activityData.categories = ["user_event", finalCategory];
    activityData.isUserEvent = true;
    activityData.sourceType = "activity";
    activityData.creationSource = resolvedCreationSource;
    activityData.normalizedCategory = "community";
  }
  
  batch.set(activityRef, activityData);

  const pRef = doc(db, 'activities', activityRef.id, 'participants', user.uid);
  batch.set(pRef, {
    uid: user.uid,
    displayName: displayNameToUse,
    photoURL: photoURLToUse,
    checkInStatus: 'pending',
    joinedAt: serverTimestamp(),
    hasReviewed: false
  });

  const chatRef = doc(db, 'chats', activityRef.id);
  batch.set(chatRef, {
    activityId: activityRef.id,
    createdAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    participantIds: [user.uid],
    lastMessage: null,
    placeName: place?.name || customLocationName || "Aktivität",
    categories: activityData.categories,
    hostId: user.uid,
    participantDetails: {
      [user.uid]: {
        displayName: displayNameToUse,
        photoURL: photoURLToUse,
        isPremium: isUserPremium,
        isSupporter: isUserSupporter,
        checkInStatus: 'pending'
      },
    },
    unreadCount: {
      [user.uid]: 0
    }
  });

  if (isPlaceBasedActivity) {
    const placeRef = doc(db, 'places', placeIdValue);
    
    // We MUST save the full place data here so the ACTIVE tab can query the places collection directly!
    const placeUpdate: any = { 
      activityCount: increment(1),
      updatedAt: serverTimestamp(),
      lastActivityId: activityRef.id
    };
    
    if (place) {
      if (place.name) placeUpdate.name = place.name;
      if (place.address) placeUpdate.address = place.address;
      if (place.categories) {
        placeUpdate.categories = (Array.isArray(place.categories) ? place.categories : [place.categories])
          .filter((c: string) => c !== 'user_event');
      }
      if (place.lat) placeUpdate.lat = place.lat;
      if (place.lon) placeUpdate.lon = place.lon;
      if (place.openingHours) placeUpdate.openingHours = place.openingHours;
    }
    
    batch.set(placeRef, placeUpdate, { merge: true });
  }

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


/**
 * MODUL 18: The Balance Engine Core logic for Activities.
 * Berechnet globalScore ($S_coll$) und Category-Affinity ($V_user$).
 */
export async function castActivityVote(activityId: string, userId: string, type: 'up' | 'down' | 'none', userRole?: string): Promise<number> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app || undefined, 'us-central1');
  const secureVote = httpsCallable<
    { activityId: string; type: string },
    { communityScore: number }
  >(functions, 'secureVoteActivity');

  const result = await secureVote({ activityId, type });
  return result.data.communityScore;
}

/**
 * MODUL 18: The Balance Engine Core logic for Places.
 */
export async function votePlace(placeId: string, userId: string, type: 'up' | 'down' | 'none', userRole?: string, placeData?: Partial<Place>): Promise<number> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app || undefined, 'us-central1');
  const secureVote = httpsCallable<
    { placeId: string; type: string; placeData?: Partial<Place> },
    { weightedCommunityScore: number }
  >(functions, 'secureVotePlace');

  const result = await secureVote({ placeId, type, placeData });
  return result.data.weightedCommunityScore;
}

export async function joinActivity(activityId: string, user: User, source?: string | null, referralId?: string | null): Promise<'joined' | 'requested'> {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!user) throw new Error('User is not authenticated.');

  const activityRef = doc(db, 'activities', activityId);
  const chatRef = doc(db, 'chats', activityId);
  const userRef = doc(db, 'users', user.uid);
  const pRef = doc(db, 'activities', activityId, 'participants', user.uid);

  try {
    const result = await runTransaction(db, async (transaction) => {
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
      const displayNameToUse = userProfileData?.displayName ?? "User";
      const photoURLToUse = userProfileData?.photoURL ?? null;
      
      let forceRequestMode = false;
      
      // Validierung der Teilnahmebedingungen
      if (activityData.requirements && activityData.hostId !== user.uid) {
        const req = activityData.requirements;
        
        if (req.requireProfilePicture && !userProfileData?.photoURL) {
          throw "Du benötigst ein Profilbild, um an diesem Event teilzunehmen.";
        }
        
        if (req.requireVerification && userProfileData?.kycStatus !== 'verified') {
          throw "Nur verifizierte Nutzer (KYC) können diesem Event beitreten.";
        }
        
        if (req.minimumRating && (userProfileData?.averageRating || 0) < req.minimumRating) {
          const hasNoRating = !userProfileData?.ratingCount || userProfileData.ratingCount === 0;
          if (hasNoRating) {
            forceRequestMode = true;
          } else {
            throw `Dieses Event erfordert eine Mindestbewertung von ${req.minimumRating} Sternen.`;
          }
        }
        
        if (req.gender && req.gender.length > 0) {
          const userGender = userProfileData?.gender || 'unbekannt';
          if (!req.gender.includes(userGender)) {
             throw "Dieses Event ist nur für bestimmte Geschlechter freigegeben. Bitte überprüfe deine Profileinstellungen.";
          }
        }
        
        if (req.ageRange) {
          if (!userProfileData?.age) {
             throw "Bitte hinterlege dein Alter in den Profileinstellungen, um teilnehmen zu können.";
          }
          if (req.ageRange.min && userProfileData.age < req.ageRange.min) {
             throw `Du musst mindestens ${req.ageRange.min} Jahre alt sein.`;
          }
          if (req.ageRange.max && userProfileData.age > req.ageRange.max) {
             throw `Das Höchstalter für dieses Event ist ${req.ageRange.max} Jahre.`;
          }
        }
      }

      if (activityData.participantIds.includes(user.uid)) {
        return 'joined';
      }

      if ((activityData.joinMode === 'request' || forceRequestMode) && activityData.hostId !== user.uid) {
        return 'requested';
      }
      
      if (activityData.maxParticipants && activityData.participantIds.length >= activityData.maxParticipants) {
        throw `This activity has reached its maximum of ${activityData.maxParticipants} participants.`;
      }
      
      const updates: any = {
        participantIds: arrayUnion(user.uid),
        lastInteractionAt: serverTimestamp(),
        [`participantDetails.${user.uid}`]: {
          displayName: displayNameToUse,
          photoURL: photoURLToUse,
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
        const referrerRef = doc(db!, 'users', referralId);
        transaction.update(referrerRef, {
          successfulReferrals: increment(1)
        });
      }

      transaction.update(activityRef, updates);

      transaction.set(pRef, {
        uid: user.uid,
        displayName: displayNameToUse,
        photoURL: photoURLToUse,
        checkInStatus: 'pending',
        joinedAt: serverTimestamp(),
        hasReviewed: false
      });

      const currentPreviews = activityData.participantsPreview || [];
      if (currentPreviews.length < 5 && !currentPreviews.some(p => p.uid === user.uid)) {
        transaction.update(activityRef, {
          participantsPreview: arrayUnion({
            uid: user.uid,
            displayName: displayNameToUse,
            photoURL: photoURLToUse
          })
        });
      }

      transaction.update(chatRef, {
        participantIds: arrayUnion(user.uid),
        [`participantDetails.${user.uid}`]: {
          displayName: displayNameToUse,
          photoURL: photoURLToUse,
          isPremium: userProfileData?.isPremium || false,
          isSupporter: userProfileData?.isSupporter || false,
          checkInStatus: 'pending'
        },
        [`unreadCount.${user.uid}`]: 0
      });
      return 'joined' as const;
    });
    
    if (result === 'requested') {
      await requestJoinActivity(activityId, user);
      return 'requested';
    }
    return 'joined';
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

export async function requestJoinActivity(activityId: string, user: User): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');

  // Check if a request already exists
  const existingReqsQuery = query(
    collection(db, 'notifications'),
    where('activityId', '==', activityId),
    where('senderId', '==', user.uid),
    where('type', '==', 'join_request')
  );
  const existingReqs = await getDocs(existingReqsQuery);
  if (!existingReqs.empty) {
    throw new Error('Du hast bereits eine Anfrage gesendet.');
  }

  const activityRef = doc(db, 'activities', activityId);
  const activitySnap = await getDoc(activityRef);
  if (!activitySnap.exists()) {
    throw new Error('Activity does not exist.');
  }

  const activityData = activitySnap.data() as Activity;
  if (activityData.participantIds.includes(user.uid)) {
    throw new Error('Du bist bereits in dieser Aktivität.');
  }

  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const userProfileData = userSnap.data() as UserProfile | undefined;
  const displayNameToUse = userProfileData?.displayName ?? "User";
  const photoURLToUse = userProfileData?.photoURL ?? null;
  
  // Run the same requirement validation as joinActivity
  const req = activityData.requirements;
  if (req) {
    if (req.requireProfilePicture && !userProfileData?.photoURL) {
      throw "Du benötigst ein Profilbild, um an diesem Event teilzunehmen.";
    }
    if (req.requireVerification && userProfileData?.kycStatus !== 'verified') {
      throw "Nur verifizierte Nutzer (KYC) können diesem Event beitreten.";
    }
    if (req.minimumRating && (userProfileData?.averageRating || 0) < req.minimumRating) {
      const hasNoRating = !userProfileData?.ratingCount || userProfileData.ratingCount === 0;
      if (!hasNoRating) {
        throw `Dieses Event erfordert eine Mindestbewertung von ${req.minimumRating} Sternen.`;
      }
    }
    if (req.gender && req.gender.length > 0) {
      const userGender = userProfileData?.gender || 'unbekannt';
      if (!req.gender.includes(userGender)) {
          throw "Dieses Event ist nur für bestimmte Geschlechter freigegeben.";
      }
    }
    if (req.ageRange) {
      if (!userProfileData?.age) {
          throw "Bitte hinterlege dein Alter in den Profileinstellungen.";
      }
      if (req.ageRange.min && userProfileData.age < req.ageRange.min) {
          throw `Du musst mindestens ${req.ageRange.min} Jahre alt sein.`;
      }
      if (req.ageRange.max && userProfileData.age > req.ageRange.max) {
          throw `Das Höchstalter für dieses Event ist ${req.ageRange.max} Jahre.`;
      }
    }
  }

  // Add the notification for the host
  const notificationRef = doc(collection(db, 'notifications'));
  await setDoc(notificationRef, {
    recipientId: activityData.hostId,
    senderId: user.uid,
    senderName: displayNameToUse,
    senderProfile: {
      displayName: displayNameToUse,
      photoURL: photoURLToUse
    },
    type: 'join_request',
    title: 'Neue Beitrittsanfrage',
    message: `${displayNameToUse} möchte an deiner Aktivität "${activityData.placeName}" teilnehmen.`,
    isRead: false,
    createdAt: serverTimestamp(),
    activityId: activityId,
    link: `/activities/${activityId}`
  });
}

export async function acceptJoinRequest(notificationId: string, activityId: string, userIdToJoin: string): Promise<void> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app || undefined, 'us-central1');
  const respond = httpsCallable(functions, 'respondToJoinRequest');
  await respond({
    notificationId,
    activityId,
    userIdToJoin,
    action: 'accept'
  });
}

export async function declineJoinRequest(notificationId: string, activityId: string, userIdToDecline: string, customMessage: string): Promise<void> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app || undefined, 'us-central1');
  const respond = httpsCallable(functions, 'respondToJoinRequest');
  await respond({
    notificationId,
    activityId,
    userIdToJoin: userIdToDecline,
    action: 'decline',
    customMessage: customMessage || undefined
  });
}

export async function joinPaidActivity(activityId: string, user: User, transactionToken: string, source?: string | null, referralId?: string | null): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(app || undefined, 'us-central1');
    const secureJoin = httpsCallable(functions, 'secureJoinPaidActivity');
    
    await secureJoin({
      activityId,
      transactionToken,
      source,
      referralId
    });
  } catch (e: any) {
    console.error("Join Paid Activity via Cloud Function failed: ", e);
    throw new Error(e.message || "Zahlungsverifikation fehlgeschlagen.");
  }
}

export async function sendMessage(
  chatId: string, 
  text: string, 
  user: User, 
  userProfile?: UserProfile | null,
  replyTo?: { id: string; text: string; senderName: string } | null
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!text.trim()) return;

  if (!validateChatMessage(text)) {
    throw new Error('Diese Nachricht enthält nicht erlaubte Inhalte.');
  }

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) return;
  const chatData = chatSnap.data() as Chat;

  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const batch = writeBatch(db);

  const newMessageRef = doc(messagesRef);
  const messagePayload: any = {
    text: text.trim(),
    senderId: user.uid,
    senderName: userProfile?.displayName || "User",
    senderPhotoURL: userProfile?.photoURL || null,
    sentAt: serverTimestamp(),
    isPremium: userProfile?.isPremium || false,
    isSupporter: userProfile?.isSupporter || false,
  };

  if (replyTo) {
    messagePayload.replyToId = replyTo.id;
    messagePayload.replyToText = replyTo.text;
    messagePayload.replyToSenderName = replyTo.senderName;
  }

  batch.set(newMessageRef, messagePayload);

  const updates: any = {
    lastMessage: {
      text: text.trim(),
      senderName: userProfile?.displayName || "User",
      sentAt: serverTimestamp(),
    },
    lastActivityAt: serverTimestamp(),
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

export async function editMessage(chatId: string, messageId: string, newText: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  if (!validateChatMessage(newText)) {
    throw new Error('Diese Nachricht enthält nicht erlaubte Inhalte.');
  }
  const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
  await updateDoc(messageRef, {
    text: newText.trim(),
    isEdited: true,
    editedAt: serverTimestamp(),
  });
}

export async function pinMessage(chatId: string, messageId: string, messageText: string, senderName: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    pinnedMessages: arrayUnion({
      id: messageId,
      text: messageText,
      senderName: senderName,
    })
  });
}

export async function unpinMessage(chatId: string, messageId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) return;
  const chatData = chatSnap.data() as Chat;
  const pinned = chatData.pinnedMessages || [];
  const updatedPinned = pinned.filter((msg: any) => msg.id !== messageId);
  await updateDoc(chatRef, {
    pinnedMessages: updatedPinned
  });
}

export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
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

export async function leaveActivity(activityId: string, userId: string): Promise<void> {
  // Generate a deterministic, globally unique operationId for this leave operation.
  const operationId = `leave_${userId}_${activityId}_${Date.now()}`;

  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(app || undefined, 'us-central1');
    const secureLeave = httpsCallable<
      { activityId: string; operationId: string },
      { success: boolean }
    >(functions, 'secureLeaveActivity');

    await secureLeave({ activityId, operationId });
  } catch (error: any) {
    console.error('Error leaving activity:', error);
    const message = error?.message || 'Could not leave activity.';
    throw new Error(message);
  }
}

/**
 * MODUL 20: Lokales Entfernen eines Nutzers aus dem Chat (Post-Review Cleanup).
 * Behält den permanenten Attendance-Record in der Aktivität bei.
 */
export async function removeUserFromChat(chatId: string, userId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const chatRef = doc(db, 'chats', chatId);
  try {
    await updateDoc(chatRef, {
      participantIds: arrayRemove(userId),
      [`participantDetails.${userId}`]: deleteField(),
      [`unreadCount.${userId}`]: deleteField(),
    });
  } catch (error) {
    console.error('Error removing user from chat:', error);
    throw new Error('Could not remove user from chat.');
  }
}


export async function deleteActivity(activityId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');

  const activityRef = doc(db, 'activities', activityId);
  const chatRef = doc(db, 'chats', activityId);
  const messagesRef = collection(db, 'chats', activityId, 'messages');
  const participantsRef = collection(db, 'activities', activityId, 'participants');

  const activitySnap = await getDoc(activityRef);
  if (!activitySnap.exists()) return; // Already deleted or doesn't exist

  const activityData = activitySnap.data() as Activity;
  const batch = writeBatch(db);

  // Messages löschen
  const messagesSnapshot = await getDocs(messagesRef);
  messagesSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  // Teilnehmer löschen
  const participantsSnapshot = await getDocs(participantsRef);
  participantsSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  batch.delete(chatRef);
  batch.delete(activityRef);

  // Orts-Anker deinkrementieren falls vorhanden
  if (activityData.placeId && activityData.placeId !== 'custom') {
    const placeRef = doc(db, 'places', activityData.placeId);
    batch.set(placeRef, { 
      activityCount: increment(-1),
      lastActivityId: activityId
    }, { merge: true });
  }

  try {
    await batch.commit();
  } catch (error) {
    console.error('Error deleting activity and chat:', error);
    throw new Error('Could not delete activity.');
  }
}

export async function fetchUserActivities(userId: string): Promise<Activity[]> {
  if (!db) throw new Error('Firestore is not initialized.');

  const q = query(
    collection(db, 'activities'),
    where('participantIds', 'array-contains', userId)
  );

  const querySnapshot = await getDocs(q);
  const activities = querySnapshot.docs.map(doc => normalizeActivityDocument(doc.data(), doc.id));
  
  return activities.sort((a, b) => {
    const timeA = a.activityDate?.toMillis() || 0;
    const timeB = b.activityDate?.toMillis() || 0;
    return timeB - timeA;
  });
}


export async function sendFriendRequest(fromUserId: string, toUserId: string): Promise<void> {
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

export async function cancelFriendRequest(fromUserId: string, toUserId: string): Promise<void> {
    if (!db) throw new Error('Firestore is not initialized.');
    const fromUserRef = doc(db, 'users', fromUserId);
    const toUserRef = doc(db, 'users', toUserId);

    await runTransaction(db, async (transaction) => {
        transaction.update(fromUserRef, { friendRequestsSent: arrayRemove(toUserId) });
        transaction.update(toUserRef, { friendRequestsReceived: arrayRemove(fromUserId) });
    });
}

export async function acceptFriendRequest(userId: string, requestingUserId: string): Promise<void> {
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

export async function declineFriendRequest(userId: string, decliningUserId: string): Promise<void> {
    if (!db) throw new Error('Firestore is not initialized.');
    const userRef = doc(db, 'users', userId);
    const decliningUserRef = doc(db, 'users', decliningUserId);
    
    await runTransaction(db, async (transaction) => {
        transaction.update(userRef, { friendRequestsReceived: arrayRemove(decliningUserId) });
        transaction.update(decliningUserRef, { friendRequestsSent: arrayRemove(userId) });
    });
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const userRef = doc(db, 'users', userId);
  const friendRef = doc(db, 'users', friendId);

  await runTransaction(db, async (transaction) => {
      transaction.update(userRef, { friends: arrayRemove(friendId) });
      transaction.update(friendRef, { friends: arrayRemove(userId) });
  });
}

export async function deleteUserDocument(userId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const userDocRef = doc(db, 'users', userId);
  await deleteDoc(userDocRef);
}

export async function voteToCompleteActivity(activityId: string, userId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(app || undefined, 'us-central1');
    const secureVote = httpsCallable<{ activityId: string, operationId: string }, { success: boolean, allVoted?: boolean }>(functions, 'secureVoteToCompleteActivity');
    
    const operationId = `vote_complete_${activityId}_${userId}_${Date.now()}`;
    await secureVote({
      activityId,
      operationId
    });
  } catch (error: any) {
    console.error("Vote to complete Cloud Function failed: ", error);
    throw new Error(error.message || "Could not process your vote.");
  }
}

export async function completeActivity(activityId: string, userId: string, isPaid: boolean): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(app || undefined, 'us-central1');
    const secureComplete = httpsCallable<{ activityId: string, operationId: string }, { success: boolean }>(functions, 'secureCompleteActivity');
    
    const operationId = `complete_${activityId}_${Date.now()}`;
    await secureComplete({
      activityId,
      operationId
    });
  } catch (e: any) {
    console.error("Complete Activity Cloud Function failed: ", e);
    throw new Error(e.message || "Fehler beim Abschließen der Aktivität.");
  }
}

export const cancelActivity = async (activityId: string, hostId: string): Promise<void> => {
  if (!db) throw new Error('Firestore not initialized.');
  
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(app || undefined, 'us-central1');
    const secureCancel = httpsCallable<{ activityId: string, operationId: string }, { success: boolean }>(functions, 'secureCancelActivity');
    
    const operationId = `cancel_${activityId}_${Date.now()}`;
    await secureCancel({
      activityId,
      operationId
    });
  } catch (e: any) {
    console.error("Cancel Activity Cloud Function failed: ", e);
    throw new Error(e.message || "Fehler beim Stornieren der Aktivität.");
  }
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
export async function submitMultiReview(activityId: string, reviewerId: string, reviews: any[]): Promise<void> {
    if (!db) throw new Error('Firestore is not initialized.');

    for (const review of reviews) {
        if (review.comment && !validateChatMessage(review.comment)) {
            throw new Error("Diese Nachricht enthält nicht erlaubte Inhalte.");
        }
    }

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

export const submitHostRating = async (activityId: string, hostId: string, reviewerId: string, rating: number): Promise<void> => {
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

export async function findUserByUsername(username: string): Promise<UserProfile | null> {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(app || undefined, 'us-central1');
    const searchUser = httpsCallable<{ username: string }, UserProfile>(functions, 'searchUserByUsername');
    try {
        const result = await searchUser({ username });
        return result.data;
    } catch (err: any) {
        if (err.code === 'permission-denied' || err.code === 'not-found') {
            return null;
        }
        throw err;
    }
}

export async function isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean> {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app || undefined, 'us-central1');
  const checkUsername = httpsCallable<{ username: string }, { available: boolean }>(functions, 'checkUsernameAvailability');
  try {
    const result = await checkUsername({ username });
    return !result.data.available;
  } catch (error) {
    console.error("Error checking username availability:", error);
    return true; // Fallback to safe default
  }
}

export async function markNotificationAsRead(notificationId: string) {
    if (!db) throw new Error('Firestore is not initialized.');
    const notificationRef = doc(db, 'notifications', notificationId);
    await updateDoc(notificationRef, { isRead: true, readAt: serverTimestamp() });
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
    if (!db) throw new Error('Firestore is not initialized.');
    const q = query(
        collection(db, 'notifications'),
        where('recipientId', '==', userId),
        where('isRead', '==', false),
        limit(100)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { isRead: true, readAt: serverTimestamp() });
    });
    await batch.commit();
}

export async function getOrCreateDirectChat(user1Id: string, user2Id: string): Promise<string> {
  if (!db) throw new Error('Firestore is not initialized.');
  const chatId = [user1Id, user2Id].sort().join('_');
  const chatRef = doc(db, 'chats', chatId);

  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    const { auth } = await import('./auth');
    const currentUid = auth?.currentUser?.uid;

    let user1Profile: UserProfile | null = null;
    let user2Profile: UserProfile | null = null;

    if (user1Id === currentUid) {
      user1Profile = await getUserProfile(user1Id);
      user2Profile = await getPublicProfileClient(user2Id);
    } else if (user2Id === currentUid) {
      user1Profile = await getPublicProfileClient(user1Id);
      user2Profile = await getUserProfile(user2Id);
    } else {
      user1Profile = await getPublicProfileClient(user1Id);
      user2Profile = await getPublicProfileClient(user2Id);
    }

    if (!user1Profile || !user2Profile) {
        throw new Error("Could not find user profiles to start chat.");
    }

    await setDoc(chatRef, {
      type: 'direct',
      participantIds: [user1Id, user2Id],
      createdAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
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

export async function earnToken(userId: string, adWatchId: string) {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app || undefined, 'us-central1');
  const secureEarn = httpsCallable<{ adWatchId: string }, { success: boolean }>(functions, 'earnToken');
  try {
    await secureEarn({ adWatchId });
  } catch (err: any) {
    console.error("Earn Token Cloud Function failed:", err);
    throw new Error(err.message || "Token-Erwerb fehlgeschlagen.");
  }
}

export async function boostEntity(
  userId: string,
  entityId: string,
  durationHours: 6 | 12 | 24,
  type: 'activity' | 'place'
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');

  const userRef = doc(db, 'users', userId);
  const boostRef = doc(collection(db, 'boosts'));
  const entityRef = doc(db, type === 'activity' ? 'activities' : 'places', entityId);

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error('Nutzerprofil existiert nicht.');
    const userData = userSnap.data() as UserProfile;
    const tokens = userData.tokens || 0;

    if (tokens < 1) throw new Error('Ungenügend Token vorhanden.');

    const entitySnap = await transaction.get(entityRef);
    if (entitySnap.exists()) {
      const entityData = entitySnap.data() as any;
      if (entityData.isBoosted && entityData.boostExpiresAt) {
        const expiresMillis = typeof entityData.boostExpiresAt.toMillis === 'function'
          ? entityData.boostExpiresAt.toMillis()
          : typeof entityData.boostExpiresAt.toDate === 'function'
            ? entityData.boostExpiresAt.toDate().getTime()
            : new Date(entityData.boostExpiresAt).getTime();
        if (expiresMillis > Date.now()) {
          throw new Error('Bereits aktiv geboostet.');
        }
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    // Write boost record
    transaction.set(boostRef, {
      userId,
      entityId,
      entityType: type,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      boostLevel: 'standard',
      multiplier: 1.06
    });

    // Deduct token
    transaction.update(userRef, {
      tokens: increment(-1)
    });

    // Update entity
    transaction.update(entityRef, {
      isBoosted: true,
      boostExpiresAt: Timestamp.fromDate(expiresAt)
    });
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

  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(app || undefined, 'us-central1');
    const securePayout = httpsCallable<{ amount?: number, operationId: string }, { success: boolean, payoutRequestId?: string }>(functions, 'secureRequestPayout');
    
    const operationId = `payout_${userId}_${Date.now()}`;
    await securePayout({
      amount: currentBalance,
      operationId
    });
  } catch (e: any) {
    console.error("Request Payout Cloud Function failed: ", e);
    throw new Error(e.message || "Auszahlungsanforderung fehlgeschlagen.");
  }
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

export async function submitCreatorApplication(userId: string, userDisplayName: string | null, averageRating: number, activitiesCount: number) {
  if (!db) throw new Error('Firestore is not initialized.');
  const appRef = doc(collection(db, 'creator_applications'));
  await setDoc(appRef, {
    userId,
    userDisplayName,
    averageRating,
    activitiesCount,
    status: 'pending',
    createdAt: serverTimestamp()
  });
}

export async function approveCreator(applicationId: string, userId: string) {
  if (!db) throw new Error('Firestore is not initialized.');
  const batch = writeBatch(db);
  
  batch.update(doc(db, 'users', userId), { isCreator: true });
  batch.update(doc(db, 'creator_applications', applicationId), { status: 'approved' });
  
  await batch.commit();
}

/**
 * MODUL 18: Admin Moderation Resolver.
 * Erlaubt das Freischalten (Keep) oder Blacklisten einer Aktivität.
 */
export async function resolveModerationTask(reportId: string, activityId: string, action: 'keep' | 'blacklist') {
  if (!db) throw new Error('Firestore is not initialized.');
  const batch = writeBatch(db);
  const activityRef = doc(db, 'activities', activityId);
  const reportRef = doc(db, 'reports', reportId);

  if (action === 'keep') {
    batch.update(activityRef, { isVerified: true });
  } else {
    const actSnap = await getDoc(activityRef);
    if (actSnap.exists()) {
        const actData = actSnap.data();
        if (actData.placeId && actData.placeId !== 'custom' && (actData.status === 'active' || actData.status === 'open')) {
            const placeRef = doc(db, 'places', actData.placeId);
            batch.set(placeRef, { activityCount: increment(-1), lastActivityId: activityId }, { merge: true });
        }
    }
    batch.update(activityRef, { status: 'blacklisted' });
  }

  batch.update(reportRef, {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    moderatorAction: action
  });

  await batch.commit();
}

export async function searchActivitiesBySemanticVector(queryText: string, hardBlacklist: string[] = []): Promise<Activity[]> {
  if (!db) throw new Error('Firestore is not initialized.');
  
  const functions = getFunctions(app || undefined, 'us-central1');
  const getSearchVector = httpsCallable<{queryText: string}, {results: Activity[]}>(functions, 'getSearchVector');
  const response = await getSearchVector({ queryText });
  const results = response.data.results || [];
  
  if (hardBlacklist.length === 0) return results;
  
  return results.filter(act => !act.category || !hardBlacklist.includes(act.category));
}

export async function deleteUserData(userId: string) {
  // Deprecated: All cascading deletion is handled securely on the server-side
  // via the onUserDeleted Firebase Auth onDelete trigger.
  console.log(`deleteUserData called client-side for ${userId} (no-op: handled by server trigger).`);
}

export async function cleanupGhostUsers() {
  if (!db) throw new Error('Firestore is not initialized.');
  
  // 1. Alle existierenden User-IDs abrufen
  const usersSnap = await getDocs(collection(db, 'users'));
  const validUserIds = new Set(usersSnap.docs.map(doc => doc.id));

  const batch = writeBatch(db);
  let changesCount = 0;

  // 2. Aktivitäten bereinigen
  const activitiesSnap = await getDocs(collection(db, 'activities'));
  
  for (const docSnap of activitiesSnap.docs) {
    const actData = docSnap.data();
    let changed = false;
    let updates: any = {};

    // Prüfe Host
    if (actData.hostId && !validUserIds.has(actData.hostId)) {
        if (actData.status !== 'cancelled') {
           updates.status = 'cancelled';
           changed = true;
        }
    }

    // Prüfe Teilnehmer
    const originalParticipantIds = actData.participantIds || [];
    const validParticipantIds = originalParticipantIds.filter((uid: string) => validUserIds.has(uid));
    
    const originalPreview = actData.participantsPreview || [];
    const validPreview = originalPreview.filter((p: any) => validUserIds.has(p.uid));

    if (validParticipantIds.length !== originalParticipantIds.length) {
       updates.participantIds = validParticipantIds;
       updates.participantsPreview = validPreview;
       changed = true;
    }

    if (changed) {
       batch.update(docSnap.ref, updates);
       changesCount++;
    }
  }

  // 3. Chats bereinigen
  const chatsSnap = await getDocs(collection(db, 'chats'));
  for (const docSnap of chatsSnap.docs) {
      const chatData = docSnap.data();
      const originalParticipantIds = chatData.participantIds || [];
      const validParticipantIds = originalParticipantIds.filter((uid: string) => validUserIds.has(uid));
      
      const originalDetails = chatData.participantDetails || {};
      const validDetails: any = {};
      for (const [uid, details] of Object.entries(originalDetails)) {
          if (validUserIds.has(uid)) {
              validDetails[uid] = details;
          }
      }

      if (validParticipantIds.length !== originalParticipantIds.length || Object.keys(validDetails).length !== Object.keys(originalDetails).length) {
          batch.update(docSnap.ref, { 
              participantIds: validParticipantIds,
              participantDetails: validDetails
          });
          changesCount++;
      }
  }

  if (changesCount > 0) {
      await batch.commit();
  }
  return changesCount;
}

export interface CleanupChatsResult {
  chatsDeleted: number;
  messagesDeleted: number;
  activitiesDeleted: number;
  activityParticipantsDeleted: number;
  placeCountersUpdated: number;
  skipped: number;
  errors: number;
}

export async function triggerCleanupEmptyChats(): Promise<CleanupChatsResult> {
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const functions = getFunctions(app || undefined, 'us-central1');
    const cleanup = httpsCallable<void, CleanupChatsResult>(functions, 'cleanupEmptyChats');
    const res = await cleanup();
    return res.data;
  } catch (error: any) {
    console.error("Cleanup Empty Chats Cloud Function failed: ", error);
    throw new Error(error.message || "Fehler beim Bereinigen der leeren Chats.");
  }
}


