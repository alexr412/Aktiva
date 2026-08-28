'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useRouter, usePathname } from "next/navigation";
import { ShieldAlert, Grid, ArrowLeft, Search, LayoutDashboard, Users, AlertTriangle, Wallet, RotateCcw, Cpu, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminMetricsProvider, useAdminMetrics } from "@/contexts/admin-metrics-context";
import { AdminGlobalSearch } from "@/components/admin/AdminGlobalSearch";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  const { openReportsCount, pendingPayoutsCount, pendingRefundsCount } = useAdminMetrics();

  const isDev = process.env.NODE_ENV === 'development';
  const isAllowed = isDev || userProfile?.role === 'admin' || userProfile?.role === 'superadmin' || userProfile?.role === 'supporter';

  useEffect(() => {
    if (!loading) {
      if (!userProfile) {
        router.push(`/login?redirect=${pathname}`);
        return;
      }
      if (userProfile.onboardingCompleted === false) {
        router.replace("/onboarding");
        return;
      }
      if (!isAllowed) {
        router.replace("/");
        return;
      }
    }
  }, [userProfile, loading, router, pathname, isAllowed]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-950 text-white font-mono">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="relative w-16 h-16 animate-pulse">
            <Image src="/assets/logo-heart.png" alt="Activa" fill sizes="64px" className="object-contain" />
          </div>
          <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Verifiziere Administrator-Berechtigung…</span>
        </div>
      </div>
    );
  }

  if (!userProfile || !isAllowed) {
    return null;
  }

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Nutzer", icon: Users },
    { href: "/admin/usage", label: "Verbrauch", icon: Zap },
    { href: "/admin/reports", label: "Moderation", icon: AlertTriangle, badge: openReportsCount },
    { href: "/admin/payouts", label: "Auszahlungen", icon: Wallet, badge: pendingPayoutsCount },
    { href: "/admin/refunds", label: "Rückzahlungen", icon: RotateCcw, badge: pendingRefundsCount },
    { href: "/admin/system", label: "System", icon: Cpu },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-neutral-950 overflow-hidden">
      {/* Top Bar Header */}
      <header className="border-b border-slate-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md px-4 sm:px-6 py-3 shrink-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Title & Status */}
          <div className="flex items-center justify-between md:justify-start gap-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-red-500 p-2 rounded-xl text-white shadow-md shadow-red-500/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                    Admin Control Center
                  </span>
                  <Badge className="bg-purple-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border-none">
                    {isDev ? 'DEV MODE' : 'ADMIN'}
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Zentrale Steuerung, Moderation & Integrität
                </p>
              </div>
            </div>

            {/* Quick Actions Mobile */}
            <div className="flex sm:hidden items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearchOpen(true)}
                className="h-9 w-9 rounded-xl"
                title="Suche"
              >
                <Search className="w-4 h-4 text-slate-600 dark:text-neutral-400" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/quick-navigator')}
                className="h-9 w-9 rounded-xl"
                title="Quick Navigator"
              >
                <Grid className="w-4 h-4 text-purple-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
                className="h-9 w-9 rounded-xl"
                title="Zurück zum Feed"
              >
                <ArrowLeft className="w-4 h-4 text-slate-600" />
              </Button>
            </div>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="h-9 px-3 rounded-xl border-slate-200 dark:border-neutral-800 text-xs font-bold text-slate-600 dark:text-neutral-300 gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Schnellsuche</span>
              <kbd className="hidden lg:inline-block text-[10px] bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded font-mono text-slate-400">
                ⌘K
              </kbd>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/quick-navigator')}
              className="h-9 px-3 rounded-xl border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 text-xs font-bold gap-1.5"
            >
              <Grid className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Quick Nav</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => router.push('/')}
              className="h-9 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 text-xs font-bold gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Zum Feed</span>
            </Button>
          </div>
        </div>

        {/* Main Navigation Links */}
        <div className="max-w-7xl mx-auto mt-3 pt-2 border-t border-slate-100 dark:border-neutral-800/60">
          <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 text-sm font-bold hide-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/admin' && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-2xl transition-all whitespace-nowrap text-xs font-extrabold",
                    isActive
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                      : "text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/60 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <Badge
                      className={cn(
                        "text-[9px] font-black px-1.5 py-0.2 rounded-full border-none ml-0.5",
                        isActive
                          ? "bg-white text-purple-600"
                          : "bg-red-500 text-white"
                      )}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-24 text-foreground min-w-0">
        <div className="max-w-7xl mx-auto min-w-0 w-full">
          {children}
        </div>
      </main>

      {/* Global Admin Search Modal */}
      <AdminGlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminMetricsProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminMetricsProvider>
  );
}
