'use client';

import { Users, Plus, Loader2, ArrowRight } from 'lucide-react';
import type { Activity } from '@/lib/types';
import { getPlaceActivityPreview } from './place-activity-preview-model';
import styles from './spot-card.module.css';

export function PlaceActivityPreview({ activity, activityCount, language, onClick, onCreate, loading = false, hideEmpty = false, compact = false, appearance }: {
  activity?: Activity;
  activityCount: number;
  language: string;
  onClick: () => void;
  onCreate: () => void;
  loading?: boolean;
  hideEmpty?: boolean;
  compact?: boolean;
  appearance?: 'warm';
}) {
  const preview = activity ? getPlaceActivityPreview(activity, language) : null;
  const german = language === 'de';
  const hasActivities = activityCount > 0;
  if (hideEmpty && !preview && !hasActivities) return null;
  if (appearance === 'warm') {
    const present = Boolean(preview) || hasActivities;
    const waiting = loading && !present;
    const count = Math.max(activityCount, preview ? 1 : 0);
    const title = present ? (german ? `${count} ${count === 1 ? 'Aktivität ansehen' : 'Aktivitäten ansehen'}` : `View ${count} ${count === 1 ? 'activity' : 'activities'}`) : waiting ? (german ? 'Aktivitäten werden geladen …' : 'Loading activities …') : (german ? 'Wer kommt mit?' : 'Who’s joining?');
    const subtitle = preview ? `${preview.title} · ${preview.schedule} · ${preview.availability}` : present ? (german ? 'Entdecke die geplanten Treffen.' : 'Discover the planned meetups.') : waiting ? (german ? 'Du kannst schon ein Treffen planen.' : 'You can already plan a meetup.') : (german ? 'Starte ein Treffen.' : 'Start a meetup.');
    return <button type="button" onClick={present ? onClick : onCreate} className={`${styles.preview} ${present ? '' : styles.previewEmpty}`} aria-busy={waiting || undefined} aria-label={`${title}: ${subtitle}`} title={subtitle}>
      <span className={styles.avatars} aria-hidden="true">
        {present ? (preview?.initials.length ? preview.initials.map((initials, index) => <span className={styles.avatar} key={index}>{initials}</span>) : <Users className="h-6 w-6" />) : waiting ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Plus className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={styles.previewTitle}>{present ? (german ? `${count} ${count === 1 ? 'Aktivität' : 'Aktivitäten'}` : `${count} ${count === 1 ? 'activity' : 'activities'}`) : title}</span>
        <span className={styles.previewDetails}>{subtitle}</span>
      </span>
      {present && <ArrowRight className={styles.previewArrow} aria-hidden="true" />}
    </button>;
  }
  return (
    <button type="button" onClick={e => { e.stopPropagation(); preview || hasActivities ? onClick() : onCreate(); }}
      aria-label={preview ? `${german ? 'Aktivität ansehen' : 'View activity'}: ${preview.title} · ${preview.schedule} · ${preview.availability}` : undefined}
      className="my-1.5 flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-left transition-colors hover:bg-emerald-500/15 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <span aria-hidden="true" className="hidden shrink-0 sm:flex -space-x-1.5 pt-0.5">
        {preview?.initials.length ? preview.initials.map((initials, index) => (
          <span key={index} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-100 text-[10px] font-semibold text-emerald-800 dark:border-background dark:bg-emerald-900 dark:text-emerald-100">{initials}</span>
        )) : <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] sm:text-xs font-semibold leading-snug text-foreground dark:text-slate-200 line-clamp-2 break-words">
          {(preview && compact ? (activityCount > 1
            ? (german ? `${activityCount} Aktivitäten ansehen` : `View ${activityCount} activities`) : preview.schedule) : preview?.title) || (hasActivities
            ? (german ? `${activityCount} ${activityCount === 1 ? 'Aktivität' : 'Aktivitäten'} ansehen` : `View ${activityCount} ${activityCount === 1 ? 'activity' : 'activities'}`)
            : (german ? (loading ? 'Gemeinsam etwas planen' : 'Plane hier eine Aktivität') : (loading ? 'Plan something together' : 'Plan an activity here')))}
        </span>
        {preview && <span className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] sm:text-[11px] leading-relaxed text-muted-foreground">{(!compact || activityCount > 1) && <span>{preview.schedule}</span>}<span className="text-emerald-700 dark:text-emerald-400">{preview.availability}</span></span>}
      </span>
    </button>
  );
}
