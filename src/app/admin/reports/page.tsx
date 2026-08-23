'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, writeBatch, doc, increment, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Trash2, Loader2, ShieldCheck, Ban, ArrowLeft, Filter, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { AdminSummaryBar } from '@/components/admin/AdminSummaryBar';

function AdminReportsContent() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialStatus = searchParams.get('status') || 'open';
  const initialCategory = searchParams.get('category') || 'all';

  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isDev = process.env.NODE_ENV === 'development';
  const isAllowed = isDev || userProfile?.role === 'admin' || userProfile?.role === 'superadmin' || userProfile?.role === 'supporter';

  // Sync filters to URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'open') params.set('status', statusFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);

    const queryString = params.toString();
    const newUrl = queryString ? `/admin/reports?${queryString}` : '/admin/reports';
    router.replace(newUrl, { scroll: false });
  }, [statusFilter, categoryFilter, router]);

  useEffect(() => {
    if (!db || authLoading || !userProfile || !isAllowed) return;

    let q;
    if (statusFilter === 'all') {
      q = query(collection(db, 'reports'));
    } else {
      q = query(collection(db, 'reports'), where('status', '==', statusFilter));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.warn('Reports snapshot error:', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userProfile, authLoading, isAllowed, statusFilter]);

  const handleResolveDelete = async (reportId: string, activityId: string) => {
    if (!db) return;
    if (!window.confirm("Bist du sicher, dass du diese Aktivität permanent löschen und die Meldung als gelöst markieren möchtest?")) {
      return;
    }
    setActionLoading(reportId);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'activities', activityId));
      batch.update(doc(db, 'reports', reportId), { 
        status: 'resolved_deleted', 
        resolvedAt: serverTimestamp() 
      });
      await batch.commit();
      toast({ title: "Aktivität gelöscht", description: "Report wurde als gelöst markiert." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectReport = async (reportId: string, activityId: string) => {
    if (!db) return;
    if (!window.confirm("Bist du sicher, dass du diese Meldung abweisen möchtest? Die Aktivität bleibt bestehen.")) {
      return;
    }
    setActionLoading(reportId);
    try {
      const batch = writeBatch(db);
      if (activityId) {
        batch.update(doc(db, 'activities', activityId), { 
          reportCount: increment(-1) 
        });
      }
      batch.update(doc(db, 'reports', reportId), { 
        status: 'rejected', 
        resolvedAt: serverTimestamp() 
      });
      await batch.commit();
      toast({ title: "Meldung abgewiesen", description: "Aktivität bleibt bestehen." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || !userProfile || !isAllowed) return null;

  // Filter reports by category if selected
  const filteredReports = reports.filter(r => {
    if (categoryFilter === 'all') return true;
    return r.reason?.toLowerCase().includes(categoryFilter.toLowerCase());
  });

  // Calculate summary stats
  const openCount = reports.filter(r => r.status === 'open' || r.status === 'moderation_review').length;
  const criticalCount = reports.filter(r => r.status === 'moderation_review' || r.reason?.toLowerCase().includes('safety')).length;

  const startOfTodayMillis = new Date().setHours(0,0,0,0);
  const todayCount = reports.filter(r => {
    const millis = r.createdAt?.toMillis ? r.createdAt.toMillis() : Date.now();
    return millis >= startOfTodayMillis;
  }).length;

  const resolvedCount = reports.filter(r => r.status?.startsWith('resolved') || r.status === 'rejected').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full" aria-label="Zurück zum Dashboard">
          <Link href="/admin"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            Moderationsverwaltung
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium">
            Behandle gemeldete Inhalte, bewahre Community-Standards und prüfe automatische Triggers.
          </p>
        </div>
      </div>

      {/* KPI SUMMARY BAR */}
      <AdminSummaryBar
        metrics={[
          { label: 'Offene Meldungen', value: openCount, icon: AlertTriangle, colorClass: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
          { label: 'Kritische Fälle', value: criticalCount, icon: ShieldCheck, colorClass: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40' },
          { label: 'Heute Eingegangen', value: todayCount, icon: Sparkles, colorClass: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
          { label: 'Abgeschlossen / Inaktiv', value: resolvedCount, icon: CheckCircle2, colorClass: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
        ]}
      />

      {/* FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-sm">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'open', label: 'Offen & Review' },
            { id: 'all', label: 'Alle Status' },
            { id: 'resolved_deleted', label: 'Gelöscht' },
            { id: 'rejected', label: 'Abgewiesen' },
          ].map(st => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all border ${
                statusFilter === st.id
                  ? 'bg-purple-600 text-white border-transparent shadow-sm'
                  : 'bg-slate-50 dark:bg-neutral-950 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-neutral-800 hover:bg-slate-100'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'Alle Gründe' },
              { id: 'safety', label: 'Safety' },
              { id: 'spam', label: 'Spam' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  categoryFilter === cat.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* REPORTS LIST */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-400 font-bold">
          <Loader2 className="w-5 h-5 animate-spin mr-2 text-purple-600" />
          Lade Moderationsdaten...
        </div>
      ) : filteredReports.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 dark:border-neutral-800 p-16 text-center bg-transparent rounded-[2.5rem]">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500 mb-4 opacity-30" />
          <p className="text-slate-400 dark:text-neutral-500 font-black uppercase tracking-wider text-sm">
            Keine passenden Meldungen gefunden.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredReports.map((report) => (
            <Card key={report.id} className="overflow-hidden border-none shadow-md bg-white dark:bg-neutral-900 rounded-3xl transition-all">
              <CardHeader className="bg-red-50/40 dark:bg-red-950/20 pb-4 border-b border-red-100 dark:border-red-900/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Sicherheits-Meldung</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {report.createdAt?.toDate ? format(report.createdAt.toDate(), 'Pp', { locale: de }) : 'Unbekannt'}
                  </span>
                </div>
                <CardTitle className="text-lg font-black text-slate-900 dark:text-white">
                  Grund: {report.reason || 'Kein Grund angegeben'}
                </CardTitle>
                <CardDescription className="font-mono text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  Report-ID: {report.id} • Reporter-ID: {report.reporterId || 'System'}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ziel-Entität:</span>
                      <span className="font-mono text-xs bg-slate-100 dark:bg-neutral-800 px-2.5 py-1 rounded-xl text-slate-700 dark:text-neutral-300">
                        {report.activityId || report.reportedEntityId || 'Keine ID'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium italic">
                      Status: <strong className="uppercase text-slate-700 dark:text-neutral-300">{report.status}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    {report.status !== 'rejected' && (
                      <Button 
                        variant="ghost" 
                        onClick={() => handleRejectReport(report.id, report.activityId || report.reportedEntityId)}
                        disabled={actionLoading === report.id}
                        className="rounded-xl font-bold text-xs hover:bg-slate-100 text-slate-500 h-10 px-4"
                      >
                        {actionLoading === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                        Abweisen
                      </Button>
                    )}

                    {report.status !== 'resolved_deleted' && (
                      <Button 
                        variant="destructive" 
                        onClick={() => handleResolveDelete(report.id, report.activityId || report.reportedEntityId)}
                        disabled={actionLoading === report.id}
                        className="rounded-xl font-bold text-xs gap-1.5 shadow-sm h-10 px-4"
                      >
                        {actionLoading === report.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Löschen & Schließen
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-12 font-bold text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-purple-600" />
        Lade Moderationsseite...
      </div>
    }>
      <AdminReportsContent />
    </Suspense>
  );
}
