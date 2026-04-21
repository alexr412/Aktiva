'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { Users, Star, Flame } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/hooks/use-language';
import { getPrimaryIconData } from '@/lib/tag-config';
import { cn } from '@/lib/utils';
import type { Activity } from '@/lib/types';

interface ProfileActivityCardProps {
  activity: Activity;
  user: any;
  onJoin: (id: string) => void;
}

 export function ProfileActivityCard({ activity, user, onJoin }: ProfileActivityCardProps) {
  const language = useLanguage();
  const locale = language === 'de' ? de : enUS;

  const iconData = getPrimaryIconData({ 
    categories: activity.categories || [], 
    name: activity.placeName || (language === 'de' ? "Aktivität" : "Activity")
  }, language);
  const Icon = iconData.icon;
  
  const participantIds = activity.participantIds || [];
  const previewList = activity.participantsPreview || [];
  const activityDate = activity.activityDate?.toDate();

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] p-5 mb-4 shadow-sm border border-slate-50 dark:border-neutral-800 transition-all hover:shadow-md group cursor-pointer overflow-hidden relative">
      <div className="flex items-center gap-4">
        {/* Category Icon */}
        <div className={cn(
            "h-16 w-16 rounded-[1.5rem] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
            iconData.bgClass
        )}>
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm border border-white/30">
                <Icon className="w-8 h-8 text-white" />
            </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-black text-lg text-[#0f172a] dark:text-neutral-100 truncate flex-1">{activity.placeName}</h4>
            {activity.isNew && (
                <div className="bg-[#fff7ed] text-[#ea580c] px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <Star className="w-2.5 h-2.5 fill-current" /> {language === 'de' ? 'NEU' : 'NEW'}
                </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-bold text-slate-400">
                {activityDate ? format(activityDate, language === 'de' ? 'eee, d. MMM' : 'eee, MMM d', { locale }) : (language === 'de' ? 'In Kürze' : 'Soon')}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Details */}
      <div className="mt-4 flex items-center justify-between border-t border-slate-50 dark:border-neutral-800 pt-4">
        <div className="flex items-center gap-2">
             <div className="flex -space-x-2">
                {previewList.slice(0, 3).map((p, i) => (
                    <Avatar key={i} className="h-7 w-7 border-2 border-white ring-2 ring-slate-50">
                        <AvatarImage src={p.photoURL || undefined} />
                        <AvatarFallback className="bg-slate-100 text-[8px] font-black text-slate-400">
                            {p.displayName?.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                ))}
            </div>
            <span className="text-[11px] font-bold text-slate-400 ml-1">
                {participantIds.length} / {activity.maxParticipants || 6} {language === 'de' ? 'Teilnehmer' : 'Participants'}
            </span>
        </div>
        <div className="text-[11px] font-bold text-slate-300 uppercase tracking-tight">
            {activityDate ? formatDistanceToNow(activityDate, { addSuffix: true, locale }) : ''}
        </div>
      </div>
    </div>
  );
}
