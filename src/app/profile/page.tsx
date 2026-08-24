'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { signOut } from '@/lib/firebase/auth';
import { fetchUserActivities, joinActivity, getPublicProfileClient, acceptFriendRequest, declineFriendRequest, createActivity, updatePresetAvatar, removeUserAvatar, votePlace } from '@/lib/firebase/firestore';
import { DEFAULT_AVATARS } from '@/lib/avatar-options';
import type { Activity, UserProfile, Place, Review, ActivityCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useFavorites } from '@/contexts/favorites-context';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/image-utils';

import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityListItem } from '@/components/activa/activity-list-item';
import { shareOrCopyReferralLink } from '@/lib/referral';
import { LogOut, User, UserPlus, Compass, Edit, UserCheck, X, Loader2, Settings, Copy, Bookmark, ShieldCheck, Check, Coins, Unlock, Wallet, Star, MessageSquare, Bell, Camera, Search, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { uploadProfileImage } from '@/lib/firebase/storage';
import { validateAvatarFile } from '@/lib/avatar-utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { DesktopNav } from '@/components/desktop-nav';
import { PlaceCard } from '@/components/activa/place-card';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { PlaceDetails } from '@/components/activa/place-details';
import avatarStyles from './avatar-dialog.module.css';
import { CreateActivityDialog } from '@/components/activa/create-activity-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FriendList from '@/components/profile/FriendList';
import { ProfileActivityCard } from "@/components/profile/ProfileActivityCard";
import { TrophyXpPopover } from "@/components/profile/TrophyXpPopover";
import { cn, formatFirstName, toDateObject } from '@/lib/utils';
import { UserBadge } from '@/components/common/UserBadge';
import { format } from 'date-fns';



import { LEVEL_THRESHOLDS, getLevelTitle, getLevelTierInfo, getUnlockedTitles, getUnlockedBorders } from '@/lib/levels';

export default function ProfilePage() {
    const { user, userProfile, loading: authLoading } = useAuth();
    const language = useLanguage();
    const router = useRouter();
    const { toast } = useToast();
    const { favorites, addFavorite, removeFavorite, checkIsFavorite } = useFavorites();

    // Live Vote/Metadata Cache
    const [placesMetaMap, setPlacesMetaMap] = useState<Record<string, {
      upvotes: number;
      downvotes: number;
      userVotes: Record<string, 'up' | 'down'>;
      communityScore: number;
      avgRating: number;
      reviewCount: number;
      activityCount: number;
      weightedUpvotes: number;
      weightedDownvotes: number;
    }>>({});
    const [isVotingPlace, setIsVotingPlace] = useState<Record<string, boolean>>({});

    const favoritesPlaceIdsKey = useMemo(() => {
        if (favorites.length === 0) return '';
        const ids: string[] = [];
        const seen = new Set<string>();
        favorites.forEach(f => {
            if (f.id && !seen.has(f.id)) {
                seen.add(f.id);
                ids.push(f.id);
            }
        });
        return ids.join(',');
    }, [favorites]);

    const activeUnsubs = useRef<Record<string, () => void>>({});

    // Reset maps on authentication changes
    useEffect(() => {
        setPlacesMetaMap({});
        Object.values(activeUnsubs.current).forEach(unsub => unsub());
        activeUnsubs.current = {};
    }, [user?.uid]);

    // Live batch metadata snapshot listener for favorites
    useEffect(() => {
        if (!db) return;
        const placeIds = favoritesPlaceIdsKey ? favoritesPlaceIdsKey.split(',') : [];
        if (placeIds.length === 0) {
            Object.values(activeUnsubs.current).forEach(unsub => unsub());
            activeUnsubs.current = {};
            return;
        }

        const batchSize = 30;
        const requiredChunkKeys: string[] = [];
        const newUnsubs: Record<string, () => void> = {};

        for (let i = 0; i < placeIds.length; i += batchSize) {
            const chunk = placeIds.slice(i, i + batchSize);
            const chunkKey = chunk.join(',');
            requiredChunkKeys.push(chunkKey);

            if (activeUnsubs.current[chunkKey]) {
                newUnsubs[chunkKey] = activeUnsubs.current[chunkKey];
                delete activeUnsubs.current[chunkKey];
            } else {
                const q = query(collection(db!, 'places'), where(documentId(), 'in', chunk));
                const unsub = onSnapshot(q, (snap) => {
                    if (!requiredChunkKeys.includes(chunkKey)) return;

                    setPlacesMetaMap(prev => {
                        const updated = { ...prev };
                        let changed = false;
                        snap.forEach(docSnap => {
                            const d = docSnap.data();
                            const newEntry = {
                              upvotes: d.upvotes || 0,
                              downvotes: d.downvotes || 0,
                              userVotes: d.userVotes || {},
                              communityScore: d.communityScore || 0,
                              avgRating: d.avgRating || 0,
                              reviewCount: d.reviewCount || 0,
                              activityCount: d.activityCount || 0,
                              weightedUpvotes: d.weightedUpvotes ?? d.upvotes ?? 0,
                              weightedDownvotes: d.weightedDownvotes ?? d.downvotes ?? 0
                            };
                            const existing = prev[docSnap.id];
                            if (!existing ||
                                existing.upvotes !== newEntry.upvotes ||
                                existing.downvotes !== newEntry.downvotes ||
                                existing.communityScore !== newEntry.communityScore ||
                                existing.avgRating !== newEntry.avgRating ||
                                existing.reviewCount !== newEntry.reviewCount ||
                                existing.activityCount !== newEntry.activityCount ||
                                existing.weightedUpvotes !== newEntry.weightedUpvotes ||
                                existing.weightedDownvotes !== newEntry.weightedDownvotes ||
                                JSON.stringify(existing.userVotes) !== JSON.stringify(newEntry.userVotes)) {
                              updated[docSnap.id] = newEntry;
                              changed = true;
                            }
                        });
                        return changed ? updated : prev;
                    });
                }, (error) => {
                    console.error("Profile page metadata snapshot error:", error);
                });
                newUnsubs[chunkKey] = unsub;
            }
        }

        // Unsubscribe obsolete chunks
        Object.values(activeUnsubs.current).forEach(unsub => unsub());
        activeUnsubs.current = newUnsubs;
    }, [favoritesPlaceIdsKey, db, user?.uid]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            Object.values(activeUnsubs.current).forEach(unsub => unsub());
            activeUnsubs.current = {};
        };
    }, []);

    // Cleanup stale keys from map
    useEffect(() => {
        const activeIds = favoritesPlaceIdsKey ? favoritesPlaceIdsKey.split(',') : [];
        const activeIdSet = new Set(activeIds);

        setPlacesMetaMap(prev => {
            let changed = false;
            const cleaned = { ...prev };
            for (const id in cleaned) {
                if (!activeIdSet.has(id)) {
                    delete cleaned[id];
                    changed = true;
                }
            }
            return changed ? cleaned : prev;
        });
    }, [favoritesPlaceIdsKey]);

    const handleVotePlace = async (placeId: string, type: 'up' | 'down' | 'none', placeObj: Place) => {
        if (!user || isVotingPlace[placeId]) return;
        setIsVotingPlace(prev => ({ ...prev, [placeId]: true }));
        
        setPlacesMetaMap(prev => {
            const currentMeta = prev[placeId] || {
                upvotes: placeObj.upvotes || 0,
                downvotes: placeObj.downvotes || 0,
                userVotes: placeObj.userVotes || {},
                communityScore: placeObj.globalScore || 0,
                avgRating: placeObj.rating || 0,
                reviewCount: 0,
                activityCount: placeObj.activityCount || 0,
                weightedUpvotes: placeObj.upvotes || 0,
                weightedDownvotes: placeObj.downvotes || 0
            };

            const prevVote = currentMeta.userVotes?.[user.uid] || 'none';
            let upDelta = 0;
            let downDelta = 0;
            const newUserVotes = { ...currentMeta.userVotes };

            if (prevVote === 'up') upDelta -= 1;
            else if (prevVote === 'down') downDelta -= 1;

            if (type === 'up') { upDelta += 1; newUserVotes[user.uid] = 'up'; }
            else if (type === 'down') { downDelta += 1; newUserVotes[user.uid] = 'down'; }
            else { delete newUserVotes[user.uid]; }

            return {
                ...prev,
                [placeId]: {
                    ...currentMeta,
                    upvotes: Math.max(0, currentMeta.upvotes + upDelta),
                    downvotes: Math.max(0, currentMeta.downvotes + downDelta),
                    userVotes: newUserVotes
                }
            };
        });

        try {
            await votePlace(placeId, user.uid, type, userProfile?.role, placeObj);
        } catch (error) {
            console.error("Voting failed, reverting optimistic update:", error);
            toast({
                variant: "destructive",
                title: language === 'de' ? "Abstimmung fehlgeschlagen" : "Voting failed",
                description: language === 'de' ? "Bitte versuche es später noch einmal." : "Please try again later."
            });
            // Revert optimistic update
            setPlacesMetaMap(prev => {
                const currentMeta = prev[placeId];
                if (!currentMeta) return prev;
                
                const prevVote = placeObj.userVotes?.[user.uid] || 'none';
                let upDelta = 0;
                let downDelta = 0;
                const newUserVotes = { ...currentMeta.userVotes };

                const optVote = currentMeta.userVotes?.[user.uid] || 'none';
                if (optVote === 'up') upDelta -= 1;
                else if (optVote === 'down') downDelta -= 1;

                if (prevVote === 'up') { upDelta += 1; newUserVotes[user.uid] = 'up'; }
                else if (prevVote === 'down') { downDelta += 1; newUserVotes[user.uid] = 'down'; }
                else { delete newUserVotes[user.uid]; }

                return {
                    ...prev,
                    [placeId]: {
                        ...currentMeta,
                        upvotes: Math.max(0, currentMeta.upvotes + upDelta),
                        downvotes: Math.max(0, currentMeta.downvotes + downDelta),
                        userVotes: newUserVotes
                    }
                };
            });
        } finally {
            setIsVotingPlace(prev => ({ ...prev, [placeId]: false }));
        }
    };

    const handleBookmarkTogglePlace = (placeObj: Place) => {
        if (checkIsFavorite(placeObj.id)) {
            removeFavorite(placeObj.id);
        } else {
            addFavorite(placeObj);
        }
    };

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

    // Dialog States for Avatar Selection
    const [isAvatarSelectionDialogOpen, setIsAvatarSelectionDialogOpen] = useState(false);
    const [selectedPresetUrl, setSelectedPresetUrl] = useState<string | null>(null);
    const [isSavingPreset, setIsSavingPreset] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);

    // Dialog States for Title & Frame Customization
    const [isCustomizeDialogOpen, setIsCustomizeDialogOpen] = useState(false);
    const [selectedTitle, setSelectedTitle] = useState<string>('default');
    const [selectedBorder, setSelectedBorder] = useState<string>('default');
    const [isSavingCustomization, setIsSavingCustomization] = useState(false);

    useEffect(() => {
        if (userData) {
            setSelectedTitle(userData.equippedTitle || 'default');
            setSelectedBorder(userData.equippedBorder || 'default');
        }
    }, [userData]);

    const handleSaveCustomization = async () => {
        if (!user?.uid || !db) return;
        setIsSavingCustomization(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                equippedTitle: selectedTitle,
                equippedBorder: selectedBorder,
            });
            setUserData(prev => prev ? { ...prev, equippedTitle: selectedTitle, equippedBorder: selectedBorder } : null);
            toast({
                title: language === 'de' ? 'Anpassung gespeichert' : 'Customization saved',
                description: language === 'de' ? 'Dein Titel & Rahmen wurden aktualisiert.' : 'Your title & frame have been updated.',
            });
            setIsCustomizeDialogOpen(false);
        } catch (err) {
            console.error("Failed to save customization", err);
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Fehler' : 'Error',
                description: language === 'de' ? 'Konnte nicht gespeichert werden.' : 'Could not save customization.',
            });
        } finally {
            setIsSavingCustomization(false);
        }
    };

    const handleOpenAvatarDialog = () => {
        const currentPhotoUrl = userData?.photoURL || '';
        const hasPreset = DEFAULT_AVATARS.some(av => av.url === currentPhotoUrl);
        setSelectedPresetUrl(hasPreset ? currentPhotoUrl : null);
        setShowRemoveConfirm(false);
        setIsAvatarSelectionDialogOpen(true);
    };

    const handleSavePresetAvatar = async () => {
        if (!selectedPresetUrl || !user?.uid) return;
        setIsSavingPreset(true);
        try {
            await updatePresetAvatar(user.uid, selectedPresetUrl);
            setUserData((prev: UserProfile | null) => (prev ? { ...prev, photoURL: selectedPresetUrl } : { photoURL: selectedPresetUrl } as UserProfile));
            setIsAvatarSelectionDialogOpen(false);
            setShowRemoveConfirm(false);
            setSelectedPresetUrl(null);
            toast({ title: language === 'de' ? "Profilbild aktualisiert!" : "Profile picture updated!" });
        } catch (error: any) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Fehler beim Speichern' : 'Error saving preset',
                description: error.message
            });
        } finally {
            setIsSavingPreset(false);
        }
    };

    const handleRemoveAvatar = async () => {
        if (!user?.uid) return;
        setIsRemovingAvatar(true);
        try {
            const currentPhotoUrl = userData?.photoURL || null;
            await removeUserAvatar(user.uid, currentPhotoUrl);
            setUserData((prev: UserProfile | null) => (prev ? { ...prev, photoURL: null } : { photoURL: null } as UserProfile));
            
            setIsAvatarSelectionDialogOpen(false);
            setShowRemoveConfirm(false);
            setSelectedPresetUrl(null);
            
            toast({ title: language === 'de' ? "Avatar entfernt!" : "Avatar removed!" });
        } catch (error: any) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Fehler beim Entfernen' : 'Error removing avatar',
                description: error.message
            });
        } finally {
            setIsRemovingAvatar(false);
        }
    };

    const handleTriggerCustomUpload = () => {
        setIsAvatarSelectionDialogOpen(false);
        setTimeout(() => {
            fileInputRef.current?.click();
        }, 100);
    };

    useEffect(() => {
        if (user) {
            if (userProfile) {
                if (userProfile.onboardingCompleted === false) {
                    router.replace('/onboarding');
                    return;
                }
                setUserData(userProfile);
            } else {
                getDoc(doc(db!, "users", user.uid)).then(snap => {
                    if (snap.exists()) {
                        const data = snap.data() as UserProfile;
                        if (data.onboardingCompleted === false) {
                            router.replace('/onboarding');
                            return;
                        }
                        setUserData(data);
                    }
                });
            }

            if (userProfile?.friendRequestsReceived && userProfile.friendRequestsReceived.length > 0) {
                const fetchRequestProfiles = async () => {
                    setLoadingRequests(true);
                    const profiles = await Promise.all(
                        userProfile.friendRequestsReceived!.map(uid => getPublicProfileClient(uid).catch(() => null))
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
            router.push('/login?redirect=/profile');
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
        if (!file) {
            e.target.value = '';
            return;
        }

        const validation = validateAvatarFile(file, language);
        if (!validation.isValid) {
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Ungültiges Bild' : 'Invalid Image',
                description: validation.error,
            });
            e.target.value = '';
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
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
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

    const handleJoin = async (activity: Activity) => {
        if (!user) {
            router.push('/login');
            throw new Error('Login Required');
        }
        try {
            const status = await joinActivity(activity.id!, user, null, null, activity.joinMode);
            if (status === 'joined') {
                setActivities(prev => prev.map(act => act.id === activity.id ? { ...act, participantIds: [...act.participantIds, user.uid] } : act));
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

    const handleCreateActivity = async (startDate: Date, endDate: Date | undefined, isTimeFlexible: boolean, customLocationName?: string, maxParticipants?: number, isBoosted?: boolean, isPaid?: boolean, price?: number, category?: ActivityCategory, description?: string, requirements?: any, joinMode?: 'direct' | 'request'): Promise<boolean> => {
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
                category: 'Sonstiges',
                description,
                requirements,
                joinMode
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

    const photoUrlToDisplay = userData?.photoURL || '';
    const displayName = formatFirstName(userData?.displayName || user.displayName, language === 'de' ? 'Anonymer Nutzer' : 'Anonymous User');

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

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const pastActivities = visibleActivities.filter(a => {
        if (a.status === 'completed') return true;
        const d = toDateObject(a.activityDate);
        return d !== null && d < startOfToday;
    });
    const currentActivities = visibleActivities.filter(a => {
        if (a.status === 'completed' || a.status === 'cancelled') return false;
        const d = toDateObject(a.activityDate);
        return d === null || d >= startOfToday;
    });

    return (
        <>
            <div className="relative flex flex-col h-full w-full bg-[#F8FAFC] dark:bg-neutral-950 overflow-y-auto pb-bottom-nav-safe lg:pb-12">
                {/* Zonen-Isolierung: Header Color Blocking */}
                <div className="absolute top-0 left-0 right-0 h-[35vh] bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-950/10 z-0" />

                <header className="global-viewport-header">
                    <div className="global-header-container">
                        <div className="flex items-center gap-2 min-w-0">
                            <h1 className="truncate">{language === 'de' ? 'Profil' : 'Profile'}</h1>
                            <User className="h-6 w-6 text-primary fill-current shrink-0" />
                        </div>
                        <DesktopNav />
                        <div className="flex items-center gap-3 shrink-0">
                            <NotificationBell />
                            <Link href="/settings">
                                <Button variant="ghost" size="icon" className="secondary-header-button">
                                    <Settings className="h-5 w-5" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </header>

                {/* Main Shared Desktop Content Container */}
                <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 z-10 pt-4 lg:pt-8 flex flex-col gap-8 lg:gap-10">

                    {/* Hero Composition: Mobile vertical column / Desktop 12-column grid */}
                    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 lg:items-start">

                        {/* Left Hero Column (Identity, Stats & Edit Profile) - 6 Cols on Desktop */}
                        <div className="lg:col-span-6 flex flex-col items-start text-left gap-6 w-full">
                            
                            {/* Avatar, Identity & Bio Row (Mobile & Desktop) */}
                            <div className="flex flex-row items-start gap-4 sm:gap-6 w-full">
                                {/* Left Column: Avatar + Change Button + Name + Username + Rating */}
                                <div className="flex flex-col items-center text-center shrink-0 w-32 sm:w-36">
                                     {/* Avatar */}
                                     <div className="relative group mb-3">
                                         <div className="cursor-pointer" onClick={handleOpenAvatarDialog}>
                                             <ProfileAvatar 
                                                 className="h-24 w-24 sm:h-28 sm:w-28 relative z-10 transition-transform group-hover:scale-105 active:scale-95 shadow-lg"
                                                 photoURL={photoUrlToDisplay}
                                                 displayName={displayName}
                                                 isPremium={userData?.isPremium}
                                                 isCreator={userData?.isCreator}
                                                 isSupporter={userData?.isSupporter}
                                                 level={userData?.level || 1}
                                                 equippedBorder={userData?.equippedBorder}
                                                 showLevelBadge={true}
                                             />
                                             {/* Hover overlay */}
                                             <div className="absolute inset-0 z-20 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-black uppercase tracking-widest text-center px-1">
                                                 {language === 'de' ? 'Foto ändern' : 'Change Photo'}
                                             </div>
                                         </div>
                                         
                                         {/* Left Icon Button: Gear / Settings for Title & Frame */}
                                         <button
                                             type="button"
                                             onClick={(e) => {
                                                 e.stopPropagation();
                                                 setIsCustomizeDialogOpen(true);
                                             }}
                                             className="absolute bottom-0 left-0 h-8 w-8 rounded-full bg-slate-900/90 dark:bg-neutral-800/90 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all z-30 border border-slate-700 dark:border-neutral-700 backdrop-blur-sm cursor-pointer"
                                             title={language === 'de' ? 'Titel & Rahmen anpassen' : 'Customize Title & Frame'}
                                         >
                                             <Settings className="h-3.5 w-3.5" />
                                         </button>

                                         {/* Right Icon Button: Camera for Photo */}
                                         <button
                                             type="button"
                                             onClick={handleOpenAvatarDialog}
                                             className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all z-30 cursor-pointer"
                                             title={language === 'de' ? 'Foto ändern' : 'Change Photo'}
                                         >
                                             <Camera className="h-3.5 w-3.5" />
                                         </button>
                                     </div>
                                     <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/jpeg,image/png,image/webp" />

                                    {/* Name & Badges */}
                                    <div className="flex flex-col items-center text-center gap-1 w-full">
                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                                {displayName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
                                                {displayAge && <span className="text-slate-400 font-bold text-base sm:text-lg">, {displayAge}</span>}
                                            </h1>
                                            <UserBadge isPremium={userData?.isPremium} isSupporter={userData?.isSupporter} isCreator={userData?.isCreator} />
                                        </div>
                                        {userData?.username && (
                                            <span
                                                onClick={handleCopyUsername}
                                                className="text-slate-400 font-black text-[10px] sm:text-[11px] uppercase tracking-[0.15em] cursor-pointer hover:text-emerald-500 transition-colors"
                                            >
                                                @{userData.username}
                                            </span>
                                        )}
                                    </div>

                                    {/* Rating */}
                                    {(userData?.ratingCount && userData.ratingCount > 0) ? (
                                        <button
                                            onClick={loadReviews}
                                            className="flex items-center justify-center gap-1 mt-3 group active:opacity-70 transition-opacity"
                                        >
                                            <div className="flex gap-0.5">
                                                {[1, 2, 3, 4, 5].map(i => (
                                                    <Star key={i} className={cn("h-3.5 w-3.5", i <= (userData.averageRating || 0) ? "text-[#f59e0b] fill-[#f59e0b]" : "text-slate-200 fill-slate-100")} />
                                                ))}
                                            </div>
                                            <span className="text-base font-black text-slate-900 dark:text-neutral-100">{userData.averageRating?.toFixed(1) || '0.0'}</span>
                                            <span className="text-xs font-bold text-slate-400">({userData.ratingCount})</span>
                                        </button>
                                    ) : null}
                                </div>

                                {/* Right Side: Bio */}
                                <div className="flex-1 min-w-0 pt-1">
                                    {userData?.bio ? (
                                        <div className="bg-white dark:bg-neutral-900/90 border border-slate-100 dark:border-neutral-800 p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-sm space-y-1.5 h-full min-h-[140px]">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 block">
                                                {language === 'de' ? 'Bio' : 'Bio'}
                                            </span>
                                            <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line break-words">
                                                {userData.bio}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50/50 dark:bg-neutral-900/40 border border-dashed border-slate-200 dark:border-neutral-800/80 p-4 sm:p-5 rounded-2xl sm:rounded-3xl text-left h-full min-h-[140px] flex flex-col justify-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500 block">
                                                {language === 'de' ? 'Bio' : 'Bio'}
                                            </span>
                                            <p className="text-xs text-slate-400 dark:text-neutral-500 italic">
                                                {language === 'de' ? 'Noch keine Bio vorhanden. Tippe auf "Profil bearbeiten", um eine hinzuzufügen.' : 'No bio added yet. Tap "Edit Profile" to add one.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stats - Asymmetric Pastel Tints */}
                            <div className="grid grid-cols-3 gap-3 sm:gap-4 w-full">
                                {[
                                    { label: language === 'de' ? 'Active' : 'Active', val: currentActivities.length, bg: 'bg-emerald-500/15' },
                                    { label: language === 'de' ? 'Friends' : 'Friends', val: userData?.friends?.length || 0, bg: 'bg-cyan-500/15' },
                                    { label: language === 'de' ? 'Reviews' : 'Reviews', val: userData?.ratingCount || 0, bg: 'bg-amber-500/15' }
                                ].map((stat, idx) => (
                                    <div key={stat.label} className={cn("flex flex-col items-center py-4 sm:py-5 px-2 sm:px-4 rounded-[1.75rem] border-none shadow-none", stat.bg)}>
                                        <span className={cn("text-2xl sm:text-3xl font-black leading-none mb-1",
                                            idx === 0 ? "text-[#10b981]" :
                                                idx === 1 ? "text-cyan-600" :
                                                    "text-amber-600"
                                        )}>{stat.val}</span>
                                        <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Compact Action Button */}
                            <Button
                                className="w-full sm:w-auto h-11 rounded-full font-black text-[12px] uppercase tracking-widest px-10 transition-all active:scale-95 shadow-lg shadow-primary/10 border-none"
                                onClick={() => router.push('/profile/edit')}
                            >
                                {language === 'de' ? 'Profil bearbeiten' : 'Edit Profile'}
                            </Button>

                        </div>

                        {/* Right Hero Column (Gamification / Level & XP & Referral) - 6 Cols on Desktop */}
                        <div className="lg:col-span-6 w-full flex flex-col gap-6">
                            {userData && (
                                <div className="w-full bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-850 rounded-[2.5rem] p-6 sm:p-8 shadow-sm flex flex-col gap-6">
                                    {/* Level info */}
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1 text-left">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <TrophyXpPopover language={language} align="start">
                                                    <Badge className={cn("text-white font-black px-3 py-1 rounded-full text-xs tracking-wider border-none hover:opacity-95 transition-all cursor-pointer shadow-sm", getLevelTierInfo(userData.level || 1).badgeBg)}>
                                                        LEVEL {userData.level || 1} • {getLevelTitle(userData.level || 1, language, userData.equippedTitle)}
                                                    </Badge>
                                                </TrophyXpPopover>
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                    {userData.level && userData.level >= 100 
                                                        ? (language === 'de' ? 'Maximales Level erreicht' : 'Max Level Reached') 
                                                        : (language === 'de' ? `${(LEVEL_THRESHOLDS[userData.level || 1] || LEVEL_THRESHOLDS[99]) - (userData.pointsLifetime || 0)} XP bis Level ${(userData.level || 1) + 1}` : `${(LEVEL_THRESHOLDS[userData.level || 1] || LEVEL_THRESHOLDS[99]) - (userData.pointsLifetime || 0)} XP to Level ${(userData.level || 1) + 1}`)}
                                                </span>
                                            </div>
                                            <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2 mt-1">
                                                {userData.pointsLifetime || 0} <span className="text-sm font-black uppercase text-slate-400 font-heading">{language === 'de' ? 'XP Gesamt' : 'Total XP'}</span>
                                            </h3>
                                        </div>
                                        <TrophyXpPopover language={language} align="end">
                                            <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100/80 dark:border-emerald-900/50 flex items-center justify-center text-emerald-500 font-black text-lg shrink-0 group-hover:bg-emerald-100/80 dark:group-hover:bg-emerald-900/60 group-hover:scale-105 transition-all shadow-sm">
                                                🏆
                                            </div>
                                        </TrophyXpPopover>
                                    </div>

                                    {/* Progress bar */}
                                    {userData.level && userData.level < 100 && (
                                        <div className="w-full space-y-2">
                                            <div className="w-full bg-slate-100 dark:bg-neutral-800 h-3.5 rounded-full overflow-hidden">
                                                <div 
                                                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                                    style={{ 
                                                        width: `${Math.max(0, Math.min(100, 
                                                            (((userData.pointsLifetime || 0) - LEVEL_THRESHOLDS[(userData.level || 1) - 1]) / 
                                                            ((LEVEL_THRESHOLDS[userData.level || 1] || LEVEL_THRESHOLDS[99]) - LEVEL_THRESHOLDS[(userData.level || 1) - 1])) * 100
                                                        ))}%` 
                                                    }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                                                <span>{LEVEL_THRESHOLDS[(userData.level || 1) - 1]} XP</span>
                                                <span>{LEVEL_THRESHOLDS[userData.level || 1] || LEVEL_THRESHOLDS[99]} XP</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Referral Section */}
                                    {userData.referralCode && (
                                        <div className="border-t border-slate-100 dark:border-neutral-800 pt-5 flex flex-col gap-3 text-left">
                                            <div className="space-y-1">
                                                <p className="text-xs font-black text-slate-800 dark:text-neutral-100">
                                                    {language === 'de' ? 'Freunde einladen' : 'Invite Friends'}
                                                </p>
                                                <p className="text-xs font-medium text-slate-500 dark:text-neutral-400">
                                                    {language === 'de' ? 'Lade Freunde zu Activa ein.' : 'Invite friends to Activa.'}
                                                </p>
                                            </div>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                                                <Button
                                                    onClick={async () => {
                                                        const res = await shareOrCopyReferralLink({
                                                            referralCode: userData.referralCode!,
                                                            language
                                                        });
                                                        if (res.action === 'copy') {
                                                            if (res.success) {
                                                                toast({
                                                                    title: language === 'de' ? "Einladungslink kopiert" : "Invite link copied",
                                                                });
                                                            } else {
                                                                toast({
                                                                    variant: 'destructive',
                                                                    title: language === 'de' ? "Kopieren fehlgeschlagen" : "Copy failed",
                                                                });
                                                            }
                                                        }
                                                    }}
                                                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl px-5 py-2.5 shadow-sm transition-all"
                                                >
                                                    <Share2 className="h-4 w-4" />
                                                    <span>{language === 'de' ? 'Freunde einladen' : 'Invite Friends'}</span>
                                                </Button>
                                                <span className="text-[11px] font-medium text-slate-400 dark:text-neutral-500">
                                                    {language === 'de' ? `Dein Einladungscode: ${userData.referralCode}` : `Your invite code: ${userData.referralCode}`}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Freundschaftsanfragen */}
                    {visibleRequestProfiles.length > 0 && (
                        <div className="w-full">
                            <div className="flex items-center gap-2 mb-3">
                                <h3 className="text-slate-800 dark:text-neutral-200 font-bold text-sm uppercase tracking-wider">
                                    {language === 'de' ? 'Freundschaftsanfragen' : 'Friend Requests'}
                                </h3>
                                <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                                    {visibleRequestProfiles.length}
                                </span>
                            </div>
                            <div className="space-y-3">
                                {visibleRequestProfiles.map((reqUser) => (
                                    <div key={reqUser.uid} className="flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-850 rounded-[2rem] shadow-sm">
                                        <Link href={`/users/${reqUser.uid}`} className="flex items-center gap-3 hover:opacity-85 transition-opacity">
                                            <ProfileAvatar 
                                                className="h-10 w-10"
                                                photoURL={reqUser.photoURL}
                                                displayName={reqUser.displayName}
                                                isPremium={reqUser.isPremium}
                                                isSupporter={reqUser.isSupporter}
                                                isCreator={reqUser.isCreator}
                                            />
                                            <div className="flex flex-col text-left">
                                                <span className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                                                    {formatFirstName(reqUser.displayName, 'User')}
                                                </span>
                                                {reqUser.username && (
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                        @{reqUser.username}
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => handleAcceptRequest(reqUser.uid)}
                                                className="h-8 rounded-full font-black text-[10px] uppercase tracking-wider px-4 bg-emerald-500 hover:bg-emerald-600 text-white border-none"
                                            >
                                                {language === 'de' ? 'Annehmen' : 'Accept'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDeclineRequest(reqUser.uid)}
                                                className="h-8 rounded-full font-black text-[10px] uppercase tracking-wider px-4 text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-850"
                                            >
                                                {language === 'de' ? 'Ablehnen' : 'Decline'}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Section: Freunde */}
                    <div className="w-full">
                        <FriendList friendIds={userData?.friends || []} />
                    </div>

                    {/* Main Tabs Navigation */}
                    <div className="w-full border-b border-slate-200/60 dark:border-neutral-800">
                        <nav className="flex justify-around lg:justify-start items-center gap-2 sm:gap-6 lg:gap-8">
                            <TabButton tabName="activities" label={language === 'de' ? 'Aktivitäten' : 'Activities'} />
                            <TabButton tabName="favorites" label={language === 'de' ? 'Favoriten' : 'Favorites'} />
                            <TabButton tabName="reviews" label={language === 'de' ? 'Bewertungen' : 'Reviews'} />
                        </nav>
                    </div>

                    {/* Tab Content Area */}
                    <div className="w-full min-w-0">
                        {activeTab === 'activities' && (
                            <div className="space-y-4">
                                {loadingActivities ? (
                                    <div className="space-y-4"><ActivityListItemSkeleton /><ActivityListItemSkeleton /></div>
                                ) : visibleActivities.length > 0 ? (
                                    <Tabs defaultValue="active" className="w-full">
                                        <TabsList className="flex gap-3 bg-transparent p-0 justify-center lg:justify-start mb-6">
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
                                            {currentActivities.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                                    {currentActivities.map(activity => (
                                                        <ProfileActivityCard key={activity.id} activity={activity} user={user} onJoin={handleJoin} compact={true} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center p-6 bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-[#E5E7EB]/50 dark:border-neutral-800 shadow-sm max-w-xl mx-auto lg:mx-0">
                                                    <p className="text-slate-400 font-bold leading-relaxed">{language === 'de' ? 'Uncharted territory. Start exploring nearby treasures.' : 'Uncharted territory. Start exploring nearby treasures.'}</p>
                                                </div>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="past" className="space-y-1 mt-0">
                                            {pastActivities.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                                    {pastActivities.map(activity => (
                                                        <div key={activity.id} className="opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all">
                                                            <ProfileActivityCard activity={activity} user={user} onJoin={handleJoin} compact={true} />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center p-6 bg-white dark:bg-neutral-900 rounded-[3rem] border border-slate-100 dark:border-neutral-800 shadow-sm max-w-xl mx-auto lg:mx-0">
                                                    <p className="text-slate-400 font-bold">{language === 'de' ? 'Keine vergangenen Aktivitäten.' : 'No past activities.'}</p>
                                                </div>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                ) : (
                                    <div className="text-center p-8 flex flex-col items-center justify-center gap-6 bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-[#E5E7EB]/50 dark:border-neutral-800 shadow-sm max-w-xl mx-auto">
                                        <div className="bg-primary/10 p-3 rounded-2xl">
                                            <Search className="h-6 w-6 text-primary" strokeWidth={2.5} />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{language === 'de' ? 'Start Exploring' : 'Start Exploring'}</h3>
                                            <p className="text-[11px] text-slate-500 dark:text-neutral-400 font-medium leading-relaxed max-w-[200px] mx-auto">{language === 'de' ? 'Uncharted territory. Start exploring nearby treasures.' : 'Uncharted territory. Start exploring nearby treasures.'}</p>
                                        </div>
                                        <Link href="/" className="w-full max-w-[200px]">
                                            <Button className="w-full h-10 rounded-full font-black tracking-tight text-[13px] shadow-none border-none">
                                                {language === 'de' ? 'Discover Places' : 'Discover Places'}
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'favorites' && (
                            <div>
                                {favorites.length === 0 ? (
                                    <div className="text-center p-8 flex flex-col items-center justify-center gap-6 bg-white dark:bg-neutral-900 rounded-[2rem] border border-[#E5E7EB]/50 dark:border-neutral-800 shadow-sm max-w-xl mx-auto">
                                        <div className="bg-primary/10 p-4 rounded-3xl"><Bookmark className="h-8 w-8 text-primary" strokeWidth={2.5} /></div>
                                        <div className="space-y-1 mb-1">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{language === 'de' ? 'Expand Your Network' : 'Expand Your Network'}</h3>
                                        </div>
                                        <Button onClick={() => router.push('/')} className="rounded-full h-11 px-8 font-black shadow-none border-none uppercase tracking-widest text-[10px]">
                                            {language === 'de' ? 'Discover Places' : 'Discover Places'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                                        {favorites.map(fav => {
                                            const live = placesMetaMap[fav.id];
                                            const favPlace = fav as Place;
                                            return (
                                                <PlaceCard 
                                                    key={fav.id} 
                                                    place={favPlace} 
                                                    compact={true}
                                                    onClick={() => handlePlaceSelect(favPlace)} 
                                                    onAddActivity={() => handleOpenActivityModal(favPlace)} 
                                                    upvotes={live ? live.upvotes : (favPlace.upvotes || 0)}
                                                    downvotes={live ? live.downvotes : (favPlace.downvotes || 0)}
                                                    userVote={live ? (user ? (live.userVotes?.[user.uid] || 'none') : 'none') : (user ? (favPlace.userVotes?.[user.uid] || 'none') : 'none')}
                                                    activityCount={live ? live.activityCount : ((favPlace as any).activityCount || 0)}
                                                    isFavorite={checkIsFavorite(fav.id)}
                                                    onVote={(type) => handleVotePlace(fav.id, type, favPlace)}
                                                    onBookmarkToggle={() => handleBookmarkTogglePlace(favPlace)}
                                                    role={userProfile?.role}
                                                    weightedUpvotes={live ? live.weightedUpvotes : (favPlace.upvotes || 0)}
                                                    weightedDownvotes={live ? live.weightedDownvotes : (favPlace.downvotes || 0)}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'reviews' && (
                            <div className="text-center p-12 bg-white dark:bg-neutral-900 rounded-[2rem] border border-[#E5E7EB]/50 dark:border-neutral-800 shadow-sm max-w-xl mx-auto">
                                <p className="text-slate-400 font-bold text-sm tracking-tight">{language === 'de' ? 'Reviews Coming Soon' : 'Reviews Coming Soon'}</p>
                            </div>
                        )}
                    </div>

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
            <Dialog open={isCropModalOpen} onOpenChange={(open) => {
                if (!open && !isUploading) {
                    setIsCropModalOpen(false);
                    setImageToCrop(null);
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                }
            }}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-slate-100 dark:border-neutral-800 shadow-2xl overflow-hidden">
                    <DialogHeader><DialogTitle className="text-xl font-black text-slate-900 dark:text-white">{language === 'de' ? 'Bild zuschneiden' : 'Crop Image'}</DialogTitle></DialogHeader>
                    <div className="relative h-64 w-full bg-slate-900 rounded-2xl overflow-hidden mt-4">
                        {imageToCrop && <Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />}
                    </div>
                    <DialogFooter className="mt-6 flex gap-2">
                        <Button variant="ghost" className="rounded-xl font-bold bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700" onClick={() => { 
                            setIsCropModalOpen(false); 
                            setImageToCrop(null); 
                            if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                            }
                        }} disabled={isUploading}>{language === 'de' ? 'Abbrechen' : 'Cancel'}</Button>
                        <Button onClick={handleSaveCroppedImage} className="bg-primary hover:opacity-90 text-white rounded-xl font-black flex-1" disabled={isUploading}>{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}{language === 'de' ? 'Bild speichern' : 'Save Image'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && setSelectedPlace(null)}>
                <DialogContent className="p-0 w-full max-w-4xl h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] sm:h-[88vh] sm:max-h-[88vh] flex flex-col min-h-0 gap-0 overflow-hidden border-none outline-none rounded-none sm:rounded-[2.5rem] dark:bg-neutral-900" hideCloseButton>
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

             {/* Modal für Avatar-Auswahl (Presets + Custom Upload Option) */}
             <Dialog open={isAvatarSelectionDialogOpen} onOpenChange={(open) => {
                 setIsAvatarSelectionDialogOpen(open);
                 if (!open) {
                     setShowRemoveConfirm(false);
                     setSelectedPresetUrl(null);
                     setIsSavingPreset(false);
                     setIsRemovingAvatar(false);
                 }
             }}>
                <DialogContent className="sm:max-w-[440px] w-full p-6 sm:p-7 rounded-[2.5rem] bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-slate-900 dark:text-white shadow-2xl overflow-hidden">
                    {showRemoveConfirm ? (
                        <>
                            <DialogHeader className="text-center flex flex-col items-center gap-1 mb-4 pr-10">
                                <DialogTitle className="text-xl font-black text-rose-600 dark:text-rose-500">
                                    {language === 'de' ? 'Avatar entfernen?' : 'Remove Avatar?'}
                                </DialogTitle>
                                <DialogDescription className="font-medium text-xs text-slate-500 dark:text-neutral-400">
                                    {language === 'de' 
                                        ? 'Möchtest du deinen Avatar wirklich entfernen?' 
                                        : 'Are you sure you want to remove your avatar?'}
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="mt-6 flex justify-end gap-3">
                                <Button 
                                    variant="ghost" 
                                    className="h-11 px-5 rounded-2xl font-bold text-xs bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors" 
                                    onClick={() => setShowRemoveConfirm(false)}
                                    disabled={isRemovingAvatar}
                                >
                                    {language === 'de' ? 'Abbrechen' : 'Cancel'}
                                </Button>
                                <Button 
                                    onClick={handleRemoveAvatar} 
                                    className="h-11 px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs flex-1 shadow-lg shadow-rose-600/20"
                                    disabled={isRemovingAvatar}
                                >
                                    {isRemovingAvatar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {language === 'de' ? 'Avatar entfernen' : 'Remove avatar'}
                                </Button>
                            </DialogFooter>
                        </>
                    ) : (
                        <>
                            <DialogHeader className="text-center flex flex-col items-center gap-1 mb-4 pr-10 sm:pr-12">
                                <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                    {language === 'de' ? 'Avatar ändern' : 'Change Avatar'}
                                </DialogTitle>
                                <DialogDescription className="text-xs font-medium text-slate-500 dark:text-neutral-400 max-w-[280px] leading-relaxed">
                                    {language === 'de' ? 'Wähle einen vorgefertigten Avatar oder lade ein eigenes Bild hoch.' : 'Choose a preset avatar or upload your own image.'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex justify-center my-3">
                                <img 
                                    src={selectedPresetUrl ?? userData?.photoURL ?? ''} 
                                    alt="Avatar preview" 
                                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-slate-100 dark:border-neutral-800 object-cover shadow-md" 
                                />
                            </div>

                            {userData?.photoURL && (
                                <div className="my-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowRemoveConfirm(true)}
                                        className="w-full h-10 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                                    >
                                        {language === 'de' ? 'Avatar entfernen' : 'Remove avatar'}
                                    </Button>
                                </div>
                            )}

                            {/* Presets Grid */}
                            <div className="space-y-2.5 my-3">
                                <p className="text-[10px] font-black text-slate-400 dark:text-neutral-400 uppercase tracking-widest text-left">
                                    {language === 'de' ? 'Vorgefertigten Avatar wählen:' : 'Choose preset avatar:'}
                                </p>
                                <div className="grid grid-cols-4 gap-3 justify-items-center">
                                    {DEFAULT_AVATARS.map((avatar) => {
                                        const isSelected = selectedPresetUrl === avatar.url;
                                        return (
                                            <button
                                                key={avatar.id}
                                                type="button"
                                                onClick={() => setSelectedPresetUrl(avatar.url)}
                                                className={cn(
                                                    "w-14 h-14 rounded-full overflow-hidden border-2 border-transparent bg-slate-100 dark:bg-neutral-800 transition-all hover:scale-105 active:scale-95 focus:outline-none relative shadow-sm",
                                                    isSelected && "border-primary ring-4 ring-primary/20 dark:ring-primary/30 scale-105"
                                                )}
                                            >
                                                <img src={avatar.url} alt={avatar.label} className="w-full h-full object-cover rounded-full" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom Upload Option */}
                            <div className="my-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleTriggerCustomUpload}
                                    className="w-full h-11 border border-dashed border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 bg-slate-50 dark:bg-neutral-800/60 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all"
                                >
                                    <Camera className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
                                    {language === 'de' ? 'Eigenes Bild hochladen' : 'Upload own image'}
                                </Button>
                            </div>

                            {/* Footer Buttons */}
                            <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-end gap-3">
                                <Button 
                                    variant="ghost" 
                                    className="h-11 px-5 rounded-2xl font-bold text-xs text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors" 
                                    onClick={() => {
                                        setIsAvatarSelectionDialogOpen(false);
                                        setSelectedPresetUrl(null);
                                    }}
                                    disabled={isSavingPreset}
                                >
                                    {language === 'de' ? 'Abbrechen' : 'Cancel'}
                                </Button>
                                <Button 
                                    onClick={handleSavePresetAvatar} 
                                    className="h-11 px-6 rounded-2xl font-black text-xs text-primary-foreground bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                                    disabled={!selectedPresetUrl || isSavingPreset}
                                >
                                    {isSavingPreset ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                                    {language === 'de' ? 'Speichern' : 'Save'}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Title & Frame Customization Dialog */}
            <Dialog open={isCustomizeDialogOpen} onOpenChange={setIsCustomizeDialogOpen}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] h-auto flex flex-col bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-6 sm:p-7 shadow-2xl overflow-hidden dark">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-2 shrink-0">
                        <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                            <Settings className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
                                {language === 'de' ? 'Titel & Rahmen anpassen' : 'Customize Title & Frame'}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-neutral-400 font-medium">
                                {language === 'de' 
                                    ? 'Personalisieren Sie Ihren Rang-Titel und Rahmen auf Aktiva.' 
                                    : 'Personalize your rank title and frame on Aktiva.'}
                            </DialogDescription>
                        </div>
                    </div>

                    {/* Scrollable Middle Body (Live Preview + Title & Border Selectors) */}
                    <div className="flex-1 overflow-y-auto min-h-0 py-1 pr-2 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-700/70 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-600">
                        {/* Live Preview Stage */}
                        <div className="flex flex-col items-center justify-center p-5 bg-gradient-to-b from-neutral-850 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-[2rem] relative overflow-hidden shadow-inner my-1">
                            <div className="absolute inset-0 bg-emerald-500/5 blur-2xl pointer-events-none" />
                            <ProfileAvatar 
                                className="h-24 w-24 sm:h-28 sm:w-28 shadow-2xl relative z-10 transition-all duration-300"
                                photoURL={photoUrlToDisplay}
                                displayName={displayName}
                                isPremium={userData?.isPremium}
                                isCreator={userData?.isCreator}
                                isSupporter={userData?.isSupporter}
                                level={userData?.level || 1}
                                equippedBorder={selectedBorder}
                                showLevelBadge={true}
                            />
                            <Badge className={cn("text-white font-black px-4 py-1.5 rounded-full text-xs tracking-wider border-none shadow-md transition-all duration-300 mt-3 relative z-10", getLevelTierInfo(userData?.level || 1).badgeBg)}>
                                LEVEL {userData?.level || 1} • {getLevelTitle(userData?.level || 1, language, selectedTitle)}
                            </Badge>
                        </div>

                        {/* Title Selector */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest px-1 block">
                                {language === 'de' ? 'Angezeigter Rang-Titel' : 'Displayed Rank Title'}
                            </label>
                            <div className="space-y-2">
                                {getUnlockedTitles(userData?.level || 1).map((t) => {
                                    const isSelected = selectedTitle === t.id;
                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setSelectedTitle(t.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs font-bold transition-all text-left cursor-pointer group",
                                                isSelected
                                                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.12)]"
                                                    : "border-neutral-800 bg-neutral-850/50 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn("h-7 w-7 rounded-xl flex items-center justify-center text-xs font-black transition-colors shrink-0", isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-neutral-800 text-neutral-400 group-hover:text-neutral-200")}>
                                                    {t.minLevel === 1 ? '✦' : `L${t.minLevel}`}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-white">{language === 'de' ? t.titleDe : t.titleEn}</span>
                                                    <span className="text-[10px] font-semibold text-neutral-400">
                                                        {t.id === 'default' 
                                                            ? (language === 'de' ? 'Basiert auf aktuellem Level' : 'Based on current level')
                                                            : (language === 'de' ? `Freigeschaltet ab Level ${t.minLevel}` : `Unlocked at Level ${t.minLevel}`)}
                                                    </span>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-sm shrink-0">
                                                    <Check className="h-3 w-3 stroke-[3]" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Border Selector */}
                        <div className="space-y-2 pt-1">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-widest px-1 block">
                                {language === 'de' ? 'Avatarrand / Frame' : 'Avatar Frame'}
                            </label>
                            <div className="space-y-2">
                                {getUnlockedBorders(userData?.level || 1, userData?.isPremium).map((b) => {
                                    const isSelected = selectedBorder === b.id;
                                    return (
                                        <button
                                            key={b.id}
                                            type="button"
                                            onClick={() => setSelectedBorder(b.id)}
                                            className={cn(
                                                "w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs font-bold transition-all text-left cursor-pointer group",
                                                isSelected
                                                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.12)]"
                                                    : "border-neutral-800 bg-neutral-850/50 text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn("h-7 w-7 rounded-full p-[2.5px] shrink-0 border border-white/20 shadow-md", b.gradient || "bg-slate-400")}>
                                                    <div className="w-full h-full rounded-full bg-neutral-900" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-sm text-white flex items-center gap-2">
                                                        {language === 'de' ? b.nameDe : b.nameEn}
                                                        {b.isPremiumOnly && (
                                                            <span className="bg-amber-500/20 text-amber-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-amber-500/30">
                                                                Premium
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-[10px] font-semibold text-neutral-400">
                                                        {b.id === 'default' 
                                                            ? (language === 'de' ? 'Basiert auf aktuellem Level' : 'Based on current level')
                                                            : b.isPremiumOnly
                                                                ? (language === 'de' ? 'Exklusiver Premium-Glow' : 'Exclusive Premium Glow')
                                                                : (language === 'de' ? `Freigeschaltet ab Level ${b.minLevel}` : `Unlocked at Level ${b.minLevel}`)}
                                                    </span>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-sm shrink-0">
                                                    <Check className="h-3 w-3 stroke-[3]" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Fixed Footer Actions */}
                    <DialogFooter className="gap-2 sm:gap-0 pt-4 mt-3 border-t border-neutral-800 shrink-0 flex flex-row items-center justify-end bg-neutral-900">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsCustomizeDialogOpen(false)}
                            className="rounded-full font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 h-11 px-6 text-xs uppercase tracking-wider"
                        >
                            {language === 'de' ? 'Abbrechen' : 'Cancel'}
                        </Button>
                        <Button 
                            onClick={handleSaveCustomization}
                            disabled={isSavingCustomization}
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black rounded-full h-11 px-8 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all border-none text-xs uppercase tracking-wider"
                        >
                            {isSavingCustomization && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            {language === 'de' ? 'Speichern' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

const ActivityListItemSkeleton = () => (
    <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 shadow-sm flex items-center gap-4"><Skeleton className="h-16 w-16 rounded-2xl shrink-0" /><div className="flex-1 space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div><Skeleton className="h-10 w-10 rounded-xl" /></div>
);
