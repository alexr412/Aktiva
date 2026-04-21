'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';

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
  participantDetails: Activity['participantDetails'];
}

export function ReviewDialog({ open, onOpenChange, activity, currentUser, onReviewSubmitted, participantDetails }: ReviewDialogProps) {
   const { toast } = useToast();
  const language = useLanguage();

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otherParticipants = activity.participantIds
    .filter(id => id !== currentUser.uid)
    .map(id => (participantDetails || {})[id])
    .filter(p => p);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Bewertung erforderlich' : 'Review Required',
        description: language === 'de' ? 'Bitte gib eine Sternebewertung ab.' : 'Please provide a star rating.',
      });

      return;
    }
    
    setIsSubmitting(true);
    try {
        const otherParticipantIds = activity.participantIds.filter(id => id !== currentUser.uid);
        await submitReviews(activity.id!, currentUser.uid, otherParticipantIds, rating, text);
        toast({
            title: language === 'de' ? 'Bewertung eingereicht!' : 'Review submitted!',
            description: language === 'de' ? 'Vielen Dank für dein Feedback.' : 'Thank you for your feedback.',
        });

        onReviewSubmitted();
        onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message || (language === 'de' ? 'Die Bewertung konnte nicht eingereicht werden.' : 'The review could not be submitted.'),
      });

    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle>{language === 'de' ? 'Bewerte deine Aktivität' : 'Rate your activity'}</SheetTitle>
          <SheetDescription>
            {language === 'de' ? 'Deine Bewertung wird an alle anderen Teilnehmer der Aktivität gesendet.' : 'Your review will be sent to all other participants of the activity.'}
          </SheetDescription>

        </SheetHeader>
        
        <div className="py-4 space-y-6">
            <div>
                <h3 className="text-sm font-medium mb-2">{language === 'de' ? 'Teilnehmer, die du bewertest:' : 'Participants you are rating:'}</h3>

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
                <h3 className="text-sm font-medium">{language === 'de' ? 'Bewertung' : 'Rating'}</h3>

                <StarRating rating={rating} onRatingChange={setRating} />
            </div>
            
            <div className="space-y-2">
                 <h3 className="text-sm font-medium">{language === 'de' ? 'Kommentar (optional)' : 'Comment (optional)'}</h3>
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={language === 'de' ? 'Wie war deine Erfahrung?' : 'How was your experience?'}
                />

            </div>
        </div>

        <SheetFooter className="mt-auto">
          <SheetClose asChild>
            <Button variant="outline">{language === 'de' ? 'Abbrechen' : 'Cancel'}</Button>
          </SheetClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {language === 'de' ? 'Bewertung absenden' : 'Submit Review'}
          </Button>

        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
