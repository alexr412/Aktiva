'use client';

import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { Star } from 'lucide-react';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { useLanguage } from '@/hooks/use-language';
import { getPrimaryIconData } from '@/lib/tag-config';
import { cn, toDateObject } from '@/lib/utils';
import type { Activity } from '@/lib/types';

interface ProfileActivityCardProps {
  activity: Activity;
  user: any;
  onJoin: (activity: Activity) => void;
  compact?: boolean;
}

export function ProfileActivityCard({ activity, user, onJoin, compact = false }: ProfileActivityCardProps) {
  const language = useLanguage();
  const router = useRouter();
  const locale = language === 'de' ? de : enUS;

  const iconData = getPrimaryIconData({ 
    categories: (activity.categories || []).filter(c => c !== 'user_event'), 
    placeCategories: activity.placeCategories,
    name: activity.placeName || (language === 'de' ? "Aktivität" : "Activity"),
    sourceType: activity.sourceType,
    isUserEvent: activity.isUserEvent,
    creationSource: activity.creationSource
  }, language);
  const Icon = iconData.icon;
  
  const participantIds = activity.participantIds || [];
  const previewList = activity.participantsPreview || [];
  const activityDate = toDateObject(activity.activityDate);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"], [data-card-interactive]')) {
      return;
    }
    if (activity.id) {
      router.push(`/activities/${activity.id}`);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={cn(
        "bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 transition-all group cursor-pointer overflow-hidden relative w-full min-w-0 flex flex-col justify-between",
        compact 
          ? "rounded-2xl sm:rounded-[2.5rem] p-2.5 sm:p-5 mb-0 shadow-sm hover:shadow-md" 
          : "rounded-[2.5rem] p-4 sm:p-5 mb-4 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)]"
      )}
    >
      <div className={cn("flex min-w-0", compact ? "flex-col gap-2" : "items-center gap-3 sm:gap-4")}>
        {/* Category Icon & Badges */}
        <div className={cn("flex items-center justify-between gap-2 min-w-0", compact ? "w-full" : "")}>
          <div className={cn(
            "rounded-[1.25rem] sm:rounded-[1.5rem] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
            iconData.gradientClass,
            compact ? "h-10 w-10 sm:h-16 sm:w-16" : "h-14 w-14 sm:h-16 sm:w-16"
          )}>
            <div className={cn("bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30", compact ? "p-1.5 sm:p-3" : "p-2.5 sm:p-3")}>
              <Icon className={cn("text-white", compact ? "w-5 h-5 sm:w-8 sm:h-8" : "w-7 h-7 sm:w-8 sm:h-8")} />
            </div>
          </div>
          {compact && (activity as any).isNew && (
            <div className="bg-[#fff7ed] text-[#ea580c] px-1.5 sm:px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 sm:gap-1 shrink-0">
              <Star className="w-2.5 h-2.5 fill-current" /> {language === 'de' ? 'NEU' : 'NEW'}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 sm:gap-2 min-w-0">
            <h4 className={cn(
              "font-bold text-slate-900 dark:text-neutral-100 min-w-0",
              compact ? "text-xs sm:text-base line-clamp-2 leading-snug" : "text-base truncate flex-1"
            )}>
              {activity.title || activity.placeName || (language === 'de' ? 'Treffen' : 'Meetup')}
            </h4>
            {!compact && (activity as any).isNew && (
              <div className="bg-[#fff7ed] text-[#ea580c] px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Star className="w-2.5 h-2.5 fill-current" /> {language === 'de' ? 'NEU' : 'NEW'}
              </div>
            )}
          </div>
          <div className={cn("flex flex-wrap items-center font-bold text-slate-600 dark:text-neutral-400 min-w-0", compact ? "text-[10px] sm:text-sm mt-1 gap-1" : "text-sm gap-2 mt-0.5")}>
            <span className="truncate">
              {activityDate ? format(activityDate, language === 'de' ? 'eee, d. MMM' : 'eee, MMM d', { locale }) : (language === 'de' ? 'In Kürze' : 'Soon')}
            </span>
          </div>
          {activity.placeAddress && (
            <div className={cn("font-bold text-slate-400 truncate min-w-0", compact ? "text-[9px] sm:text-xs mt-0.5" : "text-xs mt-0.5 flex items-center gap-1")}>
              {!compact && <span className="text-slate-350 dark:text-neutral-700">•</span>}
              <span className="truncate">{activity.placeAddress}</span>
            </div>
          )}
          {!compact && activity.description && (
            <p className="mt-2 text-[10px] text-slate-500 font-medium italic border-l-2 border-primary/20 pl-2">
              "{activity.description}"
            </p>
          )}
        </div>
      </div>

      {/* Footer Details */}
      <div className={cn(
        "border-t border-slate-50 dark:border-neutral-800 flex items-center justify-between min-w-0",
        compact ? "mt-2.5 sm:mt-4 pt-2 sm:pt-4" : "mt-4 pt-4"
      )}>
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <div className={cn("flex shrink-0", compact ? "-space-x-1.5 sm:-space-x-2" : "-space-x-2")}>
            {previewList.slice(0, compact ? 2 : 3).map((p, i) => (
              <ProfileAvatar 
                key={i} 
                className={cn("border-2 border-white ring-2 ring-slate-50", compact ? "h-5 w-5 sm:h-7 sm:w-7" : "h-7 w-7")}
                photoURL={p.photoURL}
                displayName={p.displayName}
              />
            ))}
          </div>
          <span className={cn("font-bold text-slate-600 min-w-0 truncate", compact ? "text-[9.5px] sm:text-[11px] ml-0.5" : "text-[11px] ml-1")}>
            {compact 
              ? `${participantIds.length}/${activity.maxParticipants || 6}` 
              : `${participantIds.length} / ${activity.maxParticipants || 6} ${language === 'de' ? 'Teilnehmer' : 'Participants'}`
            }
          </span>
        </div>
      </div>
    </div>
  );
}
