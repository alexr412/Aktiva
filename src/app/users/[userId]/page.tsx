'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

import {
  fetchUserActivities,
  joinActivity,
  getPublicProfileClient,
  sendFriendRequest,
  cancelFriendRequest,
  removeFriend,
  acceptFriendRequest,
  declineFriendRequest,
  getOrCreateDirectChat,
} from '@/lib/firebase/firestore';
import type { Activity, UserProfile, PublicUserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileActivityCard } from '@/components/profile/ProfileActivityCard';
import {
  ArrowLeft,
  Compass,
  Loader2,
  UserPlus,
  UserMinus,
  Clock,
  UserCheck,
  X,
  MessageSquare,
  Star,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EntityMoreOptions } from '@/components/common/EntityMoreOptions';
import { UserBadge } from '@/components/common/UserBadge';
import { cn, formatFirstName } from '@/lib/utils';


export default function UserProfilePage() {
    const { user: currentUser, userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const language = useLanguage();
    const { toast } = useToast();

    const userId = params.userId as string;

    const [userData, setUserData] = useState<PublicUserProfile | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFriendActionLoading, setIsFriendActionLoading] = useState(false);
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const [isBlockedOrUnavailable, setIsBlockedOrUnavailable] = useState(false);
    const [friendshipStatus, setFriendshipStatus] = useState<'loading' | 'is_self' | 'friends' | 'request_sent' | 'request_received' | 'not_friends'>('loading');

    useEffect(() => {
        if (authLoading) return;

        if (!currentUser) {
            router.push(`/login?redirect=/users/${userId}`);
            return;
        }

        if (userProfile && !userProfile.onboardingCompleted) {
            router.push('/onboarding');
            return;
        }

        if (!userId) return;
        
        if (userProfile?.hiddenEntityIds?.includes(userId)) {
            router.back();
            toast({ 
                title: language === 'de' ? "Nutzer nicht sichtbar" : "User cannot be viewed", 
                description: language === 'de' ? "Dieser Nutzer ist verborgen." : "This user is hidden." 
            });
            return;
        }

        if (currentUser.uid === userId) {
            setFriendshipStatus('is_self');
            router.replace('/profile');
            return;
        }

        // Check if we blocked the target user
        const isBlockingTarget = userProfile?.blacklist?.hard?.includes(userId) || userProfile?.blacklist?.soft?.includes(userId);
        if (isBlockingTarget) {
            setIsBlockedOrUnavailable(true);
            setLoading(false);
            return;
        }

        if (userProfile) {
            if (userProfile.friends?.includes(userId)) {
                setFriendshipStatus('friends');
            } else if (userProfile.friendRequestsSent?.includes(userId)) {
                setFriendshipStatus('request_sent');
            } else if (userProfile.friendRequestsReceived?.includes(userId)) {
                setFriendshipStatus('request_received');
            } else {
                setFriendshipStatus('not_friends');
            }
        } else {
            setFriendshipStatus('not_friends');
        }

        const loadData = async () => {
            setLoading(true);
            try {
                const [profile, userActivities] = await Promise.all([
                    getPublicProfileClient(userId),
                    fetchUserActivities(userId)
                ]);

                if (profile) {
                    setUserData(profile as PublicUserProfile);
                    
                    const mappedActivities = (userActivities as Activity[]).map(act => ({
                        ...act,
                        sourceType: 'activity' as const,
                        isUserEvent: true
                    }));
                    setActivities(mappedActivities);
                } else {
                    toast({ 
                        title: language === 'de' ? "Nutzer nicht gefunden" : "User not found", 
                        description: language === 'de' ? "Dieses Profil konnte nicht geladen werden." : "This user profile could not be loaded.", 
                        variant: "destructive" 
                    });
                    router.back();
                }
            } catch (error: any) {
                console.error("Failed to fetch user data:", error);
                const isPermissionError = error?.code === 'permission-denied' || error?.message?.includes('permission-denied');
                if (isPermissionError) {
                    setIsBlockedOrUnavailable(true);
                } else {
                    toast({
                        title: language === 'de' ? "Fehler" : "Error",
                        description: language === 'de' ? "Profil konnte nicht geladen werden." : "Could not load this user's profile.",
                        variant: "destructive",
                    });
                }
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [userId, currentUser, router, toast, userProfile, authLoading, language]);

    const handleJoin = async (activity: Activity) => {
        if (!currentUser) {
            toast({ 
                title: language === 'de' ? 'Login erforderlich' : 'Login Required', 
                description: language === 'de' ? 'Bitte logge dich ein, um beizutreten.' : 'You must be logged in to join an activity.' 
            });
            router.push('/login');
            throw new Error('Login Required');
        }
        if (isBlockedOrUnavailable) {
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Aktion nicht möglich' : 'Action not possible',
                description: language === 'de' ? 'Dieser Nutzer ist nicht verfügbar.' : 'This user is unavailable.',
            });
            return;
        }
        try {
            const status = await joinActivity(activity.id!, currentUser, null, null, activity.joinMode);
            if (status === 'joined') {
                toast({ 
                    title: language === 'de' ? 'Erfolgreich!' : 'Success!', 
                    description: language === 'de' ? 'Du bist beigetreten. Du findest die Aktivität in deinen Chats.' : 'You have joined the activity. You can find it in your chats.' 
                });
                setActivities(prev => prev.map(act => act.id === activity.id ? {...act, participantIds: [...act.participantIds, currentUser.uid]} : act));
                router.push(`/chat/${activity.id}`);
            } else if (status === 'already_requested') {
                toast({
                    title: language === 'de' ? 'Du hast bereits eine Anfrage gesendet.' : 'You already sent a request.',
                    description: language === 'de' ? 'Der Host hat deine Anfrage bereits erhalten.' : 'The host has already received your request.'
                });
            } else {
                toast({ title: language === 'de' ? 'Anfrage gesendet!' : 'Request sent!', description: language === 'de' ? 'Der Host wird benachrichtigt.' : 'The host will be notified.' });
            }
            return status;
        } catch (error: any) {
            console.error(error);
            toast({ 
                title: language === 'de' ? 'Fehler' : 'Error', 
                description: error.message || (language === 'de' ? 'Beitritt fehlgeschlagen.' : 'Failed to join activity.'), 
                variant: 'destructive' 
            });
            throw error;
        }
    };
    
    const handleFriendAction = async (action: 'send' | 'cancel' | 'remove' | 'accept' | 'decline') => {
        if (!currentUser?.uid) return;
        if (isBlockedOrUnavailable) {
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Aktion nicht möglich' : 'Action not possible',
                description: language === 'de' ? 'Dieser Nutzer ist nicht verfügbar.' : 'This user is unavailable.',
            });
            return;
        }
        if (isFriendActionLoading) return;
        setIsFriendActionLoading(true);
        try {
            switch(action) {
                case 'send':
                    await sendFriendRequest(currentUser.uid, userId);
                    setFriendshipStatus('request_sent');
                    toast({ title: language === 'de' ? 'Anfrage gesendet!' : 'Friend request sent!' });
                    break;
                case 'cancel':
                    await cancelFriendRequest(currentUser.uid, userId);
                    setFriendshipStatus('not_friends');
                    toast({ title: language === 'de' ? 'Anfrage zurückgezogen.' : 'Friend request cancelled.' });
                    break;
                case 'remove':
                    await removeFriend(currentUser.uid, userId);
                    setFriendshipStatus('not_friends');
                    toast({ title: language === 'de' ? 'Freund entfernt.' : 'Friend removed.' });
                    break;
                case 'accept':
                    await acceptFriendRequest(currentUser.uid, userId);
                    setFriendshipStatus('friends');
                    toast({ title: language === 'de' ? 'Anfrage bestätigt!' : 'Friend request accepted!' });
                    break;
                case 'decline':
                    await declineFriendRequest(currentUser.uid, userId);
                    setFriendshipStatus('not_friends');
                    toast({ title: language === 'de' ? 'Anfrage abgelehnt.' : 'Friend request declined.' });
                    break;
            }
        } catch (error) {
            console.error("Friend action failed", error);
            toast({ 
                variant: 'destructive', 
                title: language === 'de' ? 'Fehler' : 'Error', 
                description: language === 'de' ? 'Aktion konnte nicht ausgeführt werden.' : 'Could not complete the action.' 
            });
        } finally {
            setIsFriendActionLoading(false);
        }
    };
    
    const handleMessage = async () => {
        if (!currentUser?.uid) return;
        if (isBlockedOrUnavailable) {
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Aktion nicht möglich' : 'Action not possible',
                description: language === 'de' ? 'Dieser Nutzer ist nicht verfügbar.' : 'This user is unavailable.',
            });
            return;
        }
        if (isCreatingChat) return;
        setIsCreatingChat(true);
        try {
            const chatId = await getOrCreateDirectChat(currentUser.uid, userId);
            router.push(`/chat/${chatId}`);
        } catch (error) {
            console.error("Failed to create or get chat", error);
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Fehler' : 'Error',
                description: language === 'de' ? 'Chat konnte nicht gestartet werden.' : 'Could not start a chat.',
            });
        } finally {
            setIsCreatingChat(false);
        }
    }

    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (isBlockedOrUnavailable) {
        return (
            <div className="flex flex-1 min-h-0 w-full flex-col items-center justify-center p-6 text-center overflow-y-auto">
                <h1 className="text-xl font-bold mb-2">
                    {language === 'de' ? 'Profil nicht verfügbar' : 'Profile Not Available'}
                </h1>
                <p className="text-slate-500 mb-6">
                    {language === 'de' ? 'Dieses Profil kann nicht angezeigt werden.' : 'This profile cannot be viewed.'}
                </p>
                <Button onClick={() => router.push('/')} aria-label={language === 'de' ? 'Zurück zum Feed' : 'Back to Feed'} className="rounded-2xl h-12 px-8 font-black">
                    {language === 'de' ? 'Zurück zum Feed' : 'Back to Feed'}
                </Button>
            </div>
        );
    }

    if (!userData) {
         return (
            <div className="flex flex-1 min-h-0 w-full flex-col items-center justify-center p-6 text-center overflow-y-auto">
                <h1 className="text-xl font-bold mb-2">
                    {language === 'de' ? 'Nutzer nicht gefunden' : 'User Not Found'}
                </h1>
                <p className="text-slate-500 mb-6">
                    {language === 'de' ? 'Dieses Benutzerprofil existiert nicht.' : 'This user profile does not exist.'}
                </p>
                <Button onClick={() => router.push('/')} aria-label={language === 'de' ? 'Zurück zum Feed' : 'Back to Feed'} className="rounded-2xl h-12 px-8 font-black">
                    {language === 'de' ? 'Zurück zum Feed' : 'Back to Feed'}
                </Button>
            </div>
        );
    }

    const renderFriendButton = () => {
        if (!currentUser || friendshipStatus === 'is_self' || friendshipStatus === 'loading') {
            return null;
        }

        switch (friendshipStatus) {
            case 'friends':
                return (
                    <div className="w-full flex flex-row items-center gap-2.5">
                        <Button onClick={handleMessage} disabled={isCreatingChat} aria-label={language === 'de' ? 'Nachricht senden' : 'Send message'} className="flex-1 h-11 rounded-full font-black text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm">
                            {isCreatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                            {language === 'de' ? 'Nachricht' : 'Message'}
                        </Button>
                        <Button onClick={() => handleFriendAction('remove')} disabled={isFriendActionLoading} aria-label={language === 'de' ? 'Freund entfernen' : 'Remove friend'} variant="outline" className="flex-1 sm:flex-none h-11 rounded-full px-5 font-black text-xs uppercase tracking-wider border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800">
                            {isFriendActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />}
                            {language === 'de' ? 'Entfernen' : 'Remove'}
                        </Button>
                    </div>
                );
            case 'request_sent':
                return (
                    <Button onClick={() => handleFriendAction('cancel')} disabled={isFriendActionLoading} aria-label={language === 'de' ? 'Freundschaftsanfrage zurückziehen' : 'Cancel friend request'} variant="secondary" className="w-full h-11 rounded-full font-black text-xs uppercase tracking-wider bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300">
                        {isFriendActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                        {language === 'de' ? 'Anfrage gesendet' : 'Request Sent'}
                    </Button>
                );
            case 'request_received':
                return (
                    <div className="w-full flex gap-2.5">
                         <Button onClick={() => handleFriendAction('accept')} disabled={isFriendActionLoading} aria-label={language === 'de' ? 'Freundschaftsanfrage annehmen' : 'Accept friend request'} className="flex-1 h-11 rounded-full font-black text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm">
                            {isFriendActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                            {language === 'de' ? 'Annehmen' : 'Accept'}
                        </Button>
                        <Button onClick={() => handleFriendAction('decline')} disabled={isFriendActionLoading} aria-label={language === 'de' ? 'Freundschaftsanfrage ablehnen' : 'Decline friend request'} variant="outline" className="flex-1 h-11 rounded-full font-black text-xs uppercase tracking-wider border-slate-200 dark:border-neutral-800">
                             <X className="mr-2 h-4 w-4" />
                            {language === 'de' ? 'Ablehnen' : 'Decline'}
                        </Button>
                    </div>
                );
            case 'not_friends':
                return (
                    <Button onClick={() => handleFriendAction('send')} disabled={isFriendActionLoading} aria-label={language === 'de' ? 'Freund hinzufügen' : 'Add friend'} className="w-full h-11 rounded-full font-black text-xs uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm">
                        {isFriendActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        {language === 'de' ? 'Freund hinzufügen' : 'Add Friend'}
                    </Button>
                );
            default:
                return null;
        }
    };

    const photoUrlToDisplay = userData.photoURL || '';
    const usernameRaw = userData.username || null;
    const displayName = usernameRaw ? `@${usernameRaw.trim().replace(/^@/, '')}` : (language === 'de' ? 'Activa-Nutzer' : 'Activa user');
    
    const isHostBlocked = (hostId: string) => {
        return userProfile?.blacklist?.hard?.includes(hostId) || userProfile?.blacklist?.soft?.includes(hostId);
    };

    // Keep activities filtered: exclude blacklisted, cancelled, hidden, or hosted by a blocked user
    const visibleActivities = activities.filter(act => 
        act.status !== 'blacklisted' &&
        act.status !== 'cancelled' &&
        !userProfile?.hiddenEntityIds?.includes(act.id!) &&
        !isHostBlocked(act.hostId)
    );
    
    // --- ARCHITEKTUR UPDATE: AKTIVITÄTEN ARCHIV ---
    const pastActivities = visibleActivities.filter(a => a.status === 'completed');
    const currentActivities = visibleActivities.filter(a => a.status !== 'completed');

    return (
        <div className="relative flex flex-col h-full w-full bg-[#F8FAFC] dark:bg-neutral-950 overflow-y-auto pb-bottom-nav-safe">
            {/* Background Gradient */}
            <div className="absolute top-0 left-0 right-0 h-[35vh] bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-950/10 z-0" />

            <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur-md">
                <div className="flex items-center gap-3 min-w-0">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => router.back()} aria-label={language === 'de' ? 'Zurück' : 'Back'}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-lg font-black truncate">{language === 'de' ? `Profil von ${displayName}` : `${displayName}'s Profile`}</h1>
                </div>

                <EntityMoreOptions
                    entityId={userId}
                    entityType="user"
                    entityName={displayName}
                />
            </header>

            {/* Main Content Container */}
            <div className="relative w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 z-10 pt-4 sm:pt-6 flex flex-col gap-6">
                
                {/* Profile Hero Card */}
                <div className="bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-850 rounded-[2.5rem] p-6 sm:p-8 shadow-sm space-y-6">
                    
                    <div className="flex flex-row items-start gap-4 sm:gap-6 w-full">
                        
                        {/* Avatar, Name & Badges Column */}
                        <div className="flex flex-col items-center text-center shrink-0 w-28 sm:w-44">
                            <ProfileAvatar 
                                className="h-20 w-20 sm:h-32 sm:w-32 mb-2 sm:mb-3 shadow-md"
                                photoURL={photoUrlToDisplay}
                                displayName={displayName}
                                isPremium={userData.isPremium}
                                isCreator={userData.isCreator}
                                isSupporter={userData.isSupporter}
                            />
                            <div className="flex flex-col items-center gap-0.5 sm:gap-1 w-full">
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                    <h2 className="text-base sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                        {displayName}
                                        {userData.age && <span className="text-slate-400 font-bold text-sm sm:text-lg">, {userData.age}</span>}
                                    </h2>
                                    <UserBadge isPremium={userData.isPremium} isSupporter={userData.isSupporter} isCreator={userData.isCreator} />
                                </div>
                                {userData.location && (
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 dark:text-neutral-500">{userData.location}</p>
                                )}
                            </div>

                            {/* Rating */}
                            {userData.ratingCount && userData.ratingCount > 0 ? (
                                <div className="flex items-center justify-center gap-1 mt-2 sm:mt-3 bg-amber-50 dark:bg-amber-950/30 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-amber-100 dark:border-amber-900/50">
                                    <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500 fill-amber-500" />
                                    <span className="font-black text-amber-700 dark:text-amber-400 text-xs sm:text-sm">{userData.averageRating?.toFixed(1)}</span>
                                    <span className="text-[9px] sm:text-[10px] font-bold text-amber-600/70 dark:text-amber-500/70 uppercase">({userData.ratingCount})</span>
                                </div>
                            ) : null}
                        </div>

                        {/* Bio & Interests Column */}
                        <div className="flex-1 min-w-0 w-full space-y-3 pt-0.5">
                            {userData.bio && (
                                <div className="bg-slate-50/70 dark:bg-neutral-950/60 border border-slate-100 dark:border-neutral-800 p-3 sm:p-5 rounded-2xl sm:rounded-3xl space-y-1">
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block">
                                        {language === 'de' ? 'Bio' : 'Bio'}
                                    </span>
                                    <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line break-words">
                                        {userData.bio}
                                    </p>
                                </div>
                            )}

                            {/* Interests */}
                            {userData.interests && userData.interests.length > 0 && (
                                <div className="space-y-1.5">
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500 block">
                                        {language === 'de' ? 'Interessen' : 'Interests'}
                                    </span>
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {userData.interests.map((tag: string) => (
                                            <Badge key={tag} variant="secondary" className="text-[10px] sm:text-xs py-0.5 sm:py-1 px-2.5 sm:px-3 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-bold border-none">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="pt-4 border-t border-slate-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center gap-3 w-full">
                        {renderFriendButton()}
                        {currentUser && friendshipStatus !== 'is_self' && (
                            <EntityMoreOptions
                                entityId={userId}
                                entityType="user"
                                entityName={displayName}
                                variant="button"
                            />
                        )}
                    </div>
                </div>

                {/* Activities Tabs & Grid */}
                <div className="w-full pb-12">
                    <Tabs defaultValue="active" className="w-full space-y-4">
                        <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-slate-200/60 dark:bg-neutral-900 p-1.5 h-12">
                            <TabsTrigger 
                                value="active" 
                                className="rounded-xl font-black text-xs uppercase tracking-wider data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                            >
                                {language === 'de' ? 'Aktiv' : 'Active'} ({currentActivities.length})
                            </TabsTrigger>
                            <TabsTrigger 
                                value="past" 
                                className="rounded-xl font-black text-xs uppercase tracking-wider data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 data-[state=active]:text-primary data-[state=active]:shadow-sm"
                            >
                                {language === 'de' ? 'Vergangen' : 'Past'} ({pastActivities.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="active" className="mt-0 pt-2">
                            {loading ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <ActivityListItemSkeleton />
                                    <ActivityListItemSkeleton />
                                </div>
                            ) : currentActivities.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {currentActivities.map(activity => (
                                        <ProfileActivityCard
                                            key={activity.id}
                                            activity={activity}
                                            user={currentUser}
                                            onJoin={handleJoin}
                                            compact
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 px-4 bg-white dark:bg-neutral-900 rounded-3xl border border-slate-100 dark:border-neutral-800">
                                    <p className="text-xs font-bold text-slate-400 dark:text-neutral-500">
                                        {language === 'de' ? 'Keine aktiven Aktivitäten gefunden.' : 'No active activities found.'}
                                    </p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="past" className="mt-0 pt-2">
                            {pastActivities.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-75">
                                    {pastActivities.map(activity => (
                                        <ProfileActivityCard
                                            key={activity.id}
                                            activity={activity}
                                            user={currentUser}
                                            onJoin={handleJoin}
                                            compact
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 px-4 bg-white dark:bg-neutral-900 rounded-3xl border border-slate-100 dark:border-neutral-800">
                                    <p className="text-xs font-bold text-slate-400 dark:text-neutral-500">
                                        {language === 'de' ? 'Keine vergangenen Aktivitäten gefunden.' : 'No past activities found.'}
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

const ActivityListItemSkeleton = () => (
    <div className="p-4 border-b">
        <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>
    </div>
);
