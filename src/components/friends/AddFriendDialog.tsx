'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { sendFriendRequest, findUserByUsername } from '@/lib/firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatFirstName } from '@/lib/utils';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Search, UserPlus, Check, AtSign } from 'lucide-react';

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFriendDialog({ open, onOpenChange }: AddFriendDialogProps) {
  const { user: currentUser, userProfile } = useAuth();
  const { toast } = useToast();
  
  const [searchCode, setSearchCode] = useState('');
  const [searchedUser, setSearchedUser] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [requestSentLocally, setRequestSentLocally] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchCode.trim()) return;
    setIsSearching(true);
    setError("");
    setSearchedUser(null);
    setRequestSentLocally(false);

    try {
      const userProfile = await findUserByUsername(searchCode.trim().toLowerCase());
      if (userProfile) {
        setSearchedUser({ id: userProfile.uid, ...userProfile });
      } else {
        setError("Nutzer nicht gefunden.");
      }
    } catch (err) {
      console.error(err);
      setError("Fehler bei der Suche.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    if (!currentUser || !searchedUser) return;
    setRequestSentLocally(true);
    try {
      await sendFriendRequest(currentUser.uid, targetUserId);
      toast({
        title: 'Anfrage gesendet!',
        description: `Deine Anfrage wurde an ${formatFirstName(searchedUser.displayName, 'User')} gesendet.`,
      });
    } catch (err: any) {
      setRequestSentLocally(false);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: err.message || 'Konnte Anfrage nicht senden.',
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
      onOpenChange(isOpen);
      if (!isOpen) {
          setSearchCode('');
          setSearchedUser(null);
          setError('');
          setIsSearching(false);
          setRequestSentLocally(false);
      }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="w-full border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5.5 sm:p-7 shadow-2xl overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] sm:max-w-md max-sm:fixed max-sm:left-1/2 max-sm:right-auto max-sm:top-[45%] max-sm:bottom-auto max-sm:w-[calc(100%-2rem)] max-sm:max-w-none max-sm:-translate-x-1/2 max-sm:-translate-y-1/2"
      >

        <DialogHeader className="text-left space-y-0">
          <div className="flex items-center gap-3 pr-10 sm:pr-8">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30 shadow-sm">
              <UserPlus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 dark:text-neutral-100 tracking-tight leading-tight">
              Freund hinzufügen
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium leading-relaxed mt-2.5 sm:mt-3">
            Gib den Username eines Freundes ein, um ihm eine Anfrage zu senden.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2 items-center">
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-neutral-500 pointer-events-none flex items-center justify-center">
                <AtSign className="w-4 h-4" />
              </div>
              <Input
                placeholder="username"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toLowerCase().replace(/@/g, ''))}
                className="h-12 w-full rounded-2xl border-slate-200 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-900/80 pl-10 pr-4 text-sm font-bold text-slate-900 dark:text-neutral-100 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500 transition-all"
                maxLength={32}
              />
            </div>
            <Button 
              type="submit" 
              className="h-12 w-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold shrink-0 shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center" 
              disabled={isSearching || !searchCode.trim()}
              aria-label="Suchen"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 stroke-[2.5]" />}
            </Button>
          </form>
          
          {error && (
            <div className="p-3 text-center text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 rounded-2xl animate-in fade-in-50">
              {error}
            </div>
          )}

          {searchedUser && (
            <div className="flex items-center justify-between p-3.5 bg-slate-50/90 dark:bg-neutral-900/90 border border-slate-100 dark:border-neutral-800 rounded-2xl gap-3 shadow-sm animate-in fade-in-50 slide-in-from-bottom-2">
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatar 
                  className="w-10 h-10 shrink-0"
                  photoURL={searchedUser.photoURL}
                  displayName={searchedUser.displayName}
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm text-slate-900 dark:text-neutral-100 truncate">
                    {formatFirstName(searchedUser.displayName, "Unbekannt")}
                  </span>
                  {searchedUser.username && (
                    <span className="text-[11px] font-medium text-slate-400 truncate">
                      @{searchedUser.username}
                    </span>
                  )}
                </div>
              </div>

              {(() => {
                const currentId = currentUser?.uid;
                const targetId = searchedUser.id;
                const isSelf = currentId === targetId;
                const isAlreadyFriend = userProfile?.friends?.includes(targetId);
                const isRequestAlreadySent = userProfile?.friendRequestsSent?.includes(targetId) || requestSentLocally;

                if (isSelf) {
                  return (
                    <div className="px-3.5 py-2 bg-rose-500/10 text-rose-500 font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0">
                      <span>❤️</span>
                      <span>Du</span>
                    </div>
                  );
                }
                
                if (isAlreadyFriend) {
                  return (
                    <div className="px-3.5 py-2 bg-slate-200/70 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 font-bold text-xs rounded-xl shrink-0">
                      Freunde
                    </div>
                  );
                }

                if (isRequestAlreadySent) {
                  return (
                    <div className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-xl flex items-center gap-1 shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Gesendet</span>
                    </div>
                  );
                }
                
                return (
                  <button 
                    onClick={() => handleSendRequest(targetId)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Hinzufügen</span>
                  </button>
                );
              })()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
