'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { leaveActivity, deleteActivity, voteToCompleteActivity } from '@/lib/firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trash2, Users, Calendar, CheckCircle } from 'lucide-react';
import type { Chat, Activity } from '@/lib/types';
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton';

interface ChatInfoSheetProps {
  chat: Chat | null;
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatInfoSheet({ chat, activity, open, onOpenChange }: ChatInfoSheetProps) {
  const [isActing, setIsActing] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const renderDate = () => {
      if (!activity) return null;

      if (activity.activityEndDate) {
          return `${format(activity.activityDate.toDate(), "eee, MMM d")} - ${format(activity.activityEndDate.toDate(), "eee, MMM d")}`;
      }
      if (activity.isTimeFlexible) {
          return `${format(activity.activityDate.toDate(), "eee, MMM d")} (Flexible Time)`;
      }
      return format(activity.activityDate.toDate(), "eee, MMM d 'at' p");
  }


  if (!chat || !user || !activity) return null;

  const isOnlyParticipant = chat.participantIds.length === 1;
  const amCreator = chat.creatorId === user.uid;
  const hasVoted = activity?.completionVotes?.includes(user.uid);
  const isCompleted = activity.status === 'completed';

  const handleLeaveOrDelete = async () => {
    if (!chat?.id || !user?.uid) return;
    setIsActing(true);
    try {
      if (isOnlyParticipant || amCreator) {
        await deleteActivity(chat.id);
        toast({ title: 'Activity Deleted', description: 'The activity and chat have been removed.' });
      } else {
        await leaveActivity(chat.id, user.uid);
        toast({ title: 'You have left the activity.' });
      }
      onOpenChange(false);
      router.push('/chat');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: error.message });
    } finally {
      setIsActing(false);
    }
  };
  
  const handleVote = async () => {
      if (!activity?.id || !user?.uid || hasVoted) return;
      setIsVoting(true);
      try {
        await voteToCompleteActivity(activity.id, user.uid);
        toast({ title: "Vote submitted!" });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Vote Failed', description: error.message });
      } finally {
        setIsVoting(false);
      }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 sm:max-w-md">
        <SheetHeader className="p-6 pb-4 text-left">
          <SheetTitle className="text-2xl font-bold">{chat.placeName}</SheetTitle>
          <SheetDescription>{chat.participantIds.length} Participant{chat.participantIds.length === 1 ? '' : 's'}</SheetDescription>
           {!activity ? (
            <Skeleton className="h-5 w-48 mt-2" />
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground pt-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>{renderDate()}</span>
            </div>
          )}
        </SheetHeader>
        <Separator />

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider"><Users className="h-5 w-5" /> Members</h3>
            <ul className="space-y-1">
              {Object.entries(chat.participantDetails).map(([uid, p]) => (
                 <li key={uid}>
                    <Link
                        href={user?.uid === uid ? '/profile' : `/users/${uid}`}
                        className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted transition-colors"
                        onClick={() => onOpenChange(false)}
                    >
                        <Avatar>
                            <AvatarImage src={p.photoURL || undefined} />
                            <AvatarFallback>{p.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="font-medium">
                                {p.displayName}
                                {uid === chat.creatorId && <span className="text-xs font-normal text-muted-foreground"> (Creator)</span>}
                            </span>
                            {uid === user?.uid && <span className="text-xs text-muted-foreground">You</span>}
                        </div>
                    </Link>
                </li>
              ))}
            </ul>
          </div>
        </ScrollArea>

        <Separator />
        <SheetFooter className="p-4 bg-muted/30 grid grid-cols-1 gap-2">
            {!isCompleted && (
                 <Button onClick={handleVote} disabled={isVoting || hasVoted} variant="outline">
                    {isVoting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                    {hasVoted ? "Voted to Complete" : "Mark as Met / Completed"}
                 </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  {isActing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4" />}
                  {isOnlyParticipant || amCreator ? 'Delete Activity' : 'Leave Activity'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isOnlyParticipant || amCreator
                      ? 'Are you absolutely sure?'
                      : 'Are you sure you want to leave?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isOnlyParticipant || amCreator
                      ? 'This action cannot be undone. This will permanently delete this activity and all associated chat messages.'
                      : 'You can rejoin this activity later as long as it exists.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLeaveOrDelete} disabled={isActing} className='bg-destructive hover:bg-destructive/90'>
                    {isActing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isActing
                      ? (isOnlyParticipant || amCreator ? 'Deleting...' : 'Leaving...')
                      : (isOnlyParticipant || amCreator ? 'Delete' : 'Leave')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
