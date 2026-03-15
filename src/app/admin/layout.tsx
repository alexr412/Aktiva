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
    if (!loading && (!userProfile || !userProfile.isAdmin)) {
      router.replace("/");
    }
  }, [userProfile, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 font-mono text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span>Verifiziere Administrator-Berechtigung...</span>
        </div>
      </div>
    );
  }

  if (!userProfile?.isAdmin) {
    return null;
  }

  const navItems = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/reports", label: "Moderation" },
    { href: "/admin/payouts", label: "Auszahlungen" },
  ];

  return (
    <div className="flex h-screen flex-col bg-slate-50 overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-white px-6 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="bg-red-500 p-1.5 rounded-lg text-white">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">System Control Center</h1>
        </div>
        <nav className="flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
                pathname === item.href ? "text-primary" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-y-auto p-6 sm:p-10 pb-32">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
