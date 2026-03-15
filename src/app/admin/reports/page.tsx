'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, writeBatch, doc, increment, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import Link from 'next/link';

export default function AdminReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'reports'), where('status', '==', 'open'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleResolveDelete = async (reportId: string, activityId: string) => {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      // Delete activity
      batch.delete(doc(db, 'activities', activityId));
      // Close report
      batch.update(doc(db, 'reports', reportId), { 
        status: 'resolved_deleted', 
        resolvedAt: serverTimestamp() 
      });
      await batch.commit();
      toast({ title: "Aktivität gelöscht", description: "Report wurde als gelöst markiert." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    }
  };

  const handleRejectReport = async (reportId: string, activityId: string) => {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      // Reduce report count
      batch.update(doc(db, 'activities', activityId), { 
        reportCount: increment(-1) 
      });
      // Close report
      batch.update(doc(db, 'reports', reportId), { 
        status: 'rejected', 
        resolvedAt: serverTimestamp() 
      });
      await batch.commit();
      toast({ title: "Meldung abgewiesen", description: "Aktivität bleibt bestehen." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm font-black uppercase text-slate-400">Lade Moderations-Pipeline...</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/admin"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Moderation</h2>
          <p className="text-slate-500 font-medium">Behandle gemeldete Inhalte und schütze die Community.</p>
        </div>
      </div>

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Status: Warteschlange</span>
        <Badge variant="secondary" className="bg-red-50 text-red-600 font-black px-3 py-1 rounded-lg">
          {reports.length} Offene Meldungen
        </Badge>
      </div>

      {reports.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 p-20 text-center bg-transparent rounded-[2.5rem]">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500 mb-6 opacity-20" />
          <p className="text-slate-400 font-black uppercase tracking-wider">Alles sauber! Keine offenen Meldungen.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {reports.map((report) => (
            <Card key={report.id} className="overflow-hidden border-none shadow-md bg-white rounded-[2rem] animate-in fade-in zoom-in-95 duration-300">
              <CardHeader className="bg-red-50/30 pb-6 border-b border-red-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sicherheits-Alarm</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-black uppercase">
                    {report.createdAt ? format(report.createdAt.toDate(), 'Pp', { locale: de }) : 'Unbekannt'}
                  </span>
                </div>
                <CardTitle className="text-xl font-black text-slate-900">Grund: {report.reason}</CardTitle>
                <CardDescription className="font-bold text-slate-500 mt-1">Reporter-ID: {report.reporterId}</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Aktivitäts-ID:</span>
                      <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded-lg text-slate-600">{report.activityId}</span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium italic">Gemeldete Entitäten unterliegen ab 3 Meldungen der automatischen Quarantäne.</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      variant="ghost" 
                      onClick={() => handleRejectReport(report.id, report.activityId)}
                      className="rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 text-slate-500 h-12 px-6"
                    >
                      Abweisen
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => handleResolveDelete(report.id, report.activityId)}
                      className="rounded-xl font-black text-xs uppercase tracking-widest gap-2 shadow-xl shadow-red-100 h-12 px-6"
                    >
                      <Trash2 className="h-4 w-4" />
                      Löschen & Schließen
                    </Button>
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
