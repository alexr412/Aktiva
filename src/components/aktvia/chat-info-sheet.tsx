'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { leaveActivity, deleteActivity } from '@/lib/firebase/firestore';

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
import { Loader2, Trash2, Users } from 'lucide-react';
import type { Chat } from '@/lib/types';
import { Separator } from '../ui/separator';

interface ChatInfoSheetProps {
  chat: Chat | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatInfoSheet({ chat, open, onOpenChange }: ChatInfoSheetProps) {
  const [isActing, setIsActing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  if (!chat || !user) return null;

  const participants = Object.values(chat.participantDetails);
  const isOnlyParticipant = chat.participantIds.length === 1;

  const handleAction = async () => {
    if (!chat?.id || !user?.uid) return;
    setIsActing(true);
    try {
      if (isOnlyParticipant) {
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
      setIsActing(false);
    }
  };

  const amCreator = chat.participantDetails[user.uid] && chat.creatorId === user.uid;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 sm:max-w-md">
        <SheetHeader className="p-6 pb-4 text-left">
          <SheetTitle className="text-2xl font-bold">{chat.placeName}</SheetTitle>
          <SheetDescription>{participants.length} Participant{participants.length === 1 ? '' : 's'}</SheetDescription>
        </SheetHeader>
        <Separator />

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider"><Users className="h-5 w-5" /> Members</h3>
            <ul className="space-y-3">
              {participants.map((p, i) => (
                <li key={i} className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={p.photoURL || undefined} />
                    <AvatarFallback>{p.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{p.displayName}</span>
                </li>
              ))}
            </ul>
          </div>
        </ScrollArea>

        <Separator />
        <SheetFooter className="p-4 bg-muted/30">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="mr-2 h-4 w-4" />
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
                <AlertDialogAction onClick={handleAction} disabled={isActing} className='bg-destructive hover:bg-destructive/90'>
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
