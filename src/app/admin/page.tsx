'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { processRefund, banUser, approveCreator, resolveModerationTask } from '@/lib/firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAdminMetrics } from '@/contexts/admin-metrics-context';
import { AdminKpiCard } from '@/components/admin/AdminKpiCard';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ShieldAlert,
  UserCheck,
  Wallet,
  RotateCcw,
  Ban,
  ShieldCheck,
  Star,
  Activity,
  MessageSquare,
  Loader2,
  TrendingDown,
  Cpu,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { formatFirstName } from '@/lib/utils';

export default function AdminDashboardPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const isDev = process.env.NODE_ENV === 'development';
  const isAllowed = isDev || userProfile?.role === 'admin' || userProfile?.role === 'superadmin' || userProfile?.role === 'supporter';

  const {
    openReportsCount,
    criticalReportsCount,
    pendingPayoutsCount,
    pendingPayoutsAmount,
    pendingRefundsCount,
    pendingRefundsAmount,
    pendingCreatorAppsCount,
    reportsList,
    payoutsList,
    refundsList,
    creatorAppsList,
    loading: metricsLoading,
  } = useAdminMetrics();

  const [flaggedUsers, setFlaggedUsers] = useState<UserProfile[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('moderation');

  // Load flagged/risk users (averageRating <= 2.5 and ratingCount >= 3)
  useEffect(() => {
    if (authLoading || !isAllowed || !db) return;

    const qUsers = query(collection(db, 'users'), where('averageRating', '<=', 2.5));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      const allLowRated = snap.docs.map(d => d.data() as UserProfile);
      const filtered = allLowRated.filter(u => (u.ratingCount || 0) >= 3 && !u.isBanned);
      setFlaggedUsers(filtered);
    }, (err) => {
      console.warn('Risk users snapshot error:', err);
    });

    return () => unsubUsers();
  }, [authLoading, isAllowed]);

  const handleBanUser = async (userId: string) => {
    if (!window.confirm("Nutzer permanent sperren? Diese Aktion kann nicht rückgängig gemacht werden.")) return;
    
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
    if (!window.confirm("Möchtest du diese Creator-Bewerbung genehmigen und den Nutzer zum Creator befördern?")) return;
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
    const confirmationText = action === 'keep' 
      ? "Möchtest du diese Aktivität freigeben und als geprüft markieren?" 
      : "Möchtest du diese Aktivität auf die Blacklist setzen? Der Status wird permanent geändert.";
    if (!window.confirm(confirmationText)) return;
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

  if (authLoading || !userProfile || !isAllowed) {
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-purple-600 text-white font-black uppercase text-[9px] tracking-widest px-2.5 py-0.5">
              Command Dashboard
            </Badge>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Activa Control Center
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Plattform-Übersicht & Triage
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium mt-0.5">
            Systemzustand erkennen, offene Fälle priorisieren und in Fachebenen navigieren.
          </p>
        </div>

        {/* Compact System Health Shortcut */}
        <div className="flex items-center gap-3 bg-slate-50 dark:bg-neutral-950 p-3 rounded-2xl border border-slate-200/60 dark:border-neutral-800 shrink-0">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Systemstatus
            </span>
            <span className="text-xs font-extrabold text-slate-800 dark:text-neutral-200">
              Keine bekannten Störungen
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push('/admin/system')}
            className="h-8 px-2.5 rounded-xl text-xs font-bold ml-1 border-slate-200 dark:border-neutral-800"
          >
            System <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* EXECUTIVE KPI CARDS GRID (Top 4) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminKpiCard
          title="Moderation"
          value={openReportsCount}
          subtitle={criticalReportsCount > 0 ? `${criticalReportsCount} kritische Fälle` : 'Keine kritischen Meldungen'}
          icon={ShieldAlert}
          href="/admin/reports"
          badgeText={openReportsCount > 0 ? `${openReportsCount} offen` : 'Sauber'}
          badgeVariant={openReportsCount > 0 ? 'destructive' : 'outline'}
          accentColor="red"
        />

        <AdminKpiCard
          title="Creator Bewerbungen"
          value={pendingCreatorAppsCount}
          subtitle={pendingCreatorAppsCount > 0 ? 'Offene Bewerbungen prüfen' : 'Keine ausstehenden Bewerbungen'}
          icon={UserCheck}
          onClick={() => setActiveTab('creator')}
          badgeText={pendingCreatorAppsCount > 0 ? 'Ausstehend' : 'Aktuell'}
          badgeVariant={pendingCreatorAppsCount > 0 ? 'secondary' : 'outline'}
          accentColor="purple"
        />

        <AdminKpiCard
          title="Auszahlungen"
          value={`€${pendingPayoutsAmount.toFixed(2)}`}
          subtitle={`${pendingPayoutsCount} Auszahlungsanfragen`}
          icon={Wallet}
          href="/admin/payouts"
          badgeText={pendingPayoutsCount > 0 ? `${pendingPayoutsCount} offen` : 'Ausgeglichen'}
          badgeVariant={pendingPayoutsCount > 0 ? 'default' : 'outline'}
          accentColor="blue"
        />

        <AdminKpiCard
          title="Rückerstattungen"
          value={`€${pendingRefundsAmount.toFixed(2)}`}
          subtitle={`${pendingRefundsCount} Refund-Anträge`}
          icon={RotateCcw}
          href="/admin/refunds"
          badgeText={pendingRefundsCount > 0 ? `${pendingRefundsCount} offen` : 'Ausgeglichen'}
          badgeVariant={pendingRefundsCount > 0 ? 'secondary' : 'outline'}
          accentColor="amber"
        />
      </section>

      {/* ACTION HUB (Tab-based Triage Center) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Action Hub & Triage
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-400">
            Fokussierte Bearbeitung ausstehender Vorgänge
          </span>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-1.5 rounded-2xl h-auto flex flex-wrap gap-1">
            <TabsTrigger
              value="moderation"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Moderation</span>
              {openReportsCount > 0 && (
                <Badge className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full border-none">
                  {openReportsCount}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="creator"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Creator Bewerbungen</span>
              {pendingCreatorAppsCount > 0 && (
                <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded-full border-none">
                  {pendingCreatorAppsCount}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="finanzen"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Finanzen Highlights</span>
              {(pendingPayoutsCount + pendingRefundsCount) > 0 && (
                <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0.2 rounded-full border-none">
                  {pendingPayoutsCount + pendingRefundsCount}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="risiken"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-purple-600 data-[state=active]:text-white flex items-center gap-2"
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Risk Signals</span>
              {flaggedUsers.length > 0 && (
                <Badge className="bg-orange-500 text-white text-[9px] px-1.5 py-0.2 rounded-full border-none">
                  {flaggedUsers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MODERATION */}
          <TabsContent value="moderation" className="space-y-4">
            {reportsList.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 dark:border-neutral-800 p-12 text-center rounded-3xl bg-transparent">
                <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-40" />
                <h3 className="text-base font-bold text-slate-800 dark:text-neutral-200">
                  Warteschlange ist leer
                </h3>
                <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">
                  Keine offenen Moderationsfälle vorhanden.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {reportsList.map((task) => (
                  <Card key={task.id} className="border-none shadow-md rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
                    <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-950/30">
                            Automated Trigger
                          </Badge>
                          <span className="text-xs font-mono text-slate-400">ID: {task.id}</span>
                        </div>
                        <h4 className="font-black text-base text-slate-900 dark:text-neutral-100">
                          Grund: {task.reason || 'Sicherheits-Meldung'}
                        </h4>
                        <p className="text-xs font-mono text-slate-500 dark:text-neutral-400">
                          Ziel-ID: {task.reportedEntityId || task.activityId || 'Unbekannt'} • Reporter: {task.reporterId}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 shrink-0">
                        <Button 
                          onClick={() => handleResolveMod(task.id!, task.reportedEntityId! || task.activityId!, 'keep')}
                          disabled={actionLoading === task.id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs h-10 px-4"
                        >
                          {actionLoading === task.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
                          Keep (Freigeben)
                        </Button>
                        <Button 
                          onClick={() => handleResolveMod(task.id!, task.reportedEntityId! || task.activityId!, 'blacklist')}
                          disabled={actionLoading === task.id}
                          variant="destructive"
                          className="rounded-xl font-bold text-xs h-10 px-4"
                        >
                          {actionLoading === task.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1.5" />}
                          Blacklist
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => router.push('/admin/reports')}
                className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-xl"
              >
                Vollständige Moderationsverwaltung öffnen <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: CREATOR BEWERBUNGEN */}
          <TabsContent value="creator" className="space-y-4">
            {creatorAppsList.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 dark:border-neutral-800 p-12 text-center rounded-3xl bg-transparent">
                <UserCheck className="w-12 h-12 text-blue-500 mx-auto mb-3 opacity-40" />
                <h3 className="text-base font-bold text-slate-800 dark:text-neutral-200">
                  Keine Creator-Bewerbungen
                </h3>
                <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">
                  Alle Bewerbungen wurden bearbeitet.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {creatorAppsList.map((app) => (
                  <Card key={app.id} className="border-none shadow-md rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg font-black text-slate-900 dark:text-neutral-100">
                            {formatFirstName(app.userDisplayName, "User")}
                          </CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500 mt-1 font-mono">
                            ID: {app.userId.slice(0,10)}...
                          </CardDescription>
                        </div>
                        <Badge className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase">
                          Pending
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50 dark:bg-neutral-800/50 p-2.5 rounded-2xl text-center">
                          <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
                            <Star className="h-3 w-3 fill-amber-500" />
                            <span className="text-[9px] font-black uppercase">Rating</span>
                          </div>
                          <span className="text-base font-black text-foreground">
                            {app.averageRating ? app.averageRating.toFixed(1) : '5.0'}
                          </span>
                        </div>

                        <div className="bg-slate-50 dark:bg-neutral-800/50 p-2.5 rounded-2xl text-center">
                          <div className="flex items-center justify-center gap-1 text-purple-600 mb-0.5">
                            <Activity className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase">Events</span>
                          </div>
                          <span className="text-base font-black text-foreground">
                            {app.activitiesCount ?? 0}
                          </span>
                        </div>

                        <div className="bg-slate-50 dark:bg-neutral-800/50 p-2.5 rounded-2xl text-center">
                          <div className="flex items-center justify-center gap-1 text-blue-500 mb-0.5">
                            <MessageSquare className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase">Reviews</span>
                          </div>
                          <span className="text-base font-black text-foreground">
                            {app.ratingCount ?? 0}
                          </span>
                        </div>
                      </div>

                      <Button 
                        onClick={() => handleApproveCreator(app.id, app.userId)}
                        disabled={actionLoading === app.id}
                        className="w-full h-11 rounded-2xl font-black uppercase tracking-wider text-xs bg-slate-900 dark:bg-neutral-800 text-white"
                      >
                        {actionLoading === app.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Approve Creator
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: FINANZEN HIGHLIGHTS */}
          <TabsContent value="finanzen" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payouts Highlights */}
              <Card className="border-none shadow-md rounded-3xl bg-white dark:bg-neutral-900">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-600">
                      <Wallet className="w-5 h-5" />
                      <CardTitle className="text-base font-black">Auszahlungen</CardTitle>
                    </div>
                    <Badge variant="outline" className="font-bold text-xs">
                      {pendingPayoutsCount} Anfragen
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Volumen: €{pendingPayoutsAmount.toFixed(2)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  {payoutsList.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium italic py-4 text-center">
                      Keine ausstehenden Auszahlungen.
                    </p>
                  ) : (
                    payoutsList.slice(0, 3).map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 text-xs">
                        <div>
                          <p className="font-black text-slate-900 dark:text-white">€{Number(p.amount).toFixed(2)}</p>
                          <p className="font-mono text-[10px] text-slate-400">Host: {p.userId.slice(0, 8)}...</p>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-[9px] uppercase font-bold">
                          Pending
                        </Badge>
                      </div>
                    ))
                  )}

                  <Button
                    variant="outline"
                    onClick={() => router.push('/admin/payouts')}
                    className="w-full rounded-2xl h-10 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-950/40"
                  >
                    Auszahlungen verwalten <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </CardContent>
              </Card>

              {/* Refunds Highlights */}
              <Card className="border-none shadow-md rounded-3xl bg-white dark:bg-neutral-900">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-600">
                      <RotateCcw className="w-5 h-5" />
                      <CardTitle className="text-base font-black">Rückerstattungen</CardTitle>
                    </div>
                    <Badge variant="outline" className="font-bold text-xs">
                      {pendingRefundsCount} Anträge
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    Volumen: €{pendingRefundsAmount.toFixed(2)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  {refundsList.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium italic py-4 text-center">
                      Keine ausstehenden Refunds.
                    </p>
                  ) : (
                    refundsList.slice(0, 3).map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 text-xs">
                        <div>
                          <p className="font-black text-slate-900 dark:text-white">€{Number(r.amount).toFixed(2)}</p>
                          <p className="font-mono text-[10px] text-slate-400">User: {r.userId.slice(0, 8)}...</p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] uppercase font-bold">
                          Pending
                        </Badge>
                      </div>
                    ))
                  )}

                  <Button
                    variant="outline"
                    onClick={() => router.push('/admin/refunds')}
                    className="w-full rounded-2xl h-10 text-xs font-bold text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900 dark:hover:bg-amber-950/40"
                  >
                    Rückerstattungen verwalten <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 4: RISIKEN (Risk Signals) */}
          <TabsContent value="risiken" className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-4 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                <strong>Risk Signals Overview:</strong> Niedrige Reputation allein rechtfertigt keinen automatischen Ban. Dieser Bereich bündelt Risikoindikatoren aus abgegebenen Ratings und Nutzermeldungen für eine fundierte manuelle Überprüfung.
              </p>
            </div>

            {flaggedUsers.length === 0 ? (
              <Card className="border-dashed border-2 border-slate-200 dark:border-neutral-800 p-12 text-center rounded-3xl bg-transparent">
                <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-40" />
                <h3 className="text-base font-bold text-slate-800 dark:text-neutral-200">
                  Keine auffälligen Nutzer
                </h3>
                <p className="text-xs text-slate-400 dark:text-neutral-500 mt-1">
                  Derzeit liegen keine kritischen Reputation-Flags vor.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {flaggedUsers.map((u) => (
                  <Card key={u.uid} className="border-none shadow-md rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 border-2 border-slate-100 dark:border-neutral-800">
                          <AvatarImage src={u.photoURL || undefined} />
                          <AvatarFallback className="font-black bg-red-50 dark:bg-red-950/30 text-red-500">
                            {u.displayName?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base font-black text-slate-900 dark:text-neutral-100 truncate">
                            {formatFirstName(u.displayName, "User")}
                          </CardTitle>
                          <CardDescription className="text-[10px] font-bold uppercase text-slate-400 dark:text-neutral-500 font-mono">
                            UID: {u.uid.slice(0,10)}...
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-neutral-800/50 p-3 rounded-2xl">
                        <div className="text-center flex-1 border-r border-slate-200 dark:border-neutral-700">
                          <p className="text-[9px] font-black uppercase text-slate-400 dark:text-neutral-500 mb-0.5">
                            Durchschnitts-Rating
                          </p>
                          <p className="text-xl font-black text-red-600">
                            {u.averageRating?.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-center flex-1">
                          <p className="text-[9px] font-black uppercase text-slate-400 dark:text-neutral-500 mb-0.5">
                            Bewertungen
                          </p>
                          <p className="text-xl font-black text-slate-900 dark:text-neutral-100">
                            {u.ratingCount}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => router.push(`/admin/users`)}
                          variant="outline"
                          className="flex-1 h-10 rounded-xl font-bold text-xs"
                        >
                          User Details
                        </Button>
                        <Button 
                          onClick={() => handleBanUser(u.uid)}
                          disabled={actionLoading === u.uid}
                          variant="destructive" 
                          className="flex-1 h-10 rounded-xl font-bold text-xs gap-1.5"
                        >
                          {actionLoading === u.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                          Nutzer sperren
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

    </div>
  );
}
