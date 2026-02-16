'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, MessageCircle, User } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/explore', label: 'Explore', icon: Compass },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/profile', label: 'Profile', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-3xl -translate-x-1/2 border-t border-border/80 bg-background shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
      <nav className="flex h-[72px] items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex h-full w-full flex-col items-center justify-center gap-1 text-sm font-medium transition-colors ${
                isActive
                  ? item.href === '/' ? 'text-accent' : 'text-primary'
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
