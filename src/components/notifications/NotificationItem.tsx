'use client';

import { useState } from 'react';
import type { Notification } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { 
    acceptFriendRequest, 
    declineFriendRequest, 
    markNotificationAsRead,
    acceptJoinRequest,
    declineJoinRequest
} from '@/lib/firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

interface NotificationItemProps {
    notification: Notification;
    onAction: () => void;
}

export function NotificationItem({ notification, onAction }: NotificationItemProps) {
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const language = useLanguage();
    const [isLoading, setIsLoading] = useState<'accept' | 'decline' | null>(null);
    const [isDeclining, setIsDeclining] = useState(false);
    const [declineMsg, setDeclineMsg] = useState('');

    const handleAccept = async () => {
        if (!currentUser) return;
        setIsLoading('accept');
        try {
            await acceptFriendRequest(currentUser.uid, notification.senderId);
            await markNotificationAsRead(notification.id);
            toast({ title: language === 'de' ? "Freundschaftsanfrage angenommen!" : "Friend request accepted!" });
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
            toast({ title: language === 'de' ? "Freundschaftsanfrage abgelehnt." : "Friend request declined." });
            onAction(); // Close popover
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Could not decline request." });
        } finally {
            setIsLoading(null);
        }
    };

    const handleAcceptJoin = async () => {
        if (!currentUser || !notification.activityId) return;
        setIsLoading('accept');
        try {
            await acceptJoinRequest(notification.id, notification.activityId, notification.senderId);
            toast({ title: language === 'de' ? "Anfrage akzeptiert!" : "Request accepted!" });
            onAction();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || error });
        } finally {
            setIsLoading(null);
        }
    };

    const handleDeclineJoin = async () => {
        if (!currentUser || !notification.activityId) return;
        setIsLoading('decline');
        try {
            await declineJoinRequest(notification.id, notification.activityId, notification.senderId, declineMsg);
            toast({ title: language === 'de' ? "Anfrage abgelehnt." : "Request declined." });
            onAction();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || error });
        } finally {
            setIsLoading(null);
        }
    };

    const sender = notification.senderProfile;
    const localeObj = language === 'de' ? de : enUS;
    const timeAgo = notification.createdAt ? formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true, locale: localeObj }) : '';

    return (
        <div className="p-2 rounded-lg hover:bg-muted/50">
            <div className="flex items-start gap-3">
                <Avatar className="mt-1">
                    <AvatarImage src={sender?.photoURL || undefined} />
                    <AvatarFallback>{sender?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                    <p className="text-sm">
                        {notification.type === 'friend_request' && (
                            <>
                                <span className="font-semibold">{sender?.displayName || 'Someone'}</span> {language === 'de' ? 'hat dir eine Freundschaftsanfrage gesendet.' : 'sent you a friend request.'}
                            </>
                        )}
                        {notification.type === 'join_request' && (
                            <>
                                <span className="font-semibold">{sender?.displayName || 'Someone'}</span> {language === 'de' ? 'möchte deiner Aktivität beitreten.' : 'wants to join your activity.'}
                            </>
                        )}
                        {(notification.type === 'system' || notification.type === 'join_response') && (
                            <>
                                <span className="font-semibold">{notification.title}</span>: {notification.message}
                            </>
                        )}
                    </p>
                    {notification.type === 'join_response' && notification.customMessage && (
                        <div className="mt-1 p-2 rounded-lg bg-muted text-xs italic text-muted-foreground">
                            "{notification.customMessage}"
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground">{timeAgo}</p>
                    
                    {notification.type === 'friend_request' && (
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleAccept} disabled={!!isLoading} className="flex-1 h-8">
                                {isLoading === 'accept' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {language === 'de' ? 'Annehmen' : 'Accept'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleDecline} disabled={!!isLoading} className="flex-1 h-8">
                                {isLoading === 'decline' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {language === 'de' ? 'Ablehnen' : 'Decline'}
                            </Button>
                        </div>
                    )}

                    {notification.type === 'join_request' && (
                        <div className="flex flex-col gap-2 mt-2">
                            {isDeclining ? (
                                <div className="flex flex-col gap-1.5 w-full">
                                    <input
                                        type="text"
                                        value={declineMsg}
                                        onChange={(e) => setDeclineMsg(e.target.value)}
                                        placeholder={language === 'de' ? "Nachricht an den User (optional)" : "Message to user (optional)"}
                                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-input bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-neutral-800 dark:text-neutral-200"
                                    />
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={handleDeclineJoin} disabled={!!isLoading} className="flex-1 h-8 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                            {isLoading === 'decline' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {language === 'de' ? 'Ablehnen' : 'Decline'}
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setIsDeclining(false)} className="flex-1 h-8">
                                            {language === 'de' ? 'Abbrechen' : 'Cancel'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleAcceptJoin} disabled={!!isLoading} className="flex-1 h-8">
                                        {isLoading === 'accept' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {language === 'de' ? 'Annehmen' : 'Accept'}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setIsDeclining(true)} disabled={!!isLoading} className="flex-1 h-8">
                                        {language === 'de' ? 'Ablehnen' : 'Decline'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
