'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { joinActivity, cancelActivity, leaveActivity, getPublicProfileClient } from '@/lib/firebase/firestore';
import type { Activity, Place } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, Users, Calendar, MapPin, Share2, Crown, Star, MessageSquare, CreditCard, Camera, Ban, AlertTriangle, Clock, Flame, Heart, ShieldCheck, UserCircle, HelpCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import { UserBadge } from '@/components/common/UserBadge';
import { TicketQR } from '@/components/ticket-qr';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn, formatLabel, formatFirstName } from '@/lib/utils';
import Link from 'next/link';

interface ActivityDetailClientProps {
  activityId: string;
}

const isValidCoordinate = (lat: any, lng: any) => {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

export default function ActivityDetailClient({ activityId }: ActivityDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralId = searchParams.get('ref');
  const { user, userProfile, loading: authLoading } = useAuth();
  const language = useLanguage();
  const { toast } = useToast();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [hostProfile, setHostProfile] = useState<any>(null);
  const [hostError, setHostError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Authentication and onboarding guards
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/login?redirect=/activities/${activityId}`);
      return;
    }
    if (userProfile && !userProfile.onboardingCompleted) {
      router.push('/onboarding');
      return;
    }
  }, [user, userProfile, authLoading, activityId, router]);

  useEffect(() => {
    if (!activityId || !db) return;

    let placeUnsubscribe: () => void;

    const unsubscribe = onSnapshot(doc(db!, 'activities', activityId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Activity;
        setActivity(data);
        
        // Listener für den zugehörigen Ort (für Opening Hours etc.)
        if (data.placeId && data.placeId !== 'custom') {
          if (!placeUnsubscribe) {
            placeUnsubscribe = onSnapshot(doc(db!, 'places', data.placeId), (pSnap) => {
              if (pSnap.exists()) {
                setPlace({ id: pSnap.id, ...pSnap.data() } as Place);
              }
            }, (err) => {
              console.error("Error subscribing to place:", err);
            });
          }
        }

        // Load host profile via secure Cloud Function wrapper
        if (data.hostId && !hostProfile && !hostError) {
          getPublicProfileClient(data.hostId).then((profile) => {
            if (profile) {
              setHostProfile(profile);
            }
          }).catch((err) => {
            console.error("Error fetching host profile:", err);
            setHostError(true);
          });
        }
      } else {
        setActivity(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error subscribing to activity:", err);
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: language === 'de' ? 'Fehler beim Laden der Aktivität.' : 'Error loading activity.'
      });
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (placeUnsubscribe) placeUnsubscribe();
    };
  }, [activityId, language, toast, hostProfile, hostError]);

  const handleJoin = async () => {
    if (!user) {
      router.push(`/login?redirect=/activities/${activityId}`);
      return;
    }

    if (!activity) return;

    if (activity.isPaid) {
      router.push(`/checkout/${activity.id}?ref=${referralId || ''}`);
      return;
    }

    if (isJoining) return;
    setIsJoining(true);
    try {
      const status = await joinActivity(activity.id!, user, null, referralId);
      if (status === 'joined') {
        toast({ 
          title: language === 'de' ? "Willkommen!" : "Welcome!", 
          description: language === 'de' ? "Du bist der Aktivität beigetreten." : "You have joined the activity." 
        });
        router.push(`/chat/${activity.id}`);
      } else {
        toast({ title: language === 'de' ? 'Anfrage gesendet!' : 'Request sent!', description: language === 'de' ? 'Der Host wird benachrichtigt.' : 'The host will be notified.' });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: error.message });
    } finally {
      setIsJoining(false);
    }
  };

  const handleCancel = async () => {
    if (!activity?.id || !user) return;
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelActivity(activity.id, user.uid);
      toast({ 
        title: language === 'de' ? "Aktivität storniert" : "Activity cancelled", 
        description: language === 'de' ? "Alle Teilnehmer wurden über die Stornierung informiert." : "All participants have been notified of the cancellation." 
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: language === 'de' ? "Fehler" : "Error", description: error.message });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleLeave = async () => {
    if (!activity?.id || !user) return;
    if (isLeaving) return;
    setIsLeaving(true);
    try {
      await leaveActivity(activity.id, user.uid);
      toast({ 
        title: language === 'de' ? "Aktivität verlassen" : "Left activity", 
        description: language === 'de' ? "Du hast dich erfolgreich abgemeldet." : "You have successfully signed out." 
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: language === 'de' ? "Fehler" : "Error", description: error.message });
    } finally {
      setIsLeaving(false);
    }
  };

  const handleShare = async () => {
    if (!activity) return;
    const shareUrl = `${window.location.origin}/activities/${activity.id}?ref=${user?.uid || 'guest'}`;
    const shareTitle = language === 'de' 
      ? `Treffen bei ${activity.placeName}`
      : `Meeting at ${activity.placeName}`;
    const shareText = language === 'de'
      ? `Komm vorbei zum Event in der Kategorie ${activity.category || 'Sonstiges'} bei ${activity.placeName}!`
      : `Join me for ${activity.category || 'this event'} at ${activity.placeName}!`;

    const shareData = {
      title: shareTitle,
      text: shareText,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error(err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: language === 'de' ? "Link kopiert!" : "Link copied!" });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold mb-2">{language === 'de' ? 'Aktivität nicht gefunden' : 'Activity Not Found'}</h1>
        <p className="text-slate-500 mb-6">{language === 'de' ? 'Diese Aktivität existiert nicht mehr oder ist privat.' : 'This activity no longer exists or is private.'}</p>
        <Button onClick={() => router.push('/')} className="rounded-2xl h-12 px-8 font-black">{language === 'de' ? 'Zurück zum Feed' : 'Back to Feed'}</Button>
      </div>
    );
  }

  // Blocklist and Privacy checks (Client-side)
  const isHostBlacklisted = userProfile?.blacklist?.hard?.includes(activity.hostId) || 
                            userProfile?.blacklist?.soft?.includes(activity.hostId);
  const isHidden = userProfile?.hiddenEntityIds?.includes(activity.id || '');
  const isGlobalBlacklisted = activity.status === 'blacklisted';
  const isNotAccessible = isHostBlacklisted || isHidden || isGlobalBlacklisted;

  if (isNotAccessible) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold mb-2">{language === 'de' ? 'Aktivität nicht verfügbar' : 'Activity Not Available'}</h1>
        <p className="text-slate-500 mb-6">{language === 'de' ? 'Diese Aktivität ist nicht mehr verfügbar.' : 'This activity is no longer available.'}</p>
        <Button onClick={() => router.push('/')} className="rounded-2xl h-12 px-8 font-black">{language === 'de' ? 'Zurück zum Feed' : 'Back to Feed'}</Button>
      </div>
    );
  }

  const isParticipant = user ? activity.participantIds.includes(user.uid) : false;
  const isHost = user && activity.hostId === user.uid;
  const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;
  const checkInStatus = user ? activity.participantDetails?.[user.uid]?.checkInStatus : 'pending';
  const isCancelled = activity.status === 'cancelled';
  const isCompleted = activity.status === 'completed';
  const isActive = activity.status === 'active';
  
  const dateObj = activity.activityDate && typeof activity.activityDate.toDate === 'function'
    ? activity.activityDate.toDate()
    : null;
  const isPast = dateObj ? dateObj.getTime() < Date.now() : false;
  const isClosed = isCancelled || isCompleted || isPast;

  // Formatierung der Opening Hours
  const openingHours = place?.openingHours || activity.participantDetails?.[activity.hostId]?.isCreator ? 'Datenabfrage läuft...' : null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-y-auto">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between px-4 bg-white/80 border-b border-slate-100 backdrop-blur-md">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()} 
          className="rounded-full"
          aria-label={language === 'de' ? 'Zurück' : 'Back'}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center font-bold text-slate-800">{language === 'de' ? 'Community Event' : 'Community Event'}</div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleShare} 
          className="rounded-full"
          aria-label={language === 'de' ? 'Teilen' : 'Share'}
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </header>

      <main className="flex-1 p-4 sm:p-8 max-w-2xl mx-auto w-full space-y-4 pb-24">
        {/* Status Indicator */}
        {isCancelled && (
          <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[2rem] flex flex-col items-center text-center gap-2 animate-in slide-in-from-top-4 duration-500">
            <Ban className="h-10 w-10 text-red-500" />
            <div>
              <h3 className="text-lg font-black text-red-900 uppercase">{language === 'de' ? 'Aktivität Storniert' : 'Activity Cancelled'}</h3>
              <p className="text-sm font-medium text-red-700/70">{language === 'de' ? 'Dieses Event findet nicht statt. Falls du ein Ticket gekauft hast, wird der Betrag automatisch rückerstattet.' : 'This event will not take place. If you bought a ticket, the amount will be automatically refunded.'}</p>
            </div>
          </div>
        )}


        {/* Featured Hero Card */}
        <div className={cn(
          "rounded-[2rem] p-6 relative overflow-hidden transition-all duration-1000 border-none shadow-xl shadow-slate-200/50 bg-white text-slate-900",
          isCancelled ? "opacity-40 grayscale blur-[1px]" : "",
          activity.isBoosted && !isCancelled ? "ring-4 ring-orange-500/10 shadow-orange-500/20 bg-orange-50/10" : ""
        )}>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {language === 'de' ? 'Aktivität Details' : 'Activity Details'}
              </span>
              {activity.isBoosted && (
                <div className="bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
                  <Flame className="w-3 h-3 text-white animate-pulse"/>
                  <span className="text-[9px] font-black uppercase text-white">Highlight</span>
                </div>
              )}
            </div>
            
            <h1 className="text-2xl font-black mb-2 leading-tight text-slate-900">
              {formatLabel(activity.category || (language === 'de' ? 'Aktivität' : 'Activity'))}
            </h1>
            
            <div className="text-slate-700 font-bold mb-1 flex items-center gap-1.5 text-sm">
              <MapPin className="h-4 w-4 text-primary shrink-0" /> 
              <span>{activity.placeName}</span>
            </div>
            {activity.placeAddress && (
              <p className="text-slate-400 font-medium mb-4 text-xs pl-5.5 truncate">
                {activity.placeAddress}
              </p>
            )}

            {activity.description && (
              <div className="bg-primary/5 rounded-xl p-3 mb-4 border-l-2 border-primary/30">
                <p className="text-xs text-slate-600 font-medium italic leading-relaxed">"{activity.description}"</p>
              </div>
            )}
            
            <div className="flex items-center gap-3">
              <div className="bg-slate-50 rounded-xl p-2.5 flex-1 flex items-center gap-2 border border-slate-100">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[8px] font-bold uppercase text-slate-400 leading-none mb-0.5">{language === 'de' ? 'Datum' : 'Date'}</p>
                  <p className="text-xs font-black text-slate-800 leading-none">{format(activity.activityDate.toDate(), 'eee, d. MMM', { locale: language === 'de' ? de : enUS })}</p>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5 flex-1 flex items-center gap-2 border border-slate-100">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="text-[8px] font-bold uppercase text-slate-400 leading-none mb-0.5">{language === 'de' ? 'Zeit' : 'Time'}</p>
                  <p className="text-xs font-black text-slate-800 leading-none">{activity.isTimeFlexible ? (language === 'de' ? 'Flexibel' : 'Flexible') : format(activity.activityDate.toDate(), 'HH:mm')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Opening Hours Info Section */}
        {place?.openingHours && (
          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="h-4 w-4" />
                <CardTitle className="">{language === 'de' ? 'Betriebszeiten des Ortes' : 'Opening Hours of the Place'}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-sm font-bold text-slate-700 leading-relaxed">
                  {place.openingHours.split(';').map((segment, idx) => (
                    <span key={idx} className="block">{segment.trim()}</span>
                  ))}
                </p>
                <p className="text-[9px] font-medium text-slate-400 mt-3 uppercase tracking-tighter italic">
                  {language === 'de' ? '* Angaben ohne Gewähr. Daten stammen von OpenStreetMap via Geoapify.' : '* Information subject to change. Data from OpenStreetMap via Geoapify.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Host Info */}
        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar 
                  className="h-12 w-12 border-2 border-slate-100"
                  isPremium={activity.participantDetails?.[activity.hostId]?.isPremium}
                  isCreator={activity.participantDetails?.[activity.hostId]?.isCreator}
                  isSupporter={activity.participantDetails?.[activity.hostId]?.isSupporter}
                >
                  <AvatarImage src={activity.hostPhotoURL || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-black">{activity.hostName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1">
                    <p className="font-black text-slate-900 text-sm leading-none">{formatFirstName(activity.hostName, 'Host')}</p>
                    <UserBadge isPremium={activity.participantDetails?.[activity.hostId]?.isPremium} size="sm" />
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 leading-none">{language === 'de' ? 'Veranstalter' : 'Host'}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push(`/users/${activity.hostId}`)} className="rounded-xl font-bold h-8 text-xs">{language === 'de' ? 'Profil' : 'Profile'}</Button>
            </div>
          </CardContent>
        </Card>

        {/* Participants & Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-4 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-xl font-black text-slate-900 leading-none">{activity.participantIds.length} / {activity.maxParticipants || '∞'}</p>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">{language === 'de' ? 'Teilnehmer' : 'Participants'}</p>
          </Card>
          <Card className="border-none shadow-sm rounded-3xl bg-white p-4 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <p className="text-xl font-black text-slate-900 leading-none">{hostProfile?.averageRating?.toFixed(1) || '0.0'}</p>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase">{language === 'de' ? `Host Bewertung (${hostProfile?.ratingCount || 0})` : `Host Rating (${hostProfile?.ratingCount || 0})`}</p>
          </Card>
        </div>

        {/* Participants List Section */}
        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-slate-400">
              <Users className="h-4 w-4" />
              <CardTitle className="text-base font-black text-slate-850 dark:text-neutral-200">
                {language === 'de' ? 'Teilnehmerliste' : 'Participants'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <ul className="space-y-3">
              {activity.participantIds.map((uid) => {
                const details = activity.participantDetails?.[uid];
                const displayName = details?.displayName || (uid === activity.hostId ? activity.hostName : null) || (language === 'de' ? 'Entdecker' : 'Explorer');
                const photoURL = details?.photoURL || (uid === activity.hostId ? activity.hostPhotoURL : null);
                const isHostUser = uid === activity.hostId;
                
                return (
                  <li key={uid} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-none">
                    <div className="flex items-center gap-2.5">
                      <Avatar 
                        className="h-8 w-8 border border-slate-100"
                        isPremium={details?.isPremium}
                        isCreator={details?.isCreator}
                        isSupporter={details?.isSupporter}
                      >
                        <AvatarImage src={photoURL || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                          {displayName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-850 dark:text-neutral-200">
                            {formatFirstName(displayName, 'User')}
                          </span>
                          <UserBadge isPremium={details?.isPremium} size="sm" />
                          {isHostUser && (
                            <Badge variant="secondary" className="px-1.5 py-0 text-[8px] font-black uppercase bg-amber-50 text-amber-600 border-none leading-none">
                              Host
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {user?.uid !== uid && (
                      <Button asChild variant="ghost" size="sm" className="h-7 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-900">
                        <Link href={`/users/${uid}`}>
                          {language === 'de' ? 'Profil' : 'Profile'}
                        </Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Map & Navigation Section */}
        {isValidCoordinate(activity.lat, activity.lon) && (
          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="h-4 w-4" />
                <CardTitle className="text-base font-black text-slate-850 dark:text-neutral-200">
                  {language === 'de' ? 'Karten-Pin & Navigation' : 'Map Pin & Navigation'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <div className="bg-slate-50 dark:bg-neutral-900 rounded-2xl p-4 border border-slate-100 dark:border-neutral-800 flex flex-col gap-3">
                <div className="text-xs font-bold text-slate-800 dark:text-neutral-200">
                  {activity.placeName}
                </div>
                {activity.placeAddress && (
                  <div className="text-xs text-slate-500">
                    {activity.placeAddress}
                  </div>
                )}
                <Button 
                  asChild
                  variant="outline" 
                  className="w-full rounded-xl font-bold h-10 text-xs border-primary/20 hover:bg-primary/5 text-primary gap-1.5"
                >
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${activity.lat},${activity.lon}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    aria-label={language === 'de' ? 'Ort auf Google Maps anzeigen' : 'Show location on Google Maps'}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {language === 'de' ? 'In Google Maps öffnen' : 'Open in Google Maps'}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Join Criteria / Kriterien */}
        {activity.requirements && (
          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="h-4 w-4" />
                <CardTitle className="text-base font-black text-slate-800 dark:text-neutral-200">
                  {language === 'de' ? 'Kriterien zum Beitreten' : 'Join Criteria'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <div className="bg-slate-50 dark:bg-neutral-900 rounded-2xl p-4 border border-slate-100 dark:border-neutral-800 space-y-3">
                {/* Join Mode */}
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      {language === 'de' ? 'Beitrittsmethode' : 'Join Method'}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                      {activity.joinMode === 'request'
                        ? (language === 'de' ? 'Anfrage erforderlich' : 'Request required')
                        : (language === 'de' ? 'Direkter Beitritt' : 'Direct join')}
                    </span>
                  </div>
                </div>

                {/* Rating Requirement */}
                {activity.requirements.minimumRating !== undefined && (
                  <div className="flex items-start gap-3">
                    <Star className="h-4 w-4 mt-0.5 text-amber-500 fill-amber-500 shrink-0" />
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        {language === 'de' ? 'Mindestbewertung' : 'Minimum Rating'}
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                        {activity.requirements.minimumRating.toFixed(1)} {language === 'de' ? 'Sterne' : 'Stars'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Age Requirement */}
                {(activity.requirements.ageRange?.min !== undefined || activity.requirements.ageRange?.max !== undefined) && (
                  <div className="flex items-start gap-3">
                    <Users className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        {language === 'de' ? 'Altersbereich' : 'Age Range'}
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                        {activity.requirements.ageRange.min !== undefined && activity.requirements.ageRange.max !== undefined
                          ? `${activity.requirements.ageRange.min} - ${activity.requirements.ageRange.max} ${language === 'de' ? 'Jahre' : 'years'}`
                          : activity.requirements.ageRange.min !== undefined
                          ? `ab ${activity.requirements.ageRange.min} ${language === 'de' ? 'Jahren' : 'years'}`
                          : `bis ${activity.requirements.ageRange.max} ${language === 'de' ? 'Jahren' : 'years'}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Gender Requirement */}
                {activity.requirements.gender && activity.requirements.gender.length > 0 && (
                  <div className="flex items-start gap-3">
                    <UserCircle className="h-4 w-4 mt-0.5 text-purple-500 shrink-0" />
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        {language === 'de' ? 'Zugelassene Geschlechter' : 'Allowed Genders'}
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                        {activity.requirements.gender.map(g => {
                          const labels: Record<string, string> = {
                            male: language === 'de' ? 'Männer' : 'Men',
                            female: language === 'de' ? 'Frauen' : 'Women',
                            other: language === 'de' ? 'Diverse' : 'Other'
                          };
                          return labels[g] || g;
                        }).join(', ')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Profile Picture Requirement */}
                {activity.requirements.requireProfilePicture && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        {language === 'de' ? 'Profilbild' : 'Profile Picture'}
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                        {language === 'de' ? 'Profilbild ist erforderlich' : 'Profile picture is required'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Verification Requirement */}
                {activity.requirements.requireVerification && (
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        {language === 'de' ? 'Verifizierung' : 'Verification'}
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                        {language === 'de' ? 'Verifiziertes Profil (KYC) ist erforderlich' : 'Verified profile (KYC) is required'}
                      </span>
                    </div>
                  </div>
                )}

                {/* No requirements fallback */}
                {!activity.requirements.minimumRating &&
                  !activity.requirements.ageRange?.min &&
                  !activity.requirements.ageRange?.max &&
                  (!activity.requirements.gender || activity.requirements.gender.length === 0) &&
                  !activity.requirements.requireProfilePicture &&
                  !activity.requirements.requireVerification && (
                    <div className="flex items-center gap-3 text-slate-400 py-1">
                      <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="text-xs font-black">
                        {language === 'de' ? 'Keine Einschränkungen zum Beitreten' : 'No requirements to join'}
                      </span>
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Participant Ticket Section */}
        {isParticipant && !isCancelled && (
          <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden text-center p-6">
            <CardHeader className="pb-3 p-0">
              <CardTitle className="text-xl">{language === 'de' ? 'Dein Ticket' : 'Your Ticket'}</CardTitle>
              <CardDescription className="font-medium text-xs">{language === 'de' ? 'Zeige diesen Code beim Einlass vor.' : 'Show this code at the entrance.'}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center p-0 pt-4">
              <div className={cn("transition-opacity duration-500 max-w-[180px] w-full mx-auto", checkInStatus === 'scanned' && "opacity-20 grayscale")}>
                <TicketQR activityId={activityId} userId={user!.uid} />
              </div>
              
              {checkInStatus === 'scanned' && (
                <div className="mt-3 flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 animate-in fade-in zoom-in-95">
                  <Star className="h-3.5 w-3.5 fill-emerald-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{language === 'de' ? 'Eingetreten & Verifiziert' : 'Entered & Verified'}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Host Control Section */}
        {isHost && isActive && (
          <Card className="border border-primary/10 shadow-sm shadow-primary/5 rounded-[2rem] bg-white overflow-hidden">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-primary leading-tight">Host Panel</span>
                  <p className="font-bold text-sm leading-tight text-slate-900">Ticketing & Einlass</p>
                </div>
                <Button asChild size="sm" className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white gap-1.5 h-8">
                  <Link href={`/activities/${activity.id}/scanner`}>
                    <Camera className="h-3.5 w-3.5" />
                    {language === 'de' ? 'Scanner' : 'Scanner'}
                  </Link>
                </Button>
              </div>
              
              <div className="pt-3 border-t border-slate-100">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg font-bold gap-1.5 h-8">
                      <Ban className="h-3.5 w-3.5" />
                      {language === 'de' ? 'Aktivität stornieren' : 'Cancel activity'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl">
                    <AlertDialogHeader>
                      <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-3">
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                      </div>
                      <AlertDialogTitle className="text-xl font-black text-center">{language === 'de' ? 'Unwiderruflich stornieren?' : 'Cancel irrevocably?'}</AlertDialogTitle>
                      <AlertDialogDescription className="text-center text-sm font-medium">
                        {language === 'de' ? 'Dies kann nicht rückgängig gemacht werden.' : 'This cannot be undone.'} {activity.isPaid && (language === 'de' ? "Alle bezahlten Tickets werden automatisch zur Rückerstattung vorgemerkt und dein Treuhand-Guthaben wird entsprechend reduziert." : "All paid tickets will be automatically marked for refund and your escrow balance will be reduced accordingly.")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col gap-2 sm:gap-0 mt-4">
                      <AlertDialogCancel className="rounded-xl font-bold h-10">{language === 'de' ? 'Abbrechen' : 'Cancel'}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancel} disabled={isCancelling} className="rounded-xl font-black h-10 bg-red-500 hover:bg-red-600 shadow-lg shadow-red-100">
                        {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === 'de' ? "Ja, Stornieren" : "Yes, Cancel")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Button */}
        {!isCancelled && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 z-nav elevation-mid">
            <div className="max-w-md mx-auto">
              {isParticipant ? (
                <div className="flex gap-2 w-full">
                  <Button 
                    onClick={() => router.push(`/chat/${activity.id}`)} 
                    className="flex-1 h-14 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20"
                  >
                    <MessageSquare className="mr-2 h-5 w-5" />
                    {language === 'de' ? 'Zum Gruppenchat' : 'To Group Chat'}
                  </Button>
                  {!isHost && !isClosed && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="h-14 px-4 rounded-2xl font-bold border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                          title={language === 'de' ? 'Aktivität verlassen' : 'Leave activity'}
                        >
                          <Ban className="h-5 w-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-black text-center">
                            {language === 'de' ? 'Aktivität verlassen?' : 'Leave activity?'}
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-center text-sm font-medium">
                            {language === 'de' 
                              ? 'Möchtest du dich wirklich von dieser Aktivität abmelden?' 
                              : 'Do you really want to sign out from this activity?'}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex flex-col gap-2 sm:gap-0 mt-4">
                          <AlertDialogCancel className="rounded-xl font-bold h-10">
                            {language === 'de' ? 'Abbrechen' : 'Cancel'}
                          </AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleLeave} 
                            disabled={isLeaving} 
                            className="rounded-xl font-black h-10 bg-red-500 hover:bg-red-600 shadow-lg shadow-red-100"
                          >
                            {isLeaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === 'de' ? 'Ja, verlassen' : 'Yes, leave')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ) : (
                <Button 
                  onClick={handleJoin} 
                  disabled={isJoining || isFull || isClosed}
                  className={cn(
                    "w-full h-14 rounded-2xl font-black text-lg transition-all shadow-xl",
                    activity.isPaid 
                      ? "bg-slate-900 hover:bg-black text-white shadow-slate-200" 
                      : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
                  )}
                >
                  {isJoining ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      {activity.isPaid ? <CreditCard className="mr-2 h-5 w-5" /> : <Users className="mr-2 h-5 w-5" />}
                      {isFull 
                        ? (language === 'de' ? 'Aktivität ist voll' : 'Activity is full') 
                        : isClosed
                        ? (language === 'de' ? 'Aktivität beendet' : 'Activity ended')
                        : (activity.isPaid 
                            ? (language === 'de' ? `Beitreten (€${activity.price?.toFixed(2)})` : `Join (€${activity.price?.toFixed(2)})`) 
                            : (language === 'de' ? 'Jetzt beitreten' : 'Join now')
                          )}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
