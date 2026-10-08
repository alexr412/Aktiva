'use client';

import { Users } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { getPlaceActivityPreview } from './place-activity-preview-model';

export function PlaceActivityPreview({ activity, activityCount, language, onClick, onCreate, loading = false, hideEmpty = false }: {
  activity?: Activity;
  activityCount: number;
  language: string;
  onClick: () => void;
  onCreate: () => void;
  loading?: boolean;
  hideEmpty?: boolean;
}) {
  const preview = activity ? getPlaceActivityPreview(activity, language) : null;
  const german = language === 'de';
  const hasActivities = activityCount > 0;
  if (hideEmpty && !preview && !hasActivities) return null;
  return (
    <button type="button" onClick={e => { e.stopPropagation(); preview || hasActivities ? onClick() : onCreate(); }}
      className="my-1.5 flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-left transition-colors hover:bg-emerald-500/15 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <span aria-hidden="true" className="hidden shrink-0 sm:flex -space-x-1.5 pt-0.5">
        {preview?.initials.length ? preview.initials.map((initials, index) => (
          <span key={index} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-100 text-[10px] font-semibold text-emerald-800 dark:border-background dark:bg-emerald-900 dark:text-emerald-100">{initials}</span>
        )) : <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] sm:text-xs font-semibold leading-snug text-slate-700 dark:text-slate-200 line-clamp-2 break-words">
          {preview?.title || (hasActivities
            ? (german ? `${activityCount} ${activityCount === 1 ? 'Aktivität' : 'Aktivitäten'} ansehen` : `View ${activityCount} ${activityCount === 1 ? 'activity' : 'activities'}`)
            : (german ? (loading ? 'Gemeinsam etwas planen' : 'Plane hier eine Aktivität') : (loading ? 'Plan something together' : 'Plan an activity here')))}
        </span>
        {preview && <span className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] sm:text-[11px] leading-relaxed text-slate-500 dark:text-slate-400"><span>{preview.schedule}</span><span className="text-emerald-700 dark:text-emerald-400">{preview.availability}</span></span>}
      </span>
    </button>
  );
}
