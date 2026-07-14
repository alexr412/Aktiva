'use client';

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PlaceCardSkeleton() {
  return (
    <div className="w-full overflow-hidden rounded-[22px] bg-white dark:bg-neutral-900 border border-slate-200/40 dark:border-neutral-800/60 shadow-premium flex flex-col h-full pointer-events-none select-none" aria-hidden="true">
      {/* Top decoration area placeholder */}
      <div className="h-20 w-full bg-slate-100/50 dark:bg-neutral-800/40 flex items-center justify-center relative">
        <Skeleton className="h-8 w-8 rounded-full motion-reduce:animate-none" />
      </div>
      {/* Content area placeholder */}
      <div className="p-3 pb-4 flex flex-col flex-1 gap-2">
        <div className="space-y-1.5">
          <Skeleton className="h-4.5 w-11/12 rounded-lg motion-reduce:animate-none" />
          <Skeleton className="h-3.5 w-2/3 rounded-md motion-reduce:animate-none" />
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          <Skeleton className="h-4.5 w-12 rounded-[10px] motion-reduce:animate-none" />
          <Skeleton className="h-4.5 w-16 rounded-[10px] motion-reduce:animate-none" />
        </div>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/50 dark:border-neutral-800/40">
          <div className="flex gap-1.5">
            <Skeleton className="h-6 w-14 rounded-lg motion-reduce:animate-none" />
          </div>
          <Skeleton className="h-6 w-6 rounded-full motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

export function FeaturedPlaceCardSkeleton() {
  return (
    <div className="w-full overflow-hidden rounded-[22px] bg-white dark:bg-neutral-900 border border-slate-200/40 dark:border-neutral-800/60 shadow-premium flex flex-col md:flex-row min-h-[160px] pointer-events-none select-none" aria-hidden="true">
      {/* Left decoration area placeholder */}
      <div className="w-full md:w-52 h-24 md:h-full min-h-[96px] bg-slate-100/50 dark:bg-neutral-800/40 flex items-center justify-center shrink-0">
        <Skeleton className="h-9 w-9 rounded-full motion-reduce:animate-none" />
      </div>
      {/* Right content area placeholder */}
      <div className="p-4 md:p-5 flex flex-col flex-1 min-w-0 justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4 rounded-lg motion-reduce:animate-none" />
          <Skeleton className="h-3.5 w-1/3 rounded-md motion-reduce:animate-none" />
          <div className="flex flex-wrap gap-1 pt-1">
            <Skeleton className="h-4.5 w-12 rounded-[10px] motion-reduce:animate-none" />
            <Skeleton className="h-4.5 w-16 rounded-[10px] motion-reduce:animate-none" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/50 dark:border-neutral-800/40">
          <div className="flex gap-1.5">
            <Skeleton className="h-6.5 w-16 rounded-lg motion-reduce:animate-none" />
          </div>
          <Skeleton className="h-6.5 w-6.5 rounded-full motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

export function ActivityCardSkeleton() {
  return (
    <div className="w-full overflow-hidden rounded-[22px] bg-white dark:bg-neutral-900 border border-slate-200/40 dark:border-neutral-800/60 shadow-premium flex flex-col h-full pointer-events-none select-none" aria-hidden="true">
      {/* Top decoration area placeholder */}
      <div className="h-20 w-full bg-slate-100/50 dark:bg-neutral-800/40 flex items-center justify-center relative">
        <Skeleton className="h-8 w-8 rounded-full motion-reduce:animate-none" />
      </div>
      {/* Content area placeholder */}
      <div className="p-3 pb-4 flex flex-col flex-1 gap-2">
        <div className="space-y-1.5">
          <Skeleton className="h-4.5 w-11/12 rounded-lg motion-reduce:animate-none" />
          <Skeleton className="h-3.5 w-2/3 rounded-md motion-reduce:animate-none" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-5 w-16 rounded-[10px] motion-reduce:animate-none" />
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex -space-x-1.5">
            <Skeleton className="h-5 w-5 rounded-full motion-reduce:animate-none" />
            <Skeleton className="h-5 w-5 rounded-full motion-reduce:animate-none" />
          </div>
          <Skeleton className="h-3.5 w-20 rounded-md motion-reduce:animate-none" />
        </div>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/50 dark:border-neutral-800/40">
          <div className="flex items-center gap-1">
            <Skeleton className="h-3.5 w-16 rounded-md motion-reduce:animate-none" />
          </div>
          <Skeleton className="h-7 w-14 rounded-lg motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

export function FeaturedActivityCardSkeleton() {
  return (
    <div className="w-full overflow-hidden rounded-[22px] bg-white dark:bg-neutral-900 border border-slate-200/40 dark:border-neutral-800/60 shadow-premium flex flex-col md:flex-row min-h-[160px] pointer-events-none select-none" aria-hidden="true">
      {/* Left decoration area placeholder */}
      <div className="w-full md:w-52 h-24 md:h-full min-h-[96px] bg-slate-100/50 dark:bg-neutral-800/40 flex items-center justify-center shrink-0">
        <Skeleton className="h-9 w-9 rounded-full motion-reduce:animate-none" />
      </div>
      {/* Right content area placeholder */}
      <div className="p-4 md:p-5 flex flex-col flex-1 min-w-0 justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4 rounded-lg motion-reduce:animate-none" />
          <Skeleton className="h-3.5 w-1/3 rounded-md motion-reduce:animate-none" />
          <Skeleton className="h-3.5 w-11/12 rounded-md motion-reduce:animate-none" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            <Skeleton className="h-5.5 w-5.5 rounded-full motion-reduce:animate-none" />
            <Skeleton className="h-5.5 w-5.5 rounded-full motion-reduce:animate-none" />
          </div>
          <Skeleton className="h-3.5 w-24 rounded-md motion-reduce:animate-none" />
        </div>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100/50 dark:border-neutral-800/40">
          <div className="flex items-center gap-1">
            <Skeleton className="h-3.5 w-20 rounded-md motion-reduce:animate-none" />
          </div>
          <Skeleton className="h-7.5 w-16 rounded-lg motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
