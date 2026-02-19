'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/lib/firebase/auth';
import { fetchUserActivities, joinActivity, getUserProfile, acceptFriendRequest, declineFriendRequest } from '@/lib/firebase/firestore';
import type { Activity, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityListItem } from '@/components/aktvia/activity-list-item';
import { LogOut, UserPlus, Compass, Edit, UserCheck, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { uploadProfileImage } from '@/lib/firebase/storage';


export default function ProfilePage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [activeTab, setActiveTab] = useState('activities');
    const [requestProfiles, setRequestProfiles] = useState<UserProfile[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);

    useEffect(() => {
        if (user) {
            // Use userProfile from context if available, otherwise fetch
            if (userProfile) {
                setUserData(userProfile);
            } else {
                 getDoc(doc(db, "users", user.uid)).then(snap => {
                    if (snap.exists()) {
                        setUserData(snap.data() as UserProfile);
                    }
                });
            }

            if (userProfile?.friendRequestsReceived && userProfile.friendRequestsReceived.length > 0) {
                const fetchRequestProfiles = async () => {
                    setLoadingRequests(true);
                    const profiles = await Promise.all(
                        userProfile.friendRequestsReceived!.map(uid => getUserProfile(uid))
                    );
                    setRequestProfiles(profiles.filter(p => p !== null) as UserProfile[]);
                    setLoadingRequests(false);
                };
                fetchRequestProfiles();
            } else {
                setLoadingRequests(false);
                setRequestProfiles([]);
            }
            
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
    }, [user, authLoading, router, toast, userProfile]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.uid) return;
        try {
          const photoURL = await uploadProfileImage(user.uid, file);
          setUserData((prev: UserProfile | null) => (prev ? { ...prev, photoURL } : { photoURL } as UserProfile));
          toast({ title: "Profile picture updated!" });
        } catch (error: any) {
          console.error(error);
          toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
        }
    };

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

    const handleAcceptRequest = async (requestingUserId: string) => {
        if (!user?.uid) return;
        try {
            await acceptFriendRequest(user.uid, requestingUserId);
            setRequestProfiles(prev => prev.filter(p => p.uid !== requestingUserId));
            toast({ title: "Friend added!" });
        } catch (error) {
            toast({ title: "Error", description: "Could not accept request.", variant: "destructive" });
        }
    };

    const handleDeclineRequest = async (requestingUserId: string) => {
        if (!user?.uid) return;
        try {
            await declineFriendRequest(user.uid, requestingUserId);
            setRequestProfiles(prev => prev.filter(p => p.uid !== requestingUserId));
            toast({ title: "Request declined" });
        } catch (error) {
            toast({ title: "Error", description: "Could not decline request.", variant: "destructive" });
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

    const photoUrlToDisplay = userData?.photoURL || user.photoURL || '';
    const displayName = userData?.displayName || user.displayName || 'Anonymous User';

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
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    accept="image/*" 
                />
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group cursor-pointer"
                >
                    <Avatar className="h-24 w-24 border-2 border-primary/20">
                        <AvatarImage src={photoUrlToDisplay} alt="Profil" />
                        <AvatarFallback className="text-3xl bg-muted">
                            {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                        <Edit className="h-6 w-6" />
                    </div>
                </div>

                <div>
                    <h1 className="text-2xl font-bold">
                        {displayName}
                        {userData?.age && `, ${userData.age}`}
                    </h1>
                    <p className="text-muted-foreground">{userData?.email || user.email}</p>
                    {userData?.location && <p className="text-sm text-muted-foreground">{userData.location}</p>}
                </div>
            </div>
            
            {userData?.bio && (
                <div className="px-6 text-center">
                    <p className="text-foreground/80">{userData.bio}</p>
                </div>
            )}


            <div className="px-6 mt-6">
                <Button variant="outline" className="w-full" onClick={() => router.push('/profile/edit')}>Edit Profile</Button>
            </div>
            
            {loadingRequests && userProfile?.friendRequestsReceived && userProfile.friendRequestsReceived.length > 0 &&(
                <div className="p-6"><Skeleton className="h-10 w-full" /></div>
            )}

            {!loadingRequests && requestProfiles.length > 0 && (
                <div className="p-6 space-y-4 border-b">
                    <h2 className="font-bold text-lg">Friend Requests</h2>
                    <ul className="space-y-3">
                        {requestProfiles.map(profile => (
                            <li key={profile.uid} className="flex items-center gap-3 p-2 -mx-2 rounded-lg bg-secondary">
                                <Avatar>
                                    <AvatarImage src={profile.photoURL || undefined} />
                                    <AvatarFallback>{profile.displayName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span className="flex-1 font-medium truncate">{profile.displayName}</span>
                                <Button size="icon" variant="outline" onClick={() => handleAcceptRequest(profile.uid)}><UserCheck className="h-4 w-4 text-green-500"/></Button>
                                <Button size="icon" variant="outline" onClick={() => handleDeclineRequest(profile.uid)}><X className="h-4 w-4 text-red-500"/></Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            <div className="p-6 space-y-4">
                 <h2 className="font-bold text-lg">Interests</h2>
                <div className="flex flex-wrap gap-2 items-center">
                    {userData?.interests?.map(tag => (
                         <Badge key={tag} variant="secondary" className="text-base py-1 px-3">
                            {tag}
                        </Badge>
                    ))}
                    <button onClick={() => router.push('/profile/edit')} className="border border-dashed border-gray-400 text-gray-500 rounded-full px-4 py-1 text-sm hover:bg-muted/50 transition-colors">
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
