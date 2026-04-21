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
import { useLanguage } from "@/hooks/use-language";

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
  const language = useLanguage();
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

    if (dist < 5) return language === 'de' ? "In direkter Nähe (< 5km)" : "Very close (< 5km)";
    if (dist < 20) return language === 'de' ? "In der Umgebung (< 20km)" : "Nearby (< 20km)";
    return language === 'de' ? "Weiter entfernt" : "Further away";
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
        <div className="text-neutral-400 font-bold border-2 border-dashed border-neutral-200 p-12 rounded-[2rem] text-center bg-white/50 dark:bg-neutral-900/50 dark:border-neutral-800">
          {language === 'de' ? 'Noch keine Freunde hinzugefügt.' : 'No friends added yet.'}
        </div>
      </div>
    );
  }

  // Architektur-Fix: Robuste Deduplizierung zur Vermeidung von React Key-Kollisionen
  // Filtert ungültige Profile und nutzt eine Map für eindeutige UIDs
  const uniqueFriends = Array.from(
    new Map(
      friends
        .filter(f => f && (f.uid || (f as any).id))
        .map(f => [f.uid || (f as any).id, f])
    ).values()
  );

  return (
    <div className="flex flex-col gap-5 mb-12 w-full">
      <div className="flex items-center justify-between px-4">
        <h3 className="font-black text-2xl text-[#0f172a] dark:text-neutral-200 flex items-center gap-2.5">
          {language === 'de' ? 'Freunde' : 'Friends'} <span className="bg-[#59a27a]/10 text-[#59a27a] px-3 py-1 rounded-full text-sm font-black tracking-tight">{uniqueFriends.length}</span>
        </h3>
        <Link href="/community" className="text-[#59a27a] font-black text-sm hover:opacity-70 transition-opacity">{language === 'de' ? 'Alle sehen' : 'See all'}</Link>
      </div>

      <div className="flex overflow-x-auto pb-4 gap-4 px-4 no-scrollbar scroll-smooth">
        {uniqueFriends.map((friend, index) => {
          const proximity = getProximityLabel(friend);
          const friendKey = friend.uid || (friend as any).id || `fallback-${index}`;
          
          return (
            <Link href={`/profile/${friend.uid || (friend as any).id}`} key={friendKey} className="block shrink-0 w-[42%]">
              <div className="flex flex-col items-center gap-3 p-5 border border-slate-100 dark:border-neutral-800 rounded-[2.5rem] bg-white dark:bg-neutral-900 hover:shadow-xl hover:shadow-slate-200/50 transition-all cursor-pointer relative overflow-hidden group">
                <div className="relative">
                    <Avatar className="h-16 w-16 border-2 border-slate-50 shadow-md">
                      <AvatarImage src={friend.photoURL || undefined} />
                      <AvatarFallback className="bg-[#f0f9ff] text-[#3b82f6] font-black text-xl">{friend.displayName?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-neutral-800 p-1 rounded-full shadow-sm border border-slate-100">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                </div>
                <div className="flex flex-col items-center text-center overflow-hidden w-full">
                  <span className="font-black text-[#0f172a] dark:text-neutral-100 truncate w-full leading-tight text-lg">{friend.displayName?.split(' ')[0] || (language === 'de' ? 'Nutzer' : 'User')}</span>
                  <div className="flex items-center gap-1 mt-1 text-rose-500">
                    <MapPin className="h-3 w-3 fill-current" />
                    <span className="text-[10px] font-black uppercase tracking-tight whitespace-nowrap">
                      {proximity ? proximity : (friend.location?.split(' ')[0] || "Hagen")}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
