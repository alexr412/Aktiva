'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { leaveActivity } from '@/lib/firebase/firestore';
import { format, isToday } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { cn, formatFirstName } from '@/lib/utils';
import { getPrimaryIconData, getRoomVisualCategory } from '@/lib/tag-config';
import { MemberFriendActionButton } from './member-friend-action-button';

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
import { Copy, Check, ExternalLink, Share2, LogOut, Trash2, Users, Calendar, Info, X } from 'lucide-react';
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

  const language = useLanguage();
  const router = useRouter();
  const { toast } = useToast();

  if (!chat || !currentUserId) return null;

  const isHost = activity?.hostId === currentUserId || chat.hostId === currentUserId;
  const isOnlyParticipant = chat.participantIds?.length === 1;

  // Primary style icon
  const visualCategoryData = getRoomVisualCategory({ activity, place, chat });
  const primaryStyle = getPrimaryIconData(visualCategoryData, language);
  const PrimaryIcon = primaryStyle.icon;

  // Status Chip Berechnung
  const getStatusTextAndStyle = () => {
    if (!activity) {
      return {
        text: language === 'de' ? 'Aktiv' : 'Active',
        bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
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
        bg: 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300',
      };
    }

    if (activity.status === 'cancelled' || activity.status === 'blacklisted') {
      return {
        text: language === 'de' ? 'Abgesagt' : 'Cancelled',
        bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
      };
    }

    if (dateObj && isToday(dateObj)) {
      return {
        text: language === 'de' ? 'Heute' : 'Today',
        bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
      };
    }

    return {
      text: language === 'de' ? 'Aktiv' : 'Active',
      bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
    };
  };

  const statusChip = getStatusTextAndStyle();

  // Datum formatieren
  const renderDate = () => {
    if (!activity) return null;
    const locale = language === 'de' ? de : enUS;

    const dateObj = typeof activity.activityDate?.toDate === 'function'
      ? activity.activityDate.toDate()
      : activity.activityDate instanceof Date
      ? activity.activityDate
      : null;

    if (!dateObj) return null;

    if (activity.activityEndDate) {
      const endDateObj = typeof activity.activityEndDate?.toDate === 'function'
        ? activity.activityEndDate.toDate()
        : activity.activityEndDate instanceof Date
        ? activity.activityEndDate
        : null;
      if (endDateObj) {
        return `${format(dateObj, 'eee, d. MMM', { locale })} - ${format(endDateObj, 'eee, d. MMM', { locale })}`;
      }
    }
    if (activity.isTimeFlexible) {
      return `${format(dateObj, 'eee, d. MMM', { locale })} ${language === 'de' ? '(Flexibel)' : '(Flexible)'}`;
    }
    return format(dateObj, language === 'de' ? "eee, d. MMM 'um' p" : "eee, d. MMM 'at' p", { locale });
  };

  // Kopieren der Adresse
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

  // Raum teilen
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/chat/${chat.id}` : '';
    const shareTitle = activity?.placeName || chat.placeName || 'Aktiva Chat';
    const shareText = language === 'de'
      ? `Tritt unserem Treffen bei: ${shareTitle}`
      : `Join our meetup: ${shareTitle}`;

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
        description: language === 'de' ? 'Der Link zum Chat wurde kopiert.' : 'The link to the chat has been copied.',
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

  // Teilnehmer-Liste vorbereiten
  const participantEntries = participants ? Object.entries(participants) : [];
  const visibleParticipants = isExpanded ? participantEntries : participantEntries.slice(0, 5);
  const remainingCount = participantEntries.length - 5;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="p-0 h-[85vh] max-h-[85vh] w-full border-none rounded-t-[2.5rem] overflow-hidden outline-none bg-white dark:bg-neutral-900 flex flex-col"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{activity?.title || chat?.placeName || 'Chat Info'}</SheetTitle>
          <SheetDescription>
            {language === 'de'
              ? 'Raumspezifische Details und Einstellungen'
              : 'Room specific details and settings'}
          </SheetDescription>
        </SheetHeader>

        {/* Custom Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-neutral-800 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm',
                primaryStyle.gradientClass || 'bg-primary/10'
              )}
            >
              <PrimaryIcon className="h-5 w-5 text-white drop-shadow-sm" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-neutral-100 leading-snug">
                {activity?.title || chat?.placeName}
              </h2>
              <span
                className={cn(
                  'inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                  statusChip.bg
                )}
              >
                {statusChip.text}
              </span>
            </div>
          </div>
          <SheetClose className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="h-5 w-5 text-slate-500" />
          </SheetClose>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6 pb-12">
            {/* Ort Sektion */}
            {(place || activity?.placeAddress || chat?.placeName) && (
              <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-2xl p-4 border border-slate-100 dark:border-neutral-800">
                <h3 className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" />
                  <span>{language === 'de' ? 'Ort' : 'Location'}</span>
                </h3>
                <div className="font-bold text-slate-900 dark:text-neutral-100">
                  {place?.name || activity?.placeName || chat?.placeName}
                </div>
                <div className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span>{activity && (activity.isCustomActivity || activity.isUserEvent) ? (activity.placeAddress || '') : (place?.address || activity?.placeAddress || '')}</span>
                  {place?.distance !== undefined && (
                    <span className="bg-slate-200 dark:bg-neutral-750 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      {place.distance < 1
                        ? `${Math.round(place.distance * 1000)} m`
                        : `${place.distance.toFixed(1)} km`}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 mt-3.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyAddress()}
                    className="rounded-full text-xs font-bold px-3.5 py-1 bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-250 flex items-center gap-1.5"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
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
                      className="rounded-full text-xs font-bold px-3.5 py-1 bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-250 flex items-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>{language === 'de' ? 'Ort ansehen' : 'View Place'}</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Raumdetails */}
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest">
                {language === 'de' ? 'Raumdetails' : 'Room Details'}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-neutral-800/50 p-3 rounded-xl border border-slate-100 dark:border-neutral-800 flex flex-col">
                  <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-bold uppercase flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{language === 'de' ? 'Datum & Uhrzeit' : 'Date & Time'}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-neutral-200 mt-1">
                    {renderDate() || '...'}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-neutral-800/50 p-3 rounded-xl border border-slate-100 dark:border-neutral-800 flex flex-col">
                  <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-bold uppercase flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>{language === 'de' ? 'Teilnehmer' : 'Participants'}</span>
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-neutral-200 mt-1">
                    {activity?.participantIds?.length || chat.participantIds?.length || 0}
                    {activity?.maxParticipants ? ` / ${activity.maxParticipants}` : ''}
                  </span>
                </div>

                {activity?.hostName && (
                  <div className="bg-slate-50 dark:bg-neutral-800/50 p-3 rounded-xl border border-slate-100 dark:border-neutral-800 flex flex-col col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-bold uppercase">
                      {language === 'de' ? 'Host / Ersteller' : 'Host / Creator'}
                    </span>
                    <span className="text-xs font-bold text-slate-800 dark:text-neutral-200 mt-1">
                      {formatFirstName(activity.hostName, 'User')}
                    </span>
                  </div>
                )}

                {activity?.description && (
                  <div className="bg-slate-50 dark:bg-neutral-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-neutral-800 flex flex-col col-span-2">
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-bold uppercase">
                      {language === 'de' ? 'Beschreibung' : 'Description'}
                    </span>
                    <p className="text-xs font-medium text-slate-600 dark:text-neutral-355 mt-1 leading-relaxed italic">
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
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest">
                    {language === 'de' ? 'Im Raum' : 'In the Room'} ({participantEntries.length})
                  </h3>
                </div>

                <div className="space-y-2">
                  {visibleParticipants.map(([uid, p]) => {
                    const isUserHost = uid === activity?.hostId || uid === chat.hostId;
                    const isCurrentUser = uid === currentUserId;

                    return (
                      <div
                        key={uid}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-100 dark:border-neutral-800"
                      >
                        <div className="flex items-center gap-3">
                          <ProfileAvatar
                            className="h-8 w-8 shadow-sm border border-white dark:border-neutral-800"
                            photoURL={p.photoURL}
                            displayName={p.displayName}
                            isPremium={p.isPremium}
                            isCreator={p.isCreator}
                            isSupporter={p.isSupporter}
                          />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900 dark:text-neutral-100">
                              {p.displayName ? formatFirstName(p.displayName, 'User') : 'User'}
                              {isCurrentUser && (
                                <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-bold ml-1">
                                  {language === 'de' ? '(Du)' : '(You)'}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {isUserHost && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/50">
                              Host
                            </span>
                          )}
                          <MemberFriendActionButton
                            targetUserId={uid}
                            currentUserId={currentUserId || ''}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {!isExpanded && remainingCount > 0 && (
                    <button
                      onClick={() => setIsExpanded(true)}
                      className="w-full flex items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/35 border border-dashed border-slate-200 dark:border-neutral-850 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors text-xs font-bold text-slate-500 dark:text-neutral-400"
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
              <h3 className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest">
                {language === 'de' ? 'Aktionen' : 'Actions'}
              </h3>
              <div className="flex flex-col gap-2.5">
                <Button
                  onClick={handleShare}
                  className="w-full h-11 rounded-2xl font-bold bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 shadow-none border-none"
                >
                  <Share2 className="h-4 w-4" />
                  <span>{language === 'de' ? 'Raum teilen' : 'Share Room'}</span>
                </Button>

                {participantEntries.length > 5 && !isExpanded && (
                  <Button
                    onClick={() => setIsExpanded(true)}
                    className="w-full h-11 rounded-2xl font-bold bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 shadow-none border-none"
                  >
                    <Users className="h-4 w-4" />
                    <span>{language === 'de' ? 'Teilnehmer ansehen' : 'View Participants'}</span>
                  </Button>
                )}

                {/* Normal Leave Button for everyone (host and non-host) */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={isActing}
                      className="w-full h-11 rounded-2xl font-black bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/30 flex items-center justify-center gap-2 shadow-none border-none mt-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{language === 'de' ? 'Raum verlassen' : 'Leave Room'}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl border-none shadow-2xl dark:bg-neutral-900">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-lg font-black dark:text-neutral-100">
                        {language === 'de' ? 'Raum wirklich verlassen?' : 'Really leave room?'}
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-sm font-medium text-slate-500 dark:text-neutral-400">
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
                        className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-black h-11 border-none shadow-md shadow-red-200 dark:shadow-none"
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
    </Sheet>
  );
}
