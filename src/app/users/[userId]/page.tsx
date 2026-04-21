'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';

import {
  fetchUserActivities,
  joinActivity,
  getUserProfile,
  sendFriendRequest,
  cancelFriendRequest,
  removeFriend,
  acceptFriendRequest,
  declineFriendRequest,
  getOrCreateDirectChat,
} from '@/lib/firebase/firestore';
import type { Activity, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityListItem } from '@/components/aktvia/activity-list-item';
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
import { cn } from '@/lib/utils';


export default function UserProfilePage() {
    const { user: currentUser, userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const language = useLanguage();
    const { toast } = useToast();


    const userId = params.userId as string;

    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFriendActionLoading, setIsFriendActionLoading] = useState(false);
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const [friendshipStatus, setFriendshipStatus] = useState<'loading' | 'is_self' | 'friends' | 'request_sent' | 'request_received' | 'not_friends'>('loading');

    useEffect(() => {
        if (!userId) return;
        
        if (userProfile?.hiddenEntityIds?.includes(userId)) {
            router.back();
            toast({ 
                title: language === 'de' ? "Nutzer nicht sichtbar" : "User cannot be viewed", 
                description: language === 'de' ? "Dieser Nutzer ist verborgen." : "This user is hidden." 
            });

            return;
        }

        if (currentUser?.uid === userId) {
            setFriendshipStatus('is_self');
            router.replace('/profile');
            return;
        }

        if (userProfile && !authLoading) {
            if (userProfile.friends?.includes(userId)) {
                setFriendshipStatus('friends');
            } else if (userProfile.friendRequestsSent?.includes(userId)) {
                setFriendshipStatus('request_sent');
            } else if (userProfile.friendRequestsReceived?.includes(userId)) {
                setFriendshipStatus('request_received');
            } else {
                setFriendshipStatus('not_friends');
            }
        } else if (!authLoading) {
            setFriendshipStatus('not_friends');
        }


        const loadData = async () => {
            setLoading(true);
            try {
                const [profile, userActivities] = await Promise.all([
                    getUserProfile(userId),
                    fetchUserActivities(userId)
                ]);

                if (profile) {
                    setUserData(profile);
                    setActivities(userActivities as Activity[]);
                } else {
                    toast({ 
                        title: language === 'de' ? "Nutzer nicht gefunden" : "User not found", 
                        description: language === 'de' ? "Dieses Profil konnte nicht geladen werden." : "This user profile could not be loaded.", 
                        variant: "destructive" 
                    });

                    router.back();
                }
            } catch (error) {
                console.error("Failed to fetch user data:", error);
                toast({
                    title: language === 'de' ? "Fehler" : "Error",
                    description: language === 'de' ? "Profil konnte nicht geladen werden." : "Could not load this user's profile.",
                    variant: "destructive",
                });

            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [userId, currentUser, router, toast, userProfile, authLoading]);

    const handleJoin = async (activityId: string) => {
        if (!currentUser) {
            toast({ 
                title: language === 'de' ? 'Login erforderlich' : 'Login Required', 
                description: language === 'de' ? 'Bitte logge dich ein, um beizutreten.' : 'You must be logged in to join an activity.' 
            });

            router.push('/login');
            throw new Error('Login Required');
        }
        try {
            await joinActivity(activityId, currentUser);
            toast({ 
                title: language === 'de' ? 'Erfolgreich!' : 'Success!', 
                description: language === 'de' ? 'Du bist beigetreten. Du findest die Aktivität in deinen Chats.' : 'You have joined the activity. You can find it in your chats.' 
            });

            setActivities(prev => prev.map(act => act.id === activityId ? {...act, participantIds: [...act.participantIds, currentUser.uid]} : act));
            router.push(`/chat/${activityId}`);
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
    
    if (!userData) {
         return (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                User not found.
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
                    <div className="w-full flex gap-4">
                        <Button onClick={handleMessage} disabled={isCreatingChat} className="flex-1">
                            {isCreatingChat ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                            {language === 'de' ? 'Nachricht' : 'Message'}

                        </Button>
                        <Button onClick={() => handleFriendAction('remove')} disabled={isFriendActionLoading} variant="outline" className="flex-1">
                            {isFriendActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserMinus className="mr-2 h-4 w-4" />}
                            {language === 'de' ? 'Entfernen' : 'Remove'}

                        </Button>
                    </div>
                );
            case 'request_sent':
                return (
                    <Button onClick={() => handleFriendAction('cancel')} disabled={isFriendActionLoading} variant="secondary">
                        {isFriendActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                        {language === 'de' ? 'Anfrage gesendet' : 'Request Sent'}

                    </Button>
                );
            case 'request_received':
                return (
                    <div className="flex gap-2">
                         <Button onClick={() => handleFriendAction('accept')} disabled={isFriendActionLoading} className="flex-1">
                            {isFriendActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                            {language === 'de' ? 'Annehmen' : 'Accept'}

                        </Button>
                        <Button onClick={() => handleFriendAction('decline')} disabled={isFriendActionLoading} variant="outline" className="flex-1">
                             <X className="mr-2 h-4 w-4" />
                            {language === 'de' ? 'Ablehnen' : 'Decline'}

                        </Button>
                    </div>
                );
            case 'not_friends':
                return (
                    <Button onClick={() => handleFriendAction('send')} disabled={isFriendActionLoading}>
                        {isFriendActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        {language === 'de' ? 'Freund hinzufügen' : 'Add Friend'}

                    </Button>
                );
            default:
                return null;
        }
    };


    const photoUrlToDisplay = userData.photoURL || '';
    const displayName = userData.displayName || (language === 'de' ? 'Anonymer Nutzer' : 'Anonymous User');

    
    const visibleActivities = activities.filter(act => !userProfile?.hiddenEntityIds?.includes(act.id!));
    
    // --- ARCHITEKTUR UPDATE: AKTIVITÄTEN ARCHIV ---
    const pastActivities = visibleActivities.filter(a => a.status === 'completed');
    const currentActivities = visibleActivities.filter(a => a.status !== 'completed' && a.status !== 'cancelled');

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto pb-20">
            <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h1 className="font-bold truncate">{language === 'de' ? `Profil von ${displayName}` : `${displayName}'s Profile`}</h1>

                <EntityMoreOptions
                    entityId={userId}
                    entityType="user"
                    entityName={displayName}
                />
            </header>

            <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className={cn(
                  "p-1 rounded-full shadow-lg transition-all",
                  userData.isPremium ? "bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-600" : (userData.isSupporter ? "bg-pink-400" : "bg-transparent")
                )}>
                    <Avatar className="h-24 w-24 border-4 border-white">
                        <AvatarImage src={photoUrlToDisplay} alt="Profil" />
                        <AvatarFallback className="text-3xl bg-muted">
                            {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </div>

                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center gap-2">
                        <h1 className="text-2xl font-bold">
                            {displayName}
                        </h1>
                        {userData.age && <span className="text-muted-foreground text-2xl font-bold">, {userData.age}</span>}
                        <UserBadge isPremium={userData.isPremium} isSupporter={userData.isSupporter} />
                    </div>

                    {/* MODUL 11: REPUTATION DISPLAY */}
                    {userData.ratingCount && userData.ratingCount > 0 ? (
                      <div className="flex items-center justify-center gap-1.5 mt-1 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        <span className="font-black text-amber-700 text-sm">{userData.averageRating?.toFixed(1)}</span>
                        <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-tighter">({userData.ratingCount} {language === 'de' ? 'Bewertungen' : 'Reviews'})</span>

                      </div>
                    ) : null}
                    
                    {userData.location && <p className="text-sm text-muted-foreground mt-1">{userData.location}</p>}
                </div>

                <div className="w-full max-w-sm">
                    {renderFriendButton()}
                </div>
            </div>
            
            {userData.bio && (
                <div className="px-6 text-center">
                    <p className="text-foreground/80">{userData.bio}</p>
                </div>
            )}
            
            {(userData.interests && userData.interests.length > 0) &&
              <div className="p-6 space-y-4">
                 <h2 className="font-bold text-lg">{language === 'de' ? 'Interessen' : 'Interests'}</h2>

                <div className="flex flex-wrap gap-2 items-center">
                    {userData.interests.map(tag => (
                         <Badge key={tag} variant="secondary" className="text-base py-1 px-3">
                            {tag}
                        </Badge>
                    ))}
                </div>
            </div>
            }
            
            <div className="w-full mt-2">
                <Tabs defaultValue="active" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-none border-b bg-transparent h-12">
                        <TabsTrigger 
                            value="active" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-sm"
                        >
                            {language === 'de' ? 'Aktiv' : 'Active'} ({currentActivities.length})

                        </TabsTrigger>
                        <TabsTrigger 
                            value="past" 
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-sm"
                        >
                            {language === 'de' ? 'Vergangen' : 'Past'} ({pastActivities.length})

                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1">
                        <TabsContent value="active" className="mt-0">
                            <div className="pt-4">
                                {loading ? (
                                     <div className="divide-y divide-border">
                                        <ActivityListItemSkeleton />
                                        <ActivityListItemSkeleton />
                                    </div>
                                ) : currentActivities.length > 0 ? (
                                    <ul className="divide-y divide-border">
                                        {currentActivities.map(activity => (
                                            <li key={activity.id}>
                                                <ActivityListItem
                                                    activity={activity}
                                                    user={currentUser}
                                                    onJoin={handleJoin}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center p-10 flex flex-col items-center justify-center gap-4">
                                        <p className="text-muted-foreground">{language === 'de' ? 'Keine aktiven Aktivitäten gefunden.' : 'No active activities found.'}</p>

                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="past" className="mt-0">
                            <div className="pt-4">
                                {pastActivities.length > 0 ? (
                                    <ul className="divide-y divide-border">
                                        {pastActivities.map(activity => (
                                            <li key={activity.id} className="opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all">
                                                <ActivityListItem
                                                    activity={activity}
                                                    user={currentUser}
                                                    onJoin={handleJoin}
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center p-10 flex flex-col items-center justify-center gap-4">
                                        <p className="text-muted-foreground">{language === 'de' ? 'Keine vergangenen Aktivitäten gefunden.' : 'No past activities found.'}</p>

                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
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
