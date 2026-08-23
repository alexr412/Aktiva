'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Banknote, Clock, ArrowLeft, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { AdminSummaryBar } from '@/components/admin/AdminSummaryBar';

function AdminPayoutsContent() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialStatus = searchParams.get('status') || 'pending';

  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isDev = process.env.NODE_ENV === 'development';
  const isAllowed = isDev || userProfile?.role === 'admin' || userProfile?.role === 'superadmin' || userProfile?.role === 'supporter';

  // Sync filter to URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'pending') params.set('status', statusFilter);

    const queryString = params.toString();
    const newUrl = queryString ? `/admin/payouts?${queryString}` : '/admin/payouts';
    router.replace(newUrl, { scroll: false });
  }, [statusFilter, router]);

  useEffect(() => {
    if (!db || authLoading || !userProfile || !isAllowed) return;

    let q;
    if (statusFilter === 'all') {
      q = query(collection(db, 'payoutRequests'));
    } else {
      q = query(collection(db, 'payoutRequests'), where('status', '==', statusFilter));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPayouts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.warn('Payouts snapshot error:', err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userProfile, authLoading, isAllowed, statusFilter]);

  const handleConfirmPayout = async (requestId: string) => {
    if (!db) return;
    if (!window.confirm("Bist du sicher, dass du diese Auszahlung als ausgezahlt markieren möchtest? Der Status wird permanent auf 'completed' gesetzt.")) {
      return;
    }
    setActionLoading(requestId);
    try {
      const reqRef = doc(db, 'payoutRequests', requestId);
      await updateDoc(reqRef, { 
        status: 'completed', 
        processedAt: serverTimestamp() 
      });
      toast({ title: "Auszahlung bestätigt", description: "Der Status wurde auf 'completed' gesetzt." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || !userProfile || !isAllowed) return null;

  // Calculate summary stats
  const pendingItems = payouts.filter(p => p.status === 'pending');
  const openVolume = pendingItems.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const pendingCount = pendingItems.length;

  const startOfTodayMillis = new Date().setHours(0,0,0,0);
  const completedTodayCount = payouts.filter(p => {
    if (p.status !== 'completed') return false;
    const millis = p.processedAt?.toMillis ? p.processedAt.toMillis() : Date.now();
    return millis >= startOfTodayMillis;
  }).length;

  const failedCount = payouts.filter(p => p.status === 'failed').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full" aria-label="Zurück zum Dashboard">
          <Link href="/admin"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="h-6 w-6 text-blue-600" />
            Auszahlungen & Treasury
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium">
            Verwaltung von Host-Auszahlungsanfragen, Clearing und Stripe-Zahlungsbestätigungen.
          </p>
        </div>
      </div>

      {/* KPI SUMMARY BAR */}
      <AdminSummaryBar
        metrics={[
          { label: 'Offenes Volumen (€)', value: `€${openVolume.toFixed(2)}`, icon: Banknote, colorClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
          { label: 'Offene Anfragen', value: pendingCount, icon: Wallet, colorClass: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
          { label: 'Heute Verarbeitet', value: completedTodayCount, icon: CheckCircle2, colorClass: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'Fehlgeschlagen', value: failedCount, icon: AlertTriangle, colorClass: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
        ]}
      />

      {/* FILTER TABS */}
      <div className="flex items-center justify-between bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'pending', label: 'Ausstehend (Pending)' },
            { id: 'completed', label: 'Abgeschlossen' },
            { id: 'failed', label: 'Fehlgeschlagen' },
            { id: 'all', label: 'Alle Requests' },
          ].map(st => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all border ${
                statusFilter === st.id
                  ? 'bg-blue-600 text-white border-transparent shadow-sm'
                  : 'bg-slate-50 dark:bg-neutral-950 text-slate-600 dark:text-neutral-400 border-slate-200 dark:border-neutral-800 hover:bg-slate-100'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* LIST CONTENT */}
      {loading ? (
        <div className="flex items-center justify-center p-16 text-slate-400 font-bold">
          <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-600" />
          Lade Auszahlungsdaten...
        </div>
      ) : payouts.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 dark:border-neutral-800 p-20 text-center bg-transparent rounded-[2.5rem]">
          <Banknote className="mx-auto h-16 w-16 text-blue-500 mb-4 opacity-20" />
          <p className="text-slate-400 dark:text-neutral-500 font-black uppercase tracking-wider text-sm">
            Keine Auszahlungsanfragen für diesen Filter. Treasury ist ausgeglichen.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {payouts.map((payout) => (
            <Card key={payout.id} className="overflow-hidden border-none shadow-md bg-white dark:bg-neutral-900 rounded-3xl relative">
              <div className="absolute top-0 left-0 w-2 h-full bg-blue-500" />
              <CardHeader className="pb-4 p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Wallet className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Finanz-Transaktion</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                    <Clock className="h-3 w-3" />
                    {payout.createdAt?.toDate ? format(payout.createdAt.toDate(), 'Pp', { locale: de }) : 'Unbekannt'}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-0.5">
                      Auszahlungsbetrag
                    </span>
                    <CardTitle className="text-3xl font-black text-slate-900 dark:text-white">
                      €{Number(payout.amount || 0).toFixed(2)}
                    </CardTitle>
                  </div>
                  <Badge variant={payout.status === 'completed' ? 'default' : 'secondary'} className="text-xs font-bold uppercase">
                    {payout.status || 'Pending'}
                  </Badge>
                </div>

                <CardDescription className="font-bold text-slate-500 dark:text-neutral-400 mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400">Host-ID:</span>
                  <span className="font-mono text-xs bg-slate-100 dark:bg-neutral-800 px-2.5 py-1 rounded-xl text-slate-700 dark:text-neutral-300">
                    {payout.userId}
                  </span>
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 pt-0">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-slate-100 dark:border-neutral-800 pt-4 gap-4">
                  <div className="text-[11px] font-medium text-slate-400 max-w-[320px] leading-relaxed italic">
                    Verifiziere den externen Bank-/Stripe-Transaktionsbeleg vor der Status-Aktualisierung.
                  </div>
                  
                  {payout.status === 'pending' && (
                    <Button 
                      onClick={() => handleConfirmPayout(payout.id)}
                      disabled={actionLoading === payout.id}
                      className="rounded-2xl font-black text-xs uppercase tracking-wider bg-slate-900 hover:bg-black text-white dark:bg-neutral-800 dark:hover:bg-neutral-700 h-12 px-6 shadow-md"
                    >
                      {actionLoading === payout.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                      Als Ausgezahlt Markieren
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPayoutsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-12 font-bold text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-600" />
        Lade Auszahlungsseite...
      </div>
    }>
      <AdminPayoutsContent />
    </Suspense>
  );
}
