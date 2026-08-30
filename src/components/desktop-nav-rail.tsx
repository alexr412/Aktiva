'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { useChatSync } from '@/contexts/chat-sync-context';
import { MAIN_NAV_ITEMS, getIsActiveNav } from '@/lib/navigation-config';

export function DesktopNavRail({ className }: { className?: string }) {
  const pathname = usePathname();
  const language = useLanguage();
  const { unreadTotal } = useChatSync();

  return (
    <aside
      aria-label="Hauptnavigation"
      className={cn(
        "hidden lg:flex flex-col items-center justify-between w-16 xl:w-20 h-full py-4 bg-white dark:bg-neutral-900 border-r border-slate-200/80 dark:border-neutral-800/80 shrink-0 z-30 select-none",
        className
      )}
    >
      {/* Top: Brand Logo */}
      <div className="flex flex-col items-center gap-4 w-full">
        <Link 
          href="/" 
          className="relative h-10 w-10 flex items-center justify-center hover:scale-105 transition-transform"
          title="Aktiva Home"
        >
          <Image src="/assets/logo-heart.png" alt="Aktiva" width={36} height={36} className="object-contain" priority />
        </Link>
        <div className="w-8 h-[1px] bg-slate-200 dark:bg-neutral-800" />
      </div>

      {/* Center: Navigation Links */}
      <nav className="flex flex-col items-center gap-3 w-full px-2 mb-auto">
        {MAIN_NAV_ITEMS.map((item) => {
          const isActive = getIsActiveNav(item.href, pathname);
          const label = language === 'de' ? item.labelDe : item.labelEn;
          const tutorialId = item.href === '/' ? 'nav-feed' : item.href === '/explore' ? 'nav-explore' : item.href === '/map' ? 'nav-map' : item.href === '/chat' ? 'nav-chat' : item.href === '/profile' ? 'nav-profile' : undefined;

          return (
            <Link
              key={item.href}
              href={item.href}
              data-tutorial-id={tutorialId}
              title={label}
              aria-label={label}
              className={cn(
                "flex flex-col items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200 relative group",
                isActive
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 scale-105"
                  : "text-slate-400 dark:text-neutral-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800"
              )}
            >
              <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              {item.href === '/chat' && unreadTotal > 0 && !pathname.startsWith('/chat') && (
                <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-neutral-900" />
              )}
              {/* Desktop Hover Tooltip */}
              <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white dark:bg-neutral-800 text-xs font-bold rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-lg">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
