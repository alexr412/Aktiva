'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { sendFriendRequest, acceptFriendRequest } from '@/lib/firebase/firestore';
import { UserPlus, UserCheck, Clock, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type MemberFriendActionButtonProps = {
  targetUserId: string;
  currentUserId: string;
};

export function MemberFriendActionButton({
  targetUserId,
  currentUserId,
}: MemberFriendActionButtonProps) {
  const { userProfile } = useAuth();
  const language = useLanguage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // 1. Defensive checks & early returns
  if (!currentUserId || !targetUserId) return null;
  if (currentUserId === targetUserId) return null;
  if (!userProfile) return null;

  // 2. Defensive profile arrays
  const friends = userProfile.friends ?? [];
  const sent = userProfile.friendRequestsSent ?? [];
  const received = userProfile.friendRequestsReceived ?? [];

  // Determine state
  let state: 'friends' | 'outgoing_pending' | 'incoming_pending' | 'none' = 'none';
  if (friends.includes(targetUserId)) {
    state = 'friends';
  } else if (sent.includes(targetUserId)) {
    state = 'outgoing_pending';
  } else if (received.includes(targetUserId)) {
    state = 'incoming_pending';
  }

  // Development-only logs
  if (process.env.NODE_ENV === 'development') {
    console.log(`[FRIEND_REQUEST_DEBUG] currentUid: ${currentUserId}`);
    console.log(`[FRIEND_REQUEST_DEBUG] targetUid: ${targetUserId}`);
    console.log(`[FRIEND_REQUEST_DEBUG] existingState: ${state}`);
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isLoading) return;
    setIsLoading(true);

    try {
      if (state === 'none') {
        await sendFriendRequest(currentUserId, targetUserId);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[FRIEND_REQUEST_DEBUG] requestCreated: true (sent to ${targetUserId})`);
        }

        toast({
          title: language === 'de' ? 'Freundschaftsanfrage gesendet' : 'Friend request sent',
          description: language === 'de' 
            ? 'Deine Anfrage wurde erfolgreich übermittelt.' 
            : 'Your request was successfully sent.',
        });
      } else if (state === 'incoming_pending') {
        await acceptFriendRequest(currentUserId, targetUserId);
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[FRIEND_REQUEST_DEBUG] requestAccepted: true (accepted from ${targetUserId})`);
        }

        toast({
          title: language === 'de' ? 'Freundschaftsanfrage bestätigt!' : 'Friend request accepted!',
          description: language === 'de'
            ? 'Ihr seid jetzt befreundet.'
            : 'You are now friends.',
        });
      }
    } catch (error: any) {
      console.error('Friend request action failed:', error);
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: language === 'de' 
          ? 'Die Aktion konnte nicht abgeschlossen werden.' 
          : 'Could not complete the action.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (state === 'friends') {
    const titleText = language === 'de' ? 'Freunde' : 'Friends';
    return (
      <Button
        variant="ghost"
        disabled
        title={titleText}
        aria-label={titleText}
        className="rounded-full w-7 h-7 p-0 flex items-center justify-center bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 border border-slate-200 dark:border-neutral-700 cursor-not-allowed shrink-0 shadow-none"
      >
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      </Button>
    );
  }

  if (state === 'outgoing_pending') {
    const titleText = language === 'de' ? 'Anfrage gesendet' : 'Request Sent';
    return (
      <Button
        variant="ghost"
        disabled
        title={titleText}
        aria-label={titleText}
        className="rounded-full w-7 h-7 p-0 flex items-center justify-center bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 border border-slate-200 dark:border-neutral-700 cursor-not-allowed shrink-0 shadow-none"
      >
        <Clock className="h-3.5 w-3.5" />
      </Button>
    );
  }

  // Active / clickable states: none (Add Friend) or incoming_pending (Accept)
  const isIncoming = state === 'incoming_pending';
  const label = isIncoming 
    ? (language === 'de' ? 'Annehmen' : 'Accept')
    : (language === 'de' ? 'Freund hinzufügen' : 'Add Friend');

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      disabled={isLoading}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-full w-7 h-7 p-0 flex items-center justify-center transition-all shrink-0 shadow-sm border",
        isIncoming
          ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 border-blue-100 dark:border-blue-900/50"
          : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border-emerald-100 dark:border-emerald-900/50"
      )}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isIncoming ? (
        <UserCheck className="h-3.5 w-3.5" />
      ) : (
        <UserPlus className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
