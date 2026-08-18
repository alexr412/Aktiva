'use client';

import { useState } from 'react';
import type { Notification } from '@/lib/types';
import { getNotificationTargetUrl, normalizeNotification, deriveFriendRequestNotificationState } from '@/lib/types';
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
import { Loader2, MessageSquare, UserPlus, Sparkles, MapPin, Bell, Trash2 } from 'lucide-react';
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
    const { user: currentUser, userProfile } = useAuth();
    const { toast } = useToast();
    const language = useLanguage();
    const { markAsRead, deleteNotification } = useNotifications();
    
    const notification = normalizeNotification(rawNotification);
    const [isLoading, setIsLoading] = useState<'accept' | 'decline' | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeclining, setIsDeclining] = useState(false);
    const [declineMsg, setDeclineMsg] = useState('');

    const targetUrl = getNotificationTargetUrl(notification);
    const actorId = notification.actorId || notification.senderId || notification.entityId;

    const friendRequestState = notification.type === 'friend_request'
        ? deriveFriendRequestNotificationState(notification, userProfile?.friendRequestsReceived, userProfile?.friends)
        : null;

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDeleting) return;
        setIsDeleting(true);
        try {
            await deleteNotification(notification.id);
        } catch (error) {
            console.error("Failed to delete notification:", error);
        } finally {
            setIsDeleting(false);
        }
    };

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

        // Defensive client check: verify request is still pending locally
        const isPendingLocally = userProfile?.friendRequestsReceived?.includes(actorId);
        const isAlreadyFriends = userProfile?.friends?.includes(actorId);

        if (!isPendingLocally && !isAlreadyFriends) {
            await markAsRead(notification.id);
            if (onAction) onAction();
            return;
        }

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

        // Defensive client check: verify request is still pending locally
        const isPendingLocally = userProfile?.friendRequestsReceived?.includes(actorId);

        if (!isPendingLocally) {
            await markAsRead(notification.id);
            if (onAction) onAction();
            return;
        }

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
            toast({ title: language === 'de' ? "Anfrage abgelehnt." : "Request declined." });
            if (onAction) onAction();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: error.message || String(error) });
        } finally {
            setIsLoading(null);
        }
    };

    const sender = notification.senderProfile;
    const isJoinRequest = notification.type === 'join_request' || notification.type === 'activity_join_request';

    const getJoinRequesterLabel = () => {
        if (sender?.username && typeof sender.username === 'string' && sender.username.trim().length > 0) {
            const cleanUser = sender.username.trim().replace(/^@+/, '');
            if (cleanUser.length > 0) {
                return `@${cleanUser}`;
            }
        }
        if (sender?.displayName && typeof sender.displayName === 'string' && sender.displayName.trim().length > 0) {
            return sender.displayName.trim();
        }
        return 'Ein Nutzer';
    };

    const senderLabel = isJoinRequest
        ? getJoinRequesterLabel()
        : (sender?.displayName || (sender?.username ? `@${sender.username.trim().replace(/^@+/, '')}` : null));

    const rawBody = notification.body || notification.message || '';
    const displayedBody = isJoinRequest && rawBody
        ? rawBody.replace(/^.+?( (?:möchte an|wants to join) )/, `${senderLabel}$1`)
        : rawBody;

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

    const renderFriendRequestStatus = () => {
        if (!friendRequestState) return null;

        switch (friendRequestState) {
            case 'pending':
                return (
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
                );
            case 'accepted':
                return (
                    <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 pt-1">
                        ✓ {language === 'de' ? 'Ihr seid befreundet' : 'You are friends'}
                    </p>
                );
            case 'declined':
                return (
                    <p className="text-[11px] text-muted-foreground pt-1">
                        {language === 'de' ? 'Anfrage abgelehnt' : 'Request declined'}
                    </p>
                );
            case 'cancelled':
                return (
                    <div className="pt-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                            {language === 'de' ? 'Freundschaftsanfrage zurückgezogen' : 'Friend request cancelled'}
                        </span>
                    </div>
                );
            case 'processed':
                return (
                    <div className="pt-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                            {language === 'de' ? 'Freundschaftsanfrage verarbeitet' : 'Friend request processed'}
                        </span>
                    </div>
                );
            case 'invalid':
            default:
                return null;
        }
    };

    const handleProfileClick = (e: React.MouseEvent) => {
        const targetUserId = notification.actorId || notification.senderId;
        if (targetUserId && targetUserId !== notification.entityId) {
            e.stopPropagation();
            router.push(`/users/${targetUserId}`);
            if (onAction) onAction();
        }
    };

    return (
        <div 
            onClick={handleClick}
            className={cn(
                "group relative p-3 rounded-xl transition-all duration-200 cursor-pointer border border-transparent",
                !notification.isRead 
                    ? "bg-slate-50 dark:bg-neutral-800/60 hover:bg-slate-100 dark:hover:bg-neutral-800 border-slate-200/50 dark:border-neutral-700/50" 
                    : "hover:bg-slate-50 dark:hover:bg-neutral-800/40"
            )}
        >
            <div className="flex items-start gap-3">
                {sender?.photoURL || sender?.displayName || sender?.username ? (
                    <div 
                        onClick={handleProfileClick}
                        className="mt-0.5 shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                        title={language === 'de' ? 'Profil anzeigen' : 'View profile'}
                    >
                        <ProfileAvatar 
                            photoURL={sender?.photoURL}
                            displayName={senderLabel || sender?.displayName}
                        />
                    </div>
                ) : (
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-800 shrink-0 mt-0.5">
                        {renderTypeIcon()}
                    </div>
                )}
                
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <h5 className={cn("text-xs font-bold truncate", !notification.isRead ? "text-primary" : "text-foreground")}>
                                {notification.title}
                            </h5>
                            {senderLabel && (
                                <button
                                    type="button"
                                    onClick={handleProfileClick}
                                    className="text-[11px] font-semibold text-slate-600 dark:text-neutral-400 hover:text-primary hover:underline truncate"
                                >
                                    ({senderLabel})
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {!notification.isRead && (
                                <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label={language === 'de' ? 'Ungelesen' : 'Unread'} />
                            )}
                            {!isJoinRequest && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    title={language === 'de' ? 'Benachrichtigung löschen' : 'Delete notification'}
                                    className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-slate-200/60 dark:hover:bg-neutral-700/60 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                                >
                                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </button>
                            )}
                        </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {displayedBody}
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

                    {notification.type === 'friend_request' && renderFriendRequestStatus()}

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
