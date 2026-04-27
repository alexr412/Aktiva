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
import { cn } from '@/lib/utils';
import { voteActivity, trackActivityView, submitReport } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { getPrimaryIconData } from '@/lib/tag-config';
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

    const getIconGradient = (bgClass: string) => {
      const map: Record<string, string> = {
        'bg-blue-50': 'bg-gradient-to-br from-blue-400 to-blue-600',
        'bg-red-50': 'bg-gradient-to-br from-red-400 to-red-600',
        'bg-orange-50': 'bg-gradient-to-br from-orange-400 to-orange-600',
        'bg-green-50': 'bg-gradient-to-br from-green-400 to-green-600',
        'bg-yellow-50': 'bg-gradient-to-br from-yellow-400 to-yellow-600',
        'bg-amber-50': 'bg-gradient-to-br from-amber-400 to-amber-600',
        'bg-purple-50': 'bg-gradient-to-br from-purple-400 to-purple-600',
        'bg-cyan-50': 'bg-gradient-to-br from-cyan-400 to-cyan-600',
        'bg-pink-50': 'bg-gradient-to-br from-pink-400 to-pink-600',
        'bg-fuchsia-50': 'bg-gradient-to-br from-fuchsia-400 to-fuchsia-600',
        'bg-slate-50': 'bg-gradient-to-br from-slate-400 to-slate-600',
      };
      return map[bgClass] || 'bg-gradient-to-br from-violet-400 to-violet-600';
    };

    return (
        <div 
          ref={cardRef}
          className={cn(
            "p-5 relative group transition-all rounded-[2rem] bg-white dark:bg-neutral-800 shadow-sm border-none dark:border dark:border-neutral-700 mb-4",
            activity.isBoosted && "border-2 border-orange-400 bg-orange-50/10 dark:bg-orange-950/20 shadow-md ring-4 ring-orange-500/5"
          )}
        >
            {activity.isBoosted && (
              <div className="absolute -top-3 left-6 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg animate-in fade-in slide-in-from-top-1 flex items-center gap-1.5 z-10">
                <Flame className="h-3 w-3 animate-pulse" />
                <span>{language === 'de' ? 'Highlight' : 'Highlight'}</span>
              </div>
            )}

            <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-10">
                <div className="bg-primary/10 text-primary text-[11px] font-black px-3 py-1 rounded-xl border border-primary/20 shadow-sm flex items-center gap-1">
                    <ArrowUp className="h-3 w-3" />
                    {activity.communityScore || 0}
                </div>
            </div>

            {isOwnActivity && activity.isBoosted && (
              <Button 
                variant="ghost" 
                size="sm" 
                asChild
                className="absolute top-2 right-2 h-8 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-700 text-[10px] font-black uppercase"
              >
                <Link href={`/activities/${activity.id}/stats`}>
                  <BarChart3 className="h-3 w-3 mr-1" />
                  Insights
                </Link>
              </Button>
            )}

            <div className="flex items-start gap-4">
                <div className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl flex-shrink-0 transition-transform group-hover:scale-105", 
                    getIconGradient(primaryStyle.bgClass)
                )}>
                    <PrimaryIcon className="h-8 w-8 text-white drop-shadow-sm" />
                </div>
                
                <div className="min-w-0 flex-1 pr-14">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-lg font-black text-[#0f172a] dark:text-neutral-200 truncate leading-tight">
                            {activity.placeName || (language === 'de' ? "Treffen" : "Meetup")}
                        </p>
                        
                        {/* MODUL 18: Enhanced Rating Display with Fallback */}
                        <div className="ml-2 flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-lg border border-amber-100 dark:border-amber-800">
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                          {reviewCount > 0 ? (
                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400">
                              {rating.toFixed(1)} <span className="opacity-50">({reviewCount})</span>
                            </span>
                          ) : (
                            <span className="text-[8px] font-black uppercase text-amber-600 dark:text-amber-500">{language === 'de' ? 'Neu' : 'New'}</span>
                          )}
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        {activity.distance !== undefined && activity.distance !== null && (
                          <div className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-bold text-[10px] tracking-tight">
                            <MapPin className="h-2.5 w-2.5" />
                            <span>{activity.distance < 1 ? '< 1 km' : `${activity.distance.toFixed(1)} km`}</span>
                          </div>
                        )}

                        {isPaidEvent && (
                          <div className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-black text-[10px] tracking-tight">
                            <CreditCard className="h-2.5 w-2.5" />
                            <span>{activity.price?.toFixed(2)}€</span>
                          </div>
                        )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex items-center gap-1 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-blue-100/50">
                        <Layers className="w-2.5 h-2.5" />
                        <span>{formatTags(activity.categories || [activity.category || ''], language)[0] || (language === 'de' ? 'Sonstiges' : 'Other')}</span>
                      </div>
                      {activityDate && (
                        <div className="text-[9px] font-bold text-slate-400 uppercase">
                            {format(activityDate, language === 'de' ? 'eee, d. MMM' : 'eee, MMM d', { locale: language === 'de' ? de : enUS })}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 overflow-hidden">
                          {isPremium ? (
                            <>
                              {previewList.slice(0, 4).map((p) => (
                                <Avatar key={p.uid} className="h-6 w-6 border-2 border-background shadow-sm">
                                  <AvatarImage src={p.photoURL || undefined} />
                                  <AvatarFallback className="text-[8px] font-black bg-primary/10 text-primary">{p.displayName?.charAt(0) || "U"}</AvatarFallback>
                                </Avatar>
                              ))}
                              {previewList.length > 4 && (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[8px] font-bold border-2 border-background text-foreground">
                                  +{previewList.length - 4}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="flex -space-x-2">
                               {[1, 2, 3].map(i => (
                                 <div key={i} className="h-6 w-6 rounded-full bg-muted/50 border-2 border-background border-dashed" />
                               ))}
                            </div>
                          )}
                        </div>

                        {!isPremium && (
                          <span className="text-[10px] text-muted-foreground font-medium italic flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-500" />
                            Preview
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted/30 rounded-full">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground tracking-tight">
                          {participantIds.length} / {activity.maxParticipants || '∞'}
                        </span>
                      </div>
                    </div>
                </div>
            </div>

            <div className="card-footer-actions flex justify-between items-center w-full mt-5 pt-4 border-t border-neutral-50 dark:border-neutral-700/50">
              <div className="flex items-center gap-3">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Users className="h-3 w-3 text-primary/60"/>
                    <span>{language === 'de' ? 'Veranstalter' : 'Host'}: {activity.hostName?.split(' ')[0] || (language === 'de' ? "Gast" : "Explorer")}</span>

                </p>
              </div>

              <div className="flex gap-2">
                {isParticipant ? (
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); handleViewChatClick(activity.id!); }} 
                    className="h-10 rounded-2xl bg-white shadow-sm border-neutral-100 hover:bg-neutral-50 text-primary font-bold gap-2 px-4"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Chat</span>
                  </Button>
                ) : (
                  <Button 
                    size="sm"
                    onClick={handleJoinClick} 
                    disabled={isJoining || isFull}
                    className={cn(
                        "h-10 rounded-2xl font-black px-6 shadow-lg transition-transform active:scale-95",
                        isPaidEvent 
                            ? "bg-slate-900 hover:bg-black text-white shadow-slate-200" 
                            : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
                    )}
                  >
                    {isJoining ? (
                        <Loader2 className="animate-spin h-4 w-4" />
                    ) : isFull ? (
                        language === 'de' ? 'Voll' : 'Full'
                    ) : (
                        language === 'de' ? 'Beitreten' : 'Join'
                    )}
                  </Button>
                )}
              </div>
            </div>
        </div>
    );
}
