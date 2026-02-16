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
    <div className="sm:hidden fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 pointer-events-none">
      <nav className="pointer-events-auto flex h-16 w-full max-w-sm items-center justify-around rounded-full bg-background/95 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur-sm">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-full text-sm font-medium transition-colors ${
              pathname === item.href
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
