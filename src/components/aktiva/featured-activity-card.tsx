'use client';

import { useState, useEffect, useRef } from 'react';
import type { Activity } from '@/lib/types';
import type { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { Loader2, MessageSquare, Users, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { UserBadge } from '@/components/common/UserBadge';
import { cn } from '@/lib/utils';
import { trackActivityView } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { getPrimaryIconData, translateAppString } from '@/lib/tag-config';
import { CategoryCardDecoration } from './category-card-decoration';
import Link from 'next/link';

interface FeaturedActivityCardProps {
    activity: Activity & { distance?: number | null };
    user: User | null;
    onJoin: (activity: Activity) => Promise<any>;
    hasRequested?: boolean;
}

export function FeaturedActivityCard({ activity, user, onJoin, hasRequested }: FeaturedActivityCardProps) {
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
        (activity as any).isRequested ||
        hasRequested ||
        hasRequestedLocal
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
              "group cursor-pointer overflow-hidden rounded-[22px] bg-white dark:bg-neutral-900 border border-slate-200/40 dark:border-neutral-800/60 shadow-premium hover:shadow-premium-active transition-[transform,box-shadow,border-color] duration-200 flex flex-row relative p-0 w-full min-h-[145px] max-h-[165px] md:max-h-none md:min-h-[160px]",
              isPressed ? "scale-[0.985] duration-75" : "",
              activity.isBoosted && "ring-4 ring-orange-500/10 shadow-orange-500/15"
          )}
        >
            <CategoryCardDecoration
                gradientClass={primaryStyle.gradientClass}
                icon={PrimaryIcon}
                label={primaryStyle.label}
                variant="featured"
                className="w-24 md:w-52 h-full shrink-0 relative"
            >
                {/* Custom Content Overlay inside Decoration */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-max pointer-events-none">
                    <div className="bg-white/95 text-emerald-800 dark:bg-neutral-900 dark:text-emerald-400 text-[6.5px] md:text-[8px] font-black uppercase px-1.5 md:px-2 py-0.5 rounded-full shadow-sm tracking-widest border border-white/20 select-none">
                        {translateAppString('featured.label', language)}
                    </div>
                </div>

                <div className="flex flex-col items-center gap-1.5 z-10 px-1 text-center mt-5">
                    <PrimaryIcon className="text-white h-11 w-11 md:h-12 md:w-12 drop-shadow-lg" />
                    <span className="text-[6.5px] md:text-[7.5px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] text-white/90 drop-shadow-sm truncate max-w-full">
                        {primaryStyle.label}
                    </span>
                </div>
            </CategoryCardDecoration>

            {/* Split Right Content Area */}
            <div className="p-3 md:p-5 flex flex-col flex-1 min-w-0 justify-between">
                <div>
                    <div className="flex items-start justify-between gap-2 mb-1 md:mb-2">
                        <div className="min-w-0">
                            <h3 className="text-sm sm:text-base md:text-lg font-black tracking-tight leading-tight text-[#0f172a] dark:text-neutral-200 truncate">
                                <Link 
                                    href={`/activities/${activity.id}`} 
                                    onClick={(e) => { e.stopPropagation(); }}
                                    className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                                >
                                    {activity.title || activity.placeName || (language === 'de' ? "Treffen" : "Meetup")}
                                </Link>
                            </h3>
                            {activity.placeAddress && (
                                <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5 truncate">
                                    {activity.placeAddress}
                                </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5 text-neutral-400 dark:text-neutral-500 font-bold text-[9px] md:text-[10px]">
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
                    </div>

                    {/* Exclude description on mobile to avoid overflow and clipping */}
                    {activity.description && (
                        <p className="hidden md:block mb-4 text-[9px] text-slate-500 dark:text-neutral-400 font-medium leading-relaxed italic border-l border-primary/20 pl-2 line-clamp-2 overflow-hidden text-ellipsis break-words">
                            "{activity.description}"
                        </p>
                    )}

                    {/* Exclude avatars on mobile to avoid card vertical bloating */}
                    <div className="hidden md:flex items-center gap-3 mb-4">
                        {visibleAvatars.length > 0 && (
                            <div className="flex -space-x-1.5 overflow-hidden">
                                {visibleAvatars.map((p) => (
                                    <ProfileAvatar 
                                        key={p.uid} 
                                        photoURL={p.photoURL}
                                        displayName={p.displayName}
                                        className="h-5.5 w-5.5 border border-white shadow-sm"
                                    />
                                ))}
                            </div>
                        )}
                        
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-slate-500 dark:text-neutral-400">
                                {translateAppString('activity.participants', language, participantIds.length)}
                                {excessCount > 0 && ` (+${excessCount})`}
                            </span>
                            
                            {maxParticipants && maxParticipants > 0 ? (
                                <span className={cn(
                                    "text-[8px] font-bold uppercase tracking-wider mt-0.5",
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
                </div>

                {/* Footer Controls */}
                <div className="flex items-center gap-2 mt-1 md:mt-auto pt-1.5 md:pt-3 border-t border-slate-50 dark:border-neutral-800/40">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <Users className="h-3.5 w-3.5 text-slate-300 shrink-0" />
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
                                className="h-11 md:h-7.5 rounded-lg text-xs md:text-[9px] font-black text-primary border-primary/20 px-3 flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            >
                                <MessageSquare className="h-3.5 w-3.5" />
                                Chat
                            </Button>
                        ) : (
                             <Button 
                                size="sm"
                                onClick={handleJoinClick} 
                                disabled={isJoining || isFull || isRequested}
                                className={cn(
                                    "h-11 md:h-7.5 rounded-lg text-xs md:text-[9px] font-black px-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 relative flex items-center justify-center min-w-[72px]",
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
