'use client';

import { useState } from 'react';
import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Home, Loader2, MapPin, LogIn, MessageSquare, Users, Flame, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EntityMoreOptions } from '../common/EntityMoreOptions';
import { cn } from '@/lib/utils';
import { voteActivity } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

interface ActivityListItemProps {
    activity: Activity;
    user: User | null;
    onJoin: (activityId: string) => Promise<void>;
}

export function ActivityListItem({ activity, user, onJoin }: ActivityListItemProps) {
    const { userProfile } = useAuth();
    const router = useRouter();
    const [isJoining, setIsJoining] = useState(false);
    const [isVoting, setIsVoting] = useState(false);

    if (!activity.id) return null;

    const isParticipant = activity.participantIds.includes(user?.uid || '---');
    const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;
    const isOwnActivity = activity.creatorId === user?.uid;
    
    const currentUserVote = user ? activity.userVotes?.[user.uid] : undefined;
    
    const Icon = activity.isCustomActivity ? Home : MapPin;

    const handleJoinClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isJoining || isParticipant || isFull || !activity.id) return; 

        setIsJoining(true);
        try {
            await onJoin(activity.id);
        } catch (error) {
            setIsJoining(false);
        }
    };
    
    const handleViewChatClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(`/chat/${activity.id}`);
    };

    const handleVote = async (e: React.MouseEvent, type: 'up' | 'down') => {
        e.stopPropagation();
        if (!user || !activity.id || isVoting) return;
        
        setIsVoting(true);
        try {
            await voteActivity(activity.id, user.uid, type);
        } catch (error) {
            console.error("Voting failed:", error);
        } finally {
            setIsVoting(false);
        }
    };

    const renderDate = () => {
        if (activity.activityEndDate) {
            return `${format(activity.activityDate.toDate(), "eee, MMM d")} - ${format(activity.activityEndDate.toDate(), "eee, MMM d")}`;
        }
        if (activity.isTimeFlexible) {
            return `${format(activity.activityDate.toDate(), "eee, MMM d")} (Flexible Time)`;
        }
        return format(activity.activityDate.toDate(), "eee, MMM d 'at' p");
    }

    return (
        <div className={cn(
          "p-4 relative group transition-all",
          activity.isBoosted && "bg-orange-500/5 border-l-4 border-l-orange-500"
        )}>
            <div className="flex items-center gap-4">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0",
                  activity.isBoosted ? "bg-orange-500/10" : "bg-muted"
                )}>
                    <Icon className={cn(
                      "h-5 w-5",
                      activity.isBoosted ? "text-orange-500" : "text-muted-foreground"
                    )} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-base truncate">{activity.placeName}</p>
                        {activity.isBoosted && (
                          <Badge variant="default" className="bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1">
                            <Flame className="h-3 w-3" />
                            <span>HOT</span>
                          </Badge>
                        )}
                        {activity.isCustomActivity && <Badge variant="secondary">Community</Badge>}
                    </div>
                     <p className="text-sm text-muted-foreground">
                        {renderDate()}
                    </p>
                    <p className="text-sm text-muted-foreground truncate mt-1 flex items-center gap-1.5">
                        <Users className="h-4 w-4"/>
                        <span>
                            {activity.participantIds.length} / {activity.maxParticipants || '∞'} &bull; von {activity.creatorName}
                        </span>
                    </p>
                    
                    {/* Voting Logic Interface */}
                    <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center bg-secondary/50 rounded-full p-1">
                            <button 
                                onClick={(e) => handleVote(e, 'up')}
                                disabled={isVoting || !user}
                                className={cn(
                                    "p-1.5 rounded-full transition-colors",
                                    currentUserVote === 'up' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                )}
                            >
                                <ThumbsUp className="h-4 w-4" />
                            </button>
                            <button 
                                onClick={(e) => handleVote(e, 'down')}
                                disabled={isVoting || !user}
                                className={cn(
                                    "p-1.5 rounded-full transition-colors",
                                    currentUserVote === 'down' ? "bg-destructive text-destructive-foreground" : "hover:bg-muted"
                                )}
                            >
                                <ThumbsDown className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Admin-only metrics */}
                        {userProfile?.isAdmin && (
                            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-l pl-3 border-border">
                                <span className="flex items-center gap-1">
                                    <ThumbsUp className="h-3 w-3 text-primary" />
                                    {activity.upvotes || 0}
                                </span>
                                <span className="flex items-center gap-1">
                                    <ThumbsDown className="h-3 w-3 text-destructive" />
                                    {activity.downvotes || 0}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex-shrink-0 self-center pl-2">
                    {isParticipant ? (
                         <Button size="sm" variant="outline" onClick={handleViewChatClick}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Chat
                        </Button>
                    ) : isFull ? (
                        <Button size="sm" variant="secondary" disabled>
                            Voll
                        </Button>
                    ) : (
                        <Button size="sm" onClick={handleJoinClick} disabled={isJoining} className={cn(activity.isBoosted && "bg-orange-500 hover:bg-orange-600")}>
                            {isJoining ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="mr-2 h-4 w-4" />
                                    Teilnehmen
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
             {!isOwnActivity && user && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <EntityMoreOptions
                        entityId={activity.id}
                        entityType="activity"
                        entityName={activity.placeName}
                    />
                </div>
            )}
        </div>
    );
}
