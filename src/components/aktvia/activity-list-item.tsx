'use client';

import { useState, useEffect, useRef } from 'react';
import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { Loader2, MessageSquare, Users, Flame, Bookmark, Plus, MapPin, CreditCard, Crown, BarChart3, AlertTriangle, Layers, Star, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserBadge } from '@/components/common/UserBadge';
import { cn } from '@/lib/utils';
import { castActivityVote, trackActivityView, submitReport } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { getPrimaryIconData, translateTag } from '@/lib/tag-config';
import { formatTags } from '@/lib/tag-parser';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface ActivityListItemProps {
    activity: Activity & { distance?: number | null };
    user: User | null;
    onJoin: (activityId: string) => Promise<void>;
}

export function ActivityListItem({ activity, user, onJoin }: ActivityListItemProps) {
    const { userProfile } = useAuth();
    const language = useLanguage();
    const router = useRouter();
    const { toast } = useToast();
    const [isJoining, setIsJoining] = useState(false);
    const [isVoting, setIsVoting] = useState(false);
    const [isReporting, setIsReporting] = useState(false);
    
    const cardRef = useRef<HTMLDivElement>(null);
    const hasTracked = useRef(false);

    useEffect(() => {
      if (!activity || !activity.id || !activity.isBoosted || hasTracked.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !hasTracked.current) {
            trackActivityView(activity.id!);
            hasTracked.current = true;
          }
        },
        { threshold: 0.5 }
      );

      if (cardRef.current) {
        observer.observe(cardRef.current);
      }

      return () => observer.disconnect();
    }, [activity]);

    if (!activity || !activity.id) return null;

    const participantIds = activity.participantIds || [];
    const isParticipant = user ? participantIds.includes(user.uid) : false;
    const isFull = activity.maxParticipants ? participantIds.length >= activity.maxParticipants : false;
    const isOwnActivity = activity.hostId === user?.uid;
    
    const isPaidEvent = activity.isPaid && activity.price && activity.price > 0;
    const isPremium = userProfile?.isPremium || false;
    const previewList = activity.participantsPreview || [];

    const primaryStyle = getPrimaryIconData({ 
        categories: activity.categories || [], 
        name: activity.placeName || (language === 'de' ? "Aktivität" : "Activity")
    }, language);
    const PrimaryIcon = primaryStyle.icon;

    const handleJoinClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isJoining || isParticipant || isFull) return; 

        if (!user) {
            router.push('/login');
            return;
        }

        if (isPaidEvent) {
            router.push(`/checkout/${activity.id}`);
            return;
        }

        setIsJoining(true);
        try { 
            await onJoin(activity.id!); 
        } catch (error) { 
            setIsJoining(false); 
        }
    };
    
    const handleViewChatClick = (activityId: string) => { router.push(`/chat/${activityId}`); };

    const handleReport = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user) {
        router.push('/login');
        return;
      }
      setIsReporting(true);
      try {
        await submitReport(activity.id!, user.uid, language === 'de' ? "Verstoß gegen Richtlinien" : "Policy violation");
        toast({
          title: language === 'de' ? "Meldung eingegangen" : "Report received",
          description: language === 'de' ? "Vielen Dank. Wir prüfen den Inhalt umgehend." : "Thank you. We will review the content immediately.",
        });
      } catch (error) {
        console.error("Meldevorgang fehlgeschlagen", error);
        toast({
          variant: "destructive",
          title: language === 'de' ? "Fehler" : "Error",
          description: language === 'de' ? "Meldung konnte nicht gesendet werden." : "Message could not be sent.",
        });
      } finally {
        setIsReporting(false);
      }
    };

    const activityDate = activity.activityDate?.toDate();

    // MODUL 18: Rating Fallback Logic
    const rating = activity.avgRating || 0;
    const reviewCount = activity.reviewCount || 0;


    return (
        <div 
          ref={cardRef}
          onClick={() => router.push(`/activities/${activity.id}`)}
          className={cn(
              "group cursor-pointer overflow-hidden rounded-[1.5rem] bg-white dark:bg-neutral-800 border-none shadow-xl shadow-slate-200/50 transition-all duration-500 flex flex-col relative p-0 h-full dark:shadow-none",
              activity.isBoosted && "ring-4 ring-orange-500/10 shadow-orange-500/20"
          )}
        >
            {/* Oberer Bild/Icon-Bereich */}
            <div className={cn(
                "w-full h-20 flex items-center justify-center relative transition-transform duration-700 group-hover:scale-105 overflow-hidden",
                primaryStyle.gradientClass
            )}>
                {/* Haupt-Icon & Label */}
                <div className="flex flex-col items-center gap-1 z-10">
                    <PrimaryIcon className="text-white h-7 w-7 drop-shadow-2xl" />
                    <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/90 drop-shadow-md">{primaryStyle.label}</span>
                </div>

                {/* Status Badges - Left */}
                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-20">
                    {activity.isBoosted && (
                        <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[8px] font-black px-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1 border border-white/20">
                            <Flame className="h-2.5 w-2.5 animate-pulse" />
                            <span>Highlight</span>
                        </div>
                    )}
                </div>

                {/* Status Badges - Right */}
                <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5 z-20">
                    <div className="h-5 bg-white/20 backdrop-blur-md text-white text-[8px] font-black px-2 rounded-full flex items-center gap-1 border border-white/20">
                        <ArrowUp className="h-2.5 w-2.5" />
                        {activity.communityScore || 0}
                    </div>
                </div>
            </div>

            {/* Content Bereich */}
            <div className="p-3 pb-4 flex flex-col flex-1">
                <div className="mb-2">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-base truncate flex-1 text-[#0f172a] dark:text-neutral-200">
                            {activity.placeName || (language === 'de' ? "Treffen" : "Meetup")}
                        </h3>
                    </div>
                    
                    <div className="flex items-center gap-1.5 mt-0.5 text-neutral-400 dark:text-neutral-500 font-bold text-[9px]">
                        {activityDate && (
                            <span className="truncate">
                                {format(activityDate, language === 'de' ? 'eee, d. MMM HH:mm' : 'eee, MMM d HH:mm', { locale: language === 'de' ? de : enUS })}
                            </span>
                        )}
                        {activity.distance !== undefined && activity.distance !== null && (
                            <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {activity.distance < 1 ? '< 1 km' : `${activity.distance.toFixed(1)} km`}</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                    <Badge variant="secondary" className="rounded-full text-[7px] font-black uppercase tracking-widest px-2 py-0.5 border-none bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        USER EVENT
                    </Badge>
                    {isPaidEvent && (
                        <Badge variant="secondary" className="rounded-full text-[7px] font-black uppercase tracking-widest px-2 py-0.5 border-none bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {activity.price?.toFixed(2)}€
                        </Badge>
                    )}
                </div>

                {activity.description && (
                    <p className="mb-3 text-[9px] text-slate-500 dark:text-neutral-400 font-medium leading-relaxed italic border-l border-primary/20 pl-2 line-clamp-2 overflow-hidden text-ellipsis break-words">
                        "{activity.description}"
                    </p>
                )}

                <div className="flex items-center gap-2 mb-3">
                    <div className="flex -space-x-1.5 overflow-hidden">
                        {previewList.slice(0, 3).map((p) => (
                            <Avatar key={p.uid} className="h-5 w-5 border border-white shadow-sm">
                                <AvatarImage src={p.photoURL || undefined} />
                                <AvatarFallback className="text-[7px] font-black bg-slate-100 text-slate-600">{p.displayName?.charAt(0) || "U"}</AvatarFallback>
                            </Avatar>
                        ))}
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 ml-1">
                        {participantIds.length} / {activity.maxParticipants || '∞'}
                    </span>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-50 dark:border-neutral-800/50">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Users className="h-3 w-3 text-slate-300 shrink-0" />
                        <span className="text-[9px] text-slate-400 font-bold uppercase truncate flex items-center gap-1">
                            {language === 'de' ? 'Veranstalter:' : 'Host:'} {activity.hostName?.split(' ')[0] || "User"}
                            {activity.participantDetails?.[activity.hostId] && (
                              <UserBadge
                                isPremium={activity.participantDetails[activity.hostId].isPremium}
                                isSupporter={activity.participantDetails[activity.hostId].isSupporter}
                                isCreator={activity.participantDetails[activity.hostId].isCreator}
                                isExplorer={(activity.participantDetails[activity.hostId] as any).isExplorer}
                                isOrganizer={(activity.participantDetails[activity.hostId] as any).isOrganizer}
                                size="sm"
                              />
                            )}
                        </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                        {isParticipant ? (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={(e) => { e.stopPropagation(); handleViewChatClick(activity.id!); }} 
                                className="h-7 rounded-lg text-[9px] font-black text-primary border-primary/20 px-3 flex items-center gap-1.5"
                            >
                                <MessageSquare className="h-3 w-3" />
                                Chat
                            </Button>
                        ) : (
                            <Button 
                                size="sm"
                                onClick={handleJoinClick} 
                                disabled={isJoining || isFull}
                                className={cn(
                                    "h-7 rounded-lg text-[9px] font-black px-4",
                                    isPaidEvent ? "bg-slate-900 text-white" : "bg-primary text-white"
                                )}
                            >
                                {isJoining ? <Loader2 className="animate-spin h-3 w-3" /> : isFull ? (language === 'de' ? 'Voll' : 'Full') : (language === 'de' ? 'Beitreten' : 'Join')}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
