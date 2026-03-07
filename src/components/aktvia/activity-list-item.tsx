'use client';

import { useState } from 'react';
import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Home, Loader2, MapPin, LogIn, MessageSquare, Users, Flame, ArrowUp, ArrowDown, Bookmark, Plus } from 'lucide-react';
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
                </div>

                <div className="flex flex-col items-end gap-3 flex-shrink-0 self-center pl-2">
                    {/* Voting Controls Area */}
                    <div className="flex items-center gap-1 bg-secondary/50 rounded-full p-1 border border-border/50">
                        <button 
                            onClick={(e) => handleVote(e, 'up')}
                            disabled={isVoting || !user}
                            className={cn(
                                "p-1.5 rounded-full transition-colors",
                                currentUserVote === 'up' ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                            )}
                            aria-label="Upvote"
                        >
                            <ArrowUp className="h-4 w-4" />
                        </button>
                        <button 
                            onClick={(e) => handleVote(e, 'down')}
                            disabled={isVoting || !user}
                            className={cn(
                                "p-1.5 rounded-full transition-colors",
                                currentUserVote === 'down' ? "bg-destructive text-destructive-foreground" : "hover:bg-muted"
                            )}
                            aria-label="Downvote"
                        >
                            <ArrowDown className="h-4 w-4" />
                        </button>

                        {/* Admin-only metrics */}
                        {userProfile?.isAdmin && (
                            <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground px-2 whitespace-nowrap border-l border-border ml-1">
                                ↑{activity.upvotes || 0} ↓{activity.downvotes || 0}
                            </span>
                        )}
                    </div>

                    {/* Interaction Buttons (Bookmark, Plus/Add) */}
                    <div className="flex items-center gap-2">
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 rounded-full bg-background hover:bg-secondary"
                            onClick={(e) => e.stopPropagation()} // Activity bookmarking logic would go here
                        >
                            <Bookmark className="h-4 w-4" />
                            <span className="sr-only">Lesezeichen</span>
                        </Button>

                        {isParticipant ? (
                             <Button size="icon" variant="outline" className="h-9 w-9 rounded-full bg-background hover:bg-secondary" onClick={handleViewChatClick}>
                                <MessageSquare className="h-4 w-4" />
                                <span className='sr-only'>Chat</span>
                            </Button>
                        ) : isFull ? (
                            <Button size="icon" variant="secondary" disabled className="h-9 w-9 rounded-full">
                                <Users className="h-4 w-4 opacity-50" />
                                <span className='sr-only'>Voll</span>
                            </Button>
                        ) : (
                            <Button 
                                size="icon" 
                                onClick={handleJoinClick} 
                                disabled={isJoining} 
                                className={cn(
                                    "h-9 w-9 rounded-full shadow-md transition-all active:scale-95",
                                    activity.isBoosted ? "bg-orange-500 hover:bg-orange-600" : "bg-primary hover:bg-primary/90"
                                )}
                            >
                                {isJoining ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4" />
                                        <span className='sr-only'>Hinzufügen</span>
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
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