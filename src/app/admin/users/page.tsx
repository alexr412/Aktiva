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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Search,
  MoreVertical,
  Shield,
  Crown,
  Copy,
  CheckCircle2,
  Loader2,
  ChevronRight,
  Layers,
  Ban,
  AlertTriangle,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { isPremiumActive, isAccountActive, parseTimestampMillis, type UserProfile } from '@/lib/types';
import { AdminSummaryBar } from '@/components/admin/AdminSummaryBar';
import { UserDetailDrawer } from '@/components/admin/users/UserDetailDrawer';
import { BulkActionDialog } from '@/components/admin/users/BulkActionDialog';
import { RoleChangeDialog } from '@/components/admin/users/RoleChangeDialog';
import { OrganizerDialog } from '@/components/admin/users/OrganizerDialog';
import { PremiumManagementDialog } from '@/components/admin/users/PremiumManagementDialog';
import { SuspendUserDialog } from '@/components/admin/users/SuspendUserDialog';
import { BanUserDialog } from '@/components/admin/users/BanUserDialog';
import { DeleteUserDialog } from '@/components/admin/users/DeleteUserDialog';

function AdminUsersContent() {
  const { userProfile: currentUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read URL search params for initial filter states
  const initialSearch = searchParams.get('search') || '';
  const initialRole = searchParams.get('role') || 'all';
  const initialOrganizer = searchParams.get('organizer') || 'all';
  const initialPremium = searchParams.get('premium') || 'all';
  const initialStatus = searchParams.get('status') || 'all';

  // Data & Pagination State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [lastDocId, setLastDocId] = useState<string | undefined>(undefined);
  const [backfilling, setBackfilling] = useState<boolean>(false);

  // Filters State
  const [searchInput, setSearchInput] = useState<string>(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch);
  const [selectedRole, setSelectedRole] = useState<string>(initialRole);
  const [selectedOrganizer, setSelectedOrganizer] = useState<string>(initialOrganizer);
  const [selectedPremium, setSelectedPremium] = useState<string>(initialPremium);
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [pageSize, setPageSize] = useState<number>(50);

  // Selection & Detail Drawer State
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [selectedUserForDrawer, setSelectedUserForDrawer] = useState<UserProfile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Specific Action Dialog Target User State
  const [actionTargetUser, setActionTargetUser] = useState<UserProfile | null>(null);
  const [activeDialog, setActiveDialog] = useState<'role' | 'organizer' | 'premium' | 'suspend' | 'ban' | 'delete' | 'bulk' | null>(null);

  // Copy Feedback State
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // 1. Debounce Search Input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 2. Sync filters to URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedRole !== 'all') params.set('role', selectedRole);
    if (selectedOrganizer !== 'all') params.set('organizer', selectedOrganizer);
    if (selectedPremium !== 'all') params.set('premium', selectedPremium);
    if (selectedStatus !== 'all') params.set('status', selectedStatus);

    const queryString = params.toString();
    const newUrl = queryString ? `/admin/users?${queryString}` : '/admin/users';
    router.replace(newUrl, { scroll: false });
  }, [debouncedSearch, selectedRole, selectedOrganizer, selectedPremium, selectedStatus, router]);

  // 3. Fetch Users Function
  const fetchUsers = useCallback(async (startAfterId?: string) => {
    if (!functions) return;
    setLoading(true);
    setError(null);
    try {
      const listUsersFn = httpsCallable(functions, 'adminListUsers');
      const payload: any = {
        limit: pageSize,
      };

      if (debouncedSearch) payload.search = debouncedSearch;
      if (selectedRole !== 'all') payload.role = selectedRole;
      if (selectedOrganizer === 'true') payload.isOrganizer = true;
      if (selectedOrganizer === 'false') payload.isOrganizer = false;
      if (selectedPremium !== 'all') payload.premium = selectedPremium;
      if (selectedStatus !== 'all') payload.accountStatus = selectedStatus;
      if (startAfterId) payload.startAfterDocId = startAfterId;

      const res: any = await listUsersFn(payload);

      if (res.data) {
        setUsers(res.data.users || []);
        setHasMore(!!res.data.hasMore);
        setLastDocId(res.data.lastDocId);
      }
    } catch (err: any) {
      console.error('[ADMIN USERS ERROR]', err);
      setError(err.message || 'Die Nutzerliste konnte nicht geladen werden.');
      toast({
        variant: 'destructive',
        title: 'Fehler beim Laden der Nutzer',
        description: err.message || 'Die Nutzerliste konnte nicht abgerufen werden.',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedRole, selectedOrganizer, selectedPremium, selectedStatus, pageSize]);

  // Handle Manual Backfill
  const handleRunBackfill = async () => {
    if (!functions) return;
    setBackfilling(true);
    try {
      const backfillFn = httpsCallable(functions, 'adminBackfillUsers');
      const res: any = await backfillFn();
      toast({
        title: 'Migration abgeschlossen',
        description: `${res.data?.scanned || 0} Dokumente gescannt, ${res.data?.backfilled || 0} Legacy-User aktualisiert.`,
      });
      fetchUsers();
    } catch (err: any) {
      console.error('Backfill error:', err);
      toast({
        variant: 'destructive',
        title: 'Fehler bei Migration',
        description: err.message || 'Der Backfill konnte nicht ausgeführt werden.',
      });
    } finally {
      setBackfilling(false);
    }
  };

  // Trigger fetch when filters change
  useEffect(() => {
    fetchUsers();
    setSelectedUids([]);
  }, [fetchUsers]);

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedUids.length === users.length) {
      setSelectedUids([]);
    } else {
      setSelectedUids(users.map(u => u.uid));
    }
  };

  const toggleSelectUser = (uid: string) => {
    setSelectedUids(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const copyUid = (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    toast({ title: 'UID kopiert', description: uid });
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const openDrawerForUser = (user: UserProfile) => {
    setSelectedUserForDrawer(user);
    setDrawerOpen(true);
  };

  const openSpecificDialog = (user: UserProfile, type: 'role' | 'organizer' | 'premium' | 'suspend' | 'ban' | 'delete') => {
    setActionTargetUser(user);
    setActiveDialog(type);
  };

  if (authLoading) {
    return null;
  }

  const currentUserRole = currentUserProfile?.role || 'admin';

  // Calculate summary metrics for current view
  const adminCount = users.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
  const organizerCount = users.filter(u => u.isOrganizer).length;
  const restrictedCount = users.filter(u => u.isBanned || u.accountStatus === 'banned' || u.accountStatus === 'suspended').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-slate-900 dark:text-white">
            <Users className="h-6 w-6 text-purple-600" /> Nutzerverwaltung
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-neutral-400 mt-0.5 font-medium">
            Systemrollen, Entitlements, Premium und Accountsicherheit zentral verwalten.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunBackfill}
            disabled={backfilling}
            className="rounded-xl text-xs font-bold border-slate-200 dark:border-neutral-800"
            title="Saniert ältere Nutzerdaten"
          >
            {backfilling ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Layers className="h-3.5 w-3.5 mr-1.5 text-slate-400" />}
            Sanieren
          </Button>

          {selectedUids.length > 0 && (
            <Button
              size="sm"
              onClick={() => setActiveDialog('bulk')}
              className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              <Layers className="h-3.5 w-3.5 mr-1.5" /> Bulk ({selectedUids.length})
            </Button>
          )}
        </div>
      </div>

      {/* KPI SUMMARY BAR */}
      <AdminSummaryBar
        metrics={[
          { label: 'Geladene Nutzer', value: users.length, icon: Users, colorClass: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40' },
          { label: 'Admins & Supers', value: adminCount, icon: Shield, colorClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
          { label: 'Organizers', value: organizerCount, icon: UserCheck, colorClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
          { label: 'Gesperrt / Suspendiert', value: restrictedCount, icon: UserX, colorClass: 'text-red-600 bg-red-50 dark:bg-red-950/40' },
        ]}
      />

      {/* Search & Filters Controls */}
      <Card className="bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-sm rounded-3xl">
        <CardContent className="p-4 space-y-4">
          {/* Main Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Nutzer suchen: Name, Username, E-Mail oder UID …"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 h-11 bg-slate-50 dark:bg-neutral-950 border-slate-200 dark:border-neutral-800 rounded-2xl text-sm font-medium"
            />
          </div>

          {/* Combinable Filter Selectors */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
            {/* System Role */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Systemrolle</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Rolle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Rollen</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Organizer */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Organizer</label>
              <Select value={selectedOrganizer} onValueChange={setSelectedOrganizer}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Organizer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="true">Organizer (Ja)</SelectItem>
                  <SelectItem value="false">Nicht Organizer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Premium */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Premium</label>
              <Select value={selectedPremium} onValueChange={setSelectedPremium}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Premium" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="inactive">Inaktiv / Free</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Account Status */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Accountstatus</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="banned">Banned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Page Size */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Pro Seite</label>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 Nutzer</SelectItem>
                  <SelectItem value="50">50 Nutzer</SelectItem>
                  <SelectItem value="100">100 Nutzer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Data Table */}
      <Card className="bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-sm rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead className="bg-slate-50 dark:bg-neutral-950 border-b border-slate-100 dark:border-neutral-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <tr>
                <th className="p-4 w-10 text-center">
                  <Checkbox
                    checked={users.length > 0 && selectedUids.length === users.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="p-4">Nutzer</th>
                <th className="p-4">Username</th>
                <th className="p-4">E-Mail</th>
                <th className="p-4">UID</th>
                <th className="p-4">Rang</th>
                <th className="p-4">Organizer</th>
                <th className="p-4">Premium</th>
                <th className="p-4">Status</th>
                <th className="p-4">Erstellt</th>
                <th className="p-4 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-4 text-center"><div className="h-4 w-4 bg-slate-200 dark:bg-neutral-800 rounded mx-auto" /></td>
                    <td className="p-4"><div className="h-4 w-32 bg-slate-200 dark:bg-neutral-800 rounded" /></td>
                    <td className="p-4"><div className="h-4 w-24 bg-slate-200 dark:bg-neutral-800 rounded" /></td>
                    <td className="p-4"><div className="h-4 w-36 bg-slate-200 dark:bg-neutral-800 rounded" /></td>
                    <td className="p-4"><div className="h-4 w-20 bg-slate-200 dark:bg-neutral-800 rounded" /></td>
                    <td className="p-4"><div className="h-5 w-16 bg-slate-200 dark:bg-neutral-800 rounded" /></td>
                    <td className="p-4"><div className="h-5 w-16 bg-slate-200 dark:bg-neutral-800 rounded" /></td>
                    <td className="p-4"><div className="h-5 w-16 bg-slate-200 dark:bg-neutral-800 rounded" /></td>
                    <td className="p-4"><div className="h-5 w-16 bg-slate-200 dark:bg-neutral-800 rounded" /></td>
                    <td className="p-4"><div className="h-4 w-20 bg-slate-200 dark:bg-neutral-800 rounded" /></td>
                    <td className="p-4 text-right"><div className="h-8 w-8 bg-slate-200 dark:bg-neutral-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-red-500 font-medium space-y-2">
                    <AlertTriangle className="h-6 w-6 mx-auto text-red-500" />
                    <p>Nutzer konnten nicht geladen werden.</p>
                    <p className="text-xs text-slate-400 font-mono">{error}</p>
                    <Button variant="outline" size="sm" onClick={() => fetchUsers()} className="mt-2">
                      Erneut versuchen
                    </Button>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 font-medium italic">
                    Keine Nutzer für die aktuellen Filterkriterien gefunden.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isPrem = isPremiumActive(u);
                  const isOrg = !!u.isOrganizer;
                  const isBanned = u.isBanned || u.accountStatus === 'banned';
                  const isSuspended = u.accountStatus === 'suspended' && u.suspendedUntil && parseTimestampMillis(u.suspendedUntil)! > Date.now();
                  const isActive = isAccountActive(u);
                  const roleName = u.role || 'user';
                  const createdDate = u.createdAt ? new Date(parseTimestampMillis(u.createdAt) || Date.now()).toLocaleDateString('de-DE') : '-';

                  return (
                    <tr
                      key={u.uid}
                      onClick={() => openDrawerForUser(u)}
                      className="hover:bg-slate-50/80 dark:hover:bg-neutral-800/50 cursor-pointer transition-colors"
                    >
                      <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedUids.includes(u.uid)}
                          onCheckedChange={() => toggleSelectUser(u.uid)}
                        />
                      </td>

                      {/* Display Name & Avatar */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={u.photoURL || undefined} alt={u.displayName || 'User'} />
                            <AvatarFallback className="bg-purple-100 text-purple-600 font-bold text-xs">
                              {(u.displayName || u.username || 'U').substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-bold text-slate-900 dark:text-white truncate max-w-[150px]">
                            {u.displayName || 'Unbenannt'}
                          </span>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="p-4 font-mono text-xs text-slate-500 truncate max-w-[120px]">
                        {u.username ? `@${u.username.replace(/^@/, '')}` : '-'}
                      </td>

                      {/* Email */}
                      <td className="p-4 font-mono text-xs text-slate-500 truncate max-w-[160px]">
                        {u.email || '-'}
                      </td>

                      {/* UID */}
                      <td className="p-4 font-mono text-xs text-slate-400" onClick={(e) => copyUid(u.uid, e)}>
                        <button className="hover:text-purple-600 transition-colors flex items-center gap-1">
                          <span>{u.uid.slice(0, 7)}...</span>
                          {copiedUid === u.uid ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </td>

                      {/* Role */}
                      <td className="p-4">
                        <Badge variant={roleName === 'superadmin' ? 'destructive' : (roleName === 'admin' ? 'default' : (roleName === 'moderator' ? 'secondary' : 'outline'))} className="text-[10px] font-bold">
                          {roleName.toUpperCase()}
                        </Badge>
                      </td>

                      {/* Organizer */}
                      <td className="p-4">
                        {isOrg ? (
                          <Badge className="bg-blue-600 text-white text-[10px] font-bold">
                            ORGANIZER
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>

                      {/* Premium */}
                      <td className="p-4">
                        {isPrem ? (
                          <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                            PREMIUM
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">FREE</span>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="p-4">
                        <Badge variant={isBanned ? 'destructive' : (isSuspended ? 'outline' : 'default')} className={isActive ? 'bg-emerald-600 text-white text-[10px] font-bold' : (isSuspended ? 'border-amber-500 text-amber-500 text-[10px] font-bold' : 'text-[10px] font-bold')}>
                          {isBanned ? 'BANNED' : (isSuspended ? 'SUSPENDED' : 'ACTIVE')}
                        </Badge>
                      </td>

                      {/* Created Date */}
                      <td className="p-4 text-xs text-slate-400 whitespace-nowrap">
                        {createdDate}
                      </td>

                      {/* Row Actions Menu */}
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 rounded-xl">
                              <MoreVertical className="h-4 w-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 rounded-2xl shadow-xl">
                            <DropdownMenuLabel className="text-[10px] uppercase font-black text-slate-400">Aktionen</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDrawerForUser(u)} className="text-xs font-bold">
                              <Users className="h-3.5 w-3.5 mr-2 text-purple-600" /> Details Ansehen
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'role')} className="text-xs font-bold">
                              <Shield className="h-3.5 w-3.5 mr-2" /> Rolle Ändern
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'organizer')} className="text-xs font-bold">
                              <UserCheck className="h-3.5 w-3.5 mr-2 text-blue-500" /> Organizer-Status
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'premium')} className="text-xs font-bold">
                              <Crown className="h-3.5 w-3.5 mr-2 text-amber-500" /> Premium Verwalten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'suspend')} className="text-xs font-bold text-amber-600">
                              <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Suspendieren
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'ban')} className="text-xs font-bold text-red-500">
                              <Ban className="h-3.5 w-3.5 mr-2" /> {isBanned ? 'Unban' : 'Bannen'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'delete')} className="text-xs font-bold text-red-600">
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Account Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/50">
          <div className="text-xs text-slate-400 font-medium">
            Zeige max. <strong>{pageSize}</strong> Nutzer pro Seite
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchUsers()}
              disabled={loading}
              className="rounded-xl text-xs font-bold h-8"
            >
              Erste Seite
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchUsers(lastDocId)}
              disabled={loading || !hasMore}
              className="rounded-xl text-xs font-bold h-8"
            >
              Nächste Seite <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      {/* USER DETAIL DRAWER */}
      <UserDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        user={selectedUserForDrawer}
        currentUserRole={currentUserRole}
        onRefresh={fetchUsers}
      />

      {/* BULK ACTION DIALOG */}
      <BulkActionDialog
        open={activeDialog === 'bulk'}
        onOpenChange={(op) => !op && setActiveDialog(null)}
        selectedUids={selectedUids}
        onSuccess={() => { fetchUsers(); setSelectedUids([]); }}
      />

      {/* INDIVIDUAL ACTION DIALOGS */}
      {actionTargetUser && (
        <>
          <RoleChangeDialog
            open={activeDialog === 'role'}
            onOpenChange={(op) => !op && setActiveDialog(null)}
            user={actionTargetUser}
            currentUserRole={currentUserRole}
            onSuccess={fetchUsers}
          />
          <OrganizerDialog
            open={activeDialog === 'organizer'}
            onOpenChange={(op) => !op && setActiveDialog(null)}
            user={actionTargetUser}
            onSuccess={fetchUsers}
          />
          <PremiumManagementDialog
            open={activeDialog === 'premium'}
            onOpenChange={(op) => !op && setActiveDialog(null)}
            user={actionTargetUser}
            onSuccess={fetchUsers}
          />
          <SuspendUserDialog
            open={activeDialog === 'suspend'}
            onOpenChange={(op) => !op && setActiveDialog(null)}
            user={actionTargetUser}
            onSuccess={fetchUsers}
          />
          <BanUserDialog
            open={activeDialog === 'ban'}
            onOpenChange={(op) => !op && setActiveDialog(null)}
            user={actionTargetUser}
            onSuccess={fetchUsers}
          />
          <DeleteUserDialog
            open={activeDialog === 'delete'}
            onOpenChange={(op) => !op && setActiveDialog(null)}
            user={actionTargetUser}
            onSuccess={fetchUsers}
          />
        </>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-12 font-bold text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-purple-600" />
        Lade Nutzerverwaltung...
      </div>
    }>
      <AdminUsersContent />
    </Suspense>
  );
}
