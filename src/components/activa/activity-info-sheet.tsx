'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import { cn, formatFirstName, formatActivityDateRange, formatActivityTimeDisplay } from '@/lib/utils';
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
    <div className="flex flex-col min-h-0 w-full overflow-hidden bg-card text-card-foreground">
      <div className="relative flex items-start gap-3 border-b border-border p-5 pr-16 shrink-0">
        <div className={cn('h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0', primaryStyle.gradientClass)}>
          <PrimaryIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{primaryStyle.label}</p>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight break-words">
            {activity.isCustomActivity ? (activity.title || activity.placeName) : (activity.placeName || (language === 'de' ? 'Aktivität' : 'Activity'))}
          </h2>
          {activity.placeAddress && (
            <ActivityAddressLink address={formatActivityLocationDisplay(activity)} placeName={activity.placeName} language={language} />
          )}
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={language === 'de' ? 'Schließen' : 'Close'}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        <div className="p-5 space-y-5">
          {/* Date & Time and Cost section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3 border border-border">
              <div className="h-9 w-9 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">
                  {language === 'de' ? 'Datum & Uhrzeit' : 'Date & Time'}
                </p>
                <p className="text-sm font-semibold text-foreground break-words">
                  {renderDate()}
                </p>
              </div>
            </div>

            {isPaidEvent ? (
              <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3 border border-border">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <span className="font-black text-base">€</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {language === 'de' ? 'Eintrittspreis' : 'Price'}
                  </p>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {activity.price?.toFixed(2)} €
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3 border border-border">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {language === 'de' ? 'Teilnehmer' : 'Participants'}
                  </p>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {participantIds.length} {activity.maxParticipants ? `/ ${activity.maxParticipants}` : ''} {language === 'de' ? 'dabei' : 'joined'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Description/Comment Box */}
          {activity.description && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">
                {language === 'de' ? 'Über die Aktivität' : 'About this activity'}
              </h4>
              <div className="bg-muted/40 rounded-xl p-4 border border-border">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {activity.description}
                </p>
              </div>
            </div>
          )}

          {/* Requirements / Criteria */}
          <div className="space-y-2.5">
            <h4 className="text-sm font-semibold text-foreground">
              {language === 'de' ? 'Kriterien zum Beitreten' : 'Join Criteria'}
            </h4>
            <div className="rounded-xl p-4 border border-border space-y-3">
              {/* Join Mode */}
              <div className="flex items-start gap-3">
                <HelpCircle className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">
                    {language === 'de' ? 'Beitrittsmethode' : 'Join Method'}
                  </span>
                  <span className="text-sm font-medium text-foreground">
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
                    <span className="text-xs font-medium text-muted-foreground block">
                      {language === 'de' ? 'Mindestbewertung' : 'Minimum Rating'}
                    </span>
                    <span className="text-sm font-medium text-foreground">
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
                    <span className="text-xs font-medium text-muted-foreground block">
                      {language === 'de' ? 'Altersbereich' : 'Age Range'}
                    </span>
                    <span className="text-sm font-medium text-foreground">
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
                    <span className="text-xs font-medium text-muted-foreground block">
                      {language === 'de' ? 'Zugelassene Geschlechter' : 'Allowed Genders'}
                    </span>
                    <span className="text-sm font-medium text-foreground">
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
                    <span className="text-xs font-medium text-muted-foreground block">
                      {language === 'de' ? 'Profilbild' : 'Profile Picture'}
                    </span>
                    <span className="text-sm font-medium text-foreground">
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
                    <span className="text-xs font-medium text-muted-foreground block">
                      {language === 'de' ? 'Verifizierung' : 'Verification'}
                    </span>
                    <span className="text-sm font-medium text-foreground">
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
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-medium">
                      {language === 'de' ? 'Keine Einschränkungen zum Beitreten' : 'No requirements to join'}
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* Participant List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-sm font-semibold text-foreground">
                {language === 'de' ? 'Mitglieder' : 'Members'}
              </h4>
              <span className="text-[11px] font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10">
                {participantIds.length} {activity.maxParticipants ? `/ ${activity.maxParticipants}` : ''}
              </span>
            </div>

            <div className="rounded-xl p-4 border border-border">
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
                          <span className="text-sm font-medium text-foreground truncate">
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
      </div>

      {/* Footer Action */}
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border shrink-0">
        <Button
          onClick={handleAction}
          disabled={isJoining || (!isParticipant && !isHost && isFull)}
          className="w-full h-12 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2"
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
        <SheetContent side="bottom" hideCloseButton className="flex flex-col p-0 w-full max-h-[90dvh] gap-0 border border-border rounded-t-3xl overflow-hidden outline-none bg-card z-[9999]">
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
      <DialogContent className="p-0 sm:p-0 w-full max-w-xl sm:max-w-xl max-h-[85dvh] flex flex-col min-h-0 gap-0 overflow-hidden border border-border outline-none rounded-3xl bg-card z-[9999] shadow-2xl" hideCloseButton>
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
      className="text-xs text-muted-foreground hover:text-primary flex items-start gap-1.5 underline decoration-border underline-offset-4 cursor-pointer select-none"
      style={{ WebkitTouchCallout: 'none' }}
      title={language === 'de' ? 'Antippen zum Öffnen, gedrückt halten zum Kopieren' : 'Tap to open, hold to copy'}
    >
      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span className="break-words">{address}</span>
    </a>
  );
}
