'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';

import { submitMultiReview } from '@/lib/firebase/firestore';
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
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
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
  
  // State for activity review
  const [activityRating, setActivityRating] = useState(0);
  const [activityComment, setActivityComment] = useState('');

  // State for peer reviews (individual ratings)
  const peers = (activity.participantsPreview || []).filter(p => p.uid !== currentUser.uid);
  const [peerRatings, setPeerRatings] = useState<Record<string, number>>(
    peers.reduce((acc, p) => ({ ...acc, [p.uid]: 0 }), {})
  );

  const handlePeerRatingChange = (uid: string, rating: number) => {
    setPeerRatings(prev => ({ ...prev, [uid]: rating }));
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
                comment: '' // Participants get only rating in this view
            });
        });

        await submitMultiReview(activity.id!, currentUser.uid, reviews);
        toast({ 
            title: language === 'de' ? 'Feedback gesendet!' : 'Feedback sent!', 
            description: language === 'de' ? 'Danke, dass du die Aktvia Community stärkst.' : 'Thank you for strengthening the Aktvia community.' 
        });

        onReviewSubmitted();
        onOpenChange(false);
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
      <SheetContent side="bottom" className="rounded-t-[2.5rem] p-0 sm:max-w-md mx-auto h-[90vh] flex flex-col bg-white border-none shadow-2xl overflow-hidden">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-slate-100" />
        
        <SheetHeader className="pt-10 px-8 pb-4 text-center items-center shrink-0">
          <div className="bg-primary/10 p-3 rounded-2xl mb-2">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <SheetTitle className="text-2xl font-black tracking-tight">{language === 'de' ? 'Review Time' : 'Review Time'}</SheetTitle>

          <SheetDescription className="text-sm font-medium text-slate-500">
            {language === 'de' ? 'Wie war dein Treffen bei ' : 'How was your meetup at '} <strong>{activity.placeName}</strong>?
          </SheetDescription>

        </SheetHeader>
        
        <ScrollArea className="flex-1 px-8 py-4">
          <div className="space-y-10 pb-8">
            {/* Section 1: Activity Rating */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">{language === 'de' ? 'Das Event' : 'The Event'}</h3>

              </div>
              <div className="flex flex-col items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <StarRating rating={activityRating} onRatingChange={setActivityRating} size={32} />
                <Textarea 
                  value={activityComment}
                  onChange={(e) => setActivityComment(e.target.value)}
                  placeholder={language === 'de' ? 'Erzähl uns kurz, wie es war... (optional)' : 'Tell us briefly how it was... (optional)'}

                  className="rounded-2xl border-none bg-white shadow-sm font-medium focus-visible:ring-primary/20"
                />
              </div>
            </div>

            {/* Section 2: Peer Ratings */}
            {peers.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">{language === 'de' ? 'Die Teilnehmer' : 'The Participants'}</h3>

                </div>
                <div className="space-y-3">
                  {peers.map((peer) => (
                    <div key={peer.uid} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-primary/20">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={peer.photoURL || undefined} />
                          <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{peer.displayName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="font-bold text-slate-900 truncate text-sm">{peer.displayName}</span>
                      </div>
                      <StarRating 
                        rating={peerRatings[peer.uid] || 0} 
                        onRatingChange={(r) => handlePeerRatingChange(peer.uid, r)} 
                        size={20} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="p-8 pt-4 bg-slate-50 border-t border-slate-100 shrink-0">
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting}
            className="w-full h-14 rounded-2xl font-black text-lg bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-200 transition-all active:scale-95"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserCheck className="mr-2 h-5 w-5" />}
            {language === 'de' ? 'Reviews absenden' : 'Submit Reviews'}

          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
