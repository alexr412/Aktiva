'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { useChatSync } from '@/contexts/chat-sync-context';
import { MAIN_NAV_ITEMS, getIsActiveNav } from '@/lib/navigation-config';

export function BottomNav() {
  const pathname = usePathname();
  const language = useLanguage();
  const { unreadTotal } = useChatSync();

  const bottomNavVisiblePaths = ['/', '/map', '/explore', '/chat', '/profile'];
  const shouldShowBottomNav = bottomNavVisiblePaths.includes(pathname);
  if (!shouldShowBottomNav) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 w-full z-nav bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-t border-slate-200/30 dark:border-neutral-800/20 pb-safe shadow-premium lg:hidden">
      <nav data-activa-bottom-nav className="grid grid-cols-5 h-[var(--bottom-nav-height,66px)] items-center px-1 max-w-lg mx-auto w-full">
        {MAIN_NAV_ITEMS.map((item) => {
          const isActive = getIsActiveNav(item.href, pathname);
          const label = language === 'de' ? item.labelDe : item.labelEn;
          const tutorialId = item.href === '/' ? 'nav-feed' : item.href === '/explore' ? 'nav-explore' : item.href === '/map' ? 'nav-map' : item.href === '/chat' ? 'nav-chat' : item.href === '/profile' ? 'nav-profile' : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tutorial-id={tutorialId}
              className={cn(
                "flex h-full flex-col items-center justify-center gap-0.5 transition-[color,opacity] duration-200 relative px-0.5 min-w-0 w-full",
                isActive ? "text-primary scale-100" : "text-slate-500 dark:text-neutral-400 opacity-60 hover:opacity-100"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-[10px] transition-[color,background-color] duration-200 relative shrink-0",
                isActive ? "bg-primary/10 text-primary" : "text-current"
              )}>
                <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                {item.href === '/chat' && unreadTotal > 0 && !pathname.startsWith('/chat') && (
                  <div 
                    className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] bg-red-500 text-white rounded-full flex items-center justify-center text-[8.5px] font-bold px-1"
                    aria-label={language === 'de' ? `${unreadTotal} ungelesene Chat-Nachrichten` : `${unreadTotal} unread chat messages`}
                  >
                    <span className="sr-only">
                      {language === 'de' ? `${unreadTotal} ungelesene Chat-Nachrichten` : `${unreadTotal} unread chat messages`}
                    </span>
                    <span aria-hidden="true">
                      {unreadTotal > 9 ? '9+' : unreadTotal}
                    </span>
                  </div>
                )}
              </div>
              <span className={cn(
                "text-[8.5px] sm:text-[9px] uppercase font-black tracking-tight whitespace-nowrap truncate max-w-full transition-all duration-200",
                isActive ? "opacity-100 scale-100 text-primary" : "opacity-75"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
