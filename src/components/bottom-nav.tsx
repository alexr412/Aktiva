'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Compass, MessageCircle, User } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useChatSync } from '@/contexts/chat-sync-context';

export function BottomNav() {
  const pathname = usePathname();
  const language = useLanguage();
  const { unreadTotal } = useChatSync();

  const bottomNavVisiblePaths = ['/', '/explore', '/chat', '/profile'];
  const shouldShowBottomNav = bottomNavVisiblePaths.includes(pathname);
  if (!shouldShowBottomNav) {
    return null;
  }
  
  const getIsActive = (itemHref: string) => {
    if (itemHref === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(itemHref);
  };

  const navItems = [
    { href: '/', label: language === 'de' ? 'Entdecken' : 'Discover', icon: Home },
    { href: '/explore', label: language === 'de' ? 'Erkunden' : 'Explore', icon: Compass },
    { href: '/chat', label: 'Chat', icon: MessageCircle },
    { href: '/profile', label: language === 'de' ? 'Profil' : 'Profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full z-nav bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-t border-slate-200/30 dark:border-neutral-800/20 pb-safe shadow-premium">
      <nav className="flex h-[72px] items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = getIsActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 transition-all duration-200 relative px-4 flex-1",
                  isActive ? "text-primary scale-100" : "text-slate-500 dark:text-neutral-400 opacity-60 hover:opacity-100"
              )}
            >
              <div className={cn(
                  "p-2.5 rounded-[12px] transition-all duration-200 relative",
                  isActive ? "bg-primary/10 text-primary" : "text-current"
              )}>
                <item.icon className="h-5.5 w-5.5" strokeWidth={isActive ? 2.5 : 2} />
                {item.href === '/chat' && unreadTotal > 0 && !pathname.startsWith('/chat') && (
                  <div 
                    className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold px-1"
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
                  "text-[8px] uppercase font-black tracking-widest transition-all duration-200",
                  isActive ? "opacity-100 scale-100" : "opacity-0 scale-95"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
