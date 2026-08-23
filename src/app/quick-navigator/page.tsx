'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ALL_QUICK_NAV_ITEMS,
  CATEGORY_LABELS,
  GROUP_TITLES,
  QuickNavItem,
} from '@/lib/quick-navigator-items';
import {
  Search,
  ChevronRight,
  ArrowLeft,
  Grid,
  Shield,
  Sparkles,
  Terminal,
  ExternalLink,
  Lock,
} from 'lucide-react';

export default function QuickNavigatorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { userProfile, loading } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const isDev = process.env.NODE_ENV === 'development';
  const isNavigatorActive =
    isDev ||
    userProfile?.role === 'admin' ||
    userProfile?.role === 'superadmin' ||
    userProfile?.role === 'supporter';

  const filteredItems = useMemo(() => {
    return ALL_QUICK_NAV_ITEMS.filter((item) => {
      // 1. Admin requirement check
      if (item.requiresAdmin && userProfile?.role !== 'admin' && userProfile?.role !== 'superadmin') {
        return false;
      }

      // 2. Mock & debug check in production
      if ((item.isMock || item.path === '/test' || item.path === '/debug') && !isDev) {
        return false;
      }

      // 3. Category Filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // 4. Text Search
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-neutral-950">
        <div className="flex items-center gap-2 font-bold text-slate-500">
          <Terminal className="h-5 w-5 animate-spin text-[#7c3aed]" />
          Lade Quick Navigator...
        </div>
      </div>
    );
  }

  if (!isNavigatorActive) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-neutral-950">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mb-4 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">Zugriff beschränkt</h1>
        <p className="text-sm text-slate-500 dark:text-neutral-400 max-w-sm mb-6">
          Der Quick Navigator ist Administratoren und Entwicklern vorbehalten.
        </p>
        <Button onClick={() => router.push('/')} className="rounded-2xl h-11 px-6 font-bold bg-[#7c3aed] hover:bg-[#6d28d9] text-white">
          Zurück zur Startseite
        </Button>
      </div>
    );
  }

  const handleNavigate = (item: QuickNavItem) => {
    toast({
      title: 'Seitenwechsel',
      description: `Navigiere zu: ${item.label}`,
    });
    router.push(item.path);
  };

  return (
    <div className="h-full flex-1 overflow-y-auto bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 pb-24">
      {/* Header Banner */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-neutral-800 px-4 py-4 md:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              className="h-10 w-10 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 shrink-0"
              title="Zurück zum Feed"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Badge className="bg-[#7c3aed] text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border-none">
                  {isDev ? 'DEV MODE' : 'ADMIN NAVIGATOR'}
                </Badge>
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest hidden sm:inline">
                  {filteredItems.length} Seiten verfügbar
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                <Grid className="w-6 h-6 text-[#7c3aed]" />
                Quick Navigator
              </h1>
            </div>
          </div>

          <Button
            onClick={() => router.push('/')}
            className="rounded-2xl h-10 px-4 font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 text-xs hidden sm:flex items-center gap-1.5"
          >
            <span>Startseite</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-6 md:px-8 space-y-6">
        {/* Search & Category Tabs Bar */}
        <div className="flex flex-col gap-4 bg-white dark:bg-neutral-900 p-4 md:p-6 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-sm">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Seite, Pfad oder Beschreibung suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-4 h-12 rounded-2xl bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 focus-visible:ring-[#7c3aed] text-sm md:text-base font-medium"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {['all', 'core', 'activities', 'admin', 'auth', 'legal'].map((cat) => {
              const isActive = selectedCategory === cat;
              const label = CATEGORY_LABELS[cat] || cat;

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all border ${
                    isActive
                      ? 'bg-[#7c3aed] text-white border-transparent shadow-md shadow-purple-500/20 scale-[1.02]'
                      : 'bg-slate-50 dark:bg-neutral-950 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-neutral-800 hover:bg-slate-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grouped Pages Grid */}
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([groupKey, items]) => {
            if (items.length === 0) return null;

            const groupTitle = GROUP_TITLES[groupKey] || groupKey;

            return (
              <section key={groupKey} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#7c3aed]" />
                    {groupTitle} ({items.length})
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActivePage = pathname === item.path;

                    return (
                      <button
                        key={item.path}
                        onClick={() => handleNavigate(item)}
                        className={`group text-left p-4 rounded-3xl transition-all border flex flex-col justify-between relative overflow-hidden ${
                          isActivePage
                            ? 'bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/40 text-[#7c3aed] shadow-md shadow-purple-500/10'
                            : 'bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800 text-slate-800 dark:text-neutral-200 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div
                              className={`p-3 rounded-2xl shrink-0 transition-colors ${
                                isActivePage
                                  ? 'bg-[#7c3aed] text-white'
                                  : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 group-hover:bg-[#7c3aed] group-hover:text-white'
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.requiresAdmin && (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[8px] font-black uppercase px-2 py-0.5 border-none">
                                  ADMIN
                                </Badge>
                              )}
                              {item.isMock && (
                                <Badge className="bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-400 text-[8px] font-black uppercase px-2 py-0.5 border-none">
                                  MOCK
                                </Badge>
                              )}
                              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-neutral-700 group-hover:translate-x-1 group-hover:text-[#7c3aed] transition-transform" />
                            </div>
                          </div>

                          <h3 className="font-extrabold text-base leading-snug mb-1 group-hover:text-[#7c3aed] transition-colors">
                            {item.label}
                          </h3>

                          {item.description && (
                            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium leading-relaxed mb-3">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-neutral-800/60 mt-auto flex items-center justify-between text-[11px] font-mono text-slate-400 dark:text-neutral-500">
                          <span className="truncate">{item.path}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {Object.keys(groupedItems).every((k) => groupedItems[k].length === 0) && (
            <div className="text-center py-16 px-4 bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800">
              <Search className="w-10 h-10 text-slate-300 dark:text-neutral-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700 dark:text-neutral-300">Keine Seiten gefunden</h3>
              <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">
                Passe deinen Suchbegriff oder den gewählten Filter an.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
