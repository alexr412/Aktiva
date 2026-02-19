'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { fetchUserActivities, joinActivity, getUserProfile, addFriend, removeFriend } from '@/lib/firebase/firestore';
import type { Activity, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityListItem } from '@/components/aktvia/activity-list-item';
import { ArrowLeft, Compass, Loader2, UserPlus, UserMinus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


export default function UserProfilePage() {
    const { user: currentUser, userProfile } = useAuth();
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();

    const userId = params.userId as string;

    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFriend, setIsFriend] = useState(false);
    const [isFriendActionLoading, setIsFriendActionLoading] = useState(false);


    useEffect(() => {
        if (!userId) return;

        // If the user is trying to view their own profile via this page, redirect them
        if (currentUser?.uid === userId) {
            router.replace('/profile');
            return;
        }

        if (userProfile?.friends?.includes(userId)) {
            setIsFriend(true);
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
                    toast({ title: "User not found", description: "This user profile could not be loaded.", variant: "destructive" });
                    router.back();
                }
            } catch (error) {
                console.error("Failed to fetch user data:", error);
                toast({
                    title: "Error",
                    description: "Could not load this user's profile.",
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [userId, currentUser, router, toast, userProfile]);

    const handleJoin = async (activityId: string) => {
        if (!currentUser) {
            toast({ title: 'Login Required', description: 'You must be logged in to join an activity.' });
            router.push('/login');
            throw new Error('Login Required');
        }
        try {
            await joinActivity(activityId, currentUser);
            toast({ title: 'Success!', description: 'You have joined the activity. You can find it in your chats.' });
            setActivities(prev => prev.map(act => act.id === activityId ? {...act, participantIds: [...act.participantIds, currentUser.uid]} : act));
            router.push(`/chat/${activityId}`);
        } catch (error: any) {
            console.error(error);
            toast({ title: 'Error', description: error.message || 'Failed to join activity.', variant: 'destructive' });
            throw error;
        }
    };
    
    const handleFriendAction = async () => {
        if (!currentUser || !userId) return;

        setIsFriendActionLoading(true);
        try {
            if (isFriend) {
                await removeFriend(currentUser.uid, userId);
                toast({ title: "Friend removed" });
                setIsFriend(false);
            } else {
                await addFriend(currentUser.uid, userId);
                toast({ title: "Friend added!" });
                setIsFriend(true);
            }
        } catch (error: any) {
            console.error(error);
            toast({ title: 'Error', description: 'Could not perform action.', variant: 'destructive' });
        } finally {
            setIsFriendActionLoading(false);
        }
    };


    if (loading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }
    
    if (!userData) {
        // This case is mostly handled by the redirect, but it's a good fallback.
         return (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                User not found.
            </div>
        );
    }


    const photoUrlToDisplay = userData.photoURL || '';
    const displayName = userData.displayName || 'Anonymous User';

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto pb-20">
            <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h1 className="font-bold truncate">{displayName}'s Profile</h1>
            </header>

            <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
                <Avatar className="h-24 w-24 border-2 border-primary/20">
                    <AvatarImage src={photoUrlToDisplay} alt="Profil" />
                    <AvatarFallback className="text-3xl bg-muted">
                        {displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                <div>
                    <h1 className="text-2xl font-bold">
                        {displayName}
                        {userData.age && `, ${userData.age}`}
                    </h1>
                    <p className="text-muted-foreground">{userData.email}</p>
                    {userData.location && <p className="text-sm text-muted-foreground">{userData.location}</p>}
                </div>

                {currentUser && currentUser.uid !== userId && (
                    <Button onClick={handleFriendAction} disabled={isFriendActionLoading} className="w-40">
                        {isFriendActionLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : isFriend ? (
                            <UserMinus className="mr-2 h-4 w-4" />
                        ) : (
                            <UserPlus className="mr-2 h-4 w-4" />
                        )}
                        {isFriendActionLoading ? 'Updating...' : isFriend ? 'Remove Friend' : 'Add Friend'}
                    </Button>
                )}
            </div>
            
            {userData.bio && (
                <div className="px-6 text-center">
                    <p className="text-foreground/80">{userData.bio}</p>
                </div>
            )}
            
            {(userData.interests && userData.interests.length > 0) &&
              <div className="p-6 space-y-4">
                 <h2 className="font-bold text-lg">Interests</h2>
                <div className="flex flex-wrap gap-2 items-center">
                    {userData.interests.map(tag => (
                         <Badge key={tag} variant="secondary" className="text-base py-1 px-3">
                            {tag}
                        </Badge>
                    ))}
                </div>
            </div>
            }
            
            <div className="w-full border-b mt-2">
                <nav className="flex justify-around items-center font-medium px-6">
                     <div className="transition-colors duration-200 text-sm pb-2 border-b-2 border-primary text-primary font-bold">
                        Activities
                    </div>
                </nav>
            </div>

            <div className="flex-1">
                <div className="pt-4">
                    {loading ? (
                         <div className="divide-y divide-border">
                            <ActivityListItemSkeleton />
                            <ActivityListItemSkeleton />
                        </div>
                    ) : activities.length > 0 ? (
                        <ul className="divide-y divide-border">
                            {activities.map(activity => (
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
                            <p className="text-muted-foreground">This user has no public activities.</p>
                        </div>
                    )}
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
