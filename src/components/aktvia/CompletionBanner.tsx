'use client';

import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { voteToCompleteActivity } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface CompletionBannerProps {
  activity: Activity;
  currentUser: User;
  participantDetails: Activity['participantDetails'];
}

export function CompletionBanner({ activity, currentUser, participantDetails }: CompletionBannerProps) {
  const { toast } = useToast();
  const [isVoting, setIsVoting] = useState(false);
  const userHasVoted = activity.completionVotes.includes(currentUser.uid);

  const handleVote = async () => {
    if (!activity.id || userHasVoted) return;
    setIsVoting(true);
    try {
      await voteToCompleteActivity(activity.id, currentUser.uid);
      toast({ title: "Vote submitted!" });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Vote Failed', description: error.message });
    } finally {
      setIsVoting(false);
    }
  };

  const getVoterDetails = () => {
    return activity.completionVotes.map(voterId => {
      const details = (participantDetails || {})[voterId];
      return details ? details : { displayName: "Unknown", photoURL: null };
    });
  };

  const voterDetails = getVoterDetails();

  return (
    <div className="bg-amber-100 dark:bg-amber-900/40 border-b border-t border-amber-300 dark:border-amber-800 p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <p className="font-bold text-amber-900 dark:text-amber-200">
            Aktivität abschließen
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {activity.completionVotes.length} von {activity.participantIds.length} Teilnehmer haben bestätigt, dass das Treffen stattgefunden hat.
          </p>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
            <div className="flex -space-x-2 overflow-hidden">
                <TooltipProvider>
                {voterDetails.map((voter, index) => (
                    <Tooltip key={index}>
                        <TooltipTrigger asChild>
                            <Avatar className="inline-block h-6 w-6 rounded-full ring-2 ring-amber-100 dark:ring-amber-900/40">
                                <AvatarImage src={voter.photoURL || ''} />
                                <AvatarFallback>{voter.displayName?.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{voter.displayName}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
                </TooltipProvider>
            </div>
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">haben bereits abgestimmt.</span>
          </div>
        </div>
        {!userHasVoted && (
          <Button onClick={handleVote} disabled={isVoting} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0">
            {isVoting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Treffen bestätigen
          </Button>
        )}
      </div>
    </div>
  );
}
