'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { processRefund, banUser } from '@/lib/firebase/firestore';
import type { UserProfile, Refund } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertTriangle, Banknote, RotateCcw, Loader2, Ban, ShieldAlert, ArrowUpRight, TrendingDown } from "lucide-react";

export default function AdminDashboardPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<UserProfile[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // MODUL 19: Autorisierung & Datenabfrage
  useEffect(() => {
    if (!authLoading) {
      if (!userProfile || userProfile.role !== 'admin') {
        router.replace('/');
        return;
      }
    }

    if (!db || !userProfile || userProfile.role !== 'admin') return;

    // Sektion A: Refund-Pipeline (Real-time)
    const qRefunds = query(collection(db, 'refunds'), where('status', '==', 'pending'));
    const unsubRefunds = onSnapshot(qRefunds, (snap) => {
      setRefunds(snap.docs.map(d => ({ id: d.id, ...d.data() } as Refund)));
    });

    // Sektion B: Reputations-Kontrolle
    const qUsers = query(collection(db, 'users'), where('averageRating', '<=', 2.5));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const allLowRated = snap.docs.map(d => d.data() as UserProfile);
      // Client-Filter für statistische Relevanz
      const filtered = allLowRated.filter(u => (u.ratingCount || 0) >= 3 && !u.isBanned);
      setFlaggedUsers(filtered);
      setLoadingData(false);
    });

    return () => {
      unsubRefunds();
      unsubUsers();
    };
  }, [userProfile, authLoading, router]);

  const handleProcessRefund = async (refundId: string) => {
    setActionLoading(refundId);
    try {
      await processRefund(refundId);
      toast({ title: "Erstattung abgeschlossen", description: "Der Betrag wurde im System verbucht." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanUser = async (userId: string) => {
    if (!window.confirm("Möchtest du diesen Nutzer wirklich permanent sperren?")) return;
    
    setActionLoading(userId);
    try {
      await banUser(userId);
      toast({ title: "Nutzer gesperrt", description: "Der Account wurde permanent deaktiviert." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || (userProfile && userProfile.role !== 'admin')) {
    return null;
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="flex flex-col gap-2">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          Dashboard
          <Badge className="bg-red-500 hover:bg-red-600 text-white font-black uppercase text-[10px] tracking-widest px-3 py-1">Admin Mode</Badge>
        </h2>
        <p className="text-slate-500 font-medium">Zentrale Steuerung der Refund-Pipeline und Community-Moderation.</p>
      </header>

      {/* Sektion A: Refund-Pipeline */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-blue-600">
          <RotateCcw className="h-5 w-5" />
          <h3 className="font-black text-lg uppercase tracking-tight">Refund-Pipeline</h3>
        </div>
        <Card className="border-none shadow-md rounded-[2rem] overflow-hidden bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="font-black text-[10px] uppercase text-slate-400 p-6">Refund-ID</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-400">Activity-ID</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-400">Empfänger (UID)</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-400">Amount</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-400 text-right pr-6">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refunds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-400 font-bold italic">Keine ausstehenden Rückzahlungen.</TableCell>
                  </TableRow>
                ) : (
                  refunds.map((refund) => (
                    <TableRow key={refund.id} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-mono text-[10px] text-slate-500 p-6">{refund.id}</TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-500">{refund.activityId}</TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-500">{refund.userId}</TableCell>
                      <TableCell className="font-black text-slate-900">€{refund.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button 
                          onClick={() => handleProcessRefund(refund.id)}
                          disabled={actionLoading === refund.id}
                          size="sm"
                          className="rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-900 hover:bg-black"
                        >
                          {actionLoading === refund.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verarbeiten"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Sektion B: Reputations-Kontrolle */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-red-600">
          <TrendingDown className="h-5 w-5" />
          <h3 className="font-black text-lg uppercase tracking-tight">Kritische Reputation</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {flaggedUsers.length === 0 ? (
            <Card className="col-span-full border-dashed border-2 border-slate-200 bg-transparent p-12 text-center rounded-[2.5rem]">
              <p className="text-slate-400 font-bold">Aktuell keine verhaltensauffälligen Nutzer gemeldet.</p>
            </Card>
          ) : (
            flaggedUsers.map((u) => (
              <Card key={u.uid} className="border-none shadow-md rounded-[2.5rem] bg-white overflow-hidden group">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-slate-100">
                      <AvatarImage src={u.photoURL || undefined} />
                      <AvatarFallback className="font-black bg-red-50 text-red-500">{u.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg font-black text-slate-900 truncate">{u.displayName}</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase text-slate-400">UID: {u.uid.slice(0,8)}...</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
                    <div className="text-center flex-1 border-r border-slate-200">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Rating</p>
                      <p className="text-2xl font-black text-red-600">{u.averageRating?.toFixed(1)}</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Reviews</p>
                      <p className="text-2xl font-black text-slate-900">{u.ratingCount}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleBanUser(u.uid)}
                    disabled={actionLoading === u.uid}
                    variant="destructive" 
                    className="w-full h-12 rounded-2xl font-black uppercase tracking-widest gap-2 shadow-xl shadow-red-100"
                  >
                    {actionLoading === u.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                    Nutzer sperren
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4">
        <div className="bg-white p-2 rounded-xl shadow-sm shrink-0">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h4 className="font-black text-amber-900 text-sm mb-1 uppercase tracking-tight">Admin-Compliance</h4>
          <p className="text-xs text-amber-800/70 font-medium leading-relaxed italic">
            Hinweis: Das Sperren eines Nutzers erfolgt permanent. Der betroffene Account verliert sofort jeglichen Zugriff auf das System. Rückzahlungen sollten erst bestätigt werden, wenn die externe Transaktion (Stripe/Bank) verifiziert wurde.
          </p>
        </div>
      </div>
    </div>
  );
}
