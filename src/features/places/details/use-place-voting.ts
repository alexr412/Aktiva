'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { votePlace } from '@/lib/firebase/firestore';
import type { Place } from '@/lib/types';
import type { UserProfile } from '@/lib/types';
import type { User } from 'firebase/auth';

export interface PlaceMetaState {
  avgRating: number;
  reviewCount: number;
  upvotes: number;
  downvotes: number;
  communityScore: number;
  userVotes: Record<string, 'up' | 'down'>;
  weightedUpvotes: number;
  weightedDownvotes: number;
}

export function usePlaceVoting(
  place: Place,
  user: User | null,
  userProfile: UserProfile | null
) {
  const [placeMeta, setPlaceMeta] = useState<PlaceMetaState>({
    avgRating: 0,
    reviewCount: 0,
    upvotes: 0,
    downvotes: 0,
    communityScore: 0,
    userVotes: {},
    weightedUpvotes: 0,
    weightedDownvotes: 0,
  });
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [isVoting, setIsVoting] = useState(false);

  const userVote = user ? placeMeta.userVotes?.[user.uid] || 'none' : 'none';

  useEffect(() => {
    if (!db || !place.id) {
      setLoadingMeta(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'places', place.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPlaceMeta({
          avgRating: data.avgRating || 0,
          reviewCount: data.reviewCount || 0,
          upvotes: data.upvotes || 0,
          downvotes: data.downvotes || 0,
          communityScore: data.communityScore || 0,
          userVotes: data.userVotes || {},
          weightedUpvotes: data.weightedUpvotes || 0,
          weightedDownvotes: data.weightedDownvotes || 0,
        });
      }
      setLoadingMeta(false);
    });
    return () => unsub();
  }, [place.id]);

  const handleVoteClick = async (
    e: React.MouseEvent,
    type: 'up' | 'down' | 'none'
  ) => {
    e.stopPropagation();
    if (!user || isVoting) return;
    setIsVoting(true);

    setPlaceMeta((prev) => {
      const prevVote = prev.userVotes?.[user.uid] || 'none';
      let upDelta = 0;
      let downDelta = 0;
      const newUserVotes = { ...prev.userVotes };

      if (prevVote === 'up') upDelta -= 1;
      else if (prevVote === 'down') downDelta -= 1;

      if (type === 'up') {
        upDelta += 1;
        newUserVotes[user.uid] = 'up';
      } else if (type === 'down') {
        downDelta += 1;
        newUserVotes[user.uid] = 'down';
      } else {
        delete newUserVotes[user.uid];
      }

      return {
        ...prev,
        upvotes: Math.max(0, prev.upvotes + upDelta),
        downvotes: Math.max(0, prev.downvotes + downDelta),
        userVotes: newUserVotes,
      };
    });

    try {
      await votePlace(place.id, user.uid, type, userProfile?.role, place);
    } catch (error) {
      console.error('Voting failed:', error);
    } finally {
      setIsVoting(false);
    }
  };

  return {
    placeMeta,
    loadingMeta,
    userVote,
    isVoting,
    handleVoteClick,
  };
}
