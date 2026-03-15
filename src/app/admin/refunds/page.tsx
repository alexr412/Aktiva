'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, CheckCircle2, Loader2, Banknote, Clock, ArrowLeft, RefreshCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import Link from 'next/link';

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'refunds'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRefunds(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleConfirmRefund = async (refundId: string) => {
    if (!db) return;
    try {
      const refundRef = doc(db, 'refunds', refundId);
      await updateDoc(refundRef, { 
        status: 'completed', 
        processedAt: serverTimestamp() 
      });
      toast({ title: "Rückzahlung bestätigt", description: "Der Status wurde auf 'completed' gesetzt." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm font-black uppercase text-slate-400">Initialisiere Refund-Pipeline...</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/admin"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Rückzahlungen</h2>
          <p className="text-slate-500 font-medium">Verwaltung von Erstattungen stornierter Aktivitäten.</p>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Modus: Reversal</span>
        <Badge variant="secondary" className="bg-orange-50 text-orange-600 font-black px-3 py-1 rounded-lg">
          {refunds.length} Offene Erstattungen
        </Badge>
      </div>

      {refunds.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 p-20 text-center bg-transparent rounded-[2.5rem]">
          <RefreshCcw className="mx-auto h-16 w-16 text-emerald-500 mb-6 opacity-20" />
          <p className="text-slate-400 font-black uppercase tracking-wider">Keine offenen Rückzahlungen. Ledger ist ausgeglichen.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {refunds.map((refund) => (
            <Card key={refund.id} className="overflow-hidden border-none shadow-md bg-white rounded-[2.5rem] animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
              <div className="absolute top-0 left-0 w-2 h-full bg-orange-500" />
              <CardHeader className="pb-4 p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-orange-600">
                    <RotateCcw className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Rückabwicklung</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-black uppercase">
                    <Clock className="h-3 w-3" />
                    {refund.createdAt ? format(refund.createdAt.toDate(), 'Pp', { locale: de }) : 'Unbekannt'}
                  </div>
                </div>
                <div className="mt-6">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Rückerstattungsbetrag</span>
                  <CardTitle className="text-5xl font-black text-slate-900 tracking-tighter">€{refund.amount?.toFixed(2)}</CardTitle>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Nutzer-ID</span>
                    <span className="font-mono text-xs bg-slate-50 px-2 py-1 rounded border border-slate-100">{refund.userId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">Aktivitäts-ID</span>
                    <span className="font-mono text-xs bg-slate-50 px-2 py-1 rounded border border-slate-100">{refund.activityId}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4">
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-50 pt-6 gap-6">
                  <div className="text-[11px] font-bold text-slate-400 max-w-[300px] leading-relaxed italic">
                    ACHTUNG: Führe die Rückbuchung im Stripe-Dashboard aus, bevor du den System-Status aktualisierst.
                  </div>
                  <Button 
                    onClick={() => handleConfirmRefund(refund.id)}
                    className="rounded-2xl font-black text-xs uppercase tracking-widest bg-slate-900 hover:bg-black text-white px-8 h-14 shadow-2xl shadow-slate-200 transition-transform active:scale-95"
                  >
                    Als Rückerstattet markieren
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
