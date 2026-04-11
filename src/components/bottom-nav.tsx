'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Compass, MessageCircle, User } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Discover', icon: Home, activeColor: '#f97316' },
  { href: '/explore', label: 'Explore', icon: Compass, activeColor: '#eab308' },
  { href: '/chat', label: 'Chat', icon: MessageCircle, activeColor: '#8b5cf6' },
  { href: '/profile', label: 'Profile', icon: User, activeColor: '#a855f7' },
];

export function BottomNav() {
  const pathname = usePathname();

  const hideOnPaths = ['/login', '/signup', '/onboarding'];
  if (hideOnPaths.includes(pathname)) {
    return null;
  }
  
  const getIsActive = (itemHref: string) => {
    // Root path is only active if it's an exact match
    if (itemHref === '/') {
      return pathname === '/';
    }
    // Other paths are active if the current path starts with their href
    return pathname.startsWith(itemHref);
  };

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-t border-neutral-100 dark:border-neutral-800 pb-safe">
      <nav className="flex h-[76px] items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = getIsActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                  "flex h-full flex-col items-center justify-center gap-1.5 transition-all duration-300 relative px-4 flex-1",
                  isActive ? "scale-110" : "opacity-40 grayscale hover:opacity-70 hover:grayscale-0"
              )}
              style={{ color: isActive ? item.activeColor : undefined }}
            >
              <div className={cn(
                  "p-2 rounded-2xl transition-all duration-300",
                  isActive ? "bg-current/10 shadow-lg shadow-current/5" : ""
              )}>
                <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                  "text-[10px] uppercase font-black tracking-widest",
                  isActive ? "opacity-100" : "opacity-0 translate-y-2 scale-50"
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
