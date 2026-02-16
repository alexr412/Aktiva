'use client';

import { useState } from 'react';
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
  onDelete: () => Promise<void>;
}

export function ChatInfoSheet({ chat, open, onOpenChange, onDelete }: ChatInfoSheetProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!chat) return null;

  const participants = Object.values(chat.participantDetails);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
  };

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
                Delete Activity
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this activity and all associated chat messages.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className='bg-destructive hover:bg-destructive/90'>
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
