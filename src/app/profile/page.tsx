'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/lib/firebase/auth';
import { fetchUserActivities, joinActivity } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityListItem } from '@/components/aktvia/activity-list-item';
import { LogOut, UserPlus, Compass } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ProfilePage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [activeTab, setActiveTab] = useState('activities');

    useEffect(() => {
        if (user) {
            const loadActivities = async () => {
                setLoadingActivities(true);
                try {
                    const userActivities = await fetchUserActivities(user.uid);
                    setActivities(userActivities as Activity[]);
                } catch (error) {
                    console.error("Failed to fetch user activities:", error);
                    toast({
                        title: "Error",
                        description: "Could not load your activities.",
                        variant: "destructive",
                    });
                } finally {
                    setLoadingActivities(false);
                }
            };
            loadActivities();
        } else if (!authLoading) {
            router.push('/login');
        }
    }, [user, authLoading, router, toast]);

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push('/');
            toast({
                title: 'Logged Out',
                description: 'You have been successfully signed out.',
            });
        } catch (error) {
            console.error("Logout failed", error);
            toast({
                title: "Logout Failed",
                description: "There was a problem signing you out.",
                variant: "destructive",
            });
        }
    };
    
    const handleJoin = async (activityId: string) => {
        if (!user) {
            toast({ title: 'Login Required', description: 'You must be logged in to join an activity.' });
            router.push('/login');
            throw new Error('Login Required');
        }
        try {
            await joinActivity(activityId, user);
            toast({ title: 'Success!', description: 'You have joined the activity. You can find it in your chats.' });
            setActivities(prev => prev.map(act => act.id === activityId ? {...act, participantIds: [...act.participantIds, user.uid]} : act));
            router.push(`/chat/${activityId}`);
        } catch (error: any) {
            console.error(error);
            toast({ title: 'Error', description: error.message || 'Failed to join activity.', variant: 'destructive' });
            throw error;
        }
    };


    if (authLoading || (!user && !authLoading)) {
        return (
            <div className="p-6 space-y-8">
                <div className="flex items-center justify-center">
                    <Skeleton className="h-24 w-24 rounded-full" />
                </div>
                 <div className="space-y-2 text-center">
                    <Skeleton className="h-6 w-48 mx-auto" />
                    <Skeleton className="h-4 w-32 mx-auto" />
                </div>
                <Skeleton className="h-10 w-full" />
                 <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-8 w-24 rounded-full" />
                        <Skeleton className="h-8 w-32 rounded-full" />
                        <Skeleton className="h-8 w-28 rounded-full" />
                    </div>
                </div>
                 <Skeleton className="h-12 w-full mt-6" />
            </div>
        );
    }

    if (!user) {
        return (
             <div className="flex h-full flex-col items-center justify-center gap-6 text-center p-6">
                 <div className="bg-primary/10 p-4 rounded-full">
                    <UserPlus className="h-10 w-10 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">Join the community</h1>
                    <p className="text-muted-foreground mt-1">Sign in to view your profile.</p>
                </div>

                <div className="flex gap-4 w-full max-w-xs">
                    <Button asChild className="flex-1 h-12 text-base">
                        <Link href="/login">Login</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1 h-12 text-base">
                        <Link href="/signup">Sign Up</Link>
                    </Button>
                </div>
            </div>
        )
    }

    const TabButton = ({ tabName, label }: { tabName: string, label: string }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`transition-colors duration-200 text-sm pb-2 ${
                activeTab === tabName
                ? 'border-b-2 border-primary text-primary font-bold'
                : 'text-muted-foreground border-b-2 border-transparent'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="relative flex flex-col h-full bg-background overflow-y-auto pb-20">
            <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="absolute top-4 right-4 text-muted-foreground z-10"
            >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Sign Out</span>
            </Button>
            
            <div className="p-6 flex flex-col items-center justify-center text-center space-y-4 pt-16">
                <Avatar className="h-24 w-24 border-2 border-primary/20">
                    <AvatarImage src={userProfile?.photoURL || user.photoURL || ''} />
                    <AvatarFallback className="text-3xl bg-muted">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-2xl font-bold">{userProfile?.displayName || 'Anonymous User'}</h1>
                    <p className="text-muted-foreground">{userProfile?.email}</p>
                    {userProfile?.location && <p className="text-sm text-muted-foreground">{userProfile.location}</p>}
                </div>
            </div>
            
            {userProfile?.bio && (
                <div className="px-6 text-center">
                    <p className="text-foreground/80">{userProfile.bio}</p>
                </div>
            )}


            <div className="px-6 mt-6">
                <Button variant="outline" className="w-full" onClick={() => router.push('/profile/edit')}>Edit Profile</Button>
            </div>
            
            <div className="p-6 space-y-4">
                 <h2 className="font-bold text-lg">Interests</h2>
                <div className="flex flex-wrap gap-2 items-center">
                    {userProfile?.interests?.map(tag => (
                         <Badge key={tag} variant="secondary" className="text-base py-1 px-3">
                            {tag}
                        </Badge>
                    ))}
                    <button onClick={() => router.push('/profile/interests')} className="border border-dashed border-gray-400 text-gray-500 rounded-full px-4 py-1 text-sm hover:bg-muted/50 transition-colors">
                        + Hinzufügen
                    </button>
                </div>
            </div>
            
            <div className="w-full border-b mt-2">
                <nav className="flex justify-around items-center font-medium px-6">
                    <TabButton tabName="activities" label="Aktivitäten" />
                    <TabButton tabName="favorites" label="Favoriten" />
                    <TabButton tabName="reviews" label="Reviews" />
                </nav>
            </div>

            <div className="flex-1">
                {activeTab === 'activities' && (
                    <div className="pt-4">
                        {loadingActivities ? (
                             <div className="divide-y divide-border">
                                <ActivityListItemSkeleton />
                                <ActivityListItemSkeleton />
                                <ActivityListItemSkeleton />
                            </div>
                        ) : activities.length > 0 ? (
                            <ul className="divide-y divide-border">
                                {activities.map(activity => (
                                    <li key={activity.id}>
                                        <ActivityListItem
                                            activity={activity}
                                            user={user}
                                            onJoin={handleJoin}
                                        />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center p-10 flex flex-col items-center justify-center gap-4">
                                <p className="text-muted-foreground">Noch keine Aktivitäten erstellt.</p>
                                <Button onClick={() => router.push('/explore')}>
                                    <Compass className="mr-2 h-4 w-4" />
                                    Aktivitäten entdecken
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                 {activeTab === 'favorites' && (
                     <div className="text-center text-muted-foreground p-10">
                        <p>Favorites are not yet implemented.</p>
                    </div>
                 )}
                 {activeTab === 'reviews' && (
                     <div className="text-center text-muted-foreground p-10">
                        <p>Reviews are not yet implemented.</p>
                    </div>
                 )}
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
