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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Home,
  Compass,
  MessageSquare,
  Users,
  Wallet,
  User,
  Settings,
  Shield,
  FileText,
  Sparkles,
  Info,
  Terminal,
  Code,
  AlertTriangle,
  Search,
  ExternalLink,
  ChevronRight,
  Command,
  Globe
} from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<any>;
  category: 'core' | 'admin' | 'auth' | 'legal' | 'mock';
  requiresAdmin: boolean;
}

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
  // - Strictly visible ONLY to logged-in users with role === 'admin' or role === 'supporter'.
  const isNavigatorActive = userProfile?.role === 'admin' || userProfile?.role === 'supporter';

  // Static list of app routes
  const navItems = useMemo<NavItem[]>(() => [
    // Core App Group
    { label: 'Startseite (Feed)', path: '/', icon: Home, category: 'core', requiresAdmin: false },
    { label: 'Entdecken (Karte)', path: '/explore', icon: Compass, category: 'core', requiresAdmin: false },
    { label: 'Favoriten & Sammlungen', path: '/favorites', icon: Sparkles, category: 'core', requiresAdmin: false },
    { label: 'Community & Freunde', path: '/community', icon: Users, category: 'core', requiresAdmin: false },
    { label: 'Wallet & Token-Shop', path: '/wallet', icon: Wallet, category: 'core', requiresAdmin: false },
    { label: 'Mein Profil', path: '/profile', icon: User, category: 'core', requiresAdmin: false },
    { label: 'Einstellungen', path: '/settings', icon: Settings, category: 'core', requiresAdmin: false },

    // Admin Group
    { label: 'Admin Dashboard', path: '/admin', icon: Shield, category: 'admin', requiresAdmin: true },
    { label: 'Meldungen & Berichte', path: '/admin/reports', icon: FileText, category: 'admin', requiresAdmin: true },
    { label: 'Auszahlungen', path: '/admin/payouts', icon: Wallet, category: 'admin', requiresAdmin: true },
    { label: 'Rückerstattungen', path: '/admin/refunds', icon: AlertTriangle, category: 'admin', requiresAdmin: true },

    // Auth & Flow Group
    { label: 'Login / Anmeldung', path: '/login', icon: ExternalLink, category: 'auth', requiresAdmin: false },
    { label: 'Registrieren', path: '/signup', icon: User, category: 'auth', requiresAdmin: false },
    { label: 'Onboarding (Profilsetup)', path: '/onboarding', icon: Sparkles, category: 'auth', requiresAdmin: false },

    // Legal Group
    { label: 'Datenschutzerklärung', path: '/privacy', icon: Info, category: 'legal', requiresAdmin: false },
    { label: 'Allgemeine Geschäftsbedingungen', path: '/terms', icon: Info, category: 'legal', requiresAdmin: false },
    { label: 'Impressum', path: '/imprint', icon: Info, category: 'legal', requiresAdmin: false },
    { label: 'Kündigungs-Informationen', path: '/cancellation', icon: Info, category: 'legal', requiresAdmin: false },
    { label: 'Barrierefreiheit', path: '/accessibility', icon: Info, category: 'legal', requiresAdmin: false },
    { label: 'Lizenzen & Open Source', path: '/licenses', icon: Info, category: 'legal', requiresAdmin: false },

    // Developer Tools & Test (Development Only)
    { label: 'Developer Debug Panel', path: '/debug', icon: Terminal, category: 'admin', requiresAdmin: false },
    { label: 'Testumgebung (Sandbox)', path: '/test', icon: Code, category: 'admin', requiresAdmin: false },

    // Dynamic Route Mocks (Development Only)
    { label: 'Chat-Unterhaltung (Mock ID)', path: '/chat/mock-chat-room', icon: MessageSquare, category: 'mock', requiresAdmin: false },
    { label: 'Aktivität-Detail (Mock ID)', path: '/activities/mock-activity-id', icon: Compass, category: 'mock', requiresAdmin: false },
    { label: 'QR-Scanner (Mock ID)', path: '/activities/mock-activity-id/scanner', icon: Code, category: 'mock', requiresAdmin: false },
    { label: 'Statistiken (Mock ID)', path: '/activities/mock-activity-id/stats', icon: FileText, category: 'mock', requiresAdmin: false },
    { label: 'Buchungs-Checkout (Mock ID)', path: '/checkout/mock-activity-id', icon: Wallet, category: 'mock', requiresAdmin: false },
    { label: 'Öffentliches Profil (Mock ID)', path: '/users/mock-user-id', icon: User, category: 'mock', requiresAdmin: false },
    { label: 'Gesperrte Nutzer (Settings)', path: '/settings/blocked', icon: AlertTriangle, category: 'mock', requiresAdmin: false },
    { label: 'Spracheinstellungen (Settings)', path: '/settings/language', icon: Globe, category: 'mock', requiresAdmin: false },
    { label: 'Rechtliche Infos (Settings)', path: '/settings/legal', icon: Info, category: 'mock', requiresAdmin: false },
  ], []);

  // Filter items based on security constraints, query and category
  const filteredItems = useMemo(() => {
    return navItems.filter((item) => {
      // 1. Admin-Only paths require role === 'admin' in all environments
      if (item.requiresAdmin && userProfile?.role !== 'admin') {
        return false;
      }

      // 2. Dynamic route mocks, debug and test pages strictly hidden in production
      if ((item.category === 'mock' || item.path === '/test' || item.path === '/debug') && !isDev) {
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
          item.path.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [navItems, searchQuery, selectedCategory, userProfile?.role, isDev]);

  // Group items for rendering
  const groupedItems = useMemo(() => {
    const groups: Record<string, NavItem[]> = {
      core: [],
      admin: [],
      auth: [],
      legal: [],
      mock: []
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

  const handleNavigate = (item: NavItem) => {
    setIsOpen(false);
    toast({
      title: 'Seitenwechsel',
      description: `Navigiere zu: ${item.label}`,
    });
    router.push(item.path);
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
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="default" className="bg-[#7c3aed] text-white font-bold uppercase tracking-wider text-[9px] px-2 py-0.5 shadow-none border-none">
              {isDev ? 'DEV MODE' : 'ADMIN ONLY'}
            </Badge>
            {isSwitchEnabled && (
              <Badge variant="secondary" className="text-[9px] px-2 py-0.5">
                SWITCH ON
              </Badge>
            )}
          </div>
          <SheetTitle className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Terminal className="w-5 h-5 text-[#7c3aed]" />
            Quick Navigator
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-400 dark:text-neutral-400 font-medium">
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
            {['all', 'core', 'admin', 'auth', 'legal', 'mock'].map((cat) => {
              const isActive = selectedCategory === cat;
              const catLabels: Record<string, string> = {
                all: 'Alle',
                core: 'Core App',
                admin: 'Admin & Dev',
                auth: 'Auth',
                legal: 'Rechtliches',
                mock: 'Mocks (Dev)'
              };
              
              if (cat === 'mock' && !isDev) return null;
              
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
                  {catLabels[cat]}
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
              
              const groupTitles: Record<string, string> = {
                core: 'Hauptanwendung',
                admin: 'Administration & Debug',
                auth: 'Login & Registrierung',
                legal: 'Rechtliches & Information',
                mock: 'Dynamic Route Mocks (Dev Only)'
              };

              return (
                <div key={group} className="flex flex-col gap-1.5">
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-neutral-500 uppercase tracking-widest px-1">
                    {groupTitles[group] || group}
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActivePage = pathname === item.path;
                      
                      return (
                        <button
                          key={item.path}
                          onClick={() => handleNavigate(item)}
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
