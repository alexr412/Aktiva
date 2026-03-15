'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { joinActivity } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, Users, Calendar, MapPin, Share2, Crown, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { UserBadge } from '@/components/common/UserBadge';
import { cn } from '@/lib/utils';

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
  const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;

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
        {/* Featured Hero Card */}
        <div className={cn(
          "rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden",
          activity.isBoosted ? "bg-gradient-to-br from-orange-400 to-amber-500" : "bg-slate-900"
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

        {/* Host Info */}
        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Veranstalter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-slate-100">
                  <AvatarImage src={activity.creatorPhotoURL || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-black">{activity.creatorName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-black text-slate-900">{activity.creatorName}</p>
                    <UserBadge isPremium={activity.participantDetails?.[activity.creatorId]?.isPremium} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Host auf Aktvia</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => router.push(`/profile/${activity.creatorId}`)} className="rounded-xl font-bold h-10">Profil</Button>
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

        {/* Premium Preview Section */}
        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400">Wer ist dabei?</CardTitle>
            <Crown className="h-4 w-4 text-amber-500 opacity-50" />
          </CardHeader>
          <CardContent>
            <div className="flex -space-x-3 overflow-hidden p-2">
              {userProfile?.isPremium ? (
                activity.participantsPreview?.map((p) => (
                  <Avatar key={p.uid} className="h-10 w-10 border-4 border-white shadow-sm hover:scale-110 transition-transform cursor-pointer" onClick={() => router.push(`/profile/${p.uid}`)}>
                    <AvatarImage src={p.photoURL || undefined} />
                    <AvatarFallback className="bg-primary/5 text-primary text-xs font-black">{p.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                ))
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-10 w-10 rounded-full bg-slate-100 border-4 border-white border-dashed" />)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold italic">Premium für Details</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Button */}
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
      </main>
    </div>
  );
}
