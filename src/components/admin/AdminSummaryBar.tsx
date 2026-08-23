'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface SummaryMetricItem {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ElementType;
  colorClass?: string;
}

interface AdminSummaryBarProps {
  metrics: SummaryMetricItem[];
  className?: string;
}

export function AdminSummaryBar({ metrics, className }: AdminSummaryBarProps) {
  return (
    <Card className={cn("bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800 shadow-sm rounded-3xl overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 divide-x-0 sm:divide-x divide-slate-100 dark:divide-neutral-800">
          {metrics.map((m, idx) => {
            const Icon = m.icon;
            return (
              <div key={idx} className={cn("flex items-center gap-3", idx > 0 && "sm:pl-4")}>
                {Icon && (
                  <div className={cn("p-2.5 rounded-2xl shrink-0 bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300", m.colorClass)}>
                    <Icon className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 block truncate">
                    {m.label}
                  </span>
                  <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                    {m.value}
                  </div>
                  {m.sublabel && (
                    <span className="text-[11px] font-medium text-slate-500 dark:text-neutral-400 block truncate">
                      {m.sublabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
