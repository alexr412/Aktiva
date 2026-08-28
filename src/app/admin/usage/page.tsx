'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import { Card, CardContent } from '@/components/ui/card';
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
  Users,
  Copy,
  CheckCircle2,
  Loader2,
  ExternalLink,
  MapPin,
  Database,
  AlertTriangle,
  Activity,
  Layers,
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
  geoapifyCredits?: number;
  geoapifyRequests?: number;
  cacheHits?: number;
  cacheMisses?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  requestCount?: number;
  errorCount?: number;
  lastUsedAt?: number | string | null;
  feature?: string;
}

export interface UsageSummary {
  berlinDayKey?: string;
  creditsToday?: number;
  dailyCreditLimit?: number;
  dailyLimitPercentage?: number;
  requestsToday?: number;
  cacheHitsToday?: number;
  cacheMissesToday?: number;
  cacheAvoidanceRate?: number;
  errorRate?: number;
  totalGeoapifyCredits?: number;
  totalTokens?: number;
  totalRequests?: number;
  activeUsersCount?: number;
  services?: Record<string, { requests: number; credits: number }>;
}

function AdminUsageContent() {
  const { userProfile: currentUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters
  const initialSearch = searchParams.get('search') || '';
  const initialRole = searchParams.get('role') || 'all';
  const initialSort = searchParams.get('sort') || 'geoapifyCredits';
  const initialTimeframe = searchParams.get('timeframe') || 'this_month';

  const [items, setItems] = useState<UserUsageItem[]>([]);
  const [summary, setSummary] = useState<UsageSummary>({
    creditsToday: 0,
    dailyCreditLimit: 3000,
    dailyLimitPercentage: 0,
    requestsToday: 0,
    cacheAvoidanceRate: 0,
    errorRate: 0,
    totalGeoapifyCredits: 0,
    totalTokens: 0,
    totalRequests: 0,
    activeUsersCount: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [selectedRole, setSelectedRole] = useState<string>(initialRole);
  const [selectedSort, setSelectedSort] = useState<string>(initialSort);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(initialTimeframe);

  const [selectedItem, setSelectedItem] = useState<UserUsageItem | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedRole !== 'all') params.set('role', selectedRole);
    if (selectedSort !== 'geoapifyCredits') params.set('sort', selectedSort);
    if (selectedTimeframe !== 'this_month') params.set('timeframe', selectedTimeframe);

    const queryString = params.toString();
    const newUrl = queryString ? `/admin/usage?${queryString}` : '/admin/usage';
    router.replace(newUrl, { scroll: false });
  }, [debouncedSearch, selectedRole, selectedSort, selectedTimeframe, router]);

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

  const handleCopyUid = (uid: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    toast({ title: 'Kopiert', description: `UID ${uid} in Zwischenablage kopiert.` });
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const handleExportCSV = () => {
    if (!items.length) {
      toast({ title: 'Keine Daten', description: 'Keine Einträge zum Exportieren vorhanden.' });
      return;
    }

    const headers = ['UID', 'Name', 'Email', 'Role', 'Premium', 'Geoapify Credits', 'Geoapify Requests', 'Cache Hits', 'Cache Misses', 'AI Tokens', 'Total Requests', 'Last Active'];
    const csvRows = [
      headers.join(','),
      ...items.map(i => [
        `"${i.uid}"`,
        `"${(i.displayName || '').replace(/"/g, '""')}"`,
        `"${(i.email || '').replace(/"/g, '""')}"`,
        `"${i.role || 'user'}"`,
        i.isPremium ? 'Ja' : 'Nein',
        i.geoapifyCredits || 0,
        i.geoapifyRequests || 0,
        i.cacheHits || 0,
        i.cacheMisses || 0,
        i.totalTokens || 0,
        i.requestCount || 0,
        `"${i.lastUsedAt ? new Date(i.lastUsedAt).toISOString() : ''}"`
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activa_api_usage_${selectedTimeframe}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV Exportiert', description: 'Verbrauchsbericht wurde heruntergeladen.' });
  };

  const formatNumber = (val: number = 0) => val.toLocaleString('de-DE');
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
          { label: 'Erfasste Credits Heute', value: `${formatNumber(summary.creditsToday)} / ${formatNumber(summary.dailyCreditLimit)}`, icon: MapPin, colorClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
          { label: 'Geoapify Requests', value: formatNumber(summary.requestsToday), icon: Activity, colorClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
          {label: 'Gemessene Cache-Avoidance', value: `${summary.cacheAvoidanceRate}%`, icon: Database, colorClass: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'Error Rate', value: `${summary.errorRate}%`, icon: AlertTriangle, colorClass: summary.errorRate && summary.errorRate > 2 ? 'text-red-600 bg-red-50 dark:bg-red-950/40' : 'text-slate-600 bg-slate-100 dark:bg-neutral-800' },
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
                API & Verbrauch (Usage)
              </h1>
              <Badge className="bg-amber-500 text-white font-bold text-[10px] uppercase">
                PRODUCTION MONITOR
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium">
              Autoritative Erfassung von Geoapify Credits, Cache Avoidance Rate und KI-Service-Nutzung
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

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Geoapify Credits Today */}
        <Card className="rounded-2xl border-slate-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900">
          <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Erfasste Credits heute</span>
              <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-600 dark:text-amber-400">
                <MapPin className="h-5 w-5" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                {formatNumber(summary.creditsToday)} <span className="text-sm font-bold text-slate-400">/ {formatNumber(summary.dailyCreditLimit)}</span>
              </h3>
              <div className="w-full bg-slate-100 dark:bg-neutral-800 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  style={{ width: `${summary.dailyLimitPercentage}%` }}
                  className={`h-full rounded-full transition-all ${
                    (summary.dailyLimitPercentage || 0) > 80 ? 'bg-red-500' : (summary.dailyLimitPercentage || 0) > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 mt-1.5 flex justify-between">
                <span>Europe/Berlin ({summary.berlinDayKey || 'Heute'})</span>
                <span className="font-bold text-slate-700 dark:text-neutral-300">{summary.dailyLimitPercentage}% Tageslimit</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Geoapify Requests */}
        <Card className="rounded-2xl border-slate-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Geoapify Requests heute</p>
              <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                {formatNumber(summary.requestsToday)}
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                Places, Geocoding & Details Gateway Calls
              </p>
            </div>
            <div className="bg-blue-500/10 p-3 rounded-2xl text-blue-600 dark:text-blue-400">
              <Activity className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Cache Avoidance Rate */}
        <Card className="rounded-2xl border-slate-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gemessene Cache-Avoidance</p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {summary.cacheAvoidanceRate}%
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                {formatNumber(summary.cacheHitsToday)} Hits / {formatNumber(summary.cacheMissesToday)} Misses <span className="text-[10px] text-slate-400 font-normal">(Client-Telemetrie)</span>
              </p>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-2xl text-emerald-600 dark:text-emerald-400">
              <Database className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: AI & Secondary Provider */}
        <Card className="rounded-2xl border-slate-200 dark:border-neutral-800 shadow-sm bg-white dark:bg-neutral-900">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI & KI-Requests</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {formatNumber(summary.totalTokens)} <span className="text-xs font-bold text-slate-400">Tokens</span>
              </h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                Intent Parsing & Generierung
              </p>
            </div>
            <div className="bg-purple-500/10 p-3 rounded-2xl text-purple-600 dark:text-purple-400">
              <Cpu className="h-6 w-6" />
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

          <Select value={selectedSort} onValueChange={setSelectedSort}>
            <SelectTrigger className="w-[170px] rounded-xl text-xs font-bold bg-slate-50 dark:bg-neutral-800 border-slate-200 dark:border-neutral-700">
              <SelectValue placeholder="Sortieren nach" />
            </SelectTrigger>
            <SelectContent className="rounded-xl text-xs">
              <SelectItem value="geoapifyCredits">Höchste Credits</SelectItem>
              <SelectItem value="requestCount">Meiste Requests</SelectItem>
              <SelectItem value="cacheHits">Meiste Cache-Hits</SelectItem>
              <SelectItem value="recent">Zuletzt aktiv</SelectItem>
            </SelectContent>
          </Select>

        </div>
      </div>

      {/* Main Usage Ranking Table */}
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
              <p className="text-sm font-bold text-slate-700 dark:text-neutral-300">Noch keine Verbrauchsdaten für diesen Zeitraum vorhanden</p>
              <p className="text-xs text-slate-400">Verbrauchsdaten sammeln sich automatisch bei API-Aufrufen an.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Nutzer</th>
                    <th className="py-3.5 px-4">Tarif / Rolle</th>
                    <th className="py-3.5 px-4 text-right">Geoapify Credits</th>
                    <th className="py-3.5 px-4 text-right">Geoapify Requests</th>
                    <th className="py-3.5 px-4 text-right">Cache Hits</th>
                    <th className="py-3.5 px-4 text-right">AI Tokens</th>
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

                      <td className="py-3 px-4 text-right">
                        <span className="font-black text-amber-600 dark:text-amber-400 text-sm font-mono">
                          {formatNumber(item.geoapifyCredits || 0)} Credits
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-700 dark:text-neutral-300">
                        {formatNumber(item.geoapifyRequests || 0)} Calls
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatNumber(item.cacheHits || 0)} Hits
                      </td>

                      <td className="py-3 px-4 text-right text-[11px] font-mono text-purple-600 dark:text-purple-400 font-bold">
                        {formatNumber(item.totalTokens || 0)}
                      </td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {formatTime(item.lastUsedAt)}
                      </td>

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
              Detaillierte API- & Credit-Statistiken für diesen Nutzer
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 pt-2">
              
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

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 dark:bg-neutral-800/40 rounded-xl border border-slate-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Geoapify Credits</p>
                  <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {formatNumber(selectedItem.geoapifyCredits || 0)}
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-neutral-800/40 rounded-xl border border-slate-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Cache Hits (Geld gespart)</p>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatNumber(selectedItem.cacheHits || 0)} Hits
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-neutral-800/40 rounded-xl border border-slate-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">API Calls (Requests)</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {formatNumber(selectedItem.geoapifyRequests || 0)} Calls
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 dark:bg-neutral-800/40 rounded-xl border border-slate-100 dark:border-neutral-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">KI Tokens</p>
                  <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">
                    {formatNumber(selectedItem.totalTokens || 0)}
                  </p>
                </div>
              </div>

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
        <span>Lade API-Verbrauchsübersicht...</span>
      </div>
    }>
      <AdminUsageContent />
    </Suspense>
  );
}
