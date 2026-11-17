'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { useChatSync } from '@/contexts/chat-sync-context';
import { MAIN_NAV_ITEMS, getIsActiveNav } from '@/lib/navigation-config';

export function DesktopNav({ className, flat = false }: { className?: string; flat?: boolean }) {
  const pathname = usePathname();
  const language = useLanguage();
  const { unreadTotal } = useChatSync();

  return (
    <nav
      aria-label="Hauptnavigation"
      className={cn(
        'hidden lg:flex shrink-0 items-center gap-1',
        !flat && 'rounded-2xl border border-border bg-muted p-1.5 dark:border-neutral-800/80 dark:bg-neutral-900/80',
        className
      )}
    >
      {MAIN_NAV_ITEMS.map((item) => {
        const isActive = getIsActiveNav(item.href, pathname);
        const label = language === 'de' ? item.labelDe : item.labelEn;
        const headerTutorialId = item.href === '/' ? 'header-feed' : item.href === '/explore' ? 'header-explore' : item.href === '/map' ? 'header-map' : item.href === '/chat' ? 'header-chat' : item.href === '/profile' ? 'header-profile' : undefined;

        return (
          <Link
            key={item.href}
            href={item.href}
            data-tutorial-id={headerTutorialId}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'relative flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs transition-colors duration-200',
              flat ? 'min-h-10 font-semibold' : 'font-black uppercase tracking-wider',
              isActive
                ? (flat ? 'bg-primary/10 text-primary' : 'bg-white text-primary shadow-sm dark:bg-neutral-800')
                : "text-muted-foreground dark:text-neutral-400 hover:text-foreground dark:hover:text-white hover:bg-white/50 dark:hover:bg-neutral-800/50"
            )}
          >
            <div className="relative shrink-0 flex items-center justify-center">
              <item.icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
              {item.href === '/chat' && unreadTotal > 0 && !pathname.startsWith('/chat') && (
                <div
                  className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold px-1"
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
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
