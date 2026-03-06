"use client";

import { useEffect, useState } from "react";
import { fetchFriendsProfiles } from "@/lib/friends";
import type { UserProfile } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { MapPin } from "lucide-react";

interface FriendListProps {
  friendIds: string[];
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius der Erde in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function FriendList({ friendIds }: FriendListProps) {
  const { userProfile: currentUser } = useAuth();
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadFriends = async () => {
      if (!friendIds || friendIds.length === 0) {
        setFriends([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await fetchFriendsProfiles(friendIds);
        setFriends(data);
      } catch (error) {
        console.error("Failed to load friends:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadFriends();
  }, [friendIds]);

  const getProximityLabel = (friend: UserProfile) => {
    // Bilaterale Prüfung & Zeitstempel-Validierung (max 24h)
    if (!currentUser?.proximitySettings?.enabled || !friend.proximitySettings?.enabled) return null;
    if (!currentUser.lastLocation || !friend.lastLocation?.updatedAt) return null;

    const lastUpdate = friend.lastLocation.updatedAt.toMillis();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (now - lastUpdate > twentyFourHours) return null;

    const dist = calculateDistance(
      currentUser.lastLocation.lat,
      currentUser.lastLocation.lng,
      friend.lastLocation.lat,
      friend.lastLocation.lng
    );

    if (dist < 5) return "In direkter Nähe (< 5km)";
    if (dist < 20) return "In der Umgebung (< 20km)";
    return "Weiter entfernt";
  };

  if (isLoading) {
    return (
      <div className="space-y-4 mt-8 w-full px-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="px-6 mt-8">
        <div className="text-sm text-muted-foreground border border-dashed border-border p-8 rounded-xl text-center">
          Noch keine Freunde hinzugefügt.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-8 w-full px-6">
      <h3 className="font-bold text-xl border-b border-border pb-2">Freunde ({friends.length})</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {friends.map(friend => {
          const proximity = getProximityLabel(friend);
          return (
            <Link href={`/profile/${friend.uid}`} key={friend.uid} className="block group">
              <Card className="flex items-center gap-4 p-4 border border-border rounded-xl bg-card group-hover:bg-secondary/50 transition-colors cursor-pointer shadow-sm">
                <Avatar className="h-12 w-12 border border-primary/10">
                  <AvatarImage src={friend.photoURL || undefined} />
                  <AvatarFallback>{friend.displayName?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-bold truncate">{friend.displayName || "Unbekannter Nutzer"}</span>
                  {proximity ? (
                    <span className="text-[10px] text-green-600 font-bold flex items-center gap-1 mt-0.5 uppercase tracking-tighter">
                      <MapPin className="h-3 w-3" />
                      {proximity}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground truncate">
                      {friend.location || "Kein Standort"}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
