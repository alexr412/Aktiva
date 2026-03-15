'use client';

import { useState, useEffect, useRef } from 'react';
import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Loader2, MessageSquare, Users, Flame, Bookmark, Plus, MapPin, CreditCard, Crown, BarChart3, AlertTriangle, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EntityMoreOptions } from '../common/EntityMoreOptions';
import { cn } from '@/lib/utils';
import { voteActivity, trackActivityView, submitReport } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
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

    const isParticipant = activity.participantIds.includes(user?.uid || '---');
    const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;
    const isOwnActivity = activity.hostId === user?.uid;
    const userVote = user ? (activity.userVotes?.[user.uid] || 'none') : 'none';
    
    const isPaidEvent = activity.isPaid && activity.price && activity.price > 0;
    const isPremium = userProfile?.isPremium || false;
    const previewList = activity.participantsPreview || [];

    const primaryStyle = getPrimaryIconData({ categories: activity.categories, name: activity.placeName });
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

    const handleVote = async (activityId: string, type: 'up' | 'down' | 'none') => {
        if (!user || isVoting) return;
        setIsVoting(true);
        try { await voteActivity(activityId, user.uid, type); } catch (error) { console.error("Voting failed:", error); } finally { setIsVoting(false); }
    };

    const handleReport = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user) {
        router.push('/login');
        return;
      }
      setIsReporting(true);
      try {
        await submitReport(activity.id!, user.uid, "Verstoß gegen Richtlinien");
        toast({
          title: "Meldung eingegangen",
          description: "Vielen Dank. Wir prüfen den Inhalt umgehend.",
        });
      } catch (error) {
        console.error("Meldevorgang fehlgeschlagen", error);
        toast({
          variant: "destructive",
          title: "Fehler",
          description: "Meldung konnte nicht gesendet werden.",
        });
      } finally {
        setIsReporting(false);
      }
    };

    const rawTags = (activity.categories || []).filter((tag: string) => 
      !tag.startsWith('wheelchair') && 
      !tag.startsWith('fee') && 
      !tag.startsWith('no_fee')
    );
    const processedTags = formatTags(rawTags);

    return (
        <div 
          ref={cardRef}
          className={cn(
            "p-5 relative group transition-all rounded-[2rem] bg-white dark:bg-neutral-800 shadow-sm border-none dark:border dark:border-neutral-700 mb-4",
            activity.isBoosted && "border-2 border-orange-400 bg-orange-50/10 dark:bg-orange-950/20 shadow-md ring-4 ring-orange-500/5"
          )}
        >
            {/* Aktivitäts-Booster Badge */}
            {activity.isBoosted && (
              <div className="absolute -top-3 left-6 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-lg animate-in fade-in slide-in-from-top-1 flex items-center gap-1.5">
                <Flame className="h-3 w-3 animate-pulse" />
                <span>Highlight</span>
              </div>
            )}

            {/* Insights Link für Hosts */}
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
                    primaryStyle.bgClass.replace('bg-', 'bg-gradient-to-br from-').replace('-50', '-400 to-').concat(primaryStyle.color === '#ef4444' ? 'red-500' : 'violet-500')
                )}>
                    <PrimaryIcon className="h-8 w-8 text-white drop-shadow-sm" />
                </div>
                
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-lg font-black text-[#0f172a] dark:text-neutral-200 truncate leading-tight flex-1">{activity.placeName}</p>
                        
                        {/* Entfernungs-Badge (Modul 6) */}
                        {activity.distance !== undefined && activity.distance !== null && (
                          <div className="ml-2 inline-flex items-center gap-1 bg-slate-100 dark:bg-neutral-700 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-lg text-[10px] tracking-tight shrink-0 border border-slate-200/50">
                            <MapPin className="h-2.5 w-2.5 text-primary/70" />
                            <span>{activity.distance < 1 ? '< 1 km' : `${activity.distance.toFixed(1)} km`}</span>
                          </div>
                        )}

                        {/* Micro-Ticketing Badge */}
                        {isPaidEvent && (
                          <div className="ml-2 inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-black px-2 py-0.5 rounded-lg text-[10px] tracking-tight shrink-0">
                            <CreditCard className="h-2.5 w-2.5" />
                            <span>{activity.price!.toFixed(2)}€</span>
                          </div>
                        )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center gap-1 font-bold uppercase tracking-wider">
                            <Users className="h-3 w-3 text-primary/60"/>
                            <span>von {activity.hostName?.split(' ')[0]}</span>
                        </p>
                        {activity.placeAddress && (
                            <p className="text-[11px] text-neutral-400 flex items-center gap-1 font-medium truncate max-w-[150px]">
                                <MapPin className="h-3 w-3" />
                                {activity.placeAddress}
                            </p>
                        )}
                    </div>

                    {/* Kategorie Badge (Modul 12) */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center gap-1 text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-blue-100/50">
                        <Layers className="w-2.5 h-2.5" />
                        <span>{activity.category || 'Sonstiges'}</span>
                      </div>
                    </div>

                    {/* Premium Teilnehmer-Vorschau */}
                    <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2 overflow-hidden">
                          {isPremium ? (
                            <>
                              {previewList.slice(0, 4).map((p) => (
                                <Avatar key={p.uid} className="h-6 w-6 border-2 border-background shadow-sm">
                                  <AvatarImage src={p.photoURL || undefined} />
                                  <AvatarFallback className="text-[8px] font-black bg-primary/10 text-primary">{p.displayName?.charAt(0)}</AvatarFallback>
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

                        {/* Premium Indikator */}
                        {!isPremium && (
                          <span className="text-[10px] text-muted-foreground font-medium italic flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-500" />
                            Premium-Vorschau
                          </span>
                        )}
                        {isPremium && previewList.length > 0 && (
                           <Crown className="w-3 h-3 text-amber-500 opacity-50" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted/30 rounded-full">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground tracking-tight">
                          {activity.participantIds.length} / {activity.maxParticipants || '∞'}
                        </span>
                      </div>
                    </div>

                    <div className="flex w-full flex-wrap items-center gap-1.5 overflow-hidden mt-3">
                      {processedTags.slice(0, 3).map((tag, index) => (
                        <span key={index} className="inline-flex items-center rounded-xl px-3 py-1 text-[9px] font-black uppercase tracking-tight bg-secondary/50 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                </div>
            </div>

            {/* Modul 9: Melde-Trigger für externe Nutzer */}
            {!isOwnActivity && (
              <Button 
                onClick={handleReport} 
                disabled={isReporting}
                variant="outline"
                className="w-full mt-4 border-destructive text-destructive hover:bg-destructive/10 font-bold h-12 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2"
              >
                {isReporting ? <Loader2 className="h-3 w-3 animate-spin"/> : <AlertTriangle className="h-3 w-3" />}
                {isReporting ? "Wird gemeldet..." : "Aktivität melden"}
              </Button>
            )}

            <div className="card-footer-actions flex justify-between items-center w-full mt-5 pt-4 border-t border-neutral-50 dark:border-neutral-700/50">
              <div className="voting-controls flex gap-1.5 items-center bg-secondary/30 rounded-full p-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVote(activity.id!, userVote === 'up' ? 'none' : 'up'); }} 
                  className={cn(
                    "h-8 px-4 rounded-full font-black text-sm transition-all active:scale-90",
                    userVote === 'up' ? "bg-white text-green-500 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↑'}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVote(activity.id!, userVote === 'down' ? 'none' : 'down'); }} 
                  className={cn(
                    "h-8 px-4 rounded-full font-black text-sm transition-all active:scale-90",
                    userVote === 'down' ? "bg-white text-red-500 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
                  )}
                >
                  {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↓'}
                </button>
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
                        'Voll'
                    ) : isPaidEvent ? (
                        `Beitreten`
                    ) : (
                        'Beitreten'
                    )}
                  </Button>
                )}
              </div>
            </div>
        </div>
    );
}
