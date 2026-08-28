'use client';

import React from 'react';
import { DesktopNav } from '@/components/desktop-nav';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { cn } from '@/lib/utils';

export interface AppHeaderProps {
  /** Title text or element (e.g. "Chats", "Karte", "Hallo, Alex 👋") */
  title: React.ReactNode;
  /** Icon or Avatar to display on the left of the title (e.g. <MessageCircle />, <ProfileAvatar />) */
  icon?: React.ReactNode;
  /** Right-side action elements beside NotificationBell (e.g. Settings button, Add Friend button) */
  actions?: React.ReactNode;
  /** Additional sub-header content rendered below the main row (e.g. search bars, location row, category filters) */
  children?: React.ReactNode;
  /** Additional className for the root <header> element */
  className?: string;
  /** Container max-width class override (defaults to max-w-[1536px]) */
  containerClassName?: string;
}

export function AppHeader({
  title,
  icon,
  actions,
  children,
  className,
  containerClassName = 'max-w-[1536px]',
}: AppHeaderProps) {
  const hasSubHeader = Boolean(children);

  return (
    <header className={cn('global-viewport-header compact pb-3', className)}>
      {/* Main Header Row - Fixed h-11 height (44px) without padding/margin distortion */}
      <div className={cn('global-header-container h-11', containerClassName, hasSubHeader && 'mb-3.5')}>
        {/* Left Slot: Icon/Avatar + Title */}
        <div className="flex items-center gap-2.5 min-w-0 shrink">
          {icon && (
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <h1 className="text-[22px] font-black tracking-tight text-slate-900 dark:text-neutral-100 truncate">
            {title}
          </h1>
        </div>

        {/* Center Slot: Desktop Navigation */}
        <DesktopNav />

        {/* Right Slot: Actions (NotificationBell + Custom Actions) */}
        <div className="flex items-center gap-3 shrink-0">
          <NotificationBell />
          {actions}
        </div>
      </div>

      {/* Sub-Header Slot: Page-specific controls (Search, Location, Filters) */}
      {hasSubHeader && children}
    </header>
  );
}
