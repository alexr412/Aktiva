
'use client';

import { useState } from 'react';
import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Home, Loader2, MapPin, LogIn, MessageSquare, Users, Flame, Bookmark, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
    const userVote = user ? activity.userVotes?.[user.uid] : undefined;
    
    const Icon = activity.isCustomActivity ? Home : MapPin;

    const handleJoinClick = async (activityId: string) => {
        if (isJoining || isParticipant || isFull) return; 

        setIsJoining(true);
        try {
            await onJoin(activityId);
        } catch (error) {
            setIsJoining(false);
        }
    };
    
    const handleViewChatClick = (activityId: string) => {
        router.push(`/chat/${activityId}`);
    };

    const handleVote = async (activityId: string, type: 'up' | 'down') => {
        if (!user || isVoting) return;
        if (userVote === (type === 'up' ? 'down' : 'up')) return; // Block opposite if already voted (redundant due to disabled button)
        
        setIsVoting(true);
        try {
            await voteActivity(activityId, user.uid, type);
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
          "p-4 relative group transition-all rounded-xl border border-transparent hover:border-border hover:bg-muted/30",
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
            </div>

            <div className="card-footer-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '12px' }}>
              
              <div className="voting-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  onClick={(e) => { e.stopPropagation(); userVote !== 'up' && handleVote(activity.id!, 'up'); }} 
                  disabled={isVoting || !user || userVote === 'down'}
                  aria-label="Upvote"
                  style={{ 
                    padding: '6px 12px', 
                    border: '1px solid', 
                    borderRadius: '8px', 
                    fontWeight: 'bold',
                    transition: 'all 0.2s',
                    cursor: userVote === 'down' ? 'not-allowed' : 'pointer',
                    background: userVote === 'up' ? '#22c55e' : (userVote === 'down' ? '#f1f5f9' : '#ffffff'),
                    color: userVote === 'up' ? '#ffffff' : (userVote === 'down' ? '#94a3b8' : '#000000'),
                    borderColor: userVote === 'up' ? '#22c55e' : '#e2e8f0',
                    opacity: userVote === 'down' ? 0.6 : 1
                  }}
                >
                  {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↑'}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); userVote !== 'down' && handleVote(activity.id!, 'down'); }} 
                  disabled={isVoting || !user || userVote === 'up'}
                  aria-label="Downvote"
                  style={{ 
                    padding: '6px 12px', 
                    border: '1px solid', 
                    borderRadius: '8px', 
                    fontWeight: 'bold',
                    transition: 'all 0.2s',
                    cursor: userVote === 'up' ? 'not-allowed' : 'pointer',
                    background: userVote === 'down' ? '#ef4444' : (userVote === 'up' ? '#f1f5f9' : '#ffffff'),
                    color: userVote === 'down' ? '#ffffff' : (userVote === 'up' ? '#94a3b8' : '#000000'),
                    borderColor: userVote === 'down' ? '#ef4444' : '#e2e8f0',
                    opacity: userVote === 'up' ? 0.6 : 1
                  }}
                >
                  {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↓'}
                </button>

                {userProfile?.isAdmin && (
                  <span className="admin-metrics" style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px', display: 'block', visibility: 'visible' }}>
                    ↑{activity.upvotes || 0} ↓{activity.downvotes || 0}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="bookmark-button" 
                  aria-label="Save"
                  onClick={(e) => e.stopPropagation()}
                  style={{ padding: '8px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#ffffff', cursor: 'pointer' }}
                >
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                </button>
                
                {isParticipant ? (
                  <button 
                    className="add-button" 
                    aria-label="Chat"
                    onClick={(e) => { e.stopPropagation(); handleViewChatClick(activity.id!); }}
                    style={{ padding: '8px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#ffffff', cursor: 'pointer' }}
                  >
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </button>
                ) : isFull ? (
                  <button 
                    className="add-button" 
                    aria-label="Full"
                    disabled
                    style={{ padding: '8px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#f1f5f9', cursor: 'not-allowed' }}
                  >
                    <Users className="h-4 w-4 text-muted-foreground opacity-50" />
                  </button>
                ) : (
                  <button 
                    className="add-button" 
                    aria-label="Add"
                    onClick={(e) => { e.stopPropagation(); handleJoinClick(activity.id!); }}
                    disabled={isJoining}
                    style={{ padding: '8px', borderRadius: '50%', border: 'none', background: 'hsl(var(--primary))', color: '#ffffff', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  >
                    {isJoining ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
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
