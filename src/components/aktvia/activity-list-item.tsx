'use client';

import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Home, LogIn, Loader2, MapPin } from 'lucide-react';

interface ActivityListItemProps {
    activity: Activity;
    user: User | null;
    onJoin: (activityId: string) => void;
    isJoining: boolean;
}

export function ActivityListItem({ activity, user, onJoin, isJoining }: ActivityListItemProps) {
    const router = useRouter();

    if (!activity.id) return null;

    const isCreator = user?.uid === activity.creatorId;
    const isParticipant = activity.participantIds.includes(user?.uid || '---');
    
    const Icon = activity.isCustomActivity ? Home : MapPin;

    return (
        <div className="p-4">
            <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-base truncate">{activity.placeName}</p>
                     <p className="text-sm text-muted-foreground">
                        {format(activity.activityDate.toDate(), "eee, MMM d 'at' p")}
                    </p>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                        {activity.participantIds.length} participant{activity.participantIds.length !== 1 ? 's' : ''} &bull; by {activity.creatorName}
                    </p>
                </div>
                <div className="flex-shrink-0 self-center">
                    {isCreator || isParticipant ? (
                        <Button size="sm" variant="outline" onClick={() => router.push(`/chat/${activity.id}`)}>
                            View Chat
                        </Button>
                    ) : (
                        <Button 
                            size="sm"
                            onClick={() => onJoin(activity.id!)} 
                            disabled={isJoining}
                            className="w-24"
                        >
                            {isJoining ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="mr-2 h-4 w-4" />
                                    Join
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
