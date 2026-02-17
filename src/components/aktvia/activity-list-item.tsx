'use client';

import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Home, Loader2, MapPin, ChevronRight } from 'lucide-react';

interface ActivityListItemProps {
    activity: Activity;
    user: User | null;
    onJoin: (activityId: string) => void;
    isJoining: boolean;
}

export function ActivityListItem({ activity, user, onJoin, isJoining }: ActivityListItemProps) {
    const router = useRouter();

    if (!activity.id) return null;

    const isParticipant = activity.participantIds.includes(user?.uid || '---');
    
    const Icon = activity.isCustomActivity ? Home : MapPin;

    const handleClick = () => {
        if (isJoining) return; // Prevent multiple clicks

        if (isParticipant) {
            router.push(`/chat/${activity.id}`);
        } else {
            onJoin(activity.id!);
        }
    };

    return (
        <div 
            className="p-4 transition-colors hover:bg-muted/50 cursor-pointer"
            onClick={handleClick}
        >
            <div className="flex items-center gap-4">
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
                <div className="flex-shrink-0 self-center pl-2">
                    {isJoining ? (
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                        <ChevronRight className="h-6 w-6 text-muted-foreground" />
                    )}
                </div>
            </div>
        </div>
    );
}
