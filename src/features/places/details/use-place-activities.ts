'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { normalizeActivityDocument } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';

export function usePlaceActivities(placeId?: string) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    if (!db || !placeId) {
      setActivities([]);
      setLoadingActivities(false);
      return;
    }
    setLoadingActivities(true);

    const activitiesQuery = query(
      collection(db, 'activities'),
      where('placeId', '==', placeId)
    );

    const unsubscribe = onSnapshot(
      activitiesQuery,
      (snapshot) => {
        const fetchedActivities = snapshot.docs.map((doc) =>
          normalizeActivityDocument(doc.data(), doc.id)
        );
        setActivities(
          fetchedActivities.sort(
            (a, b) => b.activityDate.toMillis() - a.activityDate.toMillis()
          )
        );
        setLoadingActivities(false);
      },
      (error) => {
        console.error('🔥 FIRESTORE QUERY ERROR (PlaceDetails):', error.message);
        setLoadingActivities(false);
      }
    );

    return () => unsubscribe();
  }, [placeId]);

  return {
    activities,
    loadingActivities,
  };
}
