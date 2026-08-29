'use client';

import { useState } from 'react';
import { MoreVertical, Flag, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReportDialog } from './ReportDialog';
import { Button } from '../ui/button';

interface EntityMoreOptionsProps {
  entityId: string;
  entityType: 'activity' | 'user';
  entityName: string;
  className?: string;
  variant?: 'icon' | 'button';
}

export function EntityMoreOptions({ entityId, entityType, entityName, className, variant = 'icon' }: EntityMoreOptionsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const language = useLanguage();
  const isDe = language === 'de';

  const label = entityType === 'user'
    ? (isDe ? 'Nutzer melden' : 'Report User')
    : (isDe ? 'Aktivität melden' : 'Report Activity');

  const handleOpenReportModal = () => {
    setIsDropdownOpen(false);
    requestAnimationFrame(() => {
      setTimeout(() => {
        setIsReportDialogOpen(true);
      }, 0);
    });
  };

  if (variant === 'button') {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsReportDialogOpen(true)}
          className={`rounded-full border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 font-semibold text-xs gap-1.5 shadow-sm ${className || ''}`}
        >
          <Flag className="h-3.5 w-3.5 fill-current" />
          <span>{label}</span>
        </Button>

        <ReportDialog
          open={isReportDialogOpen}
          onOpenChange={setIsReportDialogOpen}
          entityId={entityId}
          entityType={entityType}
          entityName={entityName}
        />
      </>
    );
  }

  return (
    <>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 rounded-full bg-slate-100/80 dark:bg-neutral-800/80 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-neutral-700/60 transition-all ${className || ''}`}
            aria-label={label}
          >
            <MoreVertical className="h-5 w-5" />
            <span className="sr-only">{label}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-xl z-50">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              handleOpenReportModal();
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenReportModal();
            }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 focus:bg-red-50 dark:focus:bg-red-950/50 focus:text-red-600 dark:focus:text-red-400 cursor-pointer transition-colors"
          >
            <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
            <span>{label}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportDialog
        open={isReportDialogOpen}
        onOpenChange={setIsReportDialogOpen}
        entityId={entityId}
        entityType={entityType}
        entityName={entityName}
      />
    </>
  );
}
