'use client';

import { useState } from 'react';
import type { Notification } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { acceptFriendRequest, declineFriendRequest, markNotificationAsRead } from '@/lib/firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationItemProps {
    notification: Notification;
    onAction: () => void;
}

export function NotificationItem({ notification, onAction }: NotificationItemProps) {
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState<'accept' | 'decline' | null>(null);

    const handleAccept = async () => {
        if (!currentUser) return;
        setIsLoading('accept');
        try {
            await acceptFriendRequest(currentUser.uid, notification.senderId);
            await markNotificationAsRead(notification.id);
            toast({ title: "Friend request accepted!" });
            onAction(); // Close popover
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Could not accept request." });
        } finally {
            setIsLoading(null);
        }
    };

    const handleDecline = async () => {
        if (!currentUser) return;
        setIsLoading('decline');
        try {
            await declineFriendRequest(currentUser.uid, notification.senderId);
            await markNotificationAsRead(notification.id);
            toast({ title: "Friend request declined." });
            onAction(); // Close popover
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Could not decline request." });
        } finally {
            setIsLoading(null);
        }
    };

    const sender = notification.senderProfile;
    const timeAgo = notification.createdAt ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true }) : '';

    return (
        <div className="p-2 rounded-lg hover:bg-muted/50">
            <div className="flex items-start gap-3">
                <Avatar className="mt-1">
                    <AvatarImage src={sender?.photoURL || undefined} />
                    <AvatarFallback>{sender?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                    <p className="text-sm">
                        <span className="font-semibold">{sender?.displayName || 'Someone'}</span> sent you a friend request.
                    </p>
                     <p className="text-xs text-muted-foreground">{timeAgo}</p>
                    {notification.type === 'friend_request' && (
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleAccept} disabled={!!isLoading} className="flex-1 h-8">
                                {isLoading === 'accept' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Accept
                            </Button>
                             <Button size="sm" variant="outline" onClick={handleDecline} disabled={!!isLoading} className="flex-1 h-8">
                                {isLoading === 'decline' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Decline
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
