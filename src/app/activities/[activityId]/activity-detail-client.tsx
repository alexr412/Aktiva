'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { joinActivity, cancelActivity } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, Users, Calendar, MapPin, Share2, Crown, Star, MessageSquare, CreditCard, Camera, Ban, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
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
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ActivityDetailClientProps {
  activityId: string;
}

export default function ActivityDetailClient({ activityId }: ActivityDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralId = searchParams.get('ref');
  const { user, userProfile } = useAuth();
  const { toast } = useToast();

  const [activity, setActivity] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!activityId || !db) return;

    const unsubscribe = onSnapshot(doc(db, 'activities', activityId), (docSnap) => {
      if (docSnap.exists()) {
        setActivity({ id: docSnap.id, ...docSnap.data() } as Activity);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activityId]);

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

    setIsJoining(true);
    try {
      await joinActivity(activity.id!, user, null, referralId);
      toast({ title: "Willkommen!", description: "Du bist der Aktivität beigetreten." });
      router.push(`/chat/${activity.id}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: error.message });
    } finally {
      setIsJoining(false);
    }
  };

  const handleCancel = async () => {
    if (!activity?.id || !user) return;
    setIsCancelling(true);
    try {
      await cancelActivity(activity.id, user.uid);
      toast({ title: "Aktivität storniert", description: "Alle Teilnehmer wurden über die Stornierung informiert." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Fehler", description: error.message });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleShare = async () => {
    if (!activity) return;
    const shareUrl = `${window.location.origin}/activities/${activity.id}?ref=${user?.uid || 'guest'}`;
    const shareData = {
      title: `Check out ${activity.placeName}`,
      text: `Join me for ${activity.category || 'this event'} at ${activity.placeName}!`,
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
      toast({ title: "Link kopiert!" });
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
        <h1 className="text-2xl font-black text-slate-900">Nicht gefunden</h1>
        <p className="text-slate-500 mb-6">Diese Aktivität existiert nicht mehr oder ist privat.</p>
        <Button onClick={() => router.push('/')} className="rounded-2xl h-12 px-8 font-black">Zurück zum Feed</Button>
      </div>
    );
  }

  const isParticipant = user ? activity.participantIds.includes(user.uid) : false;
  const isHost = user && activity.hostId === user.uid;
  const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;
  const checkInStatus = user ? activity.participantDetails?.[user.uid]?.checkInStatus : 'pending';
  const isCancelled = activity.status === 'cancelled';

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-y-auto">
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between px-4 bg-white/80 border-b border-slate-100 backdrop-blur-md">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-black text-lg truncate flex-1 text-center px-4">{activity.placeName}</h1>
        <Button variant="ghost" size="icon" onClick={handleShare} className="rounded-full">
          <Share2 className="h-5 w-5" />
        </Button>
      </header>

      <main className="flex-1 p-4 sm:p-8 max-w-2xl mx-auto w-full space-y-6 pb-24">
        {/* Status Indicator */}
        {isCancelled && (
          <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[2rem] flex flex-col items-center text-center gap-2 animate-in slide-in-from-top-4 duration-500">
            <Ban className="h-10 w-10 text-red-500" />
            <div>
              <h3 className="text-lg font-black text-red-900 uppercase">Aktivität Storniert</h3>
              <p className="text-sm font-medium text-red-700/70">Dieses Event findet nicht statt. Falls du ein Ticket gekauft hast, wird der Betrag automatisch rückerstattet.</p>
            </div>
          </div>
        )}

        {/* Host Control Section */}
        {isHost && !isCancelled && (
          <Card className="border-none shadow-sm rounded-[2rem] bg-slate-900 text-white overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">Host Panel</span>
                  <p className="font-bold text-sm">Ticketing & Einlass</p>
                </div>
                <Button asChild className="rounded-xl font-black bg-primary hover:bg-primary/90 text-white gap-2">
                  <Link href={`/activities/${activity.id}/scanner`}>
                    <Camera className="h-4 w-4" />
                    Scanner öffnen
                  </Link>
                </Button>
              </div>
              
              <div className="pt-4 border-t border-white/10">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-white/5 rounded-xl font-bold gap-2">
                      <Ban className="h-4 w-4" />
                      Aktivität stornieren
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl">
                    <AlertDialogHeader>
                      <div className="mx-auto bg-red-100 p-4 rounded-full w-fit mb-4">
                        <AlertTriangle className="h-10 w-10 text-red-600" />
                      </div>
                      <AlertDialogTitle className="text-2xl font-black text-center">Unwiderruflich stornieren?</AlertDialogTitle>
                      <AlertDialogDescription className="text-center text-base font-medium">
                        Dies kann nicht rückgängig gemacht werden. {activity.isPaid && "Alle bezahlten Tickets werden automatisch zur Rückerstattung vorgemerkt und dein Treuhand-Guthaben wird entsprechend reduziert."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex flex-col gap-3 sm:gap-0 mt-6">
                      <AlertDialogCancel className="rounded-xl font-bold h-12">Abbrechen</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancel} disabled={isCancelling} className="rounded-xl font-black h-12 bg-red-500 hover:bg-red-600 shadow-lg shadow-red-100">
                        {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ja, Stornieren"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Featured Hero Card */}
        <div className={cn(
          "rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden transition-all duration-1000",
          isCancelled ? "opacity-40 grayscale blur-[1px]" : "",
          activity.isBoosted && !isCancelled ? "bg-gradient-to-br from-orange-400 to-amber-500" : "bg-slate-900"
        )}>
          <div className="relative z-10">
            <Badge className="bg-white/20 hover:bg-white/30 text-white border-none mb-4 px-3 py-1 font-black uppercase tracking-widest text-[10px]">
              {activity.category || 'Aktivität'}
            </Badge>
            <h2 className="text-3xl font-black leading-tight mb-2">{activity.placeName}</h2>
            <p className="text-white/70 font-medium mb-6 flex items-center gap-1.5 text-sm">
              <MapPin className="h-4 w-4" /> {activity.placeAddress || 'Ort wird im Chat bekannt gegeben'}
            </p>
            
            <div className="flex items-center gap-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex-1">
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Datum</p>
                <p className="text-sm font-black">{format(activity.activityDate.toDate(), 'eee, d. MMM', { locale: de })}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex-1">
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1">Zeit</p>
                <p className="text-sm font-black">{activity.isTimeFlexible ? 'Flexibel' : format(activity.activityDate.toDate(), 'HH:mm')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Participant Ticket Section */}
        {isParticipant && !isCancelled && (
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden text-center p-8">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-black uppercase tracking-tight">Dein Ticket</CardTitle>
              <CardDescription className="font-medium">Zeige diesen Code beim Einlass vor.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <div className={cn("transition-opacity duration-500", checkInStatus === 'scanned' && "opacity-20 grayscale")}>
                <TicketQR activityId={activityId} userId={user!.uid} />
              </div>
              
              {checkInStatus === 'scanned' && (
                <div className="mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 animate-in fade-in zoom-in-95">
                  <Star className="h-4 w-4 fill-emerald-600" />
                  <span className="text-xs font-black uppercase tracking-widest">Eingetreten & Verifiziert</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Host Info */}
        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Veranstalter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-slate-100">
                  <AvatarImage src={activity.hostPhotoURL || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-black">{activity.hostName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-black text-slate-900">{activity.hostName}</p>
                    <UserBadge isPremium={activity.participantDetails?.[activity.hostId]?.isPremium} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Host auf Aktvia</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => router.push(`/profile/${activity.hostId}`)} className="rounded-xl font-bold h-10">Profil</Button>
            </div>
          </CardContent>
        </Card>

        {/* Participants & Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6 flex flex-col items-center justify-center text-center">
            <Users className="h-5 w-5 text-primary mb-2" />
            <p className="text-2xl font-black text-slate-900">{activity.participantIds.length} / {activity.maxParticipants || '∞'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Teilnehmer</p>
          </Card>
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6 flex flex-col items-center justify-center text-center">
            <Star className="h-5 w-5 text-amber-500 mb-2 fill-amber-500" />
            <p className="text-2xl font-black text-slate-900">{activity.upvotes || 0}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Beliebtheit</p>
          </Card>
        </div>

        {/* Action Button */}
        {!isCancelled && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 z-20">
            <div className="max-w-md mx-auto">
              {isParticipant ? (
                <Button onClick={() => router.push(`/chat/${activity.id}`)} className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Zum Gruppenchat
                </Button>
              ) : (
                <Button 
                  onClick={handleJoin} 
                  disabled={isJoining || isFull}
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
                      {isFull ? 'Aktivität ist voll' : activity.isPaid ? `Beitreten (€${activity.price?.toFixed(2)})` : 'Jetzt beitreten'}
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
