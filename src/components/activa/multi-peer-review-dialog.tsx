'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { formatFirstName } from '@/lib/utils';

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
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StarRating } from '../reviews/StarRating';
import { Loader2, Users, Sparkles, Star, UserCheck } from 'lucide-react';
import { ProfileAvatar } from '../ui/profile-avatar';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';

interface MultiPeerReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity;
  currentUser: User;
  onReviewSubmitted: () => void;
}

export function MultiPeerReviewDialog({ open, onOpenChange, activity, currentUser, onReviewSubmitted }: MultiPeerReviewDialogProps) {
   const { toast } = useToast();
  const language = useLanguage();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState<number>(0);

  // Safety effect: ensure document.body pointer-events is cleaned up when closed or unmounted
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        if (typeof document !== 'undefined' && document.body.style.pointerEvents === 'none') {
          document.body.style.pointerEvents = '';
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined' && document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = '';
      }
    };
  }, []);

  // State for activity review
  const [activityRating, setActivityRating] = useState(0);
  const [activityComment, setActivityComment] = useState('');

  // State for peer reviews (individual ratings & comments)
  const peers = (activity.participantsPreview || []).filter(p => p.uid !== currentUser.uid);
  const [peerRatings, setPeerRatings] = useState<Record<string, number>>(
    peers.reduce((acc, p) => ({ ...acc, [p.uid]: 0 }), {})
  );
  const [peerComments, setPeerComments] = useState<Record<string, string>>(
    peers.reduce((acc, p) => ({ ...acc, [p.uid]: '' }), {})
  );

  const handlePeerRatingChange = (uid: string, rating: number) => {
    setPeerRatings(prev => ({ ...prev, [uid]: rating }));
  };

  const handlePeerCommentChange = (uid: string, comment: string) => {
    setPeerComments(prev => ({ ...prev, [uid]: comment }));
  };

  const handleSubmit = async () => {
    if (activityRating === 0) {
      toast({ 
        variant: 'destructive', 
        title: language === 'de' ? 'Rating fehlt' : 'Rating missing', 
        description: language === 'de' ? 'Bitte bewerte die Aktivität.' : 'Please rate the activity.' 
      });
      return;
    }

    if (activityComment && !validateChatMessage(activityComment)) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? "Inhalt blockiert" : "Content Blocked",
        description: language === 'de' ? "Diese Nachricht enthält nicht erlaubte Inhalte." : "This message contains disallowed content."
      });
      return;
    }

    for (const comment of Object.values(peerComments)) {
      if (comment && !validateChatMessage(comment)) {
        toast({
          variant: 'destructive',
          title: language === 'de' ? "Inhalt blockiert" : "Content Blocked",
          description: language === 'de' ? "Diese Nachricht enthält nicht erlaubte Inhalte." : "This message contains disallowed content."
        });
        return;
      }
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

    const unratedPeer = Object.entries(peerRatings).find(([_, rating]) => rating === 0);
    if (unratedPeer && peers.length > 0) {
      toast({ 
        variant: 'destructive', 
        title: language === 'de' ? 'Teilnehmer bewerten' : 'Rate participants', 
        description: language === 'de' ? 'Bitte gib allen Teilnehmern ein Rating.' : 'Please give all participants a rating.' 
      });
      return;
    }

    
    setIsSubmitting(true);
    try {
        setLastSubmitTime(now);
        const reviews = [];
        
        // 1. Activity Review
        reviews.push({
            targetId: activity.id!,
            targetType: 'activity' as const,
            rating: activityRating,
            comment: activityComment
        });

        // 2. Individual Peer Reviews
        Object.entries(peerRatings).forEach(([uid, rating]) => {
            reviews.push({
                targetId: uid,
                targetType: 'user' as const,
                rating: rating,
                comment: peerComments[uid] || ''
            });
        });

        await submitMultiReview(activity.id!, currentUser.uid, reviews);
        toast({ 
            title: language === 'de' ? 'Feedback gesendet!' : 'Feedback sent!', 
            description: language === 'de' ? 'Danke, dass du die Aktiva Community stärkst.' : 'Thank you for strengthening the Aktiva community.' 
        });

        onOpenChange(false);
        onReviewSubmitted();
    } catch (error: any) {
      toast({ 
        variant: 'destructive', 
        title: language === 'de' ? 'Fehler' : 'Error', 
        description: error.message || (language === 'de' ? 'Review konnte nicht gespeichert werden.' : 'Review could not be saved.') 
      });

    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[2.5rem] p-0 sm:max-w-md mx-auto h-[90vh] flex flex-col bg-white dark:bg-neutral-900 border-none shadow-2xl overflow-hidden">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-slate-100 dark:bg-neutral-800" />
        
        <SheetHeader className="pt-10 px-8 pb-4 text-center items-center shrink-0">
          <div className="bg-primary/10 p-3 rounded-2xl mb-2">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <SheetTitle className="text-xl font-black text-slate-900 dark:text-white">{language === 'de' ? 'Review Time' : 'Review Time'}</SheetTitle>

          <SheetDescription className="text-sm font-medium text-slate-500 dark:text-neutral-400">
            {language === 'de' ? 'Wie war dein Treffen bei ' : 'How was your meetup at '} <strong className="text-slate-900 dark:text-white">{activity.placeName}</strong>?
          </SheetDescription>

        </SheetHeader>
        
        <ScrollArea className="flex-1 px-8 py-4">
          <div className="space-y-10 pb-8">
            {/* Section 1: Activity Rating */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">{language === 'de' ? 'Das Event' : 'The Event'}</h3>

              </div>
              <div className="flex flex-col items-center gap-4 bg-slate-50 dark:bg-neutral-800/60 p-6 rounded-3xl border border-slate-100 dark:border-neutral-800">
                <StarRating rating={activityRating} onRatingChange={setActivityRating} size={32} />
                <Textarea 
                  value={activityComment}
                  onChange={(e) => setActivityComment(e.target.value)}
                  placeholder={language === 'de' ? 'Erzähl uns kurz, wie es war... (optional)' : 'Tell us briefly how it was... (optional)'}

                  className="rounded-2xl border-none bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-sm font-medium focus-visible:ring-primary/20 placeholder:text-slate-400 dark:placeholder:text-neutral-500"
                />
              </div>
            </div>

            {/* Section 2: Peer Ratings */}
            {peers.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-slate-900 dark:text-white">{language === 'de' ? 'Die Teilnehmer' : 'The Participants'}</h3>

                </div>
                <div className="space-y-3">
                  {peers.map((peer) => (
                    <div key={peer.uid} className="flex flex-col gap-3 p-4 bg-white dark:bg-neutral-800/60 rounded-2xl border border-slate-100 dark:border-neutral-800 shadow-sm transition-all hover:border-primary/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <ProfileAvatar 
                            className="h-10 w-10"
                            photoURL={peer.photoURL}
                            displayName={peer.displayName}
                          />
                          <span className="font-bold text-slate-900 dark:text-white truncate text-sm">{formatFirstName(peer.displayName, 'Teilnehmer')}</span>
                        </div>
                        <StarRating 
                          rating={peerRatings[peer.uid] || 0} 
                          onRatingChange={(r) => handlePeerRatingChange(peer.uid, r)} 
                          size={20} 
                        />
                      </div>
                      <Textarea 
                        value={peerComments[peer.uid] || ''}
                        onChange={(e) => handlePeerCommentChange(peer.uid, e.target.value)}
                        placeholder={language === 'de' ? `Wie war ${formatFirstName(peer.displayName, 'der Teilnehmer')}? (optional)` : `How was ${formatFirstName(peer.displayName, 'the participant')}? (optional)`}
                        className="rounded-2xl border-none bg-slate-50 dark:bg-neutral-900 text-slate-900 dark:text-white shadow-sm font-medium text-xs focus-visible:ring-primary/20 min-h-[60px] resize-none placeholder:text-slate-400 dark:placeholder:text-neutral-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="p-8 pt-4 bg-slate-50 dark:bg-neutral-900 border-t border-slate-100 dark:border-neutral-800 shrink-0">
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="w-full h-14 rounded-2xl font-black text-lg bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 shadow-xl shadow-slate-200 dark:shadow-none transition-all active:scale-95"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserCheck className="mr-2 h-5 w-5" />}
            {language === 'de' ? 'Reviews absenden' : 'Submit Reviews'}

          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
