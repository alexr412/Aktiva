"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchFriendsProfiles } from "@/lib/friends";
import type { UserProfile } from "@/lib/types";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { MapPin, UserPlus, Users, MessageCircle, UserMinus, Loader2 } from "lucide-react";
import { formatFirstName } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import { db } from "@/lib/firebase/client";
import { doc, updateDoc, arrayRemove } from "firebase/firestore";
import { removeFriend, getOrCreateDirectChat } from "@/lib/firebase/firestore";
import { AddFriendDialog } from "@/components/friends/AddFriendDialog";
import { UserBadge } from "@/components/common/UserBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FriendListProps {
  friendIds: string[];
}

export default function FriendList({ friendIds }: FriendListProps) {
  const { userProfile: currentUser } = useAuth();
  const language = useLanguage();
  const router = useRouter();
  const { toast } = useToast();

  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);
  const [showAllFriendsDialog, setShowAllFriendsDialog] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<UserProfile | null>(null);
  const [startingDmUid, setStartingDmUid] = useState<string | null>(null);

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

  const handleStartDm = async (friendId: string) => {
    if (!currentUser?.uid) return;
    setStartingDmUid(friendId);
    try {
      const chatId = await getOrCreateDirectChat(currentUser.uid, friendId);
      setShowAllFriendsDialog(false);
      router.push(`/chat/${chatId}`);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: err.message || (language === 'de' ? 'Chat konnte nicht gestartet werden.' : 'Could not start chat.'),
      });
    } finally {
      setStartingDmUid(null);
    }
  };

  const handleConfirmRemoveFriend = async () => {
    if (!currentUser?.uid || !friendToRemove) return;
    const friendId = friendToRemove.uid || (friendToRemove as any).id;
    if (!friendId) return;

    try {
      await removeFriend(currentUser.uid, friendId);
      setFriends(prev => prev.filter(f => (f.uid || (f as any).id) !== friendId));
      toast({
        title: language === 'de' ? 'Freund entfernt' : 'Friend Removed',
        description: language === 'de' ? 'Der Nutzer wurde aus deinen Freunden entfernt.' : 'User was removed from your friends.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: err.message || (language === 'de' ? 'Konnte Freund nicht entfernen.' : 'Could not remove friend.'),
      });
    } finally {
      setFriendToRemove(null);
    }
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
      <div className="px-6 lg:px-0 mb-6">
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
            
            <Button
              onClick={() => setShowAddFriendDialog(true)}
              className="w-full h-11 rounded-full font-black tracking-tight text-[13px] shadow-none border-none transition-all active:scale-[0.98]"
            >
              {language === 'de' ? 'Freunde suchen' : 'Search For New Friends'}
            </Button>
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
    <>
      <div className="flex flex-col gap-5 mb-1 w-full">
        <div className="flex items-center justify-between px-4 lg:px-0">
          <h3 className="text-base font-black text-slate-900 dark:text-neutral-100 flex items-center gap-2 shrink-0">
            {language === 'de' ? 'Freunde' : 'Friends'}{' '}
            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-black tracking-tight">
              {uniqueFriends.length}
            </span>
          </h3>
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAddFriendDialog(true)}
              aria-label={language === 'de' ? 'Freund hinzufügen' : 'Add friend'}
              className="h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-all active:scale-95 shrink-0"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
            <button
              onClick={() => setShowAllFriendsDialog(true)}
              className="text-primary font-black text-sm hover:opacity-70 transition-opacity whitespace-nowrap"
            >
              {language === 'de' ? 'Alle sehen' : 'See all'}
            </button>
          </div>
        </div>

        <div className="flex overflow-x-auto pb-4 gap-4 px-4 lg:px-0 no-scrollbar scroll-smooth">
          {uniqueFriends.length > 0 ? (
            uniqueFriends.map((friend, index) => {
              const friendKey = friend.uid || (friend as any).id || `fallback-${index}`;
              
              return (
                <Link href={`/users/${friend.uid || (friend as any).id}`} key={friendKey} className="block shrink-0 w-[110px] sm:w-[140px]">
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
                            {friend.location?.split(',')[0] || "Activa"}
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

      <AddFriendDialog open={showAddFriendDialog} onOpenChange={setShowAddFriendDialog} />

      {/* Alle Freunde Modal */}
      <Dialog open={showAllFriendsDialog} onOpenChange={setShowAllFriendsDialog}>
        <DialogContent className="max-w-md w-[92vw] rounded-[2.5rem] bg-white dark:bg-neutral-900 border-none p-6 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center justify-between">
              <span>{language === 'de' ? 'Alle Freunde' : 'All Friends'}</span>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-black">
                {uniqueFriends.length}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {uniqueFriends.length > 0 ? (
              uniqueFriends.map((friend) => {
                const friendId = friend.uid || (friend as any).id;
                const usernameDisplay = friend.username
                  ? `@${friend.username.replace(/^@/, '')}`
                  : (friend.displayName ? `@${friend.displayName.toLowerCase().replace(/\s+/g, '')}` : (language === 'de' ? '@nutzer' : '@user'));

                return (
                  <div
                    key={friendId}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-100 dark:border-neutral-800/80 transition-all hover:bg-slate-100/80 dark:hover:bg-neutral-800"
                  >
                    {/* Link to profile (Avatar & Username) */}
                    <Link
                      href={`/users/${friendId}`}
                      onClick={() => setShowAllFriendsDialog(false)}
                      className="flex items-center gap-3 min-w-0 flex-1 group"
                    >
                      <ProfileAvatar
                        className="h-12 w-12 shrink-0 transition-transform group-hover:scale-105"
                        photoURL={friend.photoURL}
                        displayName={friend.displayName}
                        isPremium={friend.isPremium}
                        isCreator={friend.isCreator}
                        isSupporter={friend.isSupporter}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-black text-slate-900 dark:text-neutral-100 text-sm truncate group-hover:underline">
                            {usernameDisplay}
                          </span>
                          <UserBadge
                            isPremium={friend.isPremium}
                            isSupporter={friend.isSupporter}
                            isCreator={friend.isCreator}
                            size="sm"
                          />
                        </div>
                        {friend.displayName && (
                          <span className="text-xs font-semibold text-slate-400 dark:text-neutral-400 truncate">
                            {friend.displayName}
                          </span>
                        )}
                      </div>
                    </Link>

                    {/* Actions: DM & Remove */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={startingDmUid === friendId}
                        onClick={() => handleStartDm(friendId)}
                        title={language === 'de' ? 'Direktnachricht' : 'Direct Message'}
                        className="h-9 w-9 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95"
                      >
                        {startingDmUid === friendId ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : (
                          <MessageCircle className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFriendToRemove(friend)}
                        title={language === 'de' ? 'Freund entfernen' : 'Remove Friend'}
                        className="h-9 w-9 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all active:scale-95"
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm font-medium">
                {language === 'de' ? 'Keine Freunde vorhanden' : 'No friends found'}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bestätigungs-Dialog zum Entfernen */}
      <AlertDialog open={!!friendToRemove} onOpenChange={(open) => !open && setFriendToRemove(null)}>
        <AlertDialogContent className="rounded-[2.5rem] max-w-sm w-[90vw] p-6">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-slate-900 dark:text-white text-lg">
              {language === 'de' ? 'Freund entfernen?' : 'Remove Friend?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 dark:text-neutral-400 text-sm">
              {language === 'de'
                ? `Möchtest du ${friendToRemove?.username ? `@${friendToRemove.username.replace(/^@/, '')}` : (friendToRemove?.displayName || 'diesen Nutzer')} wirklich aus deinen Freunden entfernen?`
                : `Are you sure you want to remove ${friendToRemove?.username ? `@${friendToRemove.username.replace(/^@/, '')}` : (friendToRemove?.displayName || 'this user')} from your friends?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2 mt-4">
            <AlertDialogCancel className="rounded-full font-bold flex-1">
              {language === 'de' ? 'Abbrechen' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemoveFriend}
              className="rounded-full font-black bg-rose-600 hover:bg-rose-700 text-white flex-1"
            >
              {language === 'de' ? 'Entfernen' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
