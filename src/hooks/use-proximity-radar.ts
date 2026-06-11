'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './use-auth';
import { fetchFriendsProfiles } from '@/lib/friends';
import type { UserProfile } from '@/lib/types';
import { useToast } from './use-toast';
import { calculateDistance } from '@/lib/geo-utils';

export function useProximityRadar() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [nearbyFriends, setNearbyFriends] = useState<UserProfile[]>([]);

  const friendsKey = useMemo(
    () => userProfile?.friends?.slice().sort().join(",") ?? "",
    [userProfile?.friends]
  );

  useEffect(() => {
    if (!userProfile?.proximitySettings?.enabled || !userProfile.lastLocation || !userProfile.friends || userProfile.friends.length === 0) {
      return;
    }

    const checkNearby = async () => {
      try {
        const friends = await fetchFriendsProfiles(userProfile.friends!);
        const now = Date.now();
        const maxAgeMs = 3 * 60 * 60 * 1000; // 3 Stunden Gültigkeit

        const nearby = friends.filter(friend => {
          if (!friend.lastLocation?.lat || !friend.lastLocation?.lng || !friend.lastLocation.updatedAt) return false;
          
          // Check Recency (nur Nutzer anzeigen, die vor kurzem online waren)
          const updatedAtMs = friend.lastLocation.updatedAt.toMillis();
          if (now - updatedAtMs > maxAgeMs) return false;

          const dist = calculateDistance(
            userProfile.lastLocation!.lat,
            userProfile.lastLocation!.lng,
            friend.lastLocation.lat,
            friend.lastLocation.lng
          );

          return dist <= (userProfile.proximitySettings?.radiusKm || 5);
        });

        if (nearby.length > nearbyFriends.length) {
          const newFriend = nearby.find(f => !nearbyFriends.some(nf => nf.uid === f.uid));
          if (newFriend) {
            const { dismiss } = toast({
              title: "Freunde in der Nähe!",
              description: `${newFriend.displayName} ist gerade in deinem Radar aufgetaucht.`,
            });
            
            // Auto-dismiss after 3 seconds
            setTimeout(() => {
              dismiss();
            }, 3000);
          }
        }

        setNearbyFriends(nearby);
      } catch (err) {
        console.error("Proximity radar error:", err);
      }
    };

    checkNearby();
    const interval = setInterval(checkNearby, 5 * 60 * 1000); // Alle 5 Min prüfen
    return () => clearInterval(interval);
  }, [
    userProfile?.uid,
    userProfile?.proximitySettings?.enabled,
    userProfile?.proximitySettings?.radiusKm,
    userProfile?.lastLocation?.lat,
    userProfile?.lastLocation?.lng,
    friendsKey,
    nearbyFriends.length,
    toast
  ]);

  return nearbyFriends;
}
