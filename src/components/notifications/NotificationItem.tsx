'use client';

import { useState } from 'react';
import type { Notification } from '@/lib/types';
import { getNotificationTargetUrl, normalizeNotification } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useNotifications } from '@/contexts/notification-context';
import { 
    acceptFriendRequest, 
    declineFriendRequest, 
    acceptJoinRequest,
    declineJoinRequest
} from '@/lib/firebase/firestore';
import { ProfileAvatar } from '../ui/profile-avatar';
import { Button } from '../ui/button';
import { Loader2, MessageSquare, UserPlus, Sparkles, MapPin, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
    notification: Notification;
    onAction?: () => void;
}

export function NotificationItem({ notification: rawNotification, onAction }: NotificationItemProps) {
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const { toast } = useToast();
    const language = useLanguage();
    const { markAsRead } = useNotifications();
    
    const notification = normalizeNotification(rawNotification);
    const [isLoading, setIsLoading] = useState<'accept' | 'decline' | null>(null);
    const [isDeclining, setIsDeclining] = useState(false);
    const [declineMsg, setDeclineMsg] = useState('');

    const targetUrl = getNotificationTargetUrl(notification);
    const actorId = notification.actorId || notification.senderId;

    const handleClick = async (e: React.MouseEvent) => {
        // Prevent trigger if clicking on action buttons inside
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('input')) return;

        try {
            if (!notification.isRead) {
                await markAsRead(notification.id);
            }
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
        }

        if (targetUrl) {
            router.push(targetUrl);
        }
        if (onAction) onAction();
    };

    const handleAccept = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser || !actorId) return;
        setIsLoading('accept');
        try {
            await acceptFriendRequest(currentUser.uid, actorId);
            await markAsRead(notification.id);
            toast({ title: language === 'de' ? "Freundschaftsanfrage angenommen!" : "Friend request accepted!" });
            if (onAction) onAction();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Could not accept request." });
        } finally {
            setIsLoading(null);
        }
    };

    const handleDecline = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!currentUser || !actorId) return;
        setIsLoading('decline');
        try {
            await declineFriendRequest(currentUser.uid, actorId);
            await markAsRead(notification.id);
            toast({ title: language === 'de' ? "Freundschaftsanfrage abgelehnt." : "Friend request declined." });
            if (onAction) onAction();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || "Could not decline request." });
        } finally {
            setIsLoading(null);
        }
    };

    const handleAcceptJoin = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const activityId = notification.activityId || notification.entityId;
        if (!currentUser || !activityId || !actorId) return;
        setIsLoading('accept');
        try {
            await acceptJoinRequest(notification.id, activityId, actorId);
            await markAsRead(notification.id);
            toast({ title: language === 'de' ? "Anfrage akzeptiert!" : "Request accepted!" });
            if (onAction) onAction();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || String(error) });
        } finally {
            setIsLoading(null);
        }
    };

    const handleDeclineJoin = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const activityId = notification.activityId || notification.entityId;
        if (!currentUser || !activityId || !actorId) return;
        setIsLoading('decline');
        try {
            await declineJoinRequest(notification.id, activityId, actorId, declineMsg);
            await markAsRead(notification.id);
            toast({ title: language === 'de' ? "Anfrage abgelehnt." : "Request declined." });
            if (onAction) onAction();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || String(error) });
        } finally {
            setIsLoading(null);
        }
    };

    const sender = notification.senderProfile;
    const localeObj = language === 'de' ? de : enUS;
    const timeAgo = notification.createdAt && typeof (notification.createdAt as any).toDate === 'function'
        ? formatDistanceToNow((notification.createdAt as any).toDate(), { addSuffix: true, locale: localeObj }) 
        : '';

    const renderTypeIcon = () => {
        switch (notification.type) {
            case 'friend_request':
            case 'friend_accepted':
                return <UserPlus className="h-4 w-4 text-primary shrink-0" />;
            case 'chat_message':
            case 'chat_request':
                return <MessageSquare className="h-4 w-4 text-blue-500 shrink-0" />;
            case 'nearby_spot':
                return <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />;
            case 'recommendation':
            case 'engagement_reminder':
                return <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />;
            default:
                return <Bell className="h-4 w-4 text-slate-400 shrink-0" />;
        }
    };

    return (
        <div 
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick(e as any);
                }
            }}
            className={cn(
                "p-3 rounded-xl transition-all duration-200 cursor-pointer relative group border border-transparent",
                !notification.isRead
                    ? "bg-primary/5 dark:bg-primary/10 border-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15"
                    : "hover:bg-slate-100/80 dark:hover:bg-neutral-800/60"
            )}
        >
            <div className="flex items-start gap-3">
                {sender?.photoURL || sender?.displayName ? (
                    <ProfileAvatar 
                        className="mt-0.5 shrink-0"
                        photoURL={sender?.photoURL}
                        displayName={sender?.displayName}
                    />
                ) : (
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-800 shrink-0 mt-0.5">
                        {renderTypeIcon()}
                    </div>
                )}
                
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <h5 className={cn("text-xs font-bold truncate", !notification.isRead ? "text-primary" : "text-foreground")}>
                            {notification.title}
                        </h5>
                        {!notification.isRead && (
                            <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label={language === 'de' ? 'Ungelesen' : 'Unread'} />
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {notification.body || notification.message}
                    </p>

                    {notification.customMessage && (
                        <div className="mt-1 p-2 rounded-lg bg-muted text-xs italic text-muted-foreground">
                            "{notification.customMessage}"
                        </div>
                    )}

                    {timeAgo && (
                        <p className="text-[10px] text-muted-foreground/70 font-medium pt-0.5">
                            {timeAgo}
                        </p>
                    )}

                    {(notification.type === 'friend_request') && (
                        <div className="flex gap-2 pt-1.5" onClick={(e) => e.stopPropagation()}>
                            <Button size="sm" onClick={handleAccept} disabled={!!isLoading} className="flex-1 h-7 text-xs font-bold">
                                {isLoading === 'accept' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                {language === 'de' ? 'Annehmen' : 'Accept'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleDecline} disabled={!!isLoading} className="flex-1 h-7 text-xs font-bold">
                                {isLoading === 'decline' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                {language === 'de' ? 'Ablehnen' : 'Decline'}
                            </Button>
                        </div>
                    )}

                    {(notification.type === 'activity_join_request' || notification.type === 'join_request') && (
                        <div className="flex flex-col gap-2 pt-1.5" onClick={(e) => e.stopPropagation()}>
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
                                        <Button size="sm" onClick={handleDeclineJoin} disabled={!!isLoading} className="flex-1 h-7 text-xs font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                            {isLoading === 'decline' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                            {language === 'de' ? 'Ablehnen' : 'Decline'}
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setIsDeclining(false)} className="flex-1 h-7 text-xs font-bold">
                                            {language === 'de' ? 'Abbrechen' : 'Cancel'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleAcceptJoin} disabled={!!isLoading} className="flex-1 h-7 text-xs font-bold">
                                        {isLoading === 'accept' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                        {language === 'de' ? 'Annehmen' : 'Accept'}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setIsDeclining(true)} disabled={!!isLoading} className="flex-1 h-7 text-xs font-bold">
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
