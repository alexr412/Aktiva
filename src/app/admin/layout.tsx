'use client';

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userProfile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      // Wir prüfen auf 'role'
      if (!userProfile || userProfile.role !== 'admin') {
        router.replace("/");
      }
    }
  }, [userProfile, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-neutral-950 font-mono text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span>Verifiziere Administrator-Berechtigung...</span>
        </div>
      </div>
    );
  }

  // Finaler Guard vor dem Rendering
  if (!userProfile || userProfile.role !== 'admin') {
    return null;
  }

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/reports", label: "Moderation" },
    { href: "/admin/payouts", label: "Auszahlungen" },
    { href: "/admin/refunds", label: "Rückzahlungen" },
  ];

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-neutral-950 overflow-hidden">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b dark:border-neutral-800 pb-4 pt-4 px-4 sm:px-6 bg-white dark:bg-neutral-900 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-red-500 p-1.5 rounded-lg text-white">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap text-slate-900 dark:text-neutral-100">
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
      
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-24 text-foreground">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
