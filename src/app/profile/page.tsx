'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/lib/firebase/auth';
import { fetchUserActivities, joinActivity, getUserProfile, acceptFriendRequest, declineFriendRequest, createActivity } from '@/lib/firebase/firestore';
import type { Activity, UserProfile, Place, Review } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useFavorites } from '@/contexts/favorites-context';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/image-utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityListItem } from '@/components/aktvia/activity-list-item';
import { LogOut, UserPlus, Compass, Edit, UserCheck, X, Loader2, Settings, Copy, Bookmark, ShieldCheck, Check, Coins, Unlock, Wallet, Star, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { uploadProfileImage } from '@/lib/firebase/storage';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PlaceCard } from '@/components/aktvia/place-card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FriendList from '@/components/profile/FriendList';
import { cn } from '@/lib/utils';
import { UserBadge } from '@/components/common/UserBadge';
import { format } from 'date-fns';

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

    // Reviews State
    const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
    const [recentReviews, setRecentReviews] = useState<Review[]>([]);
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);

    // Cropper State
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (user) {
            if (userProfile) {
                setUserData(userProfile);
            } else {
                 getDoc(doc(db!, "users", user.uid)).then(snap => {
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
                }
            }
        };
        createFriendCode();
    }, [user, userData]);

    const loadReviews = async () => {
        if (!user || !db) return;
        setIsLoadingReviews(true);
        setIsReviewsModalOpen(true);
        try {
            const q = query(
                collection(db, 'reviews'),
                where('targetId', '==', user.uid),
                where('targetType', '==', 'user'),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            const snap = await getDocs(q);
            const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() } as Review));
            setRecentReviews(reviews);
        } catch (error) {
            console.error("Failed to load reviews:", error);
        } finally {
            setIsLoadingReviews(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5242880) {
            toast({ variant: 'destructive', title: 'Datei zu groß', description: 'Bitte wähle ein Bild unter 5MB.' });
            return;
        }

        const reader = new FileReader();
        reader.addEventListener('load', () => {
            setImageToCrop(reader.result as string);
            setIsCropModalOpen(true);
        });
        reader.readAsDataURL(file);
    };

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleSaveCroppedImage = async () => {
        if (!imageToCrop || !croppedAreaPixels || !user?.uid) return;

        setIsUploading(true);
        try {
            const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
            const croppedFile = new File([croppedImageBlob], 'profile.jpg', { type: 'image/jpeg' });
            
            const photoURL = await uploadProfileImage(user.uid, croppedFile);
            setUserData((prev: UserProfile | null) => (prev ? { ...prev, photoURL } : { photoURL } as UserProfile));
            
            setIsCropModalOpen(false);
            setImageToCrop(null);
            toast({ title: "Profilbild aktualisiert!" });
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Upload fehlgeschlagen', description: error.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push('/');
            toast({ title: 'Erfolgreich abgemeldet.' });
        } catch (error) {
            console.error("Logout failed", error);
        }
    };
    
    const handleJoin = async (activityId: string) => {
        if (!user) {
            router.push('/login');
            throw new Error('Login Required');
        }
        try {
            await joinActivity(activityId, user);
            setActivities(prev => prev.map(act => act.id === activityId ? {...act, participantIds: [...act.participantIds, user.uid]} : act));
            router.push(`/chat/${activityId}`);
        } catch (error: any) {
            toast({ title: 'Fehler beim Beitritt.', variant: 'destructive' });
            throw error;
        }
    };

    const handleAcceptRequest = async (requestingUserId: string) => {
        if (!user?.uid) return;
        try {
            await acceptFriendRequest(user.uid, requestingUserId);
            setRequestProfiles(prev => prev.filter(p => p.uid !== requestingUserId));
            toast({ title: "Freund hinzugefügt!" });
        } catch (error) {
            toast({ title: "Fehler beim Bestätigen.", variant: "destructive" });
        }
    };

    const handleDeclineRequest = async (requestingUserId: string) => {
        if (!user?.uid) return;
        try {
            await declineFriendRequest(user.uid, requestingUserId);
            setRequestProfiles(prev => prev.filter(p => p.uid !== requestingUserId));
            toast({ title: "Anfrage abgelehnt." });
        } catch (error) {
            toast({ title: "Fehler beim Ablehnen.", variant: "destructive" });
        }
    };
    
    const handleCopyCode = () => {
        if (!userData?.friendCode) return;
        navigator.clipboard.writeText(userData.friendCode)
        .then(() => { toast({ title: "Code kopiert!" }); });
    };
    
    const handleOpenActivityModal = (place: Place) => {
        if (!user) {
            router.push('/login');
            return;
        }
        setActivityModalPlace(place);
    };

    const handleCreateActivity = async (startDate: Date, endDate: Date | undefined, isTimeFlexible: boolean, customLocationName?: string, maxParticipants?: number, isBoosted?: boolean): Promise<boolean> => {
        if (!user || !activityModalPlace) return false;

        try {
            const newActivityRef = await createActivity({
                place: activityModalPlace,
                startDate,
                endDate,
                user,
                isTimeFlexible,
                maxParticipants,
                isBoosted,
                category: 'Sonstiges'
            });
            toast({ title: 'Aktivität erstellt!' });
            setActivityModalPlace(null);
            router.push(`/chat/${newActivityRef.id}`);
            return true;
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Fehler beim Erstellen', description: error.message });
            return false;
        }
    };

    const handlePlaceSelect = (place: Place) => { setSelectedPlace(place); };

    if (authLoading || (!user && !authLoading)) {
        return (
            <div className="p-6 space-y-8 max-w-2xl mx-auto">
                <div className="flex items-center justify-center"><Skeleton className="h-24 w-24 rounded-full" /></div>
                 <div className="space-y-2 text-center"><Skeleton className="h-6 w-48 mx-auto" /><Skeleton className="h-4 w-32 mx-auto" /></div>
                <Skeleton className="h-10 w-full" />
            </div>
        );
    }

    if (!user) return null;

    const TabButton = ({ tabName, label }: { tabName: string, label: string }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`transition-colors duration-200 text-sm pb-3 font-bold ${
                activeTab === tabName ? 'border-b-4 border-primary text-primary' : 'text-neutral-400 border-b-4 border-transparent'
            }`}
        >
            {label}
        </button>
    );

    const photoUrlToDisplay = userData?.photoURL || user.photoURL || '';
    const displayName = userData?.displayName || user.displayName || 'Anonymer Nutzer';

    const visibleRequestProfiles = requestProfiles.filter(p => !userProfile?.hiddenEntityIds?.includes(p.uid));
    const visibleActivities = activities.filter(act => !userProfile?.hiddenEntityIds?.includes(act.id!));
    
    const pastActivities = visibleActivities.filter(a => a.status === 'completed');
    const currentActivities = visibleActivities.filter(a => a.status !== 'completed' && a.status !== 'cancelled');

    return (
        <>
            <div className="relative flex flex-col h-full bg-secondary/30 overflow-y-auto pb-20">
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                    <NotificationBell />
                    <Button asChild variant="ghost" size="icon" className="text-neutral-400 h-9 w-9 rounded-full bg-white/50 backdrop-blur-sm shadow-sm">
                        <Link href="/settings"><Settings className="h-5 w-5" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-neutral-400 h-9 w-9 rounded-full bg-white/50 backdrop-blur-sm shadow-sm">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
                
                <div className="max-w-4xl mx-auto w-full px-4 pt-12">
                    <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-sm p-8 mb-8 flex flex-col items-center relative overflow-hidden text-center border-none">
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-primary/10 via-blue-500/5 to-purple-500/10" />
                        
                        <div className="relative z-10 flex flex-col items-center w-full">
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                            <div onClick={() => fileInputRef.current?.click()} className="relative group cursor-pointer mb-6">
                                <div className={cn("p-1 rounded-full shadow-lg transition-all", userData?.isPremium ? "bg-gradient-to-tr from-amber-400 via-yellow-200 to-amber-600" : (userData?.isSupporter ? "bg-pink-400" : "bg-white"))}>
                                    <Avatar className="h-28 w-28 border-4 border-white">
                                        <AvatarImage src={photoUrlToDisplay} alt="Profil" />
                                        <AvatarFallback className="text-4xl bg-secondary text-primary font-black">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                </div>
                                <div className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                    <Edit className="h-4 w-4" />
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-1 mb-4">
                                <div className="flex items-center gap-2">
                                  <h1 className="text-3xl font-black tracking-tight text-[#0f172a] dark:text-neutral-200">{displayName}</h1>
                                  {userData?.age && <span className="text-neutral-400 text-3xl font-black">, {userData.age}</span>}
                                  <UserBadge isPremium={userData?.isPremium} isSupporter={userData?.isSupporter} />
                                </div>

                                {/* Aggregated Rating Display */}
                                <button 
                                  onClick={loadReviews}
                                  className="flex items-center gap-1.5 mt-1 bg-amber-50 px-4 py-1.5 rounded-full border border-amber-100 hover:bg-amber-100 transition-all active:scale-95 group"
                                >
                                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                  <span className="font-black text-amber-700 text-sm">{userData?.averageRating?.toFixed(1) || '0.0'}</span>
                                  <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-tighter ml-1">
                                    ({userData?.ratingCount || 0} Reviews)
                                  </span>
                                </button>
                                
                                <div className="flex flex-wrap justify-center gap-2 mt-3">
                                    <div onClick={userData?.friendCode ? handleCopyCode : undefined} className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary/10 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-primary hover:bg-primary/20 transition-all">
                                        <span>{userData?.friendCode || '...'}</span>
                                        <Copy className="h-3.5 w-3.5" />
                                    </div>
                                    {userData?.location && (
                                        <div className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-4 py-1.5 text-xs font-bold text-neutral-500">
                                            <Compass className="h-3.5 w-3.5" />
                                            <span>{userData.location}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-6 w-full mt-2">
                                <div className="flex flex-wrap justify-center gap-3">
                                    <Button variant="secondary" className="rounded-full px-8 h-12 bg-neutral-100 hover:bg-neutral-200 font-black" onClick={() => router.push('/profile/edit')}>Bearbeiten</Button>
                                    
                                    {/* MODUL 19: GATED CREATOR FEATURES */}
                                    {userData?.isCreator && (
                                      <Button asChild variant="default" className="rounded-full px-8 h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-black shadow-lg shadow-emerald-500/20">
                                          <Link href="/wallet"><Wallet className="w-4 h-4 mr-2" /> Wallet (€{userData?.fiatBalance?.toFixed(2) || '0.00'})</Link>
                                      </Button>
                                    )}
                                </div>

                                {userData?.isCreator && (
                                  <div className="flex gap-3 w-full max-w-sm mx-auto">
                                      <div className="flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border border-neutral-100 bg-white shadow-sm">
                                          <div className="flex items-center gap-1.5 text-amber-500 mb-1"><Coins className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Tokens</span></div>
                                          <span className="text-2xl font-black text-[#0f172a]">{userData?.tokens || 0}</span>
                                      </div>
                                      <div className="flex-1 flex flex-col items-center justify-center p-3 rounded-2xl border border-neutral-100 bg-white shadow-sm">
                                          <div className="flex items-center gap-1.5 text-blue-500 mb-1"><Unlock className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Level</span></div>
                                          <div className="flex items-baseline gap-1"><span className="text-2xl font-black text-[#0f172a]">{userData?.successfulFreeHosts || 0}</span><span className="text-xs font-bold text-neutral-400">/ 5</span></div>
                                      </div>
                                  </div>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    {!loadingRequests && visibleRequestProfiles.length > 0 && (
                        <div className="mb-8 space-y-4">
                            <h2 className="text-xl font-black text-[#0f172a] ml-4">Anfragen</h2>
                            <div className="grid grid-cols-1 gap-3">
                                {visibleRequestProfiles.map(profile => (
                                    <div key={profile.uid} className="flex items-center gap-4 p-4 rounded-3xl bg-white shadow-sm animate-in fade-in slide-in-from-top-2">
                                        <Avatar className="h-12 w-12"><AvatarImage src={profile.photoURL || undefined} /><AvatarFallback className="bg-primary/10 text-primary font-bold">{profile.displayName?.charAt(0)}</AvatarFallback></Avatar>
                                        <span className="flex-1 font-black text-[#0f172a] truncate">{profile.displayName}</span>
                                        <div className="flex gap-2">
                                            <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-green-50 text-green-600 hover:bg-green-100" onClick={() => handleAcceptRequest(profile.uid)}><UserCheck className="h-5 w-5"/></Button>
                                            <Button size="icon" variant="ghost" className="h-10 w-10 rounded-xl bg-red-50 text-red-600 hover:bg-red-100" onClick={() => handleDeclineRequest(profile.uid)}><X className="h-5 w-5"/></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <FriendList friendIds={userData?.friends || []} />
                    
                    <div className="w-full mt-12 mb-6">
                        <nav className="flex justify-around items-center px-4 border-b border-neutral-100">
                            <TabButton tabName="activities" label="Aktivitäten" />
                            <TabButton tabName="favorites" label="Favoriten" />
                            <TabButton tabName="reviews" label="Reviews" />
                        </nav>
                    </div>

                    <div className="flex-1 pb-12">
                        {activeTab === 'activities' && (
                            <div className="space-y-4">
                                {loadingActivities ? (
                                     <div className="space-y-4 px-2"><ActivityListItemSkeleton /><ActivityListItemSkeleton /></div>
                                ) : visibleActivities.length > 0 ? (
                                    <Tabs defaultValue="active" className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 rounded-2xl p-1">
                                            <TabsTrigger value="active" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Aktiv ({currentActivities.length})</TabsTrigger>
                                            <TabsTrigger value="past" className="rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">Vergangen ({pastActivities.length})</TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="active" className="space-y-2 mt-4">
                                            {currentActivities.length > 0 ? currentActivities.map(activity => <ActivityListItem key={activity.id} activity={activity} user={user} onJoin={handleJoin} />) : <div className="text-center p-8 bg-white/50 rounded-[2rem] border-2 border-dashed border-neutral-200"><p className="text-neutral-500 font-bold">Keine aktiven Aktivitäten.</p></div>}
                                        </TabsContent>
                                        <TabsContent value="past" className="space-y-2 mt-4">
                                            {pastActivities.length > 0 ? pastActivities.map(activity => <div key={activity.id} className="opacity-60 hover:opacity-100 transition-all"><ActivityListItem activity={activity} user={user} onJoin={handleJoin} /></div>) : <div className="text-center p-8 bg-white/50 rounded-[2rem] border-2 border-dashed border-neutral-200"><p className="text-neutral-500 font-bold">Keine vergangenen Aktivitäten.</p></div>}
                                        </TabsContent>
                                    </Tabs>
                                ) : (
                                    <div className="text-center p-12 flex flex-col items-center justify-center gap-4 bg-white/50 rounded-[2rem] border-2 border-dashed border-neutral-200">
                                        <p className="text-neutral-500 font-bold">Noch keine Aktivitäten erstellt.</p>
                                        <Button onClick={() => router.push('/explore')} className="rounded-2xl h-12 px-8 font-black"><Compass className="mr-2 h-5 w-5" />Entdecken</Button>
                                    </div>
                                )}
                            </div>
                        )}
                         {activeTab === 'favorites' && (
                            <div className="px-2">
                                {favorites.length === 0 ? (
                                    <div className="text-center p-12 flex flex-col items-center justify-center gap-4 bg-white/50 rounded-[2rem] border-2 border-dashed border-neutral-200">
                                         <div className="bg-primary/10 p-6 rounded-3xl"><Bookmark className="h-10 w-10 text-primary" /></div>
                                         <Button onClick={() => router.push('/')} className="rounded-2xl h-12 px-8 font-black">Orte finden</Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {favorites.map(fav => <PlaceCard key={fav.id} place={fav as Place} onClick={() => handlePlaceSelect(fav as Place)} onAddActivity={() => handleOpenActivityModal(fav as Place)} />)}
                                    </div>
                                )}
                            </div>
                         )}
                         {activeTab === 'reviews' && (
                             <div className="text-center text-neutral-400 font-bold p-12 bg-white/50 rounded-[2rem] border-2 border-dashed border-neutral-200">
                                <p>Reviews folgen in Kürze.</p>
                            </div>
                         )}
                    </div>
                </div>
            </div>

            {/* Community Feedback Modal */}
            <Dialog open={isReviewsModalOpen} onOpenChange={setIsReviewsModalOpen}>
              <DialogContent className="sm:max-w-md bg-white rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-amber-50">
                  <DialogTitle className="text-xl font-black flex items-center gap-2 text-amber-900">
                    <Star className="h-5 w-5 fill-amber-500" /> Community Feedback
                  </DialogTitle>
                  <DialogDescription className="text-amber-800/70 font-medium">Das sagen andere Teilnehmer über dich.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
                  {isLoadingReviews ? (
                    <div className="flex flex-col items-center py-10 gap-2"><Loader2 className="animate-spin text-primary" /><p className="text-xs font-black uppercase text-slate-400">Lade Feedback...</p></div>
                  ) : recentReviews.length > 0 ? (
                    recentReviews.map((review) => (
                      <div key={review.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={cn("h-3 w-3", i < review.rating ? "text-amber-500 fill-amber-500" : "text-slate-200")} />
                            ))}
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{format(review.createdAt.toDate(), 'dd.MM.yy')}</span>
                        </div>
                        {review.comment ? (
                          <p className="text-sm font-medium text-slate-700 italic">"{review.comment}"</p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Kein Kommentar hinterlassen.</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <MessageSquare className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-400">Noch keine Bewertungen erhalten.</p>
                    </div>
                  )}
                </div>
                <DialogFooter className="p-4 bg-slate-50">
                  <Button onClick={() => setIsReviewsModalOpen(false)} className="w-full rounded-xl font-black h-12">Schließen</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Modal für Bildzuschnitt */}
            <Dialog open={isCropModalOpen} onOpenChange={(open) => !open && !isUploading && setIsCropModalOpen(false)}>
                <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 overflow-hidden border-none shadow-2xl">
                    <DialogHeader><DialogTitle className="text-xl font-black">Bild zuschneiden</DialogTitle></DialogHeader>
                    <div className="relative h-64 w-full bg-slate-900 rounded-2xl overflow-hidden mt-4">
                        {imageToCrop && <Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />}
                    </div>
                    <DialogFooter className="mt-6 flex gap-2">
                        <Button variant="ghost" className="rounded-xl font-bold" onClick={() => { setIsCropModalOpen(false); setImageToCrop(null); }} disabled={isUploading}>Abbrechen</Button>
                        <Button onClick={handleSaveCroppedImage} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black flex-1" disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Bild speichern</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && setSelectedPlace(null)}>
                <DialogContent className="max-h-[95vh] flex flex-col p-0 w-full max-w-4xl gap-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
                    <DialogTitle className="sr-only">Ort Details</DialogTitle>
                    <DialogDescription className="sr-only">Profil Ort Details</DialogDescription>
                    {selectedPlace && <PlaceDetails place={selectedPlace} onClose={() => setSelectedPlace(null)} />}
                </DialogContent>
            </Dialog>

            <CreateActivityDialog place={activityModalPlace} open={!!activityModalPlace} onOpenChange={(open) => !open && setActivityModalPlace(null)} onCreateActivity={handleCreateActivity} />
        </>
    );
}

const ActivityListItemSkeleton = () => (
    <div className="p-5 rounded-3xl bg-white shadow-sm flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-2xl shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div><Skeleton className="h-10 w-10 rounded-xl" /></div>
);
