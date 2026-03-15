'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Banknote, LayoutDashboard, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Übersicht</h2>
        <p className="text-slate-500 font-medium">Willkommen im Administrationsbereich von Aktvia.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/admin/reports">
          <Card className="hover:shadow-lg transition-all border-none bg-white rounded-[2.5rem] p-4 group cursor-pointer shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="bg-red-100 p-3 rounded-2xl text-red-600 group-hover:scale-110 transition-transform">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-2xl font-black mb-1 text-slate-900">Moderation</CardTitle>
              <CardDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">User-Meldungen & Quarantäne</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/payouts">
          <Card className="hover:shadow-lg transition-all border-none bg-white rounded-[2.5rem] p-4 group cursor-pointer shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 group-hover:scale-110 transition-transform">
                <Banknote className="h-6 w-6" />
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <CardTitle className="text-2xl font-black mb-1 text-slate-900">Auszahlungen</CardTitle>
              <CardDescription className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Finanz-Clearing & Treasury</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4">
        <div className="bg-white p-2 rounded-xl shadow-sm shrink-0">
          <LayoutDashboard className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h4 className="font-black text-amber-900 text-sm mb-1 uppercase tracking-tight">Admin-Compliance</h4>
          <p className="text-xs text-amber-800/70 font-medium leading-relaxed">
            Alle Aktionen in diesem Bereich werden protokolliert. Löschungen von Aktivitäten sind permanent und entfernen auch den zugehörigen Gruppenchat für alle Teilnehmer. Bitte prüfe Meldungen sorgfältig vor der Resolution.
          </p>
        </div>
      </div>
    </div>
  );
}
