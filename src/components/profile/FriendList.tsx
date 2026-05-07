"use client";

import { useEffect, useState } from "react";
import { fetchFriendsProfiles } from "@/lib/friends";
import type { UserProfile } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { MapPin, Compass, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { db } from "@/lib/firebase/client";
import { doc, updateDoc, arrayRemove } from "firebase/firestore";

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

        // Auto-Cleanup: IDs entfernen, die keine Profile mehr haben
        if (currentUser?.uid && data.length < friendIds.length) {
          const foundIds = new Set(data.map(f => f.uid || (f as any).id));
          const missingIds = friendIds.filter(id => !foundIds.has(id));
          
          if (missingIds.length > 0) {
            console.log("Cleaning up ghost friends:", missingIds);
            const userRef = doc(db!, "users", currentUser.uid);
            for (const mid of missingIds) {
              await updateDoc(userRef, {
                friends: arrayRemove(mid)
              });
            }
          }
        }
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

    const lastUpdate = typeof friend.lastLocation.updatedAt === 'object' && 'toMillis' in friend.lastLocation.updatedAt 
      ? friend.lastLocation.updatedAt.toMillis() 
      : Date.now();
      
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (now - lastUpdate > twentyFourHours) return null;

    const dist = calculateDistance(
      currentUser.lastLocation.lat,
      currentUser.lastLocation.lng,
      friend.lastLocation.lat,
      friend.lastLocation.lng
    );

    if (dist < 2) return language === 'de' ? "Ganz nah" : "Very close";
    if (dist < 10) return language === 'de' ? "In der Nähe" : "Nearby";
    if (dist < 50) return language === 'de' ? "Umgebung" : "Area";
    return null;
  };

  const getActivityStatus = (friend: UserProfile) => {
    if (!friend.lastLocation?.updatedAt) return null;
    
    const lastUpdate = typeof friend.lastLocation.updatedAt === 'object' && 'toMillis' in friend.lastLocation.updatedAt 
      ? (friend.lastLocation.updatedAt as any).toMillis() 
      : Date.now();
      
    const now = Date.now();
    const diffMin = Math.floor((now - lastUpdate) / 60000);

    if (diffMin < 5) return language === 'de' ? "Gerade aktiv" : "Active now";
    if (diffMin < 60) return `${diffMin}m`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
    return null;
  };

  if (isLoading && friendIds.length > 0) {
    return (
      <div className="flex flex-col gap-5 mb-12 w-full">
        <div className="flex items-center justify-between px-4">
          <div className="h-8 w-32 bg-slate-100 animate-pulse rounded-xl" />
          <div className="h-4 w-16 bg-slate-50 animate-pulse rounded-lg" />
        </div>
        <div className="flex gap-4 px-4 overflow-x-hidden">
          {friendIds.slice(0, 3).map((_, i) => (
            <Skeleton key={i} className="h-32 w-[35%] shrink-0 rounded-[2rem] bg-neutral-200" />
          ))}
        </div>
      </div>
    );
  }

  if (friendIds.length === 0) {
    return (
      <div className="px-6 mb-6">
        <div className="relative overflow-hidden bg-white dark:bg-neutral-900 border border-[#E5E7EB] dark:border-neutral-800 rounded-2xl py-8 px-6 flex flex-col items-center text-center shadow-none">
          {/* Illustration Stack - Scaled per Root Architecture */}
          <div className="relative mb-6">
            <div className="relative flex items-center justify-center">
               <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center border-2 border-[#E5E7EB] dark:border-neutral-800">
                  <Users className="w-12 h-12 text-[#10b981]" />
               </div>
               <div className="absolute -top-1 -right-1 w-7 h-7 rounded-xl bg-white dark:bg-neutral-800 flex items-center justify-center border border-[#E5E7EB] dark:border-neutral-700">
                  <UserPlus className="w-4 h-4 text-[#10b981]" />
               </div>
            </div>
          </div>

          <div className="relative z-10 w-full max-w-[240px]">
            <h3 className="text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
              {language === 'de' ? 'Search For New Friends' : 'Search For New Friends'}
            </h3>
            <p className="text-[11px] font-medium text-slate-400 mb-6 leading-tight px-2">
              {language === 'de' ? 'Connect with explorers worldwide and build your circle.' : 'Connect with explorers worldwide and build your circle.'}
            </p>
            
            <Link href="/community" className="w-full">
              <Button className="w-full h-11 rounded-full bg-[#10b981] hover:bg-emerald-600 text-white font-black tracking-tight text-[13px] shadow-none border-none transition-all active:scale-[0.98]">
                {language === 'de' ? 'Search For New Friends' : 'Search For New Friends'}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const uniqueFriends = Array.from(
    new Map(
      friends
        .filter(f => f && (f.uid || (f as any).id))
        .map(f => [f.uid || (f as any).id, f])
    ).values()
  );

  return (
    <div className="flex flex-col gap-5 mb-1 w-full">
      <div className="flex items-center justify-between px-4">
        <h3 className="">
          {language === 'de' ? 'Freunde' : 'Friends'} 
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-black tracking-tight">
            {uniqueFriends.length}
          </span>
        </h3>
        <Link href="/community" className="text-primary font-black text-sm hover:opacity-70 transition-opacity">
          {language === 'de' ? 'Alle sehen' : 'See all'}
        </Link>
      </div>

      <div className="flex overflow-x-auto pb-4 gap-4 px-4 no-scrollbar scroll-smooth">
        {uniqueFriends.length > 0 ? (
          uniqueFriends.map((friend, index) => {
            const proximity = getProximityLabel(friend);
            const status = getActivityStatus(friend);
            const friendKey = friend.uid || (friend as any).id || `fallback-${index}`;
            
            return (
              <Link href={`/profile/${friend.uid || (friend as any).id}`} key={friendKey} className="block shrink-0 w-[35%] max-w-[140px]">
                <div className="flex flex-col items-center gap-2 p-4 rounded-[1.5rem] bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 transition-all cursor-pointer relative overflow-hidden group hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                  <div className="relative">
                      <Avatar className={cn(
                        "h-14 w-14 border-0 shadow-none transition-transform group-hover:scale-105",
                        friend.isCreator
                          ? "ring-4 ring-slate-900 dark:ring-blue-500"
                          : friend.isPremium 
                          ? "ring-4 ring-amber-400 dark:ring-amber-500" 
                          : friend.isSupporter
                          ? "ring-4 ring-red-500"
                          : "ring-4 ring-slate-50 dark:ring-neutral-800/50"
                      )}>
                        <AvatarImage src={friend.photoURL || undefined} />
                        <AvatarFallback className="bg-slate-100 text-slate-400 font-black text-xl">
                          {friend.displayName?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      {status === (language === 'de' ? "Gerade aktiv" : "Active now") && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-white dark:bg-neutral-900 p-0.5 rounded-full border border-slate-100 dark:border-neutral-800">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        </div>
                      )}
                  </div>
                  <div className="flex flex-col items-center text-center overflow-hidden w-full mt-1">
                    <span className="font-bold text-slate-900 dark:text-neutral-100 truncate w-full leading-tight text-[13px]">
                      {friend.displayName?.split(' ')[0] || (language === 'de' ? 'Nutzer' : 'User')}
                    </span>
                    <div className="flex flex-col items-center gap-0.5 mt-1 w-full">
                      <div className="flex items-center gap-1 text-slate-400 overflow-hidden w-full justify-center">
                        <MapPin className="h-2.5 w-2.5 shrink-0 opacity-40" />
                        <span className="text-[10px] font-bold opacity-70 truncate max-w-[80px]">
                          {proximity ? proximity : (friend.location?.split(',')[0] || "Aktiva")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        ) : isLoading ? (
          friendIds.slice(0, 3).map((_, i) => (
            <Skeleton key={i} className="h-32 w-[35%] shrink-0 rounded-[2rem] bg-neutral-200" />
          ))
        ) : (
          <div className="px-4 w-full">
             <div className="text-neutral-400 font-medium py-8 text-center bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                {language === 'de' ? 'Profil konnte nicht geladen werden' : 'Profile could not be loaded'}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
