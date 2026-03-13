'use client';

import { Crown, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UserBadgeProps {
  isPremium?: boolean;
  isDonator?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserBadge({ isPremium, isDonator, size = 'md', className }: UserBadgeProps) {
  if (!isPremium && !isDonator) return null;

  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[size];

  const containerGap = {
    sm: 'gap-0.5',
    md: 'gap-1',
    lg: 'gap-1.5',
  }[size];

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('inline-flex items-center', containerGap, className)}>
        {isPremium && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center rounded-full bg-amber-100 p-1 text-amber-600 shadow-sm dark:bg-amber-900/30 dark:text-amber-400">
                <Crown className={cn(iconSize, 'fill-current')} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-bold">Premium Mitglied</p>
            </TooltipContent>
          </Tooltip>
        )}
        {isDonator && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center rounded-full bg-pink-100 p-1 text-pink-600 shadow-sm dark:bg-pink-900/30 dark:text-pink-400">
                <Heart className={cn(iconSize, 'fill-current')} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-bold">Community Supporter</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
