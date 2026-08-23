'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminKpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  href?: string;
  badgeText?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  accentColor?: 'red' | 'blue' | 'purple' | 'amber' | 'emerald';
  onClick?: () => void;
}

export function AdminKpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  href,
  badgeText,
  badgeVariant = 'secondary',
  accentColor = 'purple',
  onClick,
}: AdminKpiCardProps) {
  const colorStyles = {
    red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/50',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  }[accentColor];

  const content = (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800 rounded-3xl cursor-pointer">
      <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("p-2.5 rounded-2xl shrink-0 transition-all group-hover:scale-105", colorStyles)}>
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {badgeText && (
              <Badge variant={badgeVariant} className="text-[10px] font-black uppercase px-2 py-0.5 border-none">
                {badgeText}
              </Badge>
            )}
            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-neutral-700 group-hover:translate-x-1 group-hover:text-primary transition-all" />
          </div>
        </div>

        <div>
          <span className="text-xs font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider block mb-1">
            {title}
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium mt-1 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return <div onClick={onClick}>{content}</div>;
}
