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
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { UserBadge } from '@/components/common/UserBadge';
import { cn, formatFirstName } from '@/lib/utils';
import { castActivityVote, trackActivityView, submitReport } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { getPrimaryIconData, translateTag, translateAppString } from '@/lib/tag-config';
import { formatTags } from '@/lib/tag-parser';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

import { CategoryCardDecoration } from './category-card-decoration';

interface ActivityListItemProps {
    activity: Activity & { distance?: number | null };
    user: User | null;
    onJoin: (activity: Activity) => Promise<any>;
    hasRequested?: boolean;
}

export function ActivityListItem({ activity, user, onJoin, hasRequested }: ActivityListItemProps) {
    const { userProfile } = useAuth();
    const language = useLanguage();
    const router = useRouter();
    const [isJoining, setIsJoining] = useState(false);
    const [hasRequestedLocal, setHasRequestedLocal] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    
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
    
    const maxParticipants = typeof activity.maxParticipants === 'number' && !isNaN(activity.maxParticipants) && activity.maxParticipants > 0 
        ? activity.maxParticipants 
        : null;
    const isFull = maxParticipants 
        ? participantIds.length >= maxParticipants 
        : false;
    
    const isPaidEvent = activity.isPaid && activity.price && activity.price > 0;
    const previewList = activity.participantsPreview || [];
    const visibleAvatars = previewList.slice(0, 3).filter(p => p && p.uid);
    const excessCount = participantIds.length - visibleAvatars.length;

    let visualCategories: string[] = [];
    if (activity.category) {
      visualCategories.push(activity.category);
    }
    if (activity.categories && activity.categories.length > 0) {
      const cleaned = activity.categories.filter(c => c !== 'user_event');
      visualCategories.push(...cleaned);
    }
    if (visualCategories.length === 0) {
      if (activity.isUserEvent) {
        visualCategories.push('user_event');
      }
    }
    
    visualCategories = Array.from(new Set(visualCategories.map(c => c.toLowerCase())));
    if (visualCategories.length > 1) {
      visualCategories = visualCategories.filter(c => c !== 'user_event');
    }

    const primaryStyle = getPrimaryIconData({ 
        categories: visualCategories.filter(c => c !== 'user_event'), 
        name: activity.placeName || (language === 'de' ? "Aktivität" : "Activity"),
        sourceType: activity.sourceType,
        isUserEvent: activity.isUserEvent,
        creationSource: activity.creationSource
    }, language);
    const PrimaryIcon = primaryStyle.icon;

    const isRequested = !!(
        (activity as any).isRequested || // 1. reliable backend state (if added)
        hasRequested ||                  // 2. page-session state
        hasRequestedLocal                // 3. component fallback
    );

    const handleJoinClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isJoining || isParticipant || isFull || isRequested) return; 

        if (!user) {
            router.push('/login');
            return;
        }

        if (isPaidEvent) {
            router.push(`/checkout/${activity.id}`);
            return;
        }

        const resolvedMode = activity.joinMode === 'direct' ? 'direct' : 'request';
        console.log("[JOIN_FLOW_DEBUG]", {
            activityId: activity.id,
            joinMode: activity.joinMode,
            resolvedMode,
            action: resolvedMode === 'direct' ? 'joinActivity' : 'requestJoinActivity'
        });

        setIsJoining(true);
        try { 
            await onJoin(activity); 
            if (resolvedMode === 'request') {
                setHasRequestedLocal(true);
            }
        } catch (error) { 
            setIsJoining(false); 
        }
    };
    
    const handleViewChatClick = (activityId: string) => { router.push(`/chat/${activityId}`); };

    const activityDate = activity.activityDate?.toDate();

    return (
        <article 
          ref={cardRef}
          onClick={(e) => {
              const selection = window.getSelection();
              if (selection && selection.toString()) {
                  return;
              }
              const target = e.target as HTMLElement;
              if (target.closest('button, a, input, select, textarea, [role="button"], [data-card-interactive]')) {
                  return;
              }
              router.push(`/activities/${activity.id}`);
          }}
          onPointerDown={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest('button, a, input, select, textarea, [role="button"], [data-card-interactive]')) {
                  return;
              }
              setIsPressed(true);
          }}
          onPointerUp={() => setIsPressed(false)}
          onPointerCancel={() => setIsPressed(false)}
          onPointerLeave={() => setIsPressed(false)}
          className={cn(
              "group cursor-pointer overflow-hidden rounded-[22px] bg-white dark:bg-neutral-900 border border-slate-200/40 dark:border-neutral-800/60 shadow-premium hover:shadow-premium-active transition-[transform,box-shadow,border-color] duration-200 flex flex-col relative p-0 h-full",
              isPressed ? "scale-[0.985] duration-75" : "",
              activity.isBoosted && "ring-4 ring-orange-500/10 shadow-orange-500/15"
          )}
        >
            {/* Oberer Bild/Icon-Bereich mit Dekoration */}
            <CategoryCardDecoration
                gradientClass={primaryStyle.gradientClass}
                icon={PrimaryIcon}
                label={primaryStyle.label}
                variant="standard"
                className="group-hover:scale-105"
            >
                {/* Status Badges - Left */}
                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-20 pointer-events-none select-none">
                    {activity.isBoosted && (
                        <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[8px] font-black px-2 rounded-full uppercase tracking-wider shadow-lg flex items-center gap-1 border border-white/20">
                            <Flame className="h-2.5 w-2.5" />
                            <span>Highlight</span>
                        </div>
                    )}
                </div>

                {/* Status Badges - Right */}
                <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5 z-20 pointer-events-none select-none">
                    <div className="h-5 bg-white/20 backdrop-blur-md text-white text-[8px] font-black px-2 rounded-full flex items-center gap-1 border border-white/20">
                        <ArrowUp className="h-2.5 w-2.5" />
                        {activity.communityScore || 0}
                    </div>
                </div>
            </CategoryCardDecoration>

            {/* Content Bereich */}
            <div className="p-3 pb-4 flex flex-col flex-1">
                <div className="mb-2">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-base truncate flex-1 text-[#0f172a] dark:text-neutral-200">
                            <Link 
                                href={`/activities/${activity.id}`} 
                                onClick={(e) => { e.stopPropagation(); }}
                                className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                            >
                                {activity.title || activity.placeName || (language === 'de' ? "Treffen" : "Meetup")}
                            </Link>
                        </h3>
                    </div>
                    {activity.placeAddress && (
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5 truncate">
                            {activity.placeAddress}
                        </p>
                    )}
                    
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
                    {activity.sourceType === 'activity' && activity.isUserEvent && (
                        <Badge variant="secondary" className="rounded-[10px] text-[7px] font-black uppercase tracking-widest px-2 py-0.5 border-none bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            USER EVENT
                        </Badge>
                    )}
                    {isPaidEvent && (
                        <Badge variant="secondary" className="rounded-[10px] text-[7px] font-black uppercase tracking-widest px-2 py-0.5 border-none bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {activity.price?.toFixed(2)}€
                        </Badge>
                    )}
                </div>

                {activity.description && (
                    <p className="mb-3 text-[9px] text-slate-500 dark:text-neutral-400 font-medium leading-relaxed italic border-l border-primary/20 pl-2 line-clamp-2 overflow-hidden text-ellipsis break-words">
                        "{activity.description}"
                    </p>
                )}

                {/* Social/Capacity Info */}
                <div className="flex items-center gap-2 mb-3">
                    {visibleAvatars.length > 0 && (
                        <div className="flex -space-x-1.5 overflow-hidden">
                            {visibleAvatars.map((p) => (
                                <ProfileAvatar 
                                    key={p.uid} 
                                    photoURL={p.photoURL}
                                    displayName={p.displayName}
                                    className="h-5 w-5 border border-white shadow-sm"
                                />
                            ))}
                        </div>
                    )}
                    <div className="flex flex-col ml-1">
                        <span className="text-[9px] font-bold text-slate-400">
                            {translateAppString('activity.participants', language, participantIds.length)}
                            {excessCount > 0 && ` (+${excessCount})`}
                        </span>
                        {maxParticipants && maxParticipants > 0 ? (
                            <span className={cn(
                                "text-[7.5px] font-black uppercase tracking-wider mt-0.5",
                                isFull ? "text-red-500" : "text-emerald-600"
                            )}>
                                {isFull 
                                    ? translateAppString('activity.full', language)
                                    : translateAppString('activity.spots_left', language, maxParticipants - participantIds.length)
                                }
                            </span>
                        ) : null}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center gap-2 mt-auto pt-3 border-t border-slate-50 dark:border-neutral-800/50">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Users className="h-3 w-3 text-slate-300 shrink-0" />
                        <span className="text-[9px] text-slate-400 font-bold uppercase truncate flex items-center gap-1">
                            {translateAppString('activity.host', language)}: {activity.hostUsername ? `@${activity.hostUsername.replace(/^@/, '')}` : (language === 'de' ? 'Aktiva-Nutzer' : 'Aktiva user')}
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
                                className="h-7 rounded-lg text-[9px] font-black text-primary border-primary/20 px-3 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            >
                                <MessageSquare className="h-3 w-3" />
                                Chat
                            </Button>
                        ) : (
                             <Button 
                                size="sm"
                                onClick={handleJoinClick} 
                                disabled={isJoining || isFull || isRequested}
                                className={cn(
                                    "h-7 rounded-lg text-[9px] font-black px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 relative flex items-center justify-center min-w-[70px]",
                                    isPaidEvent ? "bg-slate-900 text-white" : "bg-primary text-white"
                                )}
                            >
                                <span className={cn("transition-[opacity,transform] duration-200", isJoining ? "opacity-0 scale-90" : "opacity-100 scale-100")}>
                                    {isFull ? (
                                        translateAppString('activity.full', language)
                                    ) : isRequested ? (
                                        translateAppString('activity.requested', language)
                                    ) : activity.joinMode === 'direct' ? (
                                        translateAppString('activity.join', language)
                                    ) : (
                                        translateAppString('activity.request', language)
                                    )}
                                </span>
                                {isJoining && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Loader2 className="animate-spin h-3.5 w-3.5 text-current" />
                                    </div>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}
