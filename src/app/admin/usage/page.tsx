'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Zap,
  Search,
  RefreshCw,
  Download,
  MoreVertical,
  Crown,
  Shield,
  Coins,
  Cpu,
  DollarSign,
  TrendingUp,
  UserCheck,
  Users,
  Copy,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Sparkles,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { AdminSummaryBar } from '@/components/admin/AdminSummaryBar';

export interface UserUsageItem {
  id: string;
  uid: string;
  yearMonth?: string;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  photoURL?: string | null;
  role?: string;
  isPremium?: boolean;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
  estimatedCostUsd: number;
  lastUsedAt?: number | string | null;
  feature?: string;
}

export interface UsageSummary {
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalRequests: number;
  totalCostUsd: number;
  activeUsersCount: number;
}

function AdminUsageContent() {
  const { userProfile: currentUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initial Filter State from URL
  const initialSearch = searchParams.get('search') || '';
  const initialRole = searchParams.get('role') || 'all';
  const initialSort = searchParams.get('sort') || 'totalTokens';
  const initialTimeframe = searchParams.get('timeframe') || 'this_month';

  // Data & Loading State
  const [items, setItems] = useState<UserUsageItem[]>([]);
  const [summary, setSummary] = useState<UsageSummary>({
    totalTokens: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalRequests: 0,
    totalCostUsd: 0,
    activeUsersCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [selectedRole, setSelectedRole] = useState<string>(initialRole);
  const [selectedSort, setSelectedSort] = useState<string>(initialSort);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(initialTimeframe);

  // Detail Modal & Copy State
  const [selectedItem, setSelectedItem] = useState<UserUsageItem | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Debounce Search Input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sync Filters to URL Query String
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedRole !== 'all') params.set('role', selectedRole);
    if (selectedSort !== 'totalTokens') params.set('sort', selectedSort);
    if (selectedTimeframe !== 'this_month') params.set('timeframe', selectedTimeframe);

    const queryString = params.toString();
    const newUrl = queryString ? `/admin/usage?${queryString}` : '/admin/usage';
    router.replace(newUrl, { scroll: false });
  }, [debouncedSearch, selectedRole, selectedSort, selectedTimeframe, router]);

  // Fetch Usage Stats
  const fetchUsageData = useCallback(async (isRefresh = false) => {
    if (!functions) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const getUsageFn = httpsCallable(functions, 'adminListUsageStats');
      const payload: any = {
        search: debouncedSearch,
        role: selectedRole,
        sortBy: selectedSort,
        timeframe: selectedTimeframe,
        limit: 100,
      };

      const res: any = await getUsageFn(payload);
      if (res.data) {
        setItems(res.data.items || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err: any) {
      console.error('[ADMIN USAGE] Fetch error:', err);
      setError(err.message || 'Fehler beim Laden der Verbrauchsdaten.');
      toast({
        title: 'Fehler beim Laden',
        description: err.message || 'Konnte Verbrauchsdaten nicht abrufen.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, selectedRole, selectedSort, selectedTimeframe]);

  useEffect(() => {
    fetchUsageData();
  }, [fetchUsageData]);

  // Copy UID Helper
  const handleCopyUid = (uid: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    toast({ title: 'Kopiert', description: `UID ${uid} in Zwischenablage kopiert.` });
    setTimeout(() => setCopiedUid(null), 2000);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!items.length) {
      toast({ title: 'Keine Daten', description: 'Keine Einträge zum Exportieren vorhanden.' });
      return;
    }

    const headers = ['UID', 'Name', 'Email', 'Role', 'Premium', 'Prompt Tokens', 'Completion Tokens', 'Total Tokens', 'Requests', 'Cost USD', 'Last Used'];
    const csvRows = [
      headers.join(','),
      ...items.map(i => [
        `"${i.uid}"`,
        `"${(i.displayName || '').replace(/"/g, '""')}"`,
        `"${(i.email || '').replace(/"/g, '""')}"`,
        `"${i.role || 'user'}"`,
        i.isPremium ? 'Ja' : 'Nein',
        i.promptTokens || 0,
        i.completionTokens || 0,
        i.totalTokens || 0,
        i.requestCount || 0,
        (i.estimatedCostUsd || 0).toFixed(4),
        `"${i.lastUsedAt ? new Date(i.lastUsedAt).toISOString() : ''}"`
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activa_token_usage_${selectedTimeframe}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Exportiert', description: 'Verbrauchsbericht wurde heruntergeladen.' });
  };

  // Format Helper
  const formatTokens = (val: number) => val.toLocaleString('de-DE');
  const formatCost = (val: number) => `$${val.toFixed(4)}`;
  const formatTime = (ts: any) => {
    if (!ts) return 'Unbekannt';
    const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    if (isNaN(date.getTime())) return 'Unbekannt';
    return date.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-neutral-950 p-4 sm:p-6 md:p-8 space-y-6">
      
      {/* Admin Summary Top Bar */}
      <AdminSummaryBar
        metrics={[
          { label: 'Gesamt Tokens', value: formatTokens(summary.totalTokens), icon: Coins, colorClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
          { label: 'API Kosten ($)', value: formatCost(summary.totalCostUsd), icon: DollarSign, colorClass: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'AI Requests', value: formatTokens(summary.totalRequests), icon: Cpu, colorClass: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
          { label: 'Aktive KI-Nutzer', value: summary.activeUsersCount, icon: Users, colorClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
        ]}
      />

      {/* Header Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-600 dark:text-amber-400">
            <Zap className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Token- & Verbrauchsübersicht
              </h1>
              <Badge className="bg-amber-500 text-white font-bold text-[10px] uppercase">
                AI Analytics
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
              Echtzeit-Tracking von KI-Tokens, API-Requests und geschätzten Kosten pro Nutzer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchUsageData(true)}
            disabled={refreshing || loading}
            className="rounded-xl border-slate-200 dark:border-neutral-800 font-bold text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Aktualisieren</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleExportCSV}
            className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Export</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Tokens */}
        <Card className="rounded-2xl border-slate-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gesamt-Tokens</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatTokens(summary.totalTokens)}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5 flex items-center gap-1">
                <span className="text-blue-500 font-bold">{formatTokens(summary.totalPromptTokens)}</span> In /{' '}
                <span className="text-purple-500 font-bold">{formatTokens(summary.totalCompletionTokens)}</span> Out
              </p>
            </div>
            <div className="bg-blue-500/10 p-3 rounded-2xl text-blue-600 dark:text-blue-400">
              <Coins className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Estimated Costs */}
        <Card className="rounded-2xl border-slate-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Geschätzte API-Kosten</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCost(summary.totalCostUsd)}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                Geschätzt auf Basis aktueller LLM-Tarife
              </p>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Total Requests */}
        <Card className="rounded-2xl border-slate-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gesamt AI-Requests</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatTokens(summary.totalRequests)}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                API-Aufrufe (Intent & Generierung)
              </p>
            </div>
            <div className="bg-purple-500/10 p-3 rounded-2xl text-purple-600 dark:text-purple-400">
              <Cpu className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Active AI Users */}
        <Card className="rounded-2xl border-slate-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aktive KI-Nutzer</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {summary.activeUsersCount}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                Nutzer mit verzeichnetem Verbrauch
              </p>
            </div>
            <div className="bg-amber-500/10 p-3 rounded-2xl text-amber-600 dark:text-amber-400">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Nach Name, E-Mail oder UID suchen..."
            className="pl-10 rounded-xl bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-xs font-medium"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Timeframe Filter */}
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-[140px] rounded-xl text-xs font-bold bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700">
              <SelectValue placeholder="Zeitraum" />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="this_month">Dieser Monat</SelectItem>
              <SelectItem value="last_month">Letzter Monat</SelectItem>
              <SelectItem value="all_time">Gesamter Zeitraum</SelectItem>
            </SelectContent>
          </Select>

          {/* Role / Plan Filter */}
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger className="w-[140px] rounded-xl text-xs font-bold bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700">
              <SelectValue placeholder="Tarif / Rolle" />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="all">Alle Nutzer</SelectItem>
              <SelectItem value="premium">Nur Premium</SelectItem>
              <SelectItem value="free">Nur Free</SelectItem>
              <SelectItem value="admin">Nur Admins</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Filter */}
          <Select value={selectedSort} onValueChange={setSelectedSort}>
            <SelectTrigger className="w-[170px] rounded-xl text-xs font-bold bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700">
              <SelectValue placeholder="Sortieren nach" />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="totalTokens">Höchster Tokenverbrauch</SelectItem>
              <SelectItem value="requestCount">Meiste Requests</SelectItem>
              <SelectItem value="estimatedCostUsd">Höchste Kosten</SelectItem>
              <SelectItem value="recent">Zuletzt aktiv</SelectItem>
            </SelectContent>
          </Select>

        </div>
      </div>

      {/* Main Usage Table */}
      <Card className="rounded-2xl border-slate-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-xs font-bold text-slate-500">Verbrauchsdaten werden geladen...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-500 text-xs font-bold">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
              <Zap className="h-10 w-10 text-slate-300 dark:text-neutral-700" />
              <p className="text-sm font-bold text-slate-700 dark:text-neutral-300">Keine Verbrauchsdaten gefunden</p>
              <p className="text-xs text-slate-400">Passe deine Filter an oder durchsuche andere Begriffe.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Nutzer</th>
                    <th className="py-3.5 px-4">Tarif / Rolle</th>
                    <th className="py-3.5 px-4 text-right">Tokens Total</th>
                    <th className="py-3.5 px-4 text-right">Prompt / Completion</th>
                    <th className="py-3.5 px-4 text-right">Requests</th>
                    <th className="py-3.5 px-4 text-right">Kosten ($)</th>
                    <th className="py-3.5 px-4">Zuletzt Aktiv</th>
                    <th className="py-3.5 px-4 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 font-medium">
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => {
                        setSelectedItem(item);
                        setDetailOpen(true);
                      }}
                      className="hover:bg-slate-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
                    >
                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-slate-200 dark:border-neutral-700">
                            <AvatarImage src={item.photoURL || undefined} />
                            <AvatarFallback className="bg-amber-500 text-white font-bold text-xs">
                              {(item.displayName || item.username || 'U')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-slate-900 dark:text-white truncate">
                                {item.displayName || 'Unbenannter User'}
                              </span>
                              {item.username && (
                                <span className="text-[11px] text-slate-400 font-normal">
                                  @{item.username.replace(/^@/, '')}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate flex items-center gap-1">
                              <span>UID: {item.uid.slice(0, 10)}...</span>
                              <button
                                onClick={(e) => handleCopyUid(item.uid, e)}
                                className="hover:text-amber-500 transition-colors p-0.5"
                                title="UID kopieren"
                              >
                                {copiedUid === item.uid ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Premium Badges */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {item.role === 'admin' || item.role === 'superadmin' ? (
                            <Badge className="bg-purple-600 text-white font-bold text-[9px] px-2 py-0.5">
                              <Shield className="w-2.5 h-2.5 mr-1 inline" /> ADMIN
                            </Badge>
                          ) : item.isPremium ? (
                            <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-[9px] px-2 py-0.5">
                              <Crown className="w-2.5 h-2.5 mr-1 inline" /> PREMIUM
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 font-semibold text-[9px] px-2 py-0.5 border-slate-200 dark:border-neutral-700">
                              FREE
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Tokens Total */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                          {formatTokens(item.totalTokens)}
                        </span>
                      </td>

                      {/* Prompt / Completion breakdown */}
                      <td className="py-3 px-4 text-right text-[11px] font-mono">
                        <span className="text-blue-600 dark:text-blue-400 font-bold">{formatTokens(item.promptTokens)}</span> /{' '}
                        <span className="text-purple-600 dark:text-purple-400 font-bold">{formatTokens(item.completionTokens)}</span>
                      </td>

                      {/* Requests */}
                      <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-neutral-300">
                        {item.requestCount} Calls
                      </td>

                      {/* Estimated Cost */}
                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCost(item.estimatedCostUsd)}
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {formatTime(item.lastUsedAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                              <MoreVertical className="w-4 h-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl text-xs font-bold">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedItem(item);
                                setDetailOpen(true);
                              }}
                            >
                              <Zap className="w-3.5 h-3.5 mr-2 text-amber-500" />
                              Verbrauchs-Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/admin/users?search=${item.uid}`)}
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-2 text-purple-500" />
                              In Nutzerverwaltung öffnen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyUid(item.uid)}>
                              <Copy className="w-3.5 h-3.5 mr-2 text-slate-400" />
                              UID kopieren
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Usage Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="rounded-2xl max-w-lg bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
              <Zap className="w-5 h-5 text-amber-500" />
              Verbrauchs-Analyse
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Detaillierte KI-Nutzungsstatistiken für diesen Nutzer
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 pt-2">
              
              {/* User Identity Header */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-neutral-800/60 rounded-xl border border-slate-100 dark:border-neutral-800">
                <Avatar className="h-12 w-12 border border-slate-200 dark:border-neutral-700">
                  <AvatarImage src={selectedItem.photoURL || undefined} />
                  <AvatarFallback className="bg-amber-500 text-white font-bold text-sm">
                    {(selectedItem.displayName || 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {selectedItem.displayName || 'Activa User'}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    {selectedItem.email || `UID: ${selectedItem.uid}`}
                  </p>
                </div>
                {selectedItem.isPremium && (
                  <Badge className="bg-amber-500 text-white font-bold text-[10px]">
                    PREMIUM
                  </Badge>
                )}
              </div>

              {/* Token Breakdown Bar */}
              <div className="space-y-2 p-4 bg-slate-50 dark:bg-neutral-800/40 rounded-xl border border-slate-100 dark:border-neutral-800">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-neutral-400">Token-Zusammensetzung</span>
                  <span className="text-slate-900 dark:text-white font-mono">{formatTokens(selectedItem.totalTokens)} Tokens</span>
                </div>
                
                {/* Visual Progress Bar */}
                <div className="h-3 w-full bg-slate-200 dark:bg-neutral-700 rounded-full overflow-hidden flex">
                  <div
                    style={{
                      width: `${selectedItem.totalTokens ? (selectedItem.promptTokens / selectedItem.totalTokens) * 100 : 50}%`
                    }}
                    className="bg-blue-500 h-full"
                    title={`Prompt Tokens: ${formatTokens(selectedItem.promptTokens)}`}
                  />
                  <div
                    style={{
                      width: `${selectedItem.totalTokens ? (selectedItem.completionTokens / selectedItem.totalTokens) * 100 : 50}%`
                    }}
                    className="bg-purple-500 h-full"
                    title={`Completion Tokens: ${formatTokens(selectedItem.completionTokens)}`}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 pt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    Input Tokens: <strong className="text-slate-800 dark:text-neutral-200">{formatTokens(selectedItem.promptTokens)}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                    Output Tokens: <strong className="text-slate-800 dark:text-neutral-200">{formatTokens(selectedItem.completionTokens)}</strong>
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-neutral-800/40 rounded-xl border border-slate-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Requests</p>
                  <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{selectedItem.requestCount} Aufrufe</p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-neutral-800/40 rounded-xl border border-slate-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Geschätzte Kosten</p>
                  <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCost(selectedItem.estimatedCostUsd)}</p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  Schließen
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setDetailOpen(false);
                    router.push(`/admin/users?search=${selectedItem.uid}`);
                  }}
                  className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Nutzer verwalten</span>
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function AdminUsagePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-neutral-950 text-slate-500 font-bold text-xs gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
        <span>Lade Token-Verbrauchsübersicht...</span>
      </div>
    }>
      <AdminUsageContent />
    </Suspense>
  );
}
