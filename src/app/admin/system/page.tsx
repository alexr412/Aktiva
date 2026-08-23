'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { cleanupGhostUsers, triggerCleanupEmptyChats } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Cpu,
  RotateCcw,
  Loader2,
  Database,
  ShieldCheck,
  FileCode,
  HardDrive,
  Info,
  Server,
} from 'lucide-react';

export default function AdminSystemPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCleanupChatsOpen, setIsCleanupChatsOpen] = useState(false);

  const isDev = process.env.NODE_ENV === 'development';
  const isAllowed = isDev || userProfile?.role === 'admin' || userProfile?.role === 'superadmin' || userProfile?.role === 'supporter';

  const handleCleanupGhosts = async () => {
    if (!window.confirm("Bist du sicher, dass du alle verwaisten Einträge (Geister-User) in der Datenbank bereinigen möchtest? Dies scannt und aktualisiert mehrere Collections.")) return;
    setActionLoading('cleanup-ghosts');
    try {
      const count = await cleanupGhostUsers();
      toast({ title: "Datenbank bereinigt", description: `${count} verwaiste Einträge korrigiert.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanupChats = async () => {
    setIsCleanupChatsOpen(false);
    setActionLoading('cleanup-chats');
    try {
      const result = await triggerCleanupEmptyChats();
      toast({
        title: "Bereinigung abgeschlossen",
        description: `Chats gelöscht: ${result.chatsDeleted}, Nachrichten: ${result.messagesDeleted}, Aktivitäten: ${result.activitiesDeleted}`,
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Fehler bei der Bereinigung", description: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || !userProfile || !isAllowed) {
    return null;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-slate-200/80 dark:border-neutral-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge className="bg-emerald-600 text-white font-black uppercase text-[9px] tracking-widest px-2.5 py-0.5">
              System & Maintenance
            </Badge>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Technische Steuerung
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-7 h-7 text-emerald-600" />
            System Control & Integrity
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 font-medium mt-0.5">
            Zentrale Ausführung technischer Datenbank-Bereinigungen, Integritätsprüfungen und Systemwerkzeuge.
          </p>
        </div>
      </div>

      {/* 1. MAINTENANCE SECTION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Database className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-black tracking-tight">Datenbank-Wartung & Cleanups</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ghost User Cleanup */}
          <Card className="border-none shadow-md rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black">Geister-User Bereinigung</CardTitle>
                  <CardDescription className="text-xs">
                    Entfernt gelöschte Nutzer aus Teilnehmerlisten und storniert verwaiste Events.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleCleanupGhosts} 
                disabled={actionLoading === 'cleanup-ghosts'}
                className="w-full h-11 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-black text-white dark:bg-neutral-800 dark:hover:bg-neutral-700"
              >
                {actionLoading === 'cleanup-ghosts' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                Geister-User Scan & Bereinigung Starten
              </Button>
            </CardContent>
          </Card>

          {/* Empty Chats Cleanup */}
          <Card className="border-none shadow-md rounded-3xl bg-white dark:bg-neutral-900 overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 shrink-0">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-black">Leere Chats Bereinigung</CardTitle>
                  <CardDescription className="text-xs">
                    Löscht verwaiste Chats ohne Teilnehmer (`participantIds == []`) via Cloud Function.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AlertDialog open={isCleanupChatsOpen} onOpenChange={setIsCleanupChatsOpen}>
                <AlertDialogTrigger asChild>
                  <Button 
                    disabled={actionLoading === 'cleanup-chats'}
                    className="w-full h-11 rounded-2xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {actionLoading === 'cleanup-chats' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <HardDrive className="h-4 w-4 mr-2" />}
                    Leere Chats Bereinigung Starten
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl border-none shadow-2xl dark:bg-neutral-900">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leere Chats bereinigen?</AlertDialogTitle>
                    <AlertDialogDescription className="text-sm font-medium dark:text-neutral-400">
                      Diese Aktion löscht permanent alle Chats ohne Teilnehmer, deren Nachrichten sowie verknüpfte, verwaiste Aktivitäten via `cleanupEmptyChats` Cloud Function.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                    <AlertDialogCancel className="rounded-xl font-bold h-11 border-none bg-slate-100 dark:bg-neutral-800 dark:text-neutral-300">
                      Abbrechen
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleCleanupChats}
                      className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black h-11 border-none shadow-lg shadow-red-200"
                    >
                      Jetzt ausführen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 2. DATA INTEGRITY SECTION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-black tracking-tight">Data Integrity & Service Status</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-neutral-900">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Firestore DB</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">Connected & Active</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-neutral-900">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Cloud Functions</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">us-central1 Ready</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-neutral-900">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400">Environment</p>
                <p className="text-sm font-black text-slate-900 dark:text-white">{isDev ? 'Development' : 'Production'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3. AUDIT LOGGING NOTICE SECTION */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 dark:text-white">
          <Info className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-black tracking-tight">Audit Logging Status</h2>
        </div>

        <Card className="border-none shadow-md rounded-3xl bg-white dark:bg-neutral-900 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 shrink-0">
              <Info className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Persistentes Audit Logging (Zukünftige Erweiterung)
              </h3>
              <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium leading-relaxed">
                Derzeit werden administrative Aktionen (Bans, Moderationsentscheidungen, Creator Approvals, Refunds) direkt in den betroffenen Dokumenten und Cloud Function Invokationen protokolliert. Eine eigenständige, dedizierte `audit_logs` Collection ist im aktuellen Datenmodell noch nicht eingerichtet.
              </p>
              <Badge variant="outline" className="text-[10px] font-mono text-blue-600 border-blue-200">
                Architektur-Hinweis: Um Vorab-Strukturbeschlüsse nicht zu verletzen, wird ein zentrales Audit-Logging als empfohlenes Backend-Modul in Phase 2 eingeplant.
              </Badge>
            </div>
          </div>
        </Card>
      </section>

    </div>
  );
}
