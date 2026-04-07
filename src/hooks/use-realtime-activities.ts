import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, limit, onSnapshot, where, orderBy, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Activity } from '@/lib/types';

interface UseRealtimeActivitiesOptions {
  isCommunity: boolean;
  enabled: boolean;
  initialLimit?: number;
}

export function useRealtimeActivities({ 
  isCommunity, 
  enabled, 
  initialLimit = 10 
}: UseRealtimeActivitiesOptions) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentLimit, setCurrentLimit] = useState<number>(initialLimit);
  const [hasMore, setHasMore] = useState<boolean>(true);

  useEffect(() => {
    if (!enabled || !db) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Build the query constraints
    const constraints: QueryConstraint[] = [
      where('isCustomActivity', '==', isCommunity),
      orderBy('createdAt', 'desc'),
      limit(currentLimit)
    ];

    const q = query(collection(db, 'activities'), ...constraints);

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const newActivities = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Activity[];
        
        setActivities(newActivities);
        // If we received fewer documents than the limit, we've reached the end
        setHasMore(newActivities.length >= currentLimit);
        setLoading(false);
      },
      (err) => {
        console.error("🔥 Error in useRealtimeActivities onSnapshot:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isCommunity, enabled, currentLimit]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setCurrentLimit(prev => prev + 10);
    }
  }, [loading, hasMore]);

  const resetLimit = useCallback(() => {
    setCurrentLimit(initialLimit);
  }, [initialLimit]);

  return {
    activities,
    loading,
    error,
    hasMore,
    loadMore,
    resetLimit
  };
}
