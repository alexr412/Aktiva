'use client';

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

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
      if (userProfile.role !== 'admin' && userProfile.role !== 'superadmin') {
        router.replace("/");
        return;
      }
    }
  }, [userProfile, loading, router, pathname]);

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

  // Finaler Guard vor dem Rendering
  if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'superadmin')) {
    return null;
  }

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Nutzer" },
    { href: "/admin/reports", label: "Moderation" },
    { href: "/admin/payouts", label: "Auszahlungen" },
    { href: "/admin/refunds", label: "Rückzahlungen" },
  ];

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-neutral-950 overflow-hidden">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b dark:border-neutral-800 pb-4 pt-4 px-4 sm:px-6 bg-white dark:bg-neutral-900 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-red-500 p-1.5 rounded-lg text-white">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="">
            System Control Center
          </h1>
        </div>
        
        <nav className="flex items-center gap-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 text-sm font-medium text-muted-foreground hide-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "transition-colors hover:text-primary whitespace-nowrap px-1",
                pathname === item.href ? "text-primary font-bold border-b-2 border-primary" : ""
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-24 text-foreground min-w-0">
        <div className="max-w-7xl mx-auto min-w-0 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
