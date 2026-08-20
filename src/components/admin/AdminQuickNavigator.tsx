'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ALL_QUICK_NAV_ITEMS,
  CATEGORY_LABELS,
  GROUP_TITLES,
  QuickNavItem,
} from '@/lib/quick-navigator-items';
import {
  Terminal,
  Search,
  ChevronRight,
  Command,
  Maximize2,
  ExternalLink,
} from 'lucide-react';

export function AdminQuickNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, loading } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const isDev = process.env.NODE_ENV === 'development';
  const isSwitchEnabled = process.env.NEXT_PUBLIC_ENABLE_ADMIN_NAVIGATOR === 'true';

  // SECURITY GATE:
  // Visible to logged-in users with role === 'admin' || 'superadmin' || 'supporter' or dev mode.
  const isNavigatorActive = isDev || userProfile?.role === 'admin' || userProfile?.role === 'superadmin' || userProfile?.role === 'supporter';

  const filteredItems = useMemo(() => {
    return ALL_QUICK_NAV_ITEMS.filter((item) => {
      // 1. Admin-Only paths
      if (item.requiresAdmin && userProfile?.role !== 'admin' && userProfile?.role !== 'superadmin') {
        return false;
      }

      // 2. Dynamic route mocks, debug and test pages strictly hidden in production if non-dev
      if ((item.isMock || item.path === '/test' || item.path === '/debug') && !isDev) {
        return false;
      }

      // 3. Category Filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // 4. Text Search Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          item.label.toLowerCase().includes(query) ||
          item.path.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [searchQuery, selectedCategory, userProfile?.role, isDev]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, QuickNavItem[]> = {
      core: [],
      activities: [],
      admin: [],
      auth: [],
      legal: [],
    };

    filteredItems.forEach((item) => {
      if (groups[item.category]) {
        groups[item.category].push(item);
      }
    });

    return groups;
  }, [filteredItems]);

  if (loading || !isNavigatorActive) {
    return null;
  }

  const handleNavigate = (path: string, label?: string) => {
    setIsOpen(false);
    if (label) {
      toast({
        title: 'Seitenwechsel',
        description: `Navigiere zu: ${label}`,
      });
    }
    router.push(path);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-24 left-5 w-14 h-14 rounded-full bg-gradient-to-tr from-[#7c3aed] via-[#6366f1] to-[#ec4899] text-white flex items-center justify-center shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:ring-offset-2 z-40"
          aria-label="Admin Navigator öffnen"
          title="Admin Navigator"
        >
          <Command className="w-6 h-6 animate-pulse" />
        </button>
      </SheetTrigger>
      
      <SheetContent 
        side="right" 
        className="w-full sm:max-w-md p-0 flex flex-col bg-background border-l border-slate-100 dark:border-neutral-800 z-50"
      >
        <SheetHeader className="p-6 pb-4 border-b border-slate-100 dark:border-neutral-800 text-left">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-[#7c3aed] text-white font-bold uppercase tracking-wider text-[9px] px-2 py-0.5 shadow-none border-none">
                {isDev ? 'DEV MODE' : 'ADMIN ONLY'}
              </Badge>
              {isSwitchEnabled && (
                <Badge variant="secondary" className="text-[9px] px-2 py-0.5">
                  SWITCH ON
                </Badge>
              )}
            </div>

            {/* Top link to open the full Quick Navigator page */}
            <Button
              onClick={() => handleNavigate('/quick-navigator', 'Quick Navigator Vollbild-Seite')}
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px] font-bold rounded-xl text-[#7c3aed] border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 flex items-center gap-1 shrink-0"
              title="Als eigene Seite öffnen"
            >
              <span>Vollbild-Seite</span>
              <Maximize2 className="w-3 h-3" />
            </Button>
          </div>

          <div 
            onClick={() => handleNavigate('/quick-navigator', 'Quick Navigator Vollbild-Seite')}
            className="cursor-pointer group flex items-center justify-between"
          >
            <SheetTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2 group-hover:text-[#7c3aed] transition-colors">
              <Terminal className="w-5 h-5 text-[#7c3aed]" />
              Quick Navigator
            </SheetTitle>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#7c3aed] transition-colors" />
          </div>

          <SheetDescription className="text-xs text-slate-400 dark:text-neutral-400 font-medium mt-1">
            Schneller Zugriff auf alle App-Seiten und Dynamic Mocks.
          </SheetDescription>
        </SheetHeader>

        {/* Search & Badges */}
        <div className="p-4 gap-3 flex flex-col border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Nach Seite oder Pfad suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 h-10 w-full rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 focus-visible:ring-[#7c3aed] text-sm"
            />
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {['all', 'core', 'activities', 'admin', 'auth', 'legal'].map((cat) => {
              const isActive = selectedCategory === cat;
              const label = CATEGORY_LABELS[cat] || cat;
              
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                    isActive 
                      ? 'bg-[#7c3aed] text-white border-transparent' 
                      : 'bg-white dark:bg-neutral-950 text-slate-500 border-slate-200 dark:border-neutral-800 dark:text-neutral-400 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* List of Pages */}
        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-5 pb-8">
            {Object.entries(groupedItems).map(([group, items]) => {
              if (items.length === 0) return null;
              
              const groupTitle = GROUP_TITLES[group] || group;

              return (
                <div key={group} className="flex flex-col gap-1.5">
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest px-1">
                    {groupTitle} ({items.length})
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActivePage = pathname === item.path;
                      
                      return (
                        <button
                          key={item.path}
                          onClick={() => handleNavigate(item.path, item.label)}
                          className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border text-left group ${
                            isActivePage
                              ? 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/20 text-[#7c3aed]'
                              : 'bg-white dark:bg-neutral-900 border-slate-100 dark:border-neutral-800/40 text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-xl shrink-0 ${
                              isActivePage 
                                ? 'bg-[#7c3aed] text-white' 
                                : 'bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 group-hover:bg-slate-200 dark:group-hover:bg-neutral-700/60'
                            }`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-bold truncate leading-tight">
                                {item.label}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono truncate max-w-[240px]">
                                {item.path}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${
                            isActivePage 
                              ? 'text-[#7c3aed] translate-x-0.5' 
                              : 'text-slate-300 dark:text-neutral-700 group-hover:translate-x-0.5'
                          }`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {Object.keys(groupedItems).every(k => groupedItems[k].length === 0) && (
              <div className="text-center py-12 px-4 flex flex-col items-center justify-center">
                <Search className="w-8 h-8 text-slate-300 dark:text-neutral-700 mb-2" />
                <p className="text-sm font-bold text-slate-400 dark:text-neutral-500">
                  Keine Seiten gefunden.
                </p>
                <p className="text-xs text-slate-300 dark:text-neutral-600 mt-1">
                  Passe deinen Suchbegriff an.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
