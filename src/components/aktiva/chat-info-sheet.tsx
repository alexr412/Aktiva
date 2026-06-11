'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { leaveActivity, deleteActivity, voteToCompleteActivity, completeActivity } from '@/lib/firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import { cn, formatFirstName } from '@/lib/utils';
import { getPrimaryIconData } from '@/lib/tag-config';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
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
import { Loader2, Trash2, Users, Calendar, CheckCircle, MapPin, ChevronRight, CheckCircle2, BarChart3, HelpCircle, Star, UserCircle, ShieldCheck } from 'lucide-react';
import type { Chat, Activity } from '@/lib/types';

interface ChatInfoSheetProps {
  chat: Chat | null;
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatInfoSheet({ chat, activity, open, onOpenChange }: ChatInfoSheetProps) {
  const [isActing, setIsActing] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const { user } = useAuth();
  const language = useLanguage();
  const router = useRouter();
  const { toast } = useToast();

  const renderDate = () => {
      if (!activity) return null;

      const locale = language === 'de' ? de : enUS;

      if (activity.activityEndDate) {
          return `${format(activity.activityDate.toDate(), "eee, d. MMM", { locale })} - ${format(activity.activityEndDate.toDate(), "eee, d. MMM", { locale })}`;
      }
      if (activity.isTimeFlexible) {
          return `${format(activity.activityDate.toDate(), "eee, d. MMM", { locale })} ${language === 'de' ? '(Flexibel)' : '(Flexible)'}`;
      }
      return format(activity.activityDate.toDate(), language === 'de' ? "eee, d. MMM 'um' p" : "eee, d. MMM 'at' p", { locale });
  }


  if (!chat || !user || !activity) return null;

  const isOnlyParticipant = chat.participantIds.length === 1;
  const isHost = activity.hostId === user.uid;
  const hasVoted = activity?.completionVotes?.includes(user.uid);
  const isCompleted = activity.status === 'completed';
  
  const activityDate = activity.activityDate?.toDate();
  const isPastOrPresent = activityDate && activityDate <= new Date();

  const primaryStyle = getPrimaryIconData({ 
      categories: (activity.categories || []).filter(c => c !== 'user_event'), 
      name: activity.placeName || (language === 'de' ? "Aktivität" : "Activity"),
      sourceType: activity.sourceType,
      isUserEvent: activity.isUserEvent,
      creationSource: activity.creationSource
  }, language);
  const PrimaryIcon = primaryStyle.icon;

  const handleLeaveOrDelete = async () => {
    if (!chat?.id || !user?.uid) return;
    
    // 1. Fokus-Abwurf erzwingen
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // 2. Sheet SOFORT im UI schließen (Animation startet)
    onOpenChange(false);
    
    // 3. Firebase-Löschung um 500ms verzögern
    setTimeout(async () => {
      setIsActing(true);
      try {
        if (isOnlyParticipant) {
          await deleteActivity(chat.id);
        } else {
          await leaveActivity(chat.id, user.uid);
        }
        
        // 4. Weiterleitung nach dem Cleanup
        router.replace('/chat');
      } catch (error: any) {
        console.error('Operation failed:', error);
        setIsActing(false);
      }
    }, 500); 
  };
  
  const handleVote = async () => {
      if (!activity?.id || !user?.uid || hasVoted) return;
      setIsVoting(true);
       try {
        await voteToCompleteActivity(activity.id, user.uid);
        toast({ title: language === 'de' ? "Stimme abgegeben!" : "Vote submitted!" });
      } catch (error: any) {
        toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: error.message });
      } finally {
        setIsVoting(false);
      }
  };

  const handleCompleteActivity = async () => {
    if (!activity?.id || !user?.uid) return;
    setIsActing(true);
    try {
      await completeActivity(activity.id, user.uid, !!activity.isPaid);
      toast({ title: language === 'de' ? "Aktivität erfolgreich abgeschlossen!" : "Activity successfully completed!" });
    } catch (error: any) {
      toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: error.message });
    } finally {
      setIsActing(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 sm:max-w-md border-none rounded-l-[2.5rem] overflow-hidden dark:bg-neutral-950">
        {/* Versteckter Header für Accessibility (Radix Warning Fix) */}
        <SheetHeader className="sr-only">
          <SheetTitle>{language === 'de' ? 'Chat Info' : 'Chat Info'}</SheetTitle>
          <SheetDescription>{language === 'de' ? `Chat Einstellungen und Löschoptionen für ${chat.placeName}` : `Chat settings and deletion options for ${chat.placeName}`}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-8">
            <div className="flex flex-col items-center text-center pb-8 border-b border-slate-100 dark:border-neutral-800 mb-8">
              <div className={cn("w-24 h-24 rounded-3xl mb-6 flex items-center justify-center shadow-xl transform rotate-3", primaryStyle.gradientClass)}>
                <PrimaryIcon className="text-white h-10 w-10 drop-shadow-md" />
              </div>
              
              <h2 className="">
                {chat.placeName}
              </h2>
              
              <div className="flex flex-wrap justify-center gap-2">
                <span className="bg-blue-50 text-blue-700 dark:bg-neutral-800 dark:text-neutral-200 dark:border dark:border-neutral-700 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                  <Users className="h-3.5 w-3.5" /> {chat.participantIds.length} {chat.participantIds.length === 1 ? (language === 'de' ? 'Mitglied' : 'Member') : (language === 'de' ? 'Mitglieder' : 'Members')}
                </span>
                <span className="bg-orange-50 text-orange-700 dark:bg-neutral-800 dark:text-neutral-200 dark:border dark:border-neutral-700 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                  <Calendar className="h-3.5 w-3.5" /> {renderDate()}
                </span>
              </div>

              {activity.description && (
                <div className="mt-4 px-4 max-w-sm mx-auto">
                  <p className="text-xs font-medium text-slate-500 dark:text-neutral-400 italic leading-relaxed border-l-2 border-primary/20 pl-3 text-left">
                    "{activity.description}"
                  </p>
                </div>
              )}

              {isHost && activity.isBoosted && (
                <Button 
                  variant="outline" 
                  asChild
                  className="mt-6 rounded-2xl font-black border-orange-200 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all gap-2"
                >
                  <Link href={`/activities/${activity.id}/stats`}>
                    <BarChart3 className="h-4 w-4" />
                    <span>Boost Insights</span>
                  </Link>
                </Button>
              )}
            </div>

            {/* Requirements Section */}
            {activity.requirements && (
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-sm font-black text-slate-900 dark:text-neutral-100 uppercase tracking-wider">{language === 'de' ? 'Kriterien zum Beitreten' : 'Join Criteria'}</h3>
                  <span className="h-1 flex-1 mx-4 bg-slate-50 dark:bg-neutral-800 rounded-full" />
                </div>
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
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="">{language === 'de' ? 'Mitglieder' : 'Members'}</h3>
                <span className="h-1 flex-1 mx-4 bg-slate-50 dark:bg-neutral-800 rounded-full" />
              </div>
              
              <ul className="space-y-2">
                {Object.entries(chat.participantDetails).map(([uid, p]) => (
                   <li key={uid}>
                      <Link
                          href={user?.uid === uid ? '/profile' : `/users/${uid}`}
                          className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-all group"
                          onClick={() => onOpenChange(false)}
                      >
                          <ProfileAvatar 
                              className="h-12 w-12 border-2 border-white dark:border-neutral-800 shadow-sm ring-2 ring-transparent group-hover:ring-primary/20 transition-all"
                              photoURL={p.photoURL}
                              displayName={p.displayName}
                              isPremium={p.isPremium}
                              isCreator={p.isCreator}
                              isSupporter={p.isSupporter}
                          />
                          <div className="flex-1 flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-neutral-100 truncate">
                                    {formatFirstName(p.displayName, 'User')}
                                </span>
                                {uid === chat.hostId && (
                                  <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tight">{language === 'de' ? 'Creator' : 'Creator'}</span>
                                )}
                              </div>
                              {uid === user?.uid && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{language === 'de' ? 'Du' : 'You'}</span>}
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                      </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="p-6 bg-slate-50 dark:bg-neutral-900 border-t border-slate-100 dark:border-neutral-800 flex flex-col gap-3">
            {isHost && isPastOrPresent && !isCompleted && (
              <Button 
                onClick={handleCompleteActivity} 
                disabled={isActing}
                 className="w-full h-12 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 transition-all gap-2 mb-2"
               >
                 {isActing ? <BarChart3 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4" />}
                 <span>{language === 'de' ? 'Aktivität erfolgreich abschließen' : 'Successfully complete activity'}</span>
               </Button>
            )}

            {!isCompleted && !isHost && (
                 <Button 
                  onClick={handleVote} 
                  disabled={isVoting || hasVoted} 
                  variant="outline" 
                  className="w-full h-12 rounded-2xl font-black bg-white dark:bg-neutral-800 border-none shadow-sm hover:shadow-md transition-all gap-2"
                  >
                     {isVoting ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className={cn("h-4 w-4", hasVoted ? "text-primary" : "text-slate-400")}/>}
                     <span className={hasVoted ? "text-primary" : "text-slate-600 dark:text-neutral-300"}>
                        {hasVoted ? (language === 'de' ? "Bestätigt" : "Confirmed") : (language === 'de' ? "Treffen bestätigen" : "Confirm meeting")}
                     </span>
                  </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                 <Button variant="destructive" className="w-full h-12 rounded-2xl font-black bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border-none shadow-none transition-all gap-2">
                   {isActing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                   {isOnlyParticipant ? (language === 'de' ? 'Aktivität löschen' : 'Delete activity') : (language === 'de' ? 'Chat verlassen' : 'Leave chat')}
                 </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl border-none shadow-2xl dark:bg-neutral-900">
                <AlertDialogHeader>
                   <AlertDialogTitle className="">
                     {isOnlyParticipant
                       ? (language === 'de' ? 'Wirklich löschen?' : 'Really delete?')
                       : (language === 'de' ? 'Wirklich verlassen?' : 'Really leave?')}
                   </AlertDialogTitle>
                   <AlertDialogDescription className="text-sm font-medium dark:text-neutral-400">
                     {isOnlyParticipant
                       ? (language === 'de' ? 'Diese Aktion kann nicht rückgängig gemacht werden. Alle Nachrichten werden dauerhaft gelöscht.' : 'This action cannot be undone. All messages will be permanently deleted.')
                       : (language === 'de' ? 'Du kannst später wieder beitreten, solange die Aktivität noch existiert.' : 'You can join again later as long as the activity still exists.')}
                   </AlertDialogDescription>
                </AlertDialogHeader>
                 <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                   <AlertDialogCancel className="rounded-xl font-bold h-11 border-none bg-slate-100 dark:bg-neutral-800 dark:text-neutral-300">{language === 'de' ? 'Abbrechen' : 'Cancel'}</AlertDialogCancel>
                  <AlertDialogAction 
                    disabled={isActing} 
                    className='bg-red-500 hover:bg-red-600 text-white rounded-xl font-black h-11 border-none shadow-lg shadow-red-200'
                     onClick={handleLeaveOrDelete}
                   >
                     {isActing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                     {isOnlyParticipant ? (language === 'de' ? 'Endgültig löschen' : 'Delete permanently') : (language === 'de' ? 'Jetzt verlassen' : 'Leave now')}
                   </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
