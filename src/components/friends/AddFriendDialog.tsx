'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { findUserByFriendCode, sendFriendRequest } from '@/lib/firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search, UserPlus, Check } from 'lucide-react';

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddFriendDialog({ open, onOpenChange }: AddFriendDialogProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setFoundUser(null);
    setRequestSent(false);

    try {
      const result = await findUserByFriendCode(searchQuery);
      
      if (result) {
        setFoundUser(result);
        if (userProfile?.friendRequestsSent?.includes(result.uid)) {
          setRequestSent(true);
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'User Not Found',
          description: 'No user found with that friend code.',
        });
      }
    } catch (error) {
       toast({
          variant: 'destructive',
          title: 'Search Failed',
          description: 'An error occurred while searching.',
       });
    } finally {
        setIsSearching(false);
    }
  };
  
  const handleAddFriend = async () => {
    if (!user || !foundUser) return;
    setRequestSent(true);
    try {
      await sendFriendRequest(user.uid, foundUser.uid);
      toast({
        title: 'Friend Request Sent!',
        description: `Your request has been sent to ${foundUser.displayName}.`,
      });
    } catch (error: any) {
      setRequestSent(false);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not send friend request.',
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
      onOpenChange(isOpen);
      if (!isOpen) {
          // Reset state when closing
          setSearchQuery('');
          setFoundUser(null);
          setIsSearching(false);
          setRequestSent(false);
      }
  }

  // Status-Evaluation
  const isSelf = user?.uid === foundUser?.uid;
  const isAlreadyFriend = userProfile?.friends?.includes(foundUser?.uid || '');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a Friend</DialogTitle>
          <DialogDescription>
            Enter a friend's 8-digit code to send them a request.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="A1B2C3D4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              className="h-12 text-base tracking-widest font-mono"
              maxLength={8}
            />
            <Button type="submit" size="icon" className="h-12 w-12 flex-shrink-0" disabled={isSearching || !searchQuery}>
              {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
            </Button>
          </form>

          {foundUser && (
            <div className="mt-6 rounded-lg border bg-secondary/30 p-4 border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar>
                    <AvatarImage src={foundUser.photoURL || undefined} />
                    <AvatarFallback>{foundUser.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="font-bold truncate">{foundUser.displayName}</div>
                </div>
                
                {isSelf ? (
                  <div className="px-4 py-2 bg-secondary text-muted-foreground font-bold text-sm rounded-lg">
                    Du
                  </div>
                ) : isAlreadyFriend ? (
                  <div className="px-4 py-2 bg-secondary text-muted-foreground font-bold text-sm rounded-lg flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Befreundet
                  </div>
                ) : (
                  <Button 
                    onClick={handleAddFriend} 
                    disabled={requestSent} 
                    className="w-32 flex-shrink-0"
                  >
                    {requestSent ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Gesendet
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Hinzufügen
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
