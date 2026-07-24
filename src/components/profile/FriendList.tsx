"use client";

import { useEffect, useState } from "react";
import { fetchFriendsProfiles } from "@/lib/friends";
import type { UserProfile } from "@/lib/types";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { MapPin, UserPlus, Users } from "lucide-react";
import { formatFirstName } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { db } from "@/lib/firebase/client";
import { doc, updateDoc, arrayRemove } from "firebase/firestore";

interface FriendListProps {
  friendIds: string[];
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
          
          if (missingIds.length > 0 && db) {
            const userRef = doc(db, "users", currentUser.uid);
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
  }, [friendIds, currentUser?.uid]);

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
              {language === 'de' ? 'Neue Freunde finden' : 'Search For New Friends'}
            </h3>
            <p className="text-[11px] font-medium text-slate-400 mb-6 leading-tight px-2">
              {language === 'de' ? 'Vernetze dich mit Entdeckern in deiner Umgebung.' : 'Connect with explorers worldwide and build your circle.'}
            </p>
            
            <Link href="/community" className="w-full">
              <Button className="w-full h-11 rounded-full font-black tracking-tight text-[13px] shadow-none border-none transition-all active:scale-[0.98]">
                {language === 'de' ? 'Freunde suchen' : 'Search For New Friends'}
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
        <h3 className="text-base font-black text-slate-900 dark:text-neutral-100 flex items-center gap-2">
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
            const friendKey = friend.uid || (friend as any).id || `fallback-${index}`;
            
            return (
              <Link href={`/users/${friend.uid || (friend as any).id}`} key={friendKey} className="block shrink-0 w-[35%] max-w-[140px]">
                <div className="flex flex-col items-center gap-2 p-4 rounded-[1.5rem] bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 transition-all cursor-pointer relative overflow-hidden group hover:bg-slate-50 dark:hover:bg-neutral-800/50">
                  <div className="relative">
                      <ProfileAvatar 
                        className="h-14 w-14 border-0 shadow-none transition-transform group-hover:scale-105"
                        photoURL={friend.photoURL}
                        displayName={friend.displayName}
                        isPremium={friend.isPremium}
                        isCreator={friend.isCreator}
                        isSupporter={friend.isSupporter}
                      />
                  </div>
                  <div className="flex flex-col items-center text-center overflow-hidden w-full mt-1">
                    <span className="font-bold text-slate-900 dark:text-neutral-100 truncate w-full leading-tight text-[13px]">
                      {formatFirstName(friend.displayName, language === 'de' ? 'Nutzer' : 'User')}
                    </span>
                    <div className="flex flex-col items-center gap-0.5 mt-1 w-full">
                      <div className="flex items-center gap-1 text-slate-400 overflow-hidden w-full justify-center">
                        <MapPin className="h-2.5 w-2.5 shrink-0 opacity-40" />
                        <span className="text-[10px] font-bold opacity-70 truncate max-w-[80px]">
                          {friend.location?.split(',')[0] || "Aktiva"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
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
