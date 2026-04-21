'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { sendFriendRequest } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Search } from 'lucide-react';

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
      if (!db) throw new Error("Firestore not initialized");
      const q = query(collection(db, "users"), where("username", "==", searchCode.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        setSearchedUser({ id: doc.id, ...doc.data() });
      } else {
        setError("Nutzer nicht gefunden.");
      }
    } catch (err) {
      console.error(err);
      setError("Datenbank-Fehler bei der Suche.");
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
        description: `Deine Anfrage wurde an ${searchedUser.displayName} gesendet.`,
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
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Freund hinzufügen</DialogTitle>
          <DialogDescription>
            Gib den Username eines Freundes ein, um ihm eine Anfrage zu senden.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="@username"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toLowerCase().replace(/@/g, ''))}
              className="h-12 text-base font-bold"
              maxLength={32}
            />
            <Button type="submit" size="icon" className="h-12 w-12 flex-shrink-0" disabled={isSearching || !searchCode}>
              {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </form>
          
          {error && <p className="text-destructive text-sm mt-2 text-center">{error}</p>}

          {searchedUser && (
            <div className="flex items-center justify-between mt-4 p-3 bg-secondary/20 border border-border rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-full overflow-hidden flex items-center justify-center">
                  {searchedUser.photoURL ? (
                    <img src={searchedUser.photoURL} alt={searchedUser.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold">{searchedUser.displayName?.charAt(0) || "U"}</span>
                  )}
                </div>
                <span className="font-bold">{searchedUser.displayName || "Unbekannt"}</span>
              </div>

              {(() => {
                const currentId = currentUser?.uid;
                const targetId = searchedUser.id;
                const isSelf = currentId === targetId;
                const isAlreadyFriend = userProfile?.friends?.includes(targetId);
                const isRequestAlreadySent = userProfile?.friendRequestsSent?.includes(targetId) || requestSentLocally;

                if (isSelf) {
                  return (
                    <div className="px-4 py-2 bg-red-500/10 text-red-500 font-bold text-sm rounded-lg flex items-center gap-2">
                      <span>❤️</span>
                      <span>Du</span>
                    </div>
                  );
                }
                
                if (isAlreadyFriend) {
                  return (
                    <div className="px-4 py-2 bg-secondary text-muted-foreground font-bold text-sm rounded-lg">
                      Freunde
                    </div>
                  );
                }

                if (isRequestAlreadySent) {
                  return (
                    <div className="px-4 py-2 bg-secondary/50 text-muted-foreground font-bold text-sm rounded-lg">
                      Gesendet
                    </div>
                  );
                }
                
                return (
                  <button 
                    onClick={() => handleSendRequest(targetId)}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold text-sm transition-colors"
                  >
                    Hinzufügen
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
