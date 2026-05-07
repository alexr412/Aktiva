'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
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
import { LogOut, User, UserPlus, Compass, Edit, UserCheck, X, Loader2, Settings, Copy, Bookmark, ShieldCheck, Check, Coins, Unlock, Wallet, Star, MessageSquare, Bell, Camera, Search } from 'lucide-react';
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



export default function ProfilePage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const language = useLanguage();
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
                        title: language === 'de' ? "Fehler" : "Error",
                        description: language === 'de' ? "Deine Aktivitäten konnten nicht geladen werden." : "Could not load your activities.",
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
            toast({ variant: 'destructive', title: language === 'de' ? 'Datei zu groß' : 'File too large', description: language === 'de' ? 'Bitte wähle ein Bild unter 5MB.' : 'Please choose an image under 5MB.' });
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
            toast({ title: language === 'de' ? "Profilbild aktualisiert!" : "Profile picture updated!" });
        } catch (error: any) {
            console.error(error);
            toast({ variant: 'destructive', title: language === 'de' ? 'Upload fehlgeschlagen' : 'Upload failed', description: error.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push('/');
            toast({ title: language === 'de' ? 'Erfolgreich abgemeldet.' : 'Successfully logged out.' });
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
            setActivities(prev => prev.map(act => act.id === activityId ? { ...act, participantIds: [...act.participantIds, user.uid] } : act));
            router.push(`/chat/${activityId}`);
        } catch (error: any) {
            toast({ title: language === 'de' ? 'Fehler beim Beitritt.' : 'Error joining.', variant: 'destructive' });
            throw error;
        }
    };

    const handleAcceptRequest = async (requestingUserId: string) => {
        if (!user?.uid) return;
        try {
            await acceptFriendRequest(user.uid, requestingUserId);
            setRequestProfiles(prev => prev.filter(p => p.uid !== requestingUserId));
            toast({ title: language === 'de' ? "Freund hinzugefügt!" : "Friend added!" });
        } catch (error) {
            toast({ title: language === 'de' ? "Fehler beim Bestätigen." : "Error confirming.", variant: "destructive" });
        }
    };

    const handleDeclineRequest = async (requestingUserId: string) => {
        if (!user?.uid) return;
        try {
            await declineFriendRequest(user.uid, requestingUserId);
            setRequestProfiles(prev => prev.filter(p => p.uid !== requestingUserId));
            toast({ title: language === 'de' ? "Anfrage abgelehnt." : "Request declined." });
        } catch (error) {
            toast({ title: language === 'de' ? "Fehler beim Ablehnen." : "Error declining.", variant: "destructive" });
        }
    };

    const handleCopyUsername = () => {
        if (!userData?.username) return;
        navigator.clipboard.writeText(userData.username)
            .then(() => { toast({ title: language === 'de' ? "Username kopiert!" : "Username copied!" }); });
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
            toast({ title: language === 'de' ? 'Aktivität erstellt!' : 'Activity created!' });
            setActivityModalPlace(null);
            router.push(`/chat/${newActivityRef.id}`);
            return true;
        } catch (error: any) {
            toast({ variant: 'destructive', title: language === 'de' ? 'Fehler beim Erstellen' : 'Creation error', description: error.message });
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
            className={`transition-all duration-300 text-[11px] pb-4 font-black uppercase tracking-[0.1em] px-2 ${activeTab === tabName
                ? 'border-b-4 border-primary text-primary'
                : 'text-slate-300 border-b-4 border-transparent hover:text-slate-400'
                }`}
        >
            {label}
        </button>
    );

    const photoUrlToDisplay = userData?.photoURL || user.photoURL || '';
    const displayName = userData?.displayName || user.displayName || (language === 'de' ? 'Anonymer Nutzer' : 'Anonymous User');

    const calculateAge = (birthday: string) => {
        if (!birthday) return null;
        try {
            // Support both DD/MM/YYYY and YYYY-MM-DD
            const parts = birthday.includes('/') ? birthday.split('/') : birthday.split('-');
            const birth = parts[0].length === 4 
                ? new Date(birthday) 
                : new Date(parts.reverse().join('-'));
            
            if (isNaN(birth.getTime())) return null;
            
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                age--;
            }
            return age;
        } catch (e) {
            return null;
        }
    };
    const displayAge = userData?.age || (userData?.birthday ? calculateAge(userData.birthday) : null);

    const visibleRequestProfiles = requestProfiles.filter(p => !userProfile?.hiddenEntityIds?.includes(p.uid));
    const visibleActivities = activities.filter(act => !userProfile?.hiddenEntityIds?.includes(act.id!));

    const now = new Date();
    const pastActivities = visibleActivities.filter(a =>
        a.status === 'completed' ||
        (a.activityDate?.toDate() && a.activityDate.toDate() < now)
    );
    const currentActivities = visibleActivities.filter(a =>
        a.status !== 'completed' &&
        a.status !== 'cancelled' &&
        (!a.activityDate?.toDate() || a.activityDate.toDate() >= now)
    );

    return (
        <>
            <div className="relative flex flex-col h-full bg-[#F8FAFC] dark:bg-neutral-950 overflow-y-auto pb-20">
                {/* Zonen-Isolierung: Header Color Blocking */}
                <div className="absolute top-0 left-0 right-0 h-[35vh] bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-950/10 z-0" />

                <header className="global-viewport-header">
                    <div className="global-header-container">
                        <div className="flex items-center gap-2">
                            <h1 className="">{language === 'de' ? 'Profil' : 'Profile'}</h1>
                            <User className="h-6 w-6 text-primary fill-current" />
                        </div>
                        <div className="flex items-center gap-3">
                            <NotificationBell />
                            <Link href="/settings">
                                <Button variant="ghost" size="icon" className="secondary-header-button">
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Main Content Area - Flat Model */}
                <div className="relative px-6 w-full max-w-4xl mx-auto z-10 pt-4 flex flex-col items-center">

                    {/* Avatar Section */}
                    <div className="relative mb-10 group">


                        <div className={cn(
                            "rounded-full transition-transform active:scale-95 relative z-10 shadow-none",
                            userData?.isCreator ? "bg-gradient-to-tr from-slate-900 via-slate-800 to-blue-500 p-1.5 shadow-none" : (userData?.isPremium ? "bg-gradient-to-tr from-amber-400 via-yellow-100 to-amber-600 p-1.5 shadow-none" : (userData?.isSupporter ? "bg-red-500 p-1.5 shadow-none" : "p-0 bg-transparent"))
                        )}>
                            <Avatar className="h-32 w-32 shadow-none border-none">
                                <AvatarImage src={photoUrlToDisplay} alt="Profil" />
                                <AvatarFallback className="text-5xl bg-neutral-100 dark:bg-neutral-800 text-primary font-black">{displayName.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-1 right-1 h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-none hover:scale-110 active:scale-90 transition-all z-20"
                        >
                            <Camera className="h-4 w-4" />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                    </div>

                    {/* Name & Title */}
                    <div className="flex flex-col items-center text-center">
                        <div className="flex flex-col items-center gap-1 mb-2">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {displayName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
                                    {displayAge && <span className="text-slate-400 font-bold text-xl">, {displayAge}</span>}
                                </h1>
                                <UserBadge isPremium={userData?.isPremium} isSupporter={userData?.isSupporter} isCreator={userData?.isCreator} />
                            </div>
                            {userData?.username && (
                                <span
                                    onClick={handleCopyUsername}
                                    className="text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] cursor-pointer hover:text-emerald-500 transition-colors"
                                >
                                    @{userData.username}
                                </span>
                            )}
                            {userData?.bio && (
                                <p className="mt-3 px-8 text-sm font-medium text-slate-600 dark:text-neutral-400 leading-relaxed max-w-md">
                                    {userData.bio}
                                </p>
                            )}
                        </div>

                        {/* Rating */}
                        {(userData?.ratingCount && userData.ratingCount > 0) ? (
                            <button
                                onClick={loadReviews}
                                className="flex items-center gap-2 mb-8 group active:opacity-70 transition-opacity"
                            >
                                <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <Star key={i} className={cn("h-4 w-4", i <= (userData.averageRating || 0) ? "text-[#f59e0b] fill-[#f59e0b]" : "text-slate-200 fill-slate-100")} />
                                    ))}
                                </div>
                                <span className="text-lg font-black text-slate-900 dark:text-neutral-100">{userData.averageRating?.toFixed(1) || '0.0'}</span>
                                <span className="text-sm font-bold text-slate-400">({userData.ratingCount})</span>
                            </button>
                        ) : <div className="h-4" />}


                        {/* Stats - Asymmetric Pastel Tints */}
                        <div className="grid grid-cols-3 gap-4 w-full max-w-2xl mb-8">
                            {[
                                { label: language === 'de' ? 'Active' : 'Active', val: currentActivities.length, bg: 'bg-emerald-500/15' },
                                { label: language === 'de' ? 'Friends' : 'Friends', val: userData?.friends?.length || 0, bg: 'bg-cyan-500/15' },
                                { label: language === 'de' ? 'Reviews' : 'Reviews', val: userData?.ratingCount || 0, bg: 'bg-amber-500/15' }
                            ].map((stat, idx) => (
                                <div key={stat.label} className={cn("flex flex-col items-center py-6 px-10 rounded-[2rem] border-none shadow-none", stat.bg)}>
                                    <span className={cn("text-3xl font-black leading-none mb-1",
                                        idx === 0 ? "text-[#10b981]" :
                                            idx === 1 ? "text-cyan-600" :
                                                "text-amber-600"
                                    )}>{stat.val}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Compact Action Button */}
                        <Button
                            className="h-11 rounded-full bg-[#10b981] hover:bg-emerald-600 text-white font-black text-[12px] uppercase tracking-widest px-12 transition-all active:scale-95 shadow-lg shadow-emerald-500/10 border-none"
                            onClick={() => router.push('/profile/edit')}
                        >
                            {language === 'de' ? 'Profil bearbeiten' : 'Edit Profile'}
                        </Button>
                    </div>
                </div>

                {/* Section: Freunde */}
                <div className="mt-6">
                    <FriendList friendIds={userData?.friends || []} />
                </div>

                <div className="w-full mt-1 mb-1">
                    <nav className="flex justify-around items-center px-4">
                        <TabButton tabName="activities" label={language === 'de' ? 'Aktivitäten' : 'Activities'} />
                        <TabButton tabName="favorites" label={language === 'de' ? 'Favoriten' : 'Favorites'} />
                        <TabButton tabName="reviews" label={language === 'de' ? 'Bewertungen' : 'Reviews'} />


                    </nav>
                </div>

                <div className="flex-1 pb-0 px-2">
                    {activeTab === 'activities' && (
                        <div className="space-y-4">
                            {loadingActivities ? (
                                <div className="space-y-4"><ActivityListItemSkeleton /><ActivityListItemSkeleton /></div>
                            ) : visibleActivities.length > 0 ? (
                                <Tabs defaultValue="active" className="w-full">
                                    <TabsList className="flex gap-3 bg-transparent p-0 justify-center mb-6">
                                        <TabsTrigger
                                            value="active"
                                            className="rounded-full px-8 py-3 font-black text-xs uppercase tracking-widest bg-slate-100/50 data-[state=active]:bg-accent data-[state=active]:text-primary data-[state=active]:shadow-none border-none transition-all"
                                        >
                                            {language === 'de' ? 'Aktiv' : 'Active'} ({currentActivities.length})
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="past"
                                            className="rounded-full px-8 py-3 font-black text-xs uppercase tracking-widest bg-slate-100/50 data-[state=active]:bg-accent data-[state=active]:text-primary data-[state=active]:shadow-none border-none transition-all"
                                        >
                                            {language === 'de' ? 'Vergangen' : 'Past'} ({pastActivities.length})
                                        </TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="active" className="space-y-1 mt-0">
                                        {currentActivities.length > 0 ? currentActivities.map(activity => (
                                            <ProfileActivityCard key={activity.id} activity={activity} user={user} onJoin={handleJoin} />
                                        )) : (
                                            <div className="text-center p-4 bg-white rounded-[2.5rem] border border-[#E5E7EB]/50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.04)]">
                                                <p className="text-slate-400 font-bold leading-relaxed">{language === 'de' ? 'Uncharted territory. Start exploring nearby treasures.' : 'Uncharted territory. Start exploring nearby treasures.'}</p>
                                            </div>
                                        )}
                                    </TabsContent>
                                    <TabsContent value="past" className="space-y-1 mt-0">
                                        {pastActivities.length > 0 ? pastActivities.map(activity => (
                                            <div key={activity.id} className="opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all">
                                                <ProfileActivityCard activity={activity} user={user} onJoin={handleJoin} />
                                            </div>
                                        )) : (
                                            <div className="text-center p-4 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                                                <p className="text-slate-400 font-bold">{language === 'de' ? 'Keine vergangenen Aktivitäten.' : 'No past activities.'}</p>
                                            </div>
                                        )}
                                    </TabsContent>
                                </Tabs>
                            ) : (
                                <div className="text-center p-4 flex flex-col items-center justify-center gap-6 bg-white rounded-[2.5rem] border border-[#E5E7EB]/50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.04)]">
                                    <div className="bg-[#f0fdf4] p-3 rounded-2xl">
                                        <Search className="h-6 w-6 text-[#10b981]" strokeWidth={2.5} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-black text-slate-900 tracking-tight">{language === 'de' ? 'Start Exploring' : 'Start Exploring'}</h3>
                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-[200px] mx-auto">{language === 'de' ? 'Uncharted territory. Start exploring nearby treasures.' : 'Uncharted territory. Start exploring nearby treasures.'}</p>
                                    </div>
                                    <Link href="/" className="w-full max-w-[200px]">
                                        <Button className="w-full h-10 rounded-full bg-[#10b981] hover:bg-emerald-600 text-white font-black tracking-tight text-[13px] shadow-none border-none">
                                            {language === 'de' ? 'Discover Places' : 'Discover Places'}
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'favorites' && (
                        <div className="px-2">
                            {favorites.length === 0 ? (
                                <div className="text-center p-8 flex flex-col items-center justify-center gap-6 bg-white rounded-[2rem] border border-[#E5E7EB]/50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.04)]">
                                    <div className="bg-[#f0fdf4] p-4 rounded-3xl"><Bookmark className="h-8 w-8 text-[#10b981]" strokeWidth={2.5} /></div>
                                    <div className="space-y-1 mb-1">
                                        <h3 className="text-lg font-black text-slate-900 tracking-tight">{language === 'de' ? 'Expand Your Network' : 'Expand Your Network'}</h3>
                                    </div>
                                    <Button onClick={() => router.push('/')} className="rounded-full h-11 px-8 font-black bg-[#10b981] hover:bg-emerald-600 text-white shadow-none border-none uppercase tracking-widest text-[10px]">
                                        {language === 'de' ? 'Discover Places' : 'Discover Places'}
                                    </Button>

                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {favorites.map(fav => <PlaceCard key={fav.id} place={fav as Place} onClick={() => handlePlaceSelect(fav as Place)} onAddActivity={() => handleOpenActivityModal(fav as Place)} />)}
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'reviews' && (
                        <div className="text-center p-12 bg-white rounded-[2rem] border border-[#E5E7EB]/50 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.04)]">
                            <p className="text-slate-400 font-bold text-sm tracking-tight">{language === 'de' ? 'Reviews Coming Soon' : 'Reviews Coming Soon'}</p>

                        </div>
                    )}
                </div>
            </div>

            {/* Community Feedback Modal */}
            <Dialog open={isReviewsModalOpen} onOpenChange={setIsReviewsModalOpen}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-amber-50 dark:bg-amber-950/20">
                        <DialogTitle className="">
                            <Star className="h-5 w-5 fill-amber-500" /> {language === 'de' ? 'Community Feedback' : 'Community Feedback'}
                        </DialogTitle>
                        <DialogDescription className="text-amber-800/70 dark:text-amber-400/70 font-medium">
                            {language === 'de' ? 'Das sagen andere Teilnehmer über dich.' : 'What other participants say about you.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
                        {isLoadingReviews ? (
                            <div className="flex flex-col items-center py-10 gap-2"><Loader2 className="animate-spin text-primary" /><p className="text-xs font-black uppercase text-slate-400">{language === 'de' ? 'Lade Feedback...' : 'Loading feedback...'}</p></div>
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
                                        <p className="text-sm font-medium text-slate-700 dark:text-neutral-300">"{review.comment}"</p>
                                    ) : (
                                        <p className="text-xs text-slate-400">{language === 'de' ? 'Kein Kommentar hinterlassen.' : 'No comment left.'}</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10">
                                <MessageSquare className="h-10 w-10 text-slate-200 dark:text-neutral-800 mx-auto mb-2" />
                                <p className="text-sm font-bold text-slate-400">{language === 'de' ? 'Noch keine Bewertungen erhalten.' : 'No reviews received yet.'}</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="p-4 bg-slate-50 dark:bg-neutral-800/50">
                        <Button onClick={() => setIsReviewsModalOpen(false)} className="w-full rounded-xl font-black h-12">{language === 'de' ? 'Schließen' : 'Close'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal für Bildzuschnitt */}
            <Dialog open={isCropModalOpen} onOpenChange={(open) => !open && !isUploading && setIsCropModalOpen(false)}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 border-none shadow-2xl overflow-hidden">
                    <DialogHeader><DialogTitle className="">{language === 'de' ? 'Bild zuschneiden' : 'Crop Image'}</DialogTitle></DialogHeader>
                    <div className="relative h-64 w-full bg-slate-900 rounded-2xl overflow-hidden mt-4">
                        {imageToCrop && <Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />}
                    </div>
                    <DialogFooter className="mt-6 flex gap-2">
                        <Button variant="ghost" className="rounded-xl font-bold dark:text-neutral-400" onClick={() => { setIsCropModalOpen(false); setImageToCrop(null); }} disabled={isUploading}>{language === 'de' ? 'Abbrechen' : 'Cancel'}</Button>
                        <Button onClick={handleSaveCroppedImage} className="bg-primary hover:opacity-90 text-white rounded-xl font-black flex-1" disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{language === 'de' ? 'Bild speichern' : 'Save Image'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && setSelectedPlace(null)}>
                <DialogContent className="max-h-[95vh] flex flex-col p-0 w-full max-w-4xl gap-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl dark:bg-neutral-900">
                    <DialogTitle className="sr-only">{language === 'de' ? 'Ort Details' : 'Place Details'}</DialogTitle>
                    <DialogDescription className="sr-only">Profil Ort Details</DialogDescription>
                    {selectedPlace && (
                        <PlaceDetails 
                            place={selectedPlace} 
                            onClose={() => setSelectedPlace(null)} 
                            onCreateActivity={() => {
                                handleOpenActivityModal(selectedPlace);
                                setSelectedPlace(null);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <CreateActivityDialog place={activityModalPlace} open={!!activityModalPlace} onOpenChange={(open) => !open && setActivityModalPlace(null)} onCreateActivity={handleCreateActivity} />
        </>
    );
}

const ActivityListItemSkeleton = () => (
    <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 shadow-sm flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-2xl shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div><Skeleton className="h-10 w-10 rounded-xl" /></div>
);
