'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, MessageCircle, User } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Discover', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/profile', label: 'Profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  const hideOnPaths = ['/login', '/signup', '/onboarding'];
  if (hideOnPaths.includes(pathname)) {
    return null;
  }
  
  // A helper function to determine if a nav item is active.
  // It handles the root path and sub-paths.
  const getIsActive = (itemHref: string) => {
    if (itemHref === '/') return pathname === '/';
    return pathname.startsWith(itemHref);
  };

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 bg-background border-t">
      <nav className="flex h-[72px] items-center justify-around">
        {navItems.map((item) => {
          const isActive = getIsActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex h-full w-full flex-col items-center justify-center gap-1 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
