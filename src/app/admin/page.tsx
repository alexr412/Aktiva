'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { processRefund, banUser, approveCreator, resolveModerationTask } from '@/lib/firebase/firestore';
import type { UserProfile, Refund, CreatorApplication, Report } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RotateCcw, Loader2, Ban, ShieldAlert, TrendingDown, UserCheck, Star, Activity, ShieldCheck, Check } from "lucide-react";

export default function AdminDashboardPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<UserProfile[]>([]);
  const [creatorApps, setCreatorApps] = useState<CreatorApplication[]>([]);
  const [moderationTasks, setModerationTasks] = useState<Report[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!userProfile || userProfile.role !== 'admin') {
        router.replace('/');
        return;
      }
    }

    if (!db || !userProfile || userProfile.role !== 'admin') return;

    const qRefunds = query(collection(db, 'refunds'), where('status', '==', 'pending'));
    const unsubRefunds = onSnapshot(qRefunds, (snap) => {
      setRefunds(snap.docs.map(d => ({ id: d.id, ...d.data() } as Refund)));
    });

    const qUsers = query(collection(db, 'users'), where('averageRating', '<=', 2.5));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const allLowRated = snap.docs.map(d => d.data() as UserProfile);
      const filtered = allLowRated.filter(u => (u.ratingCount || 0) >= 3 && !u.isBanned);
      setFlaggedUsers(filtered);
    });

    const qApps = query(collection(db, 'creator_applications'), where('status', '==', 'pending'));
    const unsubApps = onSnapshot(qApps, (snap) => {
      setCreatorApps(snap.docs.map(d => ({ id: d.id, ...d.data() } as CreatorApplication)));
    });

    const qMod = query(collection(db, 'reports'), where('status', '==', 'moderation_review'));
    const unsubMod = onSnapshot(qMod, (snap) => {
      setModerationTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
    });

    return () => {
      unsubRefunds();
      unsubUsers();
      unsubApps();
      unsubMod();
    };
  }, [userProfile, authLoading, router]);

  const handleProcessRefund = async (refundId: string) => {
    setActionLoading(refundId);
    try {
      await processRefund(refundId);
      toast({ title: "Erstattung abgeschlossen" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanUser = async (userId: string) => {
    if (!window.confirm("Nutzer permanent sperren?")) return;
    
    setActionLoading(userId);
    try {
      await banUser(userId);
      toast({ title: "Nutzer gesperrt" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveCreator = async (appId: string, userId: string) => {
    setActionLoading(appId);
    try {
      await approveCreator(appId, userId);
      toast({ title: "Nutzer zum Creator befördert!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveMod = async (reportId: string, activityId: string, action: 'keep' | 'blacklist') => {
    setActionLoading(reportId);
    try {
      await resolveModerationTask(reportId, activityId, action);
      toast({ title: action === 'keep' ? "Aktivität freigegeben" : "Aktivität auf Blacklist gesetzt" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || !userProfile || userProfile.role !== 'admin') {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
          Dashboard
          <Badge className="bg-red-500 text-white font-black uppercase text-[10px] tracking-widest px-3 py-1">Admin Mode</Badge>
        </h2>
        <p className="text-slate-500 font-medium">Zentrale Steuerung der Plattform-Integrität und Monetarisierung.</p>
      </header>

      {/* MODUL 18: Automated Moderation Queue */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-orange-600">
          <ShieldAlert className="h-5 w-5" />
          <h3 className="font-black text-lg uppercase tracking-tight">Moderation Queue (Balance Engine)</h3>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {moderationTasks.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 p-8 text-center rounded-3xl">
              <p className="text-slate-400 font-bold">Keine kritischen Aktivitäten zur Prüfung.</p>
            </Card>
          ) : (
            moderationTasks.map((task) => (
              <Card key={task.id} className="border-none shadow-md rounded-3xl bg-white overflow-hidden">
                <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex-1">
                    <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 mb-2">Automated Trigger</Badge>
                    <h4 className="font-black text-slate-900">Aktivitäts-ID: {task.reportedEntityId}</h4>
                    <p className="text-xs text-slate-500 mt-1">Grund: {task.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleResolveMod(task.id!, task.reportedEntityId!, 'keep')}
                      disabled={actionLoading === task.id}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black"
                    >
                      {actionLoading === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                      Keep
                    </Button>
                    <Button 
                      onClick={() => handleResolveMod(task.id!, task.reportedEntityId!, 'blacklist')}
                      disabled={actionLoading === task.id}
                      variant="destructive"
                      className="rounded-xl font-black"
                    >
                      {actionLoading === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
                      Blacklist
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Creator Applications Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <UserCheck className="h-5 w-5" />
          <h3 className="font-black text-lg uppercase tracking-tight">Creator-Bewerbungen</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {creatorApps.length === 0 ? (
            <Card className="col-span-full border-dashed border-2 border-slate-200 p-8 text-center rounded-3xl">
              <p className="text-slate-400 font-bold">Keine offenen Bewerbungen.</p>
            </Card>
          ) : (
            creatorApps.map((app) => (
              <Card key={app.id} className="border-none shadow-md rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl font-black text-slate-900">{app.userDisplayName}</CardTitle>
                      <CardDescription className="text-[10px] font-bold uppercase text-slate-400 mt-1">ID: {app.userId.slice(0,8)}...</CardDescription>
                    </div>
                    <Badge className="bg-blue-50 text-blue-600 font-black text-[10px] uppercase">Pending</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                      <div className="flex items-center justify-center gap-1 text-amber-500 mb-1">
                        <Star className="h-3 w-3 fill-amber-500" />
                        <span className="text-[10px] font-black uppercase">Rating</span>
                      </div>
                      <span className="text-xl font-black">{app.averageRating.toFixed(1)}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl text-center">
                      <div className="flex items-center justify-center gap-1 text-primary mb-1">
                        <Activity className="h-3 w-3" />
                        <span className="text-[10px] font-black uppercase">Events</span>
                      </div>
                      <span className="text-xl font-black">{app.activitiesCount}</span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleApproveCreator(app.id, app.userId)}
                    disabled={actionLoading === app.id}
                    className="w-full h-12 rounded-2xl font-black uppercase tracking-widest bg-slate-900 shadow-xl shadow-slate-200"
                  >
                    {actionLoading === app.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve Creator"}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-blue-600">
          <RotateCcw className="h-5 w-5" />
          <h3 className="font-black text-lg uppercase tracking-tight">Refund-Pipeline</h3>
        </div>
        <Card className="border-none shadow-md rounded-[2rem] overflow-hidden bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-100">
                  <TableHead className="font-black text-[10px] uppercase text-slate-400 p-6">Refund-ID</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-400">Activity-ID</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-slate-400">User-ID</TableHead>
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
                    <TableRow key={refund.id} className="border-slate-50">
                      <TableCell className="font-mono text-[10px] text-slate-500 p-6">{refund.id}</TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-500">{refund.activityId}</TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-500">{refund.userId}</TableCell>
                      <TableCell className="font-black text-slate-900">€{refund.amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right pr-6">
                        <Button 
                          onClick={() => handleProcessRefund(refund.id)}
                          disabled={actionLoading === refund.id}
                          size="sm"
                          className="rounded-xl font-black text-[10px] uppercase tracking-widest bg-slate-900"
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

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-red-600">
          <TrendingDown className="h-5 w-5" />
          <h3 className="font-black text-lg uppercase tracking-tight">Kritische Reputation</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {flaggedUsers.map((u) => (
            <Card key={u.uid} className="border-none shadow-md rounded-[2.5rem] bg-white overflow-hidden">
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
                  className="w-full h-12 rounded-2xl font-black uppercase tracking-widest gap-2"
                >
                  {actionLoading === u.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                  Nutzer sperren
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex items-start gap-4">
        <div className="bg-white p-2 rounded-xl shadow-sm shrink-0">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
        </div>
        <p className="text-xs text-amber-800/70 font-medium leading-relaxed italic">
          Admin-Compliance: Das Sperren eines Nutzers erfolgt permanent. Rückzahlungen sollten erst bestätigt werden, wenn die externe Transaktion verifiziert wurde. Creator-Bewerbungen setzen hohe Aktivität und Reputation voraus.
        </p>
      </div>
    </div>
  );
}
