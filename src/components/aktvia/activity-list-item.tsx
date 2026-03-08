'use client';

import { useState } from 'react';
import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Loader2, MessageSquare, Users, Flame, Bookmark, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
          "p-5 relative group transition-all rounded-2xl bg-white dark:bg-neutral-800 shadow-sm border-none dark:border dark:border-neutral-700 mb-4",
          activity.isBoosted && "ring-2 ring-orange-500/20"
        )}>
            <div className="flex items-start gap-4">
                <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl flex-shrink-0", primaryStyle.bgClass, "dark:bg-neutral-700/50")}>
                    <PrimaryIcon className="h-8 w-8" style={{ color: primaryStyle.color }} />
                </div>
                
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-lg font-extrabold text-[#0f172a] dark:text-neutral-200 truncate leading-tight">{activity.placeName}</p>
                        {activity.isBoosted && (
                          <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1 h-5 px-1.5 text-[9px] font-black">
                            <Flame className="h-2.5 w-2.5" />
                            <span>HOT</span>
                          </Badge>
                        )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-1.5 flex items-center gap-1.5 font-medium">
                        <Users className="h-3.5 w-3.5"/>
                        <span>{activity.participantIds.length} / {activity.maxParticipants || '∞'} &bull; von {activity.creatorName}</span>
                    </p>

                    <div className="flex w-full flex-wrap items-center gap-1.5 overflow-hidden mt-3">
                      {processedTags.map((tag, index) => (
                        <span key={index} className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold tracking-tight bg-neutral-100 dark:bg-neutral-700 dark:border dark:border-neutral-600 text-neutral-700 dark:text-neutral-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                </div>
            </div>

            <div className="card-footer-actions flex justify-between items-center w-full mt-5 pt-4 border-t border-neutral-50 dark:border-neutral-700/50">
              <div className="voting-controls flex gap-2 items-center">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVote(activity.id!, userVote === 'up' ? 'none' : 'up'); }} 
                  className="dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:border-neutral-600 dark:text-neutral-200"
                  style={{ 
                    padding: '6px 14px', border: '1px solid', borderRadius: '10px', fontWeight: '800', fontSize: '14px', transition: 'all 0.2s', cursor: 'pointer',
                    background: userVote === 'up' ? '#22c55e' : 'inherit', color: userVote === 'up' ? '#ffffff' : 'inherit', borderColor: userVote === 'up' ? '#22c55e' : '#e2e8f0',
                  }}
                >
                  {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↑'}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVote(activity.id!, userVote === 'down' ? 'none' : 'down'); }} 
                  className="dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:border-neutral-600 dark:text-neutral-200"
                  style={{ 
                    padding: '6px 14px', border: '1px solid', borderRadius: '10px', fontWeight: '800', fontSize: '14px', transition: 'all 0.2s', cursor: 'pointer',
                    background: userVote === 'down' ? '#ef4444' : 'inherit', color: userVote === 'down' ? '#ffffff' : 'inherit', borderColor: userVote === 'down' ? '#ef4444' : '#e2e8f0',
                  }}
                >
                  {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↓'}
                </button>
              </div>

              <div className="flex gap-2">
                {isParticipant ? (
                  <button className="dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:border-neutral-600" onClick={(e) => { e.stopPropagation(); handleViewChatClick(activity.id!); }} style={{ padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'inherit' }}>
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </button>
                ) : (
                  <button className="add-button" onClick={(e) => { e.stopPropagation(); handleJoinClick(activity.id!); }} disabled={isJoining} style={{ padding: '10px', borderRadius: '12px', border: 'none', background: 'hsl(var(--primary))', color: '#ffffff', cursor: 'pointer' }}>
                    {isJoining ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" strokeWidth={3} />}
                  </button>
                )}
              </div>
            </div>
        </div>
    );
}
