'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { formatDistance, formatActivityLocationDisplay } from '@/lib/geo-utils';
import { leaveActivity, removeParticipant } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { format, isToday } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { cn, formatFirstName, formatActivityDateRange, formatActivityTimeDisplay } from '@/lib/utils';
import { getPrimaryIconData, getRoomVisualCategory } from '@/lib/tag-config';
import { MemberFriendActionButton } from './member-friend-action-button';
import { UserBadge } from '@/components/common/UserBadge';
import Link from 'next/link';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
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
} from '@/components/ui/alert-dialog';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Copy, Check, ExternalLink, Share2, LogOut, Users, Calendar, Info, X, UserMinus, MapPin, Sparkles, Shield, ChevronRight } from 'lucide-react';
import type { Chat, Activity, Place } from '@/lib/types';

interface RoomInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: Chat | null;
  activity: Activity | null;
  place: Place | null;
  participants: Chat['participantDetails'] | null | undefined;
  currentUserId?: string;
  onViewPlace?: () => void;
  onBeforeLeave?: () => void;
  onLeaveError?: () => void;
}

export function RoomInfoSheet({
  open,
  onOpenChange,
  chat,
  activity,
  place,
  participants,
  currentUserId,
  onViewPlace,
  onBeforeLeave,
  onLeaveError,
}: RoomInfoSheetProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isKicking, setIsKicking] = useState(false);
  const [participantToKick, setParticipantToKick] = useState<{ uid: string; displayName: string } | null>(null);

  const { userProfile } = useAuth();
  const language = useLanguage();
  const router = useRouter();
  const { toast } = useToast();

  if (!chat || !currentUserId) return null;

  const isHost = activity?.hostId === currentUserId || chat.hostId === currentUserId;

  const isPast = activity?.activityDate?.toDate
    ? activity.activityDate.toDate().getTime() < Date.now()
    : false;
  const isCancelled = activity?.status === 'cancelled';
  const isCompleted = activity?.status === 'completed' || isPast;

  // Primary style icon
  const visualCategoryData = getRoomVisualCategory({ activity, place, chat });
  const primaryStyle = getPrimaryIconData(visualCategoryData, language);
  const PrimaryIcon = primaryStyle.icon;

  // Status Chip
  const getStatusTextAndStyle = () => {
    if (!activity) {
      return {
        text: language === 'de' ? 'Aktiv' : 'Active',
        bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50',
      };
    }

    const now = new Date();
    const dateObj = typeof activity.activityDate?.toDate === 'function'
      ? activity.activityDate.toDate()
      : activity.activityDate instanceof Date
      ? activity.activityDate
      : null;

    const endDateObj = typeof activity.activityEndDate?.toDate === 'function'
      ? activity.activityEndDate.toDate()
      : activity.activityEndDate instanceof Date
      ? activity.activityEndDate
      : null;

    if (
      activity.status === 'completed' ||
      (endDateObj && endDateObj < now) ||
      (!activity.isTimeFlexible && dateObj && dateObj < now && !isToday(dateObj))
    ) {
      return {
        text: language === 'de' ? 'Beendet' : 'Completed',
        bg: 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300 border border-slate-200 dark:border-neutral-700',
      };
    }

    if (activity.status === 'cancelled' || activity.status === 'blacklisted') {
      return {
        text: language === 'de' ? 'Abgesagt' : 'Cancelled',
        bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50',
      };
    }

    if (dateObj && isToday(dateObj)) {
      return {
        text: language === 'de' ? 'Heute' : 'Today',
        bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/50',
      };
    }

    return {
      text: language === 'de' ? 'Aktiv' : 'Active',
      bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50',
    };
  };

  const statusChip = getStatusTextAndStyle();

  const renderDate = () => {
    if (!activity) return null;
    const dateRange = formatActivityDateRange(activity.activityDate, activity.activityEndDate, language);
    if (!dateRange) return null;
    const timeDisplay = formatActivityTimeDisplay(activity.activityDate, activity.isTimeFlexible, language);
    return `${dateRange} (${timeDisplay})`;
  };

  const handleCopyAddress = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const addressToCopy = place?.address || activity?.placeAddress || chat.placeName || '';
    if (!addressToCopy) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(addressToCopy);
      setCopied(true);
      toast({
        title: language === 'de' ? 'Kopiert!' : 'Copied!',
        description: language === 'de' ? 'Adresse in Zwischenablage kopiert.' : 'Address copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!activity) return;
    const refCode = userProfile?.referralCode || '';
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/activities/${activity.id}/invite${refCode ? `?ref=${refCode}` : ''}` : '';
    const shareTitle = activity.title || chat.placeName || 'Activa';
    const dateStr = activity.activityDate && typeof activity.activityDate.toDate === 'function'
      ? activity.activityDate.toDate().toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : '';
    const spotsLeft = (activity.maxParticipants || 0) - (chat.participantIds?.length || 0);
    const shareText = language === 'de'
      ? `Komm dazu: ${shareTitle} in ${activity.placeName || ''} am ${dateStr}. Noch ${spotsLeft} Plätze frei.`
      : `Join us: ${shareTitle} at ${activity.placeName || ''} on ${dateStr}. ${spotsLeft} spots left.`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: language === 'de' ? 'Link kopiert!' : 'Link copied!',
        description: language === 'de' ? 'Der Einladungslink wurde kopiert.' : 'The invitation link has been copied.',
      });
    }
  };

  const handleViewPlace = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const address = place?.address || activity?.placeAddress || '';
    const name = place?.name || activity?.placeName || chat.placeName || '';
    const query = address ? `${name}, ${address}` : name;
    if (!query) return;

    if (typeof window !== 'undefined') {
      const isIOS = typeof navigator !== 'undefined' && 
        (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

      const url = isIOS
        ? `https://maps.apple.com/?q=${encodeURIComponent(query)}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

      window.open(url, '_blank');
    }
  };

  const handleLeaveOrDelete = async () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    onOpenChange(false);

    setTimeout(async () => {
      setIsActing(true);
      try {
        if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        onBeforeLeave?.();
        await leaveActivity(chat.id, currentUserId);
        toast({
          title: language === 'de' ? 'Raum verlassen' : 'Room left',
          description: language === 'de' ? 'Du hast den Raum verlassen.' : 'You have left the room.',
        });
        router.replace('/chat');
      } catch (error: any) {
        onLeaveError?.();
        console.error('Operation failed:', error);
        toast({
          variant: 'destructive',
          title: language === 'de' ? 'Fehler' : 'Error',
          description: error.message || (language === 'de' ? 'Aktion fehlgeschlagen.' : 'Action failed.'),
        });
        setIsActing(false);
      }
    }, 500);
  };

  const handleKickParticipant = async (targetUid: string) => {
    const actId = activity?.id || chat?.activityId || chat?.id;
    if (!actId || !targetUid) return;
    if (isKicking) return;
    setParticipantToKick(null);
    setIsKicking(true);
    try {
      await removeParticipant(actId, targetUid);
      toast({
        title: language === 'de' ? 'Teilnehmer entfernt' : 'Participant removed',
        description: language === 'de' ? 'Der Teilnehmer wurde erfolgreich aus der Aktivität und dem Chat entfernt.' : 'Participant was successfully removed from activity and chat.',
      });
    } catch (error: any) {
      console.error('Kick participant failed:', error);
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message || (language === 'de' ? 'Entfernen fehlgeschlagen.' : 'Removal failed.'),
      });
    } finally {
      setIsKicking(false);
    }
  };

  const participantEntries = participants ? Object.entries(participants) : [];
  const visibleParticipants = isExpanded ? participantEntries : participantEntries.slice(0, 5);
  const remainingCount = participantEntries.length - 5;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 h-[88vh] max-h-[88vh] w-full max-w-xl mx-auto border-none rounded-t-[2.5rem] overflow-hidden outline-none bg-white dark:bg-neutral-900 shadow-2xl flex flex-col"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{activity?.title || chat?.placeName || 'Chat Info'}</SheetTitle>
          <SheetDescription>
            {language === 'de'
              ? 'Raumspezifische Details und Einstellungen'
              : 'Room specific details and settings'}
          </SheetDescription>
        </SheetHeader>

        {/* Header Bar */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between bg-slate-50/50 dark:bg-neutral-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div
              className={cn(
                'h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md transform -rotate-1',
                primaryStyle.gradientClass || 'bg-primary/10'
              )}
            >
              <PrimaryIcon className="h-6 w-6 text-white drop-shadow-md" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black text-slate-900 dark:text-neutral-100 truncate tracking-tight">
                {activity?.title || chat?.placeName}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-2xs',
                    statusChip.bg
                  )}
                >
                  {statusChip.text}
                </span>
                {activity?.maxParticipants && (
                  <span className="text-[11px] font-bold text-slate-500 dark:text-neutral-400">
                    {participantEntries.length}/{activity.maxParticipants} {language === 'de' ? 'Plätze' : 'spots'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <SheetClose className="rounded-full p-2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all ml-2">
            <X className="h-5 w-5" />
          </SheetClose>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6 pb-12">
            {/* Ort Sektion */}
            {(place || activity?.placeAddress || chat?.placeName) && (
              <div className="bg-slate-50 dark:bg-neutral-800/40 rounded-2xl p-4.5 border border-slate-200/60 dark:border-neutral-800 shadow-sm transition-all hover:border-slate-300 dark:hover:border-neutral-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[11px] font-black text-slate-400 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>{language === 'de' ? 'Ort & Adresse' : 'Location & Address'}</span>
                  </h3>
                  {place?.distance !== undefined && place?.distance !== null && formatDistance(place.distance) && (
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                      {formatDistance(place.distance)}
                    </span>
                  )}
                </div>
                <div className="font-extrabold text-base text-slate-900 dark:text-neutral-100 leading-snug">
                  {place?.name || activity?.placeName || chat?.placeName}
                </div>
                <div className="text-xs font-medium text-slate-500 dark:text-neutral-400 mt-1 leading-normal">
                  {activity ? formatActivityLocationDisplay(activity) : (place?.address || chat?.placeName || '')}
                </div>
                <div className="flex gap-2.5 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyAddress()}
                    className="rounded-xl text-xs font-bold px-3.5 py-1.5 bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-750 flex items-center gap-1.5 shadow-2xs"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                    <span>
                      {copied
                        ? language === 'de'
                          ? 'Kopiert!'
                          : 'Copied!'
                        : language === 'de'
                        ? 'Adresse kopieren'
                        : 'Copy Address'}
                    </span>
                  </Button>
                  {(place || activity?.placeAddress || chat.placeName) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleViewPlace}
                      className="rounded-xl text-xs font-bold px-3.5 py-1.5 bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-750 flex items-center gap-1.5 shadow-2xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-primary" />
                      <span>{language === 'de' ? 'In Maps öffnen' : 'View in Maps'}</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Raumdetails */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-black text-slate-400 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>{language === 'de' ? 'Raumdetails' : 'Room Details'}</span>
              </h3>
              
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-slate-50 dark:bg-neutral-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-neutral-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-black uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                    <span>{language === 'de' ? 'Datum & Uhrzeit' : 'Date & Time'}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-neutral-200 mt-2 leading-tight">
                    {renderDate() || '...'}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-neutral-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-neutral-800 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-black uppercase tracking-wider flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{language === 'de' ? 'Teilnehmer' : 'Participants'}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-neutral-200 mt-2">
                    {activity?.participantIds?.length || chat.participantIds?.length || 0}
                    {activity?.maxParticipants ? ` / ${activity.maxParticipants}` : ''} {language === 'de' ? 'Personen' : 'people'}
                  </span>
                </div>

                {activity?.hostName && (
                  <div className="bg-slate-50 dark:bg-neutral-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-neutral-800 flex flex-col col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-black uppercase tracking-wider flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5 text-amber-500" />
                      <span>{language === 'de' ? 'Host / Ersteller' : 'Host / Creator'}</span>
                    </span>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-neutral-100 mt-1">
                      {formatFirstName(activity.hostName, 'User')}
                    </span>
                  </div>
                )}

                {activity?.description && (
                  <div className="bg-slate-50 dark:bg-neutral-800/40 p-4 rounded-2xl border border-slate-200/60 dark:border-neutral-800 flex flex-col col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-black uppercase tracking-wider">
                      {language === 'de' ? 'Beschreibung' : 'Description'}
                    </span>
                    <p className="text-xs font-medium text-slate-700 dark:text-neutral-300 mt-1.5 leading-relaxed italic border-l-2 border-primary/30 pl-3">
                      "{activity.description}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Teilnehmer-Sektion */}
            {participantEntries.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-slate-400 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                    <span>{language === 'de' ? 'Im Raum' : 'In the Room'} ({participantEntries.length})</span>
                  </h3>
                </div>

                <div className="space-y-2">
                  {visibleParticipants.map(([uid, p]) => {
                    const isUserHost = uid === activity?.hostId || uid === chat.hostId;
                    const isCurrentUser = uid === currentUserId;
                    const usernameText = p.username ? `@${p.username.replace(/^@/, '')}` : formatFirstName(p.displayName, language === 'de' ? 'Activa-Nutzer' : 'Activa user');

                    return (
                      <div
                        key={uid}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/80 dark:bg-neutral-800/40 border border-slate-200/60 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-all group"
                      >
                        <Link
                          href={currentUserId === uid ? '/profile' : `/users/${uid}`}
                          className="flex items-center gap-3 flex-1 min-w-0"
                          onClick={() => onOpenChange(false)}
                        >
                          <ProfileAvatar
                            className="h-10 w-10 shadow-sm border-2 border-white dark:border-neutral-800 group-hover:scale-105 transition-transform"
                            photoURL={p.photoURL}
                            displayName={p.displayName}
                            isPremium={p.isPremium}
                            isCreator={p.isCreator}
                            isSupporter={p.isSupporter}
                            level={p.level || 1}
                            showLevelBadge={true}
                          />
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-slate-900 dark:text-neutral-100 truncate group-hover:text-primary transition-colors">
                                {usernameText}
                              </span>
                              <UserBadge isPremium={p.isPremium} isSupporter={p.isSupporter} isCreator={p.isCreator} size="sm" />
                              {isCurrentUser && (
                                <span className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-tight">
                                  {language === 'de' ? '(Du)' : '(You)'}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500">
                              Lv. {p.level || 1}
                            </span>
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 pr-1">
                          {isUserHost && (
                            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                              Host
                            </span>
                          )}
                          {((activity?.hostId === currentUserId || chat?.hostId === currentUserId) && !isUserHost && !isCurrentUser) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isKicking}
                              onClick={(e) => {
                                e.stopPropagation();
                                (e.currentTarget as HTMLElement)?.blur();
                                setParticipantToKick({ uid, displayName: p.displayName || 'Nutzer' });
                              }}
                              className="h-7 px-2 rounded-lg text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <UserMinus className="h-3 w-3 mr-1" />
                              {language === 'de' ? 'Entfernen' : 'Remove'}
                            </Button>
                          )}
                          <MemberFriendActionButton
                            targetUserId={uid}
                            currentUserId={currentUserId || ''}
                          />
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    );
                  })}

                  {!isExpanded && remainingCount > 0 && (
                    <button
                      onClick={() => setIsExpanded(true)}
                      className="w-full flex items-center justify-center p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/35 border border-dashed border-slate-200 dark:border-neutral-750 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-all text-xs font-black text-slate-600 dark:text-neutral-300"
                    >
                      {language === 'de'
                        ? `+ ${remainingCount} weitere anzeigen`
                        : `+ show ${remainingCount} more`}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Aktionen */}
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] font-black text-slate-400 dark:text-neutral-400 uppercase tracking-wider">
                {language === 'de' ? 'Aktionen' : 'Actions'}
              </h3>
              <div className="flex flex-col gap-2.5">
                {activity && activity.status === 'active' && !isCancelled && !isCompleted && (() => {
                  const spotsLeft = (activity.maxParticipants || 0) - (chat.participantIds?.length || 0);
                  if (spotsLeft <= 0) {
                    return (
                      <Button
                        disabled
                        className="w-full h-12 rounded-2xl font-bold bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 flex items-center justify-center gap-2 shadow-none border-none"
                      >
                        <Share2 className="h-4 w-4" />
                        <span>{language === 'de' ? 'Vollbesetzt' : 'Full'}</span>
                      </Button>
                    );
                  }
                  return (
                    <div className="bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-purple-500/10 border border-violet-200/50 dark:border-neutral-750 p-4.5 rounded-2xl flex flex-col gap-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                          {spotsLeft === 1 
                            ? (language === 'de' ? 'Noch 1 Platz frei' : '1 spot left') 
                            : (language === 'de' ? `Noch ${spotsLeft} Plätze frei` : `${spotsLeft} spots left`)}
                        </span>
                      </div>
                      <Button
                        onClick={handleShare}
                        className="w-full h-11 rounded-xl font-black bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20"
                      >
                        <Share2 className="h-4 w-4" />
                        <span>{language === 'de' ? 'Freunde einladen' : 'Invite Friends'}</span>
                      </Button>
                    </div>
                  );
                })()}

                {/* Normal Leave Button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={isActing}
                      className="w-full h-12 rounded-2xl font-black bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/40 flex items-center justify-center gap-2 shadow-none border-none transition-all mt-1"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{language === 'de' ? 'Raum verlassen' : 'Leave Room'}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl border-none shadow-2xl dark:bg-neutral-900">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-black dark:text-neutral-100">
                        {language === 'de' ? 'Raum wirklich verlassen?' : 'Really leave room?'}
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-sm font-medium text-slate-500 dark:text-neutral-400 leading-relaxed">
                        {isHost
                          ? (language === 'de' ? 'Da du der Host bist, wird die Host-Rolle auf ein anderes Mitglied übertragen. Falls du der letzte Teilnehmer bist, wird der Raum gelöscht.' : 'Since you are the host, host ownership will be transferred to another member. If you are the last participant, the meetup will be deleted.')
                          : (language === 'de' ? 'Du verlässt den Chat und die Aktivität. Du kannst später wieder beitreten, solange Plätze frei sind.' : 'You will leave the chat and activity. You can join again later as long as spaces are available.')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                      <AlertDialogCancel className="rounded-xl font-bold h-11 border-none bg-slate-100 dark:bg-neutral-800 dark:text-neutral-300">
                        {language === 'de' ? 'Abbrechen' : 'Cancel'}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleLeaveOrDelete}
                        className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black h-11 border-none shadow-md shadow-rose-200 dark:shadow-none"
                      >
                        {language === 'de' ? 'Ja, verlassen' : 'Yes, leave'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>

      <AlertDialog open={!!participantToKick} onOpenChange={(open) => !open && setParticipantToKick(null)}>
        <AlertDialogContent className="rounded-3xl border-none dark:bg-neutral-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black text-xl">
              {language === 'de' ? 'Teilnehmer entfernen?' : 'Remove participant?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-slate-500 dark:text-neutral-400">
              {language === 'de'
                ? `Möchtest du ${participantToKick?.displayName || 'diesen Teilnehmer'} wirklich aus der Aktivität und dem zugehörigen Gruppenchat entfernen? Der Nutzer kann danach nicht mehr beitreten.`
                : `Are you sure you want to remove ${participantToKick?.displayName || 'this participant'} from the activity and associated chat? The user will not be able to rejoin.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">
              {language === 'de' ? 'Abbrechen' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => participantToKick && handleKickParticipant(participantToKick.uid)}
              className="bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl"
            >
              {language === 'de' ? 'Teilnehmer entfernen' : 'Remove participant'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

