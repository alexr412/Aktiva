'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { leaveActivity, deleteActivity, voteToCompleteActivity } from '@/lib/firebase/firestore';
import Link from 'next/link';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Trash2, Users, Calendar, CheckCircle, MapPin, ChevronRight } from 'lucide-react';
import type { Chat, Activity } from '@/lib/types';
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton';

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
  const router = useRouter();
  const { toast } = useToast();

  const renderDate = () => {
      if (!activity) return null;

      if (activity.activityEndDate) {
          return `${format(activity.activityDate.toDate(), "eee, d. MMM", { locale: de })} - ${format(activity.activityEndDate.toDate(), "eee, d. MMM", { locale: de })}`;
      }
      if (activity.isTimeFlexible) {
          return `${format(activity.activityDate.toDate(), "eee, d. MMM", { locale: de })} (Flexibel)`;
      }
      return format(activity.activityDate.toDate(), "eee, d. MMM 'um' p", { locale: de });
  }


  if (!chat || !user || !activity) return null;

  const isOnlyParticipant = chat.participantIds.length === 1;
  const hasVoted = activity?.completionVotes?.includes(user.uid);
  const isCompleted = activity.status === 'completed';

  const handleLeaveOrDelete = async () => {
    if (!chat?.id || !user?.uid) return;
    
    // 1. Fokus-Abwurf erzwingen
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Modal sofort schließen (Startet die Exit-Animation)
    onOpenChange(false);
    
    // 2. Entkopplung mit Puffer (400ms) für Radix Exit-Animation
    setTimeout(async () => {
      // 3. Manueller Fail-Safe: DOM Locks entfernen
      if (typeof document !== 'undefined') {
        document.body.style.pointerEvents = 'auto';
        document.body.removeAttribute('data-scroll-locked');
      }

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
    }, 400); 
  };
  
  const handleVote = async () => {
      if (!activity?.id || !user?.uid || hasVoted) return;
      setIsVoting(true);
      try {
        await voteToCompleteActivity(activity.id, user.uid);
        toast({ title: "Stimme abgegeben!" });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Fehler', description: error.message });
      } finally {
        setIsVoting(false);
      }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 sm:max-w-md border-none rounded-l-[2.5rem] overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-8">
            <div className="flex flex-col items-center text-center pb-8 border-b border-slate-100 mb-8">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-400 to-cyan-400 mb-6 flex items-center justify-center shadow-xl transform rotate-3">
                <MapPin className="text-white h-10 w-10 drop-shadow-md" />
              </div>
              
              <SheetTitle className="text-2xl font-black text-slate-900 mb-4 tracking-tight leading-tight">
                {chat.placeName}
              </SheetTitle>
              
              <div className="flex flex-wrap justify-center gap-2">
                <span className="bg-blue-50 text-blue-700 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                  <Users className="h-3.5 w-3.5" /> {chat.participantIds.length} {chat.participantIds.length === 1 ? 'Mitglied' : 'Mitglieder'}
                </span>
                <span className="bg-orange-50 text-orange-700 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                  <Calendar className="h-3.5 w-3.5" /> {renderDate()}
                </span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Mitglieder</h3>
                <span className="h-1 flex-1 mx-4 bg-slate-50 rounded-full" />
              </div>
              
              <ul className="space-y-2">
                {Object.entries(chat.participantDetails).map(([uid, p]) => (
                   <li key={uid}>
                      <Link
                          href={user?.uid === uid ? '/profile' : `/profile/${uid}`}
                          className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-all group"
                          onClick={() => onOpenChange(false)}
                      >
                          <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                              <AvatarImage src={p.photoURL || undefined} />
                              <AvatarFallback className="bg-primary/5 text-primary font-black">{p.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 truncate">
                                    {p.displayName}
                                </span>
                                {uid === chat.creatorId && (
                                  <span className="bg-emerald-50 text-emerald-600 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tight">Creator</span>
                                )}
                              </div>
                              {uid === user?.uid && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Du</span>}
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                      </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
            {!isCompleted && (
                 <Button 
                  onClick={handleVote} 
                  disabled={isVoting || hasVoted} 
                  variant="outline" 
                  className="w-full h-12 rounded-2xl font-black bg-white border-none shadow-sm hover:shadow-md transition-all gap-2"
                 >
                    {isVoting ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className={cn("h-4 w-4", hasVoted ? "text-primary" : "text-slate-400")}/>}
                    <span className={hasVoted ? "text-primary" : "text-slate-600"}>{hasVoted ? "Bestätigt" : "Treffen bestätigen"}</span>
                 </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full h-12 rounded-2xl font-black bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none transition-all gap-2">
                  {isActing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                  {isOnlyParticipant ? 'Aktivität löschen' : 'Chat verlassen'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black">
                    {isOnlyParticipant
                      ? 'Wirklich löschen?'
                      : 'Wirklich verlassen?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium">
                    {isOnlyParticipant
                      ? 'Diese Aktion kann nicht rückgängig gemacht werden. Alle Nachrichten werden dauerhaft gelöscht.'
                      : 'Du kannst später wieder beitreten, solange die Aktivität noch existiert.'}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="rounded-xl font-bold h-11 border-none bg-slate-100">Abbrechen</AlertDialogCancel>
                  <AlertDialogAction 
                    disabled={isActing} 
                    className='bg-red-500 hover:bg-red-600 text-white rounded-xl font-black h-11 border-none shadow-lg shadow-red-200'
                    onPointerDown={(e) => {
                      // Abfangen des Events vor Radix Fokus-Management
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.currentTarget) {
                        e.currentTarget.blur();
                      }
                      handleLeaveOrDelete();
                    }}
                  >
                    {isActing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isOnlyParticipant ? 'Endgültig löschen' : 'Jetzt verlassen'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
