'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import { cn } from '@/lib/utils';
import { getPrimaryIconData } from '@/lib/tag-config';
import type { Activity } from '@/lib/types';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
} from 'lucide-react';

interface ActivityInfoSheetProps {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (activity: Activity) => Promise<void>;
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

  if (!activity) return null;

  const isJoining = externalIsJoining || internalIsJoining;
  const participantIds = activity.participantIds || [];
  const isParticipant = user ? participantIds.includes(user.uid) : false;
  const isFull = activity.maxParticipants ? participantIds.length >= activity.maxParticipants : false;
  const isHost = activity.hostId === user?.uid;
  const isPaidEvent = activity.isPaid && activity.price && activity.price > 0;

  const primaryStyle = getPrimaryIconData(
    {
      categories: activity.categories || [],
      name: activity.placeName || (language === 'de' ? 'Aktivität' : 'Activity'),
    },
    language
  );
  const PrimaryIcon = primaryStyle.icon;

  const renderDate = () => {
    const locale = language === 'de' ? de : enUS;
    const date = activity.activityDate?.toDate();
    if (!date) return '';

    if (activity.activityEndDate) {
      const endDate = activity.activityEndDate.toDate();
      return `${format(date, 'eee, d. MMM', { locale })} - ${format(endDate, 'eee, d. MMM', { locale })}`;
    }
    if (activity.isTimeFlexible) {
      return `${format(date, 'eee, d. MMM', { locale })} ${language === 'de' ? '(Flexibel)' : '(Flexible)'}`;
    }
    return format(date, language === 'de' ? "eee, d. MMM 'um' HH:mm" : "eee, d. MMM 'at' h:mm a", { locale });
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
    other: language === 'de' ? 'Diverse' : 'Other',
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 sm:max-w-md border-none rounded-l-[2.5rem] overflow-hidden dark:bg-neutral-950">
        <SheetHeader className="sr-only">
          <SheetTitle>{activity.placeName}</SheetTitle>
          <SheetDescription>
            {language === 'de'
              ? 'Details und Teilnahmebedingungen für dieses Treffen'
              : 'Details and requirements for this meetup'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {/* Header Banner */}
          <div className={cn('w-full h-40 flex flex-col items-center justify-center relative p-6 text-white text-center', primaryStyle.gradientClass)}>
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/20 mb-3 transform rotate-3">
              <PrimaryIcon className="text-white h-7 w-7 drop-shadow-md" />
            </div>
            <h2 className="text-xl font-black truncate max-w-full drop-shadow-sm px-4">
              {activity.placeName || (language === 'de' ? 'Aktivität' : 'Activity')}
            </h2>
            {activity.placeAddress && (
              <p className="text-[11px] font-bold opacity-90 truncate max-w-full flex items-center gap-1 mt-1 drop-shadow-sm">
                <MapPin className="h-3 w-3 shrink-0" />
                {activity.placeAddress}
              </p>
            )}
          </div>

          <div className="p-6 space-y-6">
            {/* Date & Time and Cost section */}
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-slate-50 dark:bg-neutral-900 rounded-2xl p-4 flex items-center gap-3 border border-slate-100 dark:border-neutral-800">
                <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-500 flex items-center justify-center shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                    {language === 'de' ? 'Datum & Uhrzeit' : 'Date & Time'}
                  </p>
                  <p className="text-sm font-black text-slate-800 dark:text-neutral-200">
                    {renderDate()}
                  </p>
                </div>
              </div>

              {isPaidEvent && (
                <div className="bg-slate-50 dark:bg-neutral-900 rounded-2xl p-4 flex items-center gap-3 border border-slate-100 dark:border-neutral-800">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center shrink-0">
                    <span className="font-black text-base">€</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                      {language === 'de' ? 'Eintrittspreis' : 'Price'}
                    </p>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {activity.price?.toFixed(2)} €
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
              <div className="bg-slate-50 dark:bg-neutral-900 rounded-2xl p-4 border border-slate-100 dark:border-neutral-800 space-y-3.5">
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

              <div className="bg-slate-50 dark:bg-neutral-900 rounded-2xl p-4 border border-slate-100 dark:border-neutral-800">
                <ul className="space-y-3">
                  {Object.entries(activity.participantDetails || {}).map(([uid, p]) => (
                    <li key={uid} className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border-2 border-white dark:border-neutral-800 shadow-sm">
                        <AvatarImage src={p.photoURL || undefined} />
                        <AvatarFallback className="bg-primary/5 text-primary text-xs font-black">
                          {p.displayName?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-neutral-200 truncate">
                            {p.displayName}
                          </span>
                          {uid === activity.hostId && (
                            <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tight">
                              Host
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer Action */}
        <SheetFooter className="p-6 bg-slate-50 dark:bg-neutral-900 border-t border-slate-100 dark:border-neutral-800 shrink-0">
          <Button
            onClick={handleAction}
            disabled={isJoining || (!isParticipant && !isHost && isFull)}
            className="w-full h-14 text-base font-black rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2"
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
