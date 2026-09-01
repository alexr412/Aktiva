'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import { cn, formatFirstName, formatActivityDateRange, formatActivityTimeDisplay, formatLabel } from '@/lib/utils';
import { getPrimaryIconData } from '@/lib/tag-config';
import type { Activity } from '@/lib/types';
import { useAddressLongPress } from '@/hooks/use-address-long-press';
import { formatActivityLocationDisplay } from '@/lib/geo-utils';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar,
  Users,
  Clock,
  MapPin,
  ChevronRight,
  ShieldCheck,
  UserCircle,
  Star,
  Lock,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  BadgePercent,
  CheckCircle,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';

interface ActivityInfoSheetProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (activity: Activity) => Promise<any>;
  isJoining?: boolean;
}

export function ActivityInfoSheet({
  activity,
  open,
  onOpenChange,
  onJoin,
  isJoining: externalIsJoining = false,
}: ActivityInfoSheetProps) {
  const { user, userProfile } = useAuth();
  const language = useLanguage();
  const router = useRouter();
  const [internalIsJoining, setInternalIsJoining] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [memberRatings, setMemberRatings] = useState<Record<string, { averageRating?: number; ratingCount?: number }>>({});

  useEffect(() => {
    if (!open || !activity) return;
    const details = activity.participantDetails || {};
    const missingUids = Object.keys(details).filter(uid => {
      const p = details[uid];
      return p && (p.averageRating === undefined && p.ratingCount === undefined);
    });

    if (missingUids.length === 0) return;

    const loadRatings = async () => {
      try {
        const { db } = await import('@/lib/firebase/client');
        const { doc, getDoc } = await import('firebase/firestore');
        if (!db) return;
        const newRatings: Record<string, { averageRating?: number; ratingCount?: number }> = {};
        await Promise.all(
          missingUids.map(async (uid) => {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
              const data = snap.data();
              newRatings[uid] = {
                averageRating: data.averageRating,
                ratingCount: data.ratingCount,
              };
            }
          })
        );
        setMemberRatings(prev => ({ ...prev, ...newRatings }));
      } catch (err) {
        console.error("Error loading member ratings:", err);
      }
    };

    loadRatings();
  }, [open, activity]);

  if (!activity) return null;

  const isJoining = externalIsJoining || internalIsJoining;
  const participantIds = activity.participantIds || [];
  const isParticipant = user ? participantIds.includes(user.uid) : false;
  const isFull = activity.maxParticipants ? participantIds.length >= activity.maxParticipants : false;
  const isHost = activity.hostId === user?.uid;
  const isPaidEvent = activity.isPaid && activity.price && activity.price > 0;

  const primaryStyle = getPrimaryIconData(
    {
      categories: (activity.categories || []).filter(c => c !== 'user_event'),
      placeCategories: activity.placeCategories,
      name: activity.placeName || (language === 'de' ? 'Aktivität' : 'Activity'),
      sourceType: activity.sourceType,
      isUserEvent: activity.isUserEvent,
      creationSource: activity.creationSource,
    },
    language
  );
  const PrimaryIcon = primaryStyle.icon;

  const renderDate = () => {
    const dateRange = formatActivityDateRange(activity.activityDate, activity.activityEndDate, language);
    if (!dateRange) return '';
    const timeDisplay = formatActivityTimeDisplay(activity.activityDate, activity.isTimeFlexible, language);
    return `${dateRange} (${timeDisplay})`;
  };

  const handleAction = async () => {
    if (isParticipant || isHost) {
      onOpenChange(false);
      router.push(`/chat/${activity.id}`);
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    if (isPaidEvent) {
      onOpenChange(false);
      router.push(`/checkout/${activity.id}`);
      return;
    }

    setInternalIsJoining(true);
    try {
      await onJoin(activity);
      onOpenChange(false);
    } catch (err) {
      console.error('Error joining from details sheet:', err);
    } finally {
      setInternalIsJoining(false);
    }
  };

  // Gender Labels mapping
  const genderLabels: Record<string, string> = {
    male: language === 'de' ? 'Männer' : 'Men',
    female: language === 'de' ? 'Frauen' : 'Women',
    diverse: language === 'de' ? 'Diverse' : 'Diverse',
    other: language === 'de' ? 'Diverse' : 'Other',
  };

  const modalContent = (
    <div className="flex flex-col h-full min-h-0 w-full overflow-hidden bg-white dark:bg-neutral-950">
      <ScrollArea className="flex-1 min-h-0">
        {/* Header Banner */}
        <div className={cn('w-full h-48 sm:h-52 flex flex-col items-center justify-center relative p-6 text-white text-center select-none overflow-hidden shrink-0', primaryStyle.gradientClass)}>
          {/* Glassmorphism Close Button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 z-30 h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-90 border border-white/20 shadow-md cursor-pointer"
            aria-label={language === 'de' ? 'Schließen' : 'Close'}
          >
            <X className="h-5 w-5 stroke-[2.5]" />
          </button>

          {/* Category Badge */}
          <div className="absolute top-4 left-4 flex gap-2 z-20">
            <span className="bg-white/25 backdrop-blur-md text-white text-[10px] font-black uppercase px-3 py-1 rounded-full border border-white/20 shadow-sm tracking-wider">
              {formatLabel(activity.categories?.[0] || (language === 'de' ? 'Aktivität' : 'Activity'))}
            </span>
          </div>

          <div className="relative z-10 flex flex-col items-center pt-2">
            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xl border border-white/30 mb-2 transform rotate-2 hover:rotate-0 transition-transform duration-300">
              <PrimaryIcon className="text-white h-8 w-8 sm:h-9 sm:w-9 drop-shadow-md" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black truncate max-w-full drop-shadow-md px-4 tracking-tight">
              {activity.isCustomActivity ? (activity.title || activity.placeName) : (activity.placeName || (language === 'de' ? 'Aktivität' : 'Activity'))}
            </h2>
            {activity.placeAddress && (
              <ActivityAddressLink
                address={formatActivityLocationDisplay(activity)}
                placeName={activity.placeName}
                language={language}
              />
            )}
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Date & Time and Cost section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-50/80 dark:bg-neutral-900/80 rounded-2xl p-4 flex items-center gap-3.5 border border-slate-100 dark:border-neutral-800/80">
              <div className="h-11 w-11 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                  {language === 'de' ? 'Datum & Uhrzeit' : 'Date & Time'}
                </p>
                <p className="text-sm font-black text-slate-800 dark:text-neutral-200 truncate">
                  {renderDate()}
                </p>
              </div>
            </div>

            {isPaidEvent ? (
              <div className="bg-slate-50/80 dark:bg-neutral-900/80 rounded-2xl p-4 flex items-center gap-3.5 border border-slate-100 dark:border-neutral-800/80">
                <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <span className="font-black text-base">€</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                    {language === 'de' ? 'Eintrittspreis' : 'Price'}
                  </p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {activity.price?.toFixed(2)} €
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50/80 dark:bg-neutral-900/80 rounded-2xl p-4 flex items-center gap-3.5 border border-slate-100 dark:border-neutral-800/80">
                <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                    {language === 'de' ? 'Teilnehmer' : 'Participants'}
                  </p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {participantIds.length} {activity.maxParticipants ? `/ ${activity.maxParticipants}` : ''} {language === 'de' ? 'dabei' : 'joined'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Description/Comment Box */}
          {activity.description && (
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase tracking-wider px-1">
                {language === 'de' ? 'Kommentar / Beschreibung' : 'Comment / Description'}
              </h4>
              <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-4 border border-primary/10">
                <p className="text-sm font-bold text-slate-700 dark:text-neutral-300 italic leading-relaxed">
                  "{activity.description}"
                </p>
              </div>
            </div>
          )}

          {/* Requirements / Criteria */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase tracking-wider px-1">
              {language === 'de' ? 'Kriterien zum Beitreten' : 'Join Criteria'}
            </h4>
            <div className="bg-slate-50/80 dark:bg-neutral-900/80 rounded-2xl p-5 border border-slate-100 dark:border-neutral-800/80 space-y-3.5">
              {/* Join Mode */}
              <div className="flex items-start gap-3">
                <HelpCircle className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
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
              {activity.requirements?.minimumRating !== undefined && (
                <div className="flex items-start gap-3">
                  <Star className="h-4 w-4 mt-0.5 text-amber-500 fill-amber-500 shrink-0" />
                  <div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                      {language === 'de' ? 'Mindestbewertung' : 'Minimum Rating'}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                      {activity.requirements.minimumRating.toFixed(1)} {language === 'de' ? 'Sterne' : 'Stars'}
                    </span>
                  </div>
                </div>
              )}

              {/* Age Requirement */}
              {(activity.requirements?.ageRange?.min !== undefined || activity.requirements?.ageRange?.max !== undefined) && (
                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                  <div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
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
              {activity.requirements?.gender && activity.requirements.gender.length > 0 && (
                <div className="flex items-start gap-3">
                  <UserCircle className="h-4 w-4 mt-0.5 text-purple-500 shrink-0" />
                  <div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                      {language === 'de' ? 'Zugelassene Geschlechter' : 'Allowed Genders'}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                      {activity.requirements.gender.map(g => genderLabels[g] || g).join(', ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Profile Picture Requirement */}
              {activity.requirements?.requireProfilePicture && (
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  <div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                      {language === 'de' ? 'Profilbild' : 'Profile Picture'}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                      {language === 'de' ? 'Profilbild ist erforderlich' : 'Profile picture is required'}
                    </span>
                  </div>
                </div>
              )}

              {/* Verification Requirement */}
              {activity.requirements?.requireVerification && (
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                      {language === 'de' ? 'Verifizierung' : 'Verification'}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                      {language === 'de' ? 'Verifiziertes Profil (KYC) ist erforderlich' : 'Verified profile (KYC) is required'}
                    </span>
                  </div>
                </div>
              )}

              {/* No requirements fallback */}
              {!activity.requirements?.minimumRating &&
                !activity.requirements?.ageRange?.min &&
                !activity.requirements?.ageRange?.max &&
                (!activity.requirements?.gender || activity.requirements.gender.length === 0) &&
                !activity.requirements?.requireProfilePicture &&
                !activity.requirements?.requireVerification && (
                  <div className="flex items-center gap-3 text-slate-400 py-1">
                    <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-black">
                      {language === 'de' ? 'Keine Einschränkungen zum Beitreten' : 'No requirements to join'}
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* Participant List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                {language === 'de' ? 'Mitglieder' : 'Members'}
              </h4>
              <span className="text-[11px] font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                {participantIds.length} {activity.maxParticipants ? `/ ${activity.maxParticipants}` : ''}
              </span>
            </div>

            <div className="bg-slate-50/80 dark:bg-neutral-900/80 rounded-2xl p-4 border border-slate-100 dark:border-neutral-800/80">
              <ul className="space-y-3">
                {Object.entries(activity.participantDetails || {}).map(([uid, p]) => {
                  const isSelf = uid === user?.uid;
                  const rawRating = isSelf ? (userProfile?.averageRating ?? p.averageRating ?? memberRatings[uid]?.averageRating) : (p.averageRating ?? memberRatings[uid]?.averageRating);
                  const rawCount = isSelf ? (userProfile?.ratingCount ?? p.ratingCount ?? memberRatings[uid]?.ratingCount) : (p.ratingCount ?? memberRatings[uid]?.ratingCount);
                  
                  const ratingVal = rawRating && rawRating > 0 ? rawRating : 5.0;
                  const countVal = rawCount || 0;

                  return (
                    <li key={uid} className="flex items-center gap-3">
                      <ProfileAvatar 
                        className="h-9 w-9 border-2 border-white dark:border-neutral-800 shadow-sm"
                        photoURL={p.photoURL}
                        displayName={p.displayName}
                        isPremium={p.isPremium}
                        isCreator={p.isCreator}
                        isSupporter={p.isSupporter}
                      />
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-800 dark:text-neutral-200 truncate">
                            {formatFirstName(p.displayName, 'User')}
                          </span>
                          {uid === activity.hostId && (
                            <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tight">
                              Host
                            </span>
                          )}
                          {isSelf && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                              {language === 'de' ? '(Du)' : '(You)'}
                            </span>
                          )}
                          <div className="flex items-center gap-0.5 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-900/40 shrink-0">
                            <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                            <span className="font-black text-amber-700 dark:text-amber-400 text-[10px]">
                              {ratingVal.toFixed(1)}
                            </span>
                            <span className="text-[9px] font-bold text-amber-600/70 dark:text-amber-500/70">
                              ({countVal})
                            </span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer Action */}
      <div className="p-5 sm:p-6 bg-slate-50/90 dark:bg-neutral-900/90 backdrop-blur-md border-t border-slate-100 dark:border-neutral-800 shrink-0">
        <Button
          onClick={handleAction}
          disabled={isJoining || (!isParticipant && !isHost && isFull)}
          className="w-full h-14 text-base font-black rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          {isJoining ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isParticipant || isHost ? (
            <>
              <MessageSquare className="h-5 w-5" />
              <span>{language === 'de' ? 'Chat öffnen' : 'Open Chat'}</span>
            </>
          ) : isFull ? (
            <span>{language === 'de' ? 'Aktivität ist voll' : 'Activity is full'}</span>
          ) : isPaidEvent ? (
            <>
              <span>{language === 'de' ? 'Ticket buchen' : 'Book ticket'}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          ) : activity.joinMode === 'request' ? (
            <>
              <span>{language === 'de' ? 'Anfrage senden' : 'Send request'}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              <span>{language === 'de' ? 'Jetzt beitreten' : 'Join now'}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" hideCloseButton className="flex flex-col p-0 w-full h-[90vh] border-none rounded-t-[2.5rem] overflow-hidden outline-none bg-white dark:bg-neutral-950 z-[9999]">
          <SheetHeader className="sr-only">
            <SheetTitle>{activity.isCustomActivity ? (activity.title || activity.placeName) : activity.placeName}</SheetTitle>
            <SheetDescription>
              {language === 'de'
                ? 'Details und Teilnahmebedingungen für dieses Treffen'
                : 'Details and requirements for this meetup'}
            </SheetDescription>
          </SheetHeader>
          {modalContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 w-full max-w-2xl sm:max-w-2xl h-[85vh] max-h-[85vh] flex flex-col min-h-0 gap-0 overflow-hidden border border-slate-200/40 dark:border-neutral-800/80 outline-none rounded-[2.5rem] bg-white dark:bg-neutral-950 z-[9999] shadow-2xl" hideCloseButton>
        <DialogTitle className="sr-only">{activity.isCustomActivity ? (activity.title || activity.placeName) : activity.placeName}</DialogTitle>
        <DialogDescription className="sr-only">
          {language === 'de'
            ? 'Details und Teilnahmebedingungen für dieses Treffen'
            : 'Details and requirements for this meetup'}
        </DialogDescription>
        {modalContent}
      </DialogContent>
    </Dialog>
  );
}

function ActivityAddressLink({
  address,
  placeName,
  language,
}: {
  address: string;
  placeName?: string;
  language: 'de' | 'en';
}) {
  const { mapsUrl, handlers } = useAddressLongPress({
    address,
    placeName,
    language,
  });

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      {...handlers}
      className="text-[11px] font-bold opacity-90 hover:opacity-100 truncate max-w-full flex items-center gap-1 mt-1 drop-shadow-sm underline decoration-white/40 underline-offset-2 cursor-pointer select-none"
      style={{ WebkitTouchCallout: 'none' }}
      title={language === 'de' ? 'Antippen zum Öffnen, gedrückt halten zum Kopieren' : 'Tap to open, hold to copy'}
    >
      <MapPin className="h-3 w-3 shrink-0" />
      <span className="truncate">{address}</span>
    </a>
  );
}
