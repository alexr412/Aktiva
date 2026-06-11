'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';

import { submitMultiReview } from '@/lib/firebase/firestore';
import { validateChatMessage } from '@/lib/moderation/blacklist';
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
import { ProfileAvatar } from '../ui/profile-avatar';
import { formatFirstName } from '@/lib/utils';

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
  const [lastSubmitTime, setLastSubmitTime] = useState<number>(0);

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

    if (text && !validateChatMessage(text)) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? "Inhalt blockiert" : "Content Blocked",
        description: language === 'de' ? "Diese Nachricht enthält nicht erlaubte Inhalte." : "This message contains disallowed content."
      });
      return;
    }

    const now = Date.now();
    if (now - lastSubmitTime < 5000) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? "Spam-Schutz" : "Spam Protection",
        description: language === 'de' ? "Bitte warte einen Moment, bevor du eine weitere Bewertung abgibst." : "Please wait a moment before submitting another review."
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
        setLastSubmitTime(now);
        const otherParticipantIds = activity.participantIds.filter(id => id !== currentUser.uid);
        const reviews = otherParticipantIds.map(uid => ({
            targetId: uid,
            targetType: 'user' as const,
            rating: rating,
            comment: text
        }));
        await submitMultiReview(activity.id!, currentUser.uid, reviews);
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
                            <ProfileAvatar 
                                className="h-6 w-6"
                                photoURL={p.photoURL}
                                displayName={p.displayName}
                            />
                            <span className="text-sm font-medium">{formatFirstName(p.displayName, 'User')}</span>
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
