'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './use-auth';
import { fetchFriendsProfiles } from '@/lib/friends';
import type { UserProfile } from '@/lib/types';
import { useToast } from './use-toast';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useProximityRadar() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [nearbyFriends, setNearbyFriends] = useState<UserProfile[]>([]);

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

          const dist = getDistance(
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
  }, [userProfile, nearbyFriends.length, toast]);

  return nearbyFriends;
}
