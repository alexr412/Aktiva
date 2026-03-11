"use client";

import { useEffect, useState } from "react";
import { fetchFriendsProfiles } from "@/lib/friends";
import type { UserProfile } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { MapPin, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <div className="space-y-4 mb-12 w-full px-2">
        <Skeleton className="h-8 w-48 ml-4 mb-2" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-[2rem]" />
          <Skeleton className="h-24 rounded-[2rem]" />
        </div>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="px-2 mb-12">
        <div className="text-neutral-400 font-bold border-2 border-dashed border-neutral-200 p-12 rounded-[2rem] text-center bg-white/50">
          Noch keine Freunde hinzugefügt.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mb-12 w-full px-2">
      <h3 className="font-black text-xl text-[#0f172a] dark:text-neutral-200 ml-4 flex items-center gap-2">
        Freunde <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-lg text-xs">{friends.length}</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {friends.map(friend => {
          const proximity = getProximityLabel(friend);
          return (
            <Link href={`/profile/${friend.uid}`} key={friend.uid} className="block group">
              <Card className="flex items-center gap-4 p-4 border-none rounded-[2rem] bg-white dark:bg-neutral-900 group-hover:shadow-md transition-all cursor-pointer shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                <div className="p-1 bg-secondary rounded-full">
                    <Avatar className="h-14 w-14 border-2 border-white">
                      <AvatarImage src={friend.photoURL || undefined} />
                      <AvatarFallback className="bg-primary/5 text-primary font-black">{friend.displayName?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                </div>
                <div className="flex flex-col overflow-hidden">
                  <span className="font-black text-[#0f172a] dark:text-neutral-200 truncate leading-tight">{friend.displayName || "Unbekannter Nutzer"}</span>
                  {proximity ? (
                    <span className="text-[9px] text-green-600 font-black flex items-center gap-1 mt-1 uppercase tracking-wider">
                      <MapPin className="h-3 w-3" />
                      {proximity}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-400 font-bold truncate flex items-center gap-1 mt-1">
                      <Compass className="h-3 w-3" />
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
