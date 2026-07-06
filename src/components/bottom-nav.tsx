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
    { href: '/', label: language === 'de' ? 'Entdecken' : 'Discover', icon: Home, activeColor: '#10b981' },
    { href: '/explore', label: language === 'de' ? 'Erkunden' : 'Explore', icon: Compass, activeColor: '#10b981' },
    { href: '/chat', label: 'Chat', icon: MessageCircle, activeColor: '#10b981' },
    { href: '/profile', label: language === 'de' ? 'Profil' : 'Profile', icon: User, activeColor: '#10b981' },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full z-nav bg-white dark:bg-neutral-900 border-t border-slate-100 dark:border-neutral-800 pb-safe">
      <nav className="flex h-[76px] items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = getIsActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                  "flex h-full flex-col items-center justify-center gap-1.5 transition-all duration-300 relative px-4 flex-1",
                  isActive ? "scale-105" : "opacity-40 grayscale hover:opacity-70 hover:grayscale-0"
              )}
              style={{ color: isActive ? item.activeColor : undefined }}
            >
              <div className={cn(
                  "p-2 rounded-2xl transition-all duration-300 relative",
                  isActive ? "bg-current/10 scale-110 shadow-none" : ""
              )}>
                <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                {item.href === '/chat' && unreadTotal > 0 && !pathname.startsWith('/chat') && (
                  <div 
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold px-1"
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
                  "text-[10px] uppercase font-black tracking-widest transition-all duration-300",
                  isActive ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-50"
              )}>
                {item.label}
              </span>
              
              {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-current" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
