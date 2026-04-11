'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from '@/lib/firebase/auth';
import { fetchUserActivities, joinActivity, getUserProfile, acceptFriendRequest, declineFriendRequest, createActivity } from '@/lib/firebase/firestore';
import type { Activity, UserProfile, Place, Review } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useFavorites } from '@/contexts/favorites-context';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/image-utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityListItem } from '@/components/aktvia/activity-list-item';
import { LogOut, UserPlus, Compass, Edit, UserCheck, X, Loader2, Settings, Copy, Bookmark, ShieldCheck, Check, Coins, Unlock, Wallet, Star, MessageSquare, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { uploadProfileImage } from '@/lib/firebase/storage';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { PlaceCard } from '@/components/aktvia/place-card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FriendList from '@/components/profile/FriendList';
import { ProfileActivityCard } from "@/components/profile/ProfileActivityCard";
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
    const [unreadNotifications, setUnreadNotifications] = useState(0);

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

    useEffect(() => {
        if (!user || !db) return;
        const q = query(
          collection(db, "notifications"),
          where("recipientId", "==", user.uid),
          where("isRead", "==", false)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
          setUnreadNotifications(snapshot.docs.length);
        });
        return () => unsubscribe();
    }, [user]);
    
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
            className={`transition-all duration-300 text-[11px] pb-4 font-black uppercase tracking-[0.1em] px-2 ${
                activeTab === tabName 
                  ? 'border-b-4 border-[#59a27a] text-[#59a27a]' 
                  : 'text-slate-300 border-b-4 border-transparent hover:text-slate-400'
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
            <div className="relative flex flex-col h-full bg-[#f8f9fa] dark:bg-black/95 overflow-y-auto pb-32">
                {/* Header Backdrop Gradient */}
                <div className="h-64 w-full bg-gradient-to-br from-[#4ade80] to-[#3b82f6] relative shrink-0">
                    <div className="absolute top-12 left-6">
                        <h1 className="text-3xl font-black text-white tracking-tighter font-heading drop-shadow-sm">Profil</h1>
                    </div>
                    <div className="absolute top-12 right-6 flex items-center gap-3">
                        <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-white/20 backdrop-blur-xl border border-white/30 text-white shadow-xl">
                            <Link href="/settings"><Settings className="h-5.5 w-5.5" /></Link>
                        </Button>
                        <div className="relative group">
                            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-[#ffeedd]/30 backdrop-blur-xl border border-white/30 text-orange-200 shadow-xl">
                                <Bell className="h-5.5 w-5.5 fill-current" />
                            </Button>
                            {unreadNotifications > 0 && <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-rose-500 border-2 border-white rounded-full" />}
                        </div>
                    </div>
                </div>

                {/* Main Content Card */}
                <div className="relative -mt-20 px-4 w-full max-w-4xl mx-auto z-10">
                    <div className="bg-white dark:bg-neutral-900 rounded-[3.5rem] shadow-2xl shadow-slate-200/60 dark:shadow-none p-8 flex flex-col items-center">
                        
                        {/* Overlapping Avatar */}
                        <div className="relative -mt-24 mb-6 group">
                            <div className="p-1.5 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-100 to-amber-600 shadow-2xl transition-transform active:scale-95">
                                <Avatar className="h-32 w-32 border-[6px] border-white dark:border-neutral-900">
                                    <AvatarImage src={photoUrlToDisplay} alt="Profil" />
                                    <AvatarFallback className="text-5xl bg-neutral-100 dark:bg-neutral-800 text-primary font-black">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                            </div>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute bottom-1 right-1 h-10 w-10 rounded-full bg-[#59a27a] border-4 border-white dark:border-neutral-900 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all z-20"
                            >
                                <Edit className="h-4 w-4 fill-current" />
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                        </div>

                        {/* Name & Title */}
                        <div className="flex flex-col items-center text-center">
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-3xl font-black text-[#0f172a] dark:text-neutral-100 tracking-tight">
                                    {displayName}
                                    {userData?.age && <span className="text-neutral-300 font-extrabold ml-2">, {userData.age}</span>}
                                </h2>
                                <div className="flex items-center gap-1.5 ml-1">
                                    <span className="text-xl">👑</span>
                                    <span className="text-xl text-rose-500">❤️</span>
                                </div>
                            </div>

                            {/* Rating */}
                            <button 
                                onClick={loadReviews}
                                className="flex items-center gap-2 mb-6 group active:opacity-70 transition-opacity"
                            >
                                <div className="flex gap-0.5">
                                    {[1,2,3,4,5].map(i => (
                                        <Star key={i} className={cn("h-4 w-4", i <= (userData?.averageRating || 3) ? "text-[#f59e0b] fill-[#f59e0b]" : "text-slate-200 fill-slate-100")} />
                                    ))}
                                </div>
                                <span className="text-lg font-black text-[#0f172a] dark:text-neutral-100">{userData?.averageRating?.toFixed(1) || '3.0'}</span>
                                <span className="text-sm font-bold text-slate-300">({userData?.ratingCount || 7} Reviews)</span>
                            </button>

                            {/* Pills */}
                            <div className="flex items-center gap-2 mb-8">
                                <div onClick={userData?.friendCode ? handleCopyCode : undefined} className="bg-[#f3f4f6] dark:bg-neutral-800/80 px-5 py-2 rounded-2xl flex items-center gap-2 cursor-pointer hover:bg-slate-200 transition-colors">
                                    <span className="text-[#a1a1aa] font-black text-[11px] uppercase tracking-tighter">🔑</span>
                                    <span className="text-[#0f172a] dark:text-neutral-200 font-black text-xs uppercase tracking-widest">{userData?.friendCode || '6CBGEON7'}</span>
                                </div>
                                <div className="bg-[#fcf1f2] dark:bg-neutral-800/80 px-5 py-2 rounded-2xl flex items-center gap-2">
                                    <span className="text-[#ec4899] font-black text-[11px]">📍</span>
                                    <span className="text-[#0f172a] dark:text-neutral-200 font-black text-xs tracking-tight">{userData?.location || 'StädteRegion Aachen'}</span>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 w-full max-w-md mb-8">
                                {[
                                    { label: 'Aktiv', val: currentActivities.length || 8, bg: 'bg-[#faf6f6]' },
                                    { label: 'Freunde', val: userData?.friends?.length || 2, bg: 'bg-[#f6f9fa]' },
                                    { label: 'Reviews', val: userData?.ratingCount || 7, bg: 'bg-[#f8f9f8]' }
                                ].map((stat) => (
                                    <div key={stat.label} className={cn("flex flex-col items-center py-4 rounded-3xl shadow-sm border border-slate-50", stat.bg)}>
                                        <span className="text-3xl font-black text-[#59a27a] leading-none mb-1">{stat.val}</span>
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Action Button */}
                            <Button 
                                className="w-full max-w-sm h-16 rounded-[1.5rem] bg-[#59a27a] hover:bg-[#4d8c6a] text-white font-black text-lg shadow-xl shadow-emerald-200/50 flex items-center justify-center gap-2 border-none"
                                onClick={() => router.push('/profile/edit')}
                            >
                                <Edit className="h-5 w-5 fill-current" />
                                Profil bearbeiten
                            </Button>
                        </div>
                    </div>

                    {/* Section: Freunde */}
                    <div className="mt-12">
                         <FriendList friendIds={userData?.friends || []} />
                    </div>
                    
                    <div className="w-full mt-12 mb-6">
                        <nav className="flex justify-around items-center px-4">
                            <TabButton tabName="activities" label="Aktivitäten" />
                            <TabButton tabName="favorites" label="Favoriten" />
                            <TabButton tabName="reviews" label="Reviews" />
                        </nav>
                    </div>

                    <div className="flex-1 pb-12 px-2">
                        {activeTab === 'activities' && (
                            <div className="space-y-4">
                                {loadingActivities ? (
                                     <div className="space-y-4"><ActivityListItemSkeleton /><ActivityListItemSkeleton /></div>
                                ) : visibleActivities.length > 0 ? (
                                    <Tabs defaultValue="active" className="w-full">
                                        <TabsList className="flex gap-3 bg-transparent p-0 justify-center mb-6">
                                            <TabsTrigger 
                                                value="active" 
                                                className="rounded-full px-8 py-3 font-black text-xs uppercase tracking-widest bg-slate-100/50 data-[state=active]:bg-[#f0fdf4] data-[state=active]:text-[#59a27a] data-[state=active]:shadow-none border-none transition-all"
                                            >
                                                Aktiv ({currentActivities.length})
                                            </TabsTrigger>
                                            <TabsTrigger 
                                                value="past" 
                                                className="rounded-full px-8 py-3 font-black text-xs uppercase tracking-widest bg-slate-100/50 data-[state=active]:bg-[#f0fdf4] data-[state=active]:text-[#59a27a] data-[state=active]:shadow-none border-none transition-all"
                                            >
                                                Vergangen ({pastActivities.length})
                                            </TabsTrigger>
                                        </TabsList>
                                        <TabsContent value="active" className="space-y-1 mt-0">
                                            {currentActivities.length > 0 ? currentActivities.map(activity => (
                                                <ProfileActivityCard key={activity.id} activity={activity} user={user} onJoin={handleJoin} />
                                            )) : (
                                                <div className="text-center p-12 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                                                    <p className="text-slate-400 font-bold">Keine aktiven Aktivitäten.</p>
                                                </div>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="past" className="space-y-1 mt-0">
                                            {pastActivities.length > 0 ? pastActivities.map(activity => (
                                                <div key={activity.id} className="opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all">
                                                    <ProfileActivityCard activity={activity} user={user} onJoin={handleJoin} />
                                                </div>
                                            )) : (
                                                <div className="text-center p-12 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                                                    <p className="text-slate-400 font-bold">Keine vergangenen Aktivitäten.</p>
                                                </div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                ) : (
                                    <div className="text-center p-12 flex flex-col items-center justify-center gap-6 bg-white rounded-[3.5rem] border border-slate-100 shadow-sm">
                                        <div className="bg-[#f0fdf4] p-8 rounded-[2.5rem]">
                                            <Compass className="h-12 w-12 text-[#59a27a]" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-xl font-black text-[#0f172a]">Noch leer hier</h3>
                                            <p className="text-slate-400 font-medium">Entdecke spannende Orte in deiner Nähe.</p>
                                        </div>
                                        <Button onClick={() => router.push('/explore')} className="rounded-[1.5rem] h-14 px-10 font-black bg-[#59a27a]">Orte entdecken</Button>
                                    </div>
                                )}
                            </div>
                        )}
                         {activeTab === 'favorites' && (
                            <div className="px-2">
                                {favorites.length === 0 ? (
                                    <div className="text-center p-12 flex flex-col items-center justify-center gap-4 bg-white/50 dark:bg-neutral-900/50 rounded-[2rem] border-2 border-dashed border-neutral-200 dark:border-neutral-800">
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
                             <div className="text-center text-neutral-400 font-bold p-12 bg-white/50 dark:bg-neutral-900/50 rounded-[2rem] border-2 border-dashed border-neutral-200 dark:border-neutral-800">
                                <p>Reviews folgen in Kürze.</p>
                            </div>
                         )}
                    </div>
                </div>
            </div>

            {/* Community Feedback Modal */}
            <Dialog open={isReviewsModalOpen} onOpenChange={setIsReviewsModalOpen}>
              <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-amber-50 dark:bg-amber-950/20">
                  <DialogTitle className="text-xl font-black flex items-center gap-2 text-amber-900 dark:text-amber-200">
                    <Star className="h-5 w-5 fill-amber-500" /> Community Feedback
                  </DialogTitle>
                  <DialogDescription className="text-amber-800/70 dark:text-amber-400/70 font-medium">Das sagen andere Teilnehmer über dich.</DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
                  {isLoadingReviews ? (
                    <div className="flex flex-col items-center py-10 gap-2"><Loader2 className="animate-spin text-primary" /><p className="text-xs font-black uppercase text-slate-400">Lade Feedback...</p></div>
                  ) : recentReviews.length > 0 ? (
                    recentReviews.map((review) => (
                      <div key={review.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800 border border-slate-100 dark:border-neutral-700">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={cn("h-3 w-3", i < review.rating ? "text-amber-500 fill-amber-500" : "text-slate-200 dark:text-neutral-700")} />
                            ))}
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{format(review.createdAt.toDate(), 'dd.MM.yy')}</span>
                        </div>
                        {review.comment ? (
                          <p className="text-sm font-medium text-slate-700 dark:text-neutral-300 italic">"{review.comment}"</p>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Kein Kommentar hinterlassen.</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10">
                      <MessageSquare className="h-10 w-10 text-slate-200 dark:text-neutral-800 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-400">Noch keine Bewertungen erhalten.</p>
                    </div>
                  )}
                </div>
                <DialogFooter className="p-4 bg-slate-50 dark:bg-neutral-800/50">
                  <Button onClick={() => setIsReviewsModalOpen(false)} className="w-full rounded-xl font-black h-12">Schließen</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Modal für Bildzuschnitt */}
            <Dialog open={isCropModalOpen} onOpenChange={(open) => !open && !isUploading && setIsCropModalOpen(false)}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 border-none shadow-2xl overflow-hidden">
                    <DialogHeader><DialogTitle className="text-xl font-black dark:text-neutral-100">Bild zuschneiden</DialogTitle></DialogHeader>
                    <div className="relative h-64 w-full bg-slate-900 rounded-2xl overflow-hidden mt-4">
                        {imageToCrop && <Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />}
                    </div>
                    <DialogFooter className="mt-6 flex gap-2">
                        <Button variant="ghost" className="rounded-xl font-bold dark:text-neutral-400" onClick={() => { setIsCropModalOpen(false); setImageToCrop(null); }} disabled={isUploading}>Abbrechen</Button>
                        <Button onClick={handleSaveCroppedImage} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black flex-1" disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Bild speichern</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && setSelectedPlace(null)}>
                <DialogContent className="max-h-[95vh] flex flex-col p-0 w-full max-w-4xl gap-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl dark:bg-neutral-900">
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
    <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 shadow-sm flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-2xl shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div><Skeleton className="h-10 w-10 rounded-xl" /></div>
);
