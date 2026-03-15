'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { submitHostRating } from '@/lib/firebase/firestore';
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
import { StarRating } from './StarRating';
import { Loader2, Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface HostRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity;
  currentUser: User;
  onRatingSubmitted: () => void;
}

export function HostRatingDialog({ open, onOpenChange, activity, currentUser, onRatingSubmitted }: HostRatingDialogProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hostDetails = (activity.participantDetails || {})[activity.creatorId];

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        variant: 'destructive',
        title: 'Bewertung erforderlich',
        description: 'Bitte wähle eine Sternebewertung aus.',
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
        await submitHostRating(activity.id!, activity.creatorId, currentUser.uid, rating);
        toast({
            title: 'Bewertung eingereicht!',
            description: `Vielen Dank für dein Feedback zu ${hostDetails?.displayName || 'dem Host'}.`,
        });
        onRatingSubmitted();
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
      <SheetContent side="bottom" className="rounded-t-[2.5rem] p-0 sm:max-w-md mx-auto h-[auto] max-h-[90vh] flex flex-col bg-white border-none shadow-2xl overflow-hidden">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-slate-100" />
        
        <SheetHeader className="pt-10 px-8 pb-6 text-center items-center shrink-0">
          <div className="bg-amber-100 p-4 rounded-[2rem] mb-4">
            <Star className="h-8 w-8 text-amber-500 fill-amber-500" />
          </div>
          <SheetTitle className="text-2xl font-black tracking-tight">Host bewerten</SheetTitle>
          <SheetDescription className="text-sm font-medium text-slate-500 px-4">
            Wie war deine Erfahrung mit <strong>{hostDetails?.displayName}</strong> bei der Aktivität "{activity.placeName}"?
          </SheetDescription>
        </SheetHeader>
        
        <div className="px-8 py-6 space-y-8 flex flex-col items-center">
            <div className="flex flex-col items-center gap-3">
                <Avatar className="h-20 w-20 border-4 border-slate-50 shadow-sm">
                    <AvatarImage src={hostDetails?.photoURL || undefined} />
                    <AvatarFallback className="text-2xl font-black bg-primary/10 text-primary">{hostDetails?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="font-black text-slate-900">{hostDetails?.displayName}</span>
            </div>

            <div className="space-y-2 flex flex-col items-center w-full">
                <StarRating rating={rating} onRatingChange={setRating} size={40} />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Tippe auf die Sterne</p>
            </div>
        </div>

        <SheetFooter className="p-8 pt-4 bg-slate-50 border-t border-slate-100 mt-4">
          <div className="flex flex-col w-full gap-3">
            <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || rating === 0}
                className="w-full h-14 rounded-2xl font-black text-lg bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-200 transition-all active:scale-95"
            >
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Bewertung absenden
            </Button>
            <SheetClose asChild>
                <Button variant="ghost" className="rounded-xl font-bold text-slate-400">Vielleicht später</Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
