'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/lib/firebase/auth';
import { fetchUserActivities, joinActivity, getUserProfile, acceptFriendRequest, declineFriendRequest, createActivity } from '@/lib/firebase/firestore';
import type { Activity, UserProfile, Place } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useFavorites } from '@/contexts/favorites-context';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityListItem } from '@/components/aktvia/activity-list-item';
import { LogOut, UserPlus, Compass, Edit, UserCheck, X, Loader2, Settings, Copy, Bookmark, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { uploadProfileImage } from '@/lib/firebase/storage';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PlaceCard } from '@/components/aktvia/place-card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import FriendList from '@/components/profile/FriendList';


function generateFriendCode(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


export default function ProfilePage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const { favorites } = useFavorites();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [userData, setUserData] = useState<UserProfile | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [activeTab, setActiveTab] = useState('activities');
    const [requestProfiles, setRequestProfiles] = useState<UserProfile[]>([]);
    const [loadingRequests, setLoadingRequests] = useState(true);
    
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
    const [activityModalPlace, setActivityModalPlace] = useState<Place | null>(null);

    useEffect(() => {
        if (user) {
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
    
    useEffect(() => {
        const createFriendCode = async () => {
            if (user && userData && !userData.friendCode && db) {
                const newCode = generateFriendCode();
                const userDocRef = doc(db, 'users', user.uid);
                try {
                    await updateDoc(userDocRef, { friendCode: newCode });
                    setUserData(prev => prev ? { ...prev, friendCode: newCode } : null);
                } catch (error) {
                    console.error("Failed to create friend code:", error);
                    toast({
                        variant: "destructive",
                        title: "Error",
                        description: "Could not generate a friend code for your account.",
                    });
                }
            }
        };
        createFriendCode();
    }, [user, userData, toast]);


    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.uid) return;

        if (file.size > 5242880) { // 5MB
            toast({ variant: 'destructive', title: 'File too large', description: 'Please select an image smaller than 5MB.' });
            return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please select a JPG, PNG, or WEBP image.' });
            return;
        }

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
    
    const handleCopyCode = () => {
        if (!userData?.friendCode) return;
        navigator.clipboard.writeText(userData.friendCode)
        .then(() => {
            toast({ title: "Friend Code Copied!" });
        })
        .catch(err => {
            toast({
                variant: 'destructive',
                title: 'Copy Failed',
                description: 'Could not copy the code to your clipboard.',
            });
        });
    };
    
    const handleOpenActivityModal = (place: Place) => {
        if (!user) {
            router.push('/login');
            toast({
                title: 'Login Required',
                description: 'Please log in to create an activity.',
            });
            return;
        }
        setActivityModalPlace(place);
    };

    const handleCreateActivity = async (startDate: Date, endDate: Date | undefined, isTimeFlexible: boolean, customLocationName?: string, maxParticipants?: number, isBoosted?: boolean): Promise<boolean> => {
        if (!user || !activityModalPlace) {
            toast({
                title: 'Error',
                description: 'You must be logged in to create an activity.',
                variant: 'destructive',
            });
            return false;
        }

        try {
            const newActivityRef = await createActivity({
                place: activityModalPlace,
                startDate,
                endDate,
                user,
                isTimeFlexible,
                maxParticipants,
                isBoosted,
            });
            toast({
                title: isBoosted ? 'Aktivität Geboostet!' : 'Activity Created!',
                description: isBoosted 
                  ? `Deine Aktivität bei ${activityModalPlace.name} steht ganz oben im Feed.`
                  : `Your activity at ${activityModalPlace.name} is set.`,
            });
            setActivityModalPlace(null);
            router.push(`/chat/${newActivityRef.id}`);
            return true;
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Failed to Create Activity',
                description: error.message,
            });
            return false;
        }
    };

    const handlePlaceSelect = (place: Place) => {
        setSelectedPlace(place);
    };


    if (authLoading || (!user && !authLoading)) {
        return (
            <div className="p-6 space-y-8 max-w-2xl mx-auto">
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

    const visibleRequestProfiles = requestProfiles.filter(p => !userProfile?.hiddenEntityIds?.includes(p.uid));
    const visibleActivities = activities.filter(act => !userProfile?.hiddenEntityIds?.includes(act.id!));

    return (
        <>
            <div className="relative flex flex-col h-full bg-background overflow-y-auto pb-20">
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                    <NotificationBell />
                    <Button asChild
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                    >
                        <Link href="/settings">
                            <Settings className="h-5 w-5" />
                            <span className="sr-only">Settings</span>
                        </Link>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleSignOut}
                        className="text-muted-foreground"
                    >
                        <LogOut className="h-5 w-5" />
                        <span className="sr-only">Sign Out</span>
                    </Button>
                </div>
                
                <div className="max-w-4xl mx-auto w-full">
                    <div className="p-6 flex flex-col items-center justify-center text-center space-y-4 pt-16">
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            className="hidden" 
                            accept="image/jpeg,image/png,image/webp" 
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

                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2">
                              <h1 className="text-2xl font-bold">
                                  {displayName}
                                  {userData?.age && `, ${userData.age}`}
                              </h1>
                              {/* Fundraising: Supporter Badge */}
                              {userData?.isDonator && (
                                <ShieldCheck className="h-6 w-6 text-primary fill-primary/10" strokeWidth={2.5} />
                              )}
                            </div>
                            <div 
                                onClick={userData?.friendCode ? handleCopyCode : undefined}
                                onKeyDown={(e) => userData?.friendCode && (e.key === 'Enter' || e.key === ' ') ? handleCopyCode() : undefined}
                                role={userData?.friendCode ? "button" : undefined}
                                tabIndex={userData?.friendCode ? 0 : -1}
                                className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
                            >
                                {userData?.friendCode ? (
                                    <>
                                        <span>{userData.friendCode}</span>
                                        <Copy className="h-4 w-4 text-muted-foreground" />
                                    </>
                                ) : (
                                    <span className='text-muted-foreground'>Generating...</span>
                                )}
                            </div>
                            {userData?.location && <p className="text-sm text-muted-foreground mt-1">{userData.location}</p>}
                        </div>
                    </div>
                    
                    {userData?.bio && (
                        <div className="px-6 text-center max-w-lg mx-auto">
                            <p className="text-foreground/80">{userData.bio}</p>
                        </div>
                    )}


                    <div className="px-6 mt-6 max-w-sm mx-auto">
                        <Button variant="outline" className="w-full" onClick={() => router.push('/profile/edit')}>Edit Profile</Button>
                    </div>
                    
                    {loadingRequests && userProfile?.friendRequestsReceived && userProfile.friendRequestsReceived.length > 0 &&(
                        <div className="p-6"><Skeleton className="h-10 w-full" /></div>
                    )}

                    {!loadingRequests && visibleRequestProfiles.length > 0 && (
                        <div className="p-6 space-y-4 border-b">
                            <h2 className="font-bold text-lg">Friend Requests</h2>
                            <ul className="space-y-3">
                                {visibleRequestProfiles.map(profile => (
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

                    <FriendList friendIds={userData?.friends || []} />
                    
                    <div className="w-full border-b mt-8">
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
                                ) : visibleActivities.length > 0 ? (
                                    <ul className="divide-y divide-border">
                                        {visibleActivities.map(activity => (
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
                            <div className="pt-4">
                                {favorites.length === 0 ? (
                                    <div className="text-center p-10 flex flex-col items-center justify-center gap-4">
                                         <div className="bg-primary/10 p-4 rounded-full">
                                            <Bookmark className="h-8 w-8 text-primary" />
                                        </div>
                                        <p className="text-muted-foreground">Noch keine Favoriten gespeichert.</p>
                                         <Button onClick={() => router.push('/')}>
                                            <Compass className="mr-2 h-4 w-4" />
                                            Orte entdecken
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {favorites.map(fav => (
                                            <PlaceCard
                                                key={fav.id}
                                                place={fav as Place}
                                                onClick={() => handlePlaceSelect(fav as Place)}
                                                onAddActivity={() => handleOpenActivityModal(fav as Place)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                         )}
                         {activeTab === 'reviews' && (
                             <div className="text-center text-muted-foreground p-10">
                                <p>Reviews are not yet implemented.</p>
                            </div>
                         )}
                    </div>
                </div>
            </div>

            <div className="fixed inset-0 pointer-events-none">
                <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && setSelectedPlace(null)}>
                    <DialogContent className="max-h-[95vh] flex flex-col p-0 w-full max-w-4xl gap-0 overflow-hidden pointer-events-auto">
                        {selectedPlace && <PlaceDetails place={selectedPlace} onClose={() => setSelectedPlace(null)} />}
                    </DialogContent>
                </Dialog>
            </div>

            <div className="fixed inset-0 pointer-events-none">
                <CreateActivityDialog
                    place={activityModalPlace}
                    open={!!activityModalPlace}
                    onOpenChange={(open) => !open && setActivityModalPlace(null)}
                    onCreateActivity={handleCreateActivity}
                />
            </div>
        </>
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
