'use client';

import { useState } from 'react';
import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Loader2, MessageSquare, Users, Flame, Bookmark, Plus, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityMoreOptions } from '../common/EntityMoreOptions';
import { cn } from '@/lib/utils';
import { voteActivity } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { getPrimaryIconData } from '@/lib/tag-config';
import { formatTags } from '@/lib/tag-parser';

interface ActivityListItemProps {
    activity: Activity;
    user: User | null;
    onJoin: (activityId: string) => Promise<void>;
}

export function ActivityListItem({ activity, user, onJoin }: ActivityListItemProps) {
    if (!activity) return null;

    const { userProfile } = useAuth();
    const router = useRouter();
    const [isJoining, setIsJoining] = useState(false);
    const [isVoting, setIsVoting] = useState(false);

    if (!activity.id) return null;

    const isParticipant = activity.participantIds.includes(user?.uid || '---');
    const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;
    const isOwnActivity = activity.creatorId === user?.uid;
    const userVote = user ? (activity.userVotes?.[user.uid] || 'none') : 'none';
    
    const primaryStyle = getPrimaryIconData({ categories: activity.categories, name: activity.placeName });
    const PrimaryIcon = primaryStyle.icon;

    const handleJoinClick = async (activityId: string) => {
        if (isJoining || isParticipant || isFull) return; 
        setIsJoining(true);
        try { await onJoin(activityId); } catch (error) { setIsJoining(false); }
    };
    
    const handleViewChatClick = (activityId: string) => { router.push(`/chat/${activityId}`); };

    const handleVote = async (activityId: string, type: 'up' | 'down' | 'none') => {
        if (!user || isVoting) return;
        setIsVoting(true);
        try { await voteActivity(activityId, user.uid, type); } catch (error) { console.error("Voting failed:", error); } finally { setIsVoting(false); }
    };

    const rawTags = (activity.categories || []).filter((tag: string) => 
      !tag.startsWith('wheelchair') && 
      !tag.startsWith('fee') && 
      !tag.startsWith('no_fee')
    );
    const processedTags = formatTags(rawTags);

    return (
        <div className={cn(
          "p-5 relative group transition-all rounded-[2rem] bg-white dark:bg-neutral-800 shadow-sm border-none dark:border dark:border-neutral-700 mb-4",
          activity.isBoosted && "ring-4 ring-orange-500/10"
        )}>
            <div className="flex items-start gap-4">
                <div className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl flex-shrink-0 transition-transform group-hover:scale-105", 
                    primaryStyle.bgClass.replace('bg-', 'bg-gradient-to-br from-').replace('-50', '-400 to-').concat(primaryStyle.color === '#ef4444' ? 'red-500' : 'violet-500')
                )}>
                    <PrimaryIcon className="h-8 w-8 text-white drop-shadow-sm" />
                </div>
                
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-lg font-black text-[#0f172a] dark:text-neutral-200 truncate leading-tight">{activity.placeName}</p>
                        {activity.isBoosted && (
                          <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 h-5 px-2 text-[9px] font-black rounded-full">
                            <Flame className="h-2.5 w-2.5" />
                            <span>HOT</span>
                          </Badge>
                        )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 font-bold uppercase tracking-wider">
                            <Users className="h-3 w-3 text-primary/60"/>
                            <span>{activity.participantIds.length} / {activity.maxParticipants || '∞'} &bull; von {activity.creatorName?.split(' ')[0]}</span>
                        </p>
                        {activity.placeAddress && (
                            <p className="text-[11px] text-neutral-400 flex items-center gap-1 font-medium truncate max-w-[150px]">
                                <MapPin className="h-3 w-3" />
                                {activity.placeAddress}
                            </p>
                        )}
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-1.5 overflow-hidden mt-3">
                      {processedTags.slice(0, 3).map((tag, index) => (
                        <span key={index} className="inline-flex items-center rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-tight bg-secondary/50 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                </div>
            </div>

            <div className="card-footer-actions flex justify-between items-center w-full mt-5 pt-4 border-t border-neutral-50 dark:border-neutral-700/50">
              <div className="voting-controls flex gap-1.5 items-center bg-secondary/30 rounded-full p-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVote(activity.id!, userVote === 'up' ? 'none' : 'up'); }} 
                  className={cn(
                    "h-8 px-4 rounded-full font-black text-sm transition-all active:scale-90",
                    userVote === 'up' ? "bg-white text-green-500 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↑'}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVote(activity.id!, userVote === 'down' ? 'none' : 'down'); }} 
                  className={cn(
                    "h-8 px-4 rounded-full font-black text-sm transition-all active:scale-90",
                    userVote === 'down' ? "bg-white text-red-500 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↓'}
                </button>
              </div>

              <div className="flex gap-2">
                {isParticipant ? (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); handleViewChatClick(activity.id!); }} 
                    className="h-10 rounded-2xl bg-white shadow-sm border-neutral-100 hover:bg-neutral-50 text-primary font-bold gap-2 px-4"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Chat</span>
                  </Button>
                ) : (
                  <Button 
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleJoinClick(activity.id!); }} 
                    disabled={isJoining || isFull}
                    className="h-10 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black px-6 shadow-lg shadow-primary/20 transition-transform active:scale-95"
                  >
                    {isJoining ? <Loader2 className="animate-spin h-4 w-4" /> : (isFull ? 'Voll' : 'Beitreten')}
                  </Button>
                )}
              </div>
            </div>
        </div>
    );
}