'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { submitReviews } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StarRating } from './StarRating';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity;
  currentUser: User;
  onReviewSubmitted: () => void;
}

export function ReviewDialog({ open, onOpenChange, activity, currentUser, onReviewSubmitted }: ReviewDialogProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otherParticipants = activity.participantIds
    .filter(id => id !== currentUser.uid)
    .map(id => activity.participantDetails[id]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        variant: 'destructive',
        title: 'Bewertung erforderlich',
        description: 'Bitte geben Sie eine Sternebewertung ab.',
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
        const otherParticipantIds = activity.participantIds.filter(id => id !== currentUser.uid);
        await submitReviews(activity.id!, currentUser.uid, otherParticipantIds, rating, text);
        toast({
            title: 'Bewertung eingereicht!',
            description: 'Vielen Dank für Ihr Feedback.',
        });
        onReviewSubmitted();
        onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: error.message || 'Die Bewertung konnte nicht eingereicht werden.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle>Bewerten Sie Ihre Aktivität</SheetTitle>
          <SheetDescription>
            Ihre Bewertung wird an alle anderen Teilnehmer der Aktivität gesendet.
          </SheetDescription>
        </SheetHeader>
        
        <div className="py-4 space-y-6">
            <div>
                <h3 className="text-sm font-medium mb-2">Teilnehmer, die Sie bewerten:</h3>
                <div className="flex flex-wrap gap-2">
                    {otherParticipants.map(p => p && (
                        <div key={p.displayName} className="flex items-center gap-2 bg-muted p-1 pr-2 rounded-full">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={p.photoURL || undefined} />
                                <AvatarFallback>{p.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{p.displayName}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <h3 className="text-sm font-medium">Bewertung</h3>
                <StarRating rating={rating} onRatingChange={setRating} />
            </div>
            
            <div className="space-y-2">
                 <h3 className="text-sm font-medium">Kommentar (optional)</h3>
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Wie war Ihre Erfahrung?"
                />
            </div>
        </div>

        <SheetFooter className="mt-auto">
          <SheetClose asChild>
            <Button variant="outline">Abbrechen</Button>
          </SheetClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Bewertung absenden
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
