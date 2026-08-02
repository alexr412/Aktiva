'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Filter,
  MoreVertical,
  Shield,
  Crown,
  Copy,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Ban,
  AlertTriangle,
  Trash2,
  UserCheck
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { isPremiumActive, isAccountActive, parseTimestampMillis, type UserProfile } from '@/lib/types';
import { UserDetailDrawer } from '@/components/admin/users/UserDetailDrawer';
import { BulkActionDialog } from '@/components/admin/users/BulkActionDialog';
import { RoleChangeDialog } from '@/components/admin/users/RoleChangeDialog';
import { OrganizerDialog } from '@/components/admin/users/OrganizerDialog';
import { PremiumManagementDialog } from '@/components/admin/users/PremiumManagementDialog';
import { SuspendUserDialog } from '@/components/admin/users/SuspendUserDialog';
import { BanUserDialog } from '@/components/admin/users/BanUserDialog';
import { DeleteUserDialog } from '@/components/admin/users/DeleteUserDialog';

export default function AdminUsersPage() {
  const { userProfile: currentUserProfile, loading: authLoading } = useAuth();

  // Data & Pagination State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [lastDocId, setLastDocId] = useState<string | undefined>(undefined);

  // Filters State
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedOrganizer, setSelectedOrganizer] = useState<string>('all');
  const [selectedPremium, setSelectedPremium] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
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

  // 2. Fetch Users Function
  const fetchUsers = useCallback(async (startAfterId?: string) => {
    if (!functions) return;
    setLoading(true);
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
      toast({
        variant: 'destructive',
        title: 'Fehler beim Laden der Nutzer',
        description: err.message || 'Die Nutzerliste konnte nicht abgerufen werden.',
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedRole, selectedOrganizer, selectedPremium, selectedStatus, pageSize]);

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
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentUserRole = currentUserProfile?.role || 'admin';

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Nutzerverwaltung
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Verwalte Systemrollen, Entitlements, Premium und Accountsicherheit zentral.
          </p>
        </div>

        {selectedUids.length > 0 && (
          <Button
            onClick={() => setActiveDialog('bulk')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm animate-fade-in"
          >
            <Layers className="h-4 w-4 mr-2" /> Bulk Aktion ({selectedUids.length})
          </Button>
        )}
      </div>

      {/* Search & Filters Controls */}
      <Card className="bg-white dark:bg-neutral-900 border dark:border-neutral-800 shadow-xs">
        <CardContent className="p-4 space-y-4">
          {/* Main Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nutzer suchen: Name, Username, E-Mail oder UID …"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 bg-slate-50 dark:bg-neutral-950 border-slate-200 dark:border-neutral-800"
            />
          </div>

          {/* Combinable Filter Selectors */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
            {/* System Role */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Systemrolle</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="h-9 text-xs">
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
              <label className="text-xs font-semibold text-muted-foreground">Organizer</label>
              <Select value={selectedOrganizer} onValueChange={setSelectedOrganizer}>
                <SelectTrigger className="h-9 text-xs">
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
              <label className="text-xs font-semibold text-muted-foreground">Premium</label>
              <Select value={selectedPremium} onValueChange={setSelectedPremium}>
                <SelectTrigger className="h-9 text-xs">
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
              <label className="text-xs font-semibold text-muted-foreground">Accountstatus</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="h-9 text-xs">
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
              <label className="text-xs font-semibold text-muted-foreground">Pro Seite</label>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-9 text-xs">
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
      <Card className="bg-white dark:bg-neutral-900 border dark:border-neutral-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-neutral-950 border-b dark:border-neutral-800 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
            <tbody className="divide-y dark:divide-neutral-800">
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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-muted-foreground">
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
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                              {(u.displayName || u.username || 'U').substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-semibold text-foreground truncate max-w-[150px]">
                            {u.displayName || 'Unbenannt'}
                          </span>
                        </div>
                      </td>

                      {/* Username */}
                      <td className="p-4 font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                        {u.username ? `@${u.username.replace(/^@/, '')}` : '-'}
                      </td>

                      {/* Email */}
                      <td className="p-4 font-mono text-xs text-muted-foreground truncate max-w-[160px]">
                        {u.email || '-'}
                      </td>

                      {/* UID */}
                      <td className="p-4 font-mono text-xs text-muted-foreground" onClick={(e) => copyUid(u.uid, e)}>
                        <button className="hover:text-primary transition-colors flex items-center gap-1">
                          <span>{u.uid.slice(0, 7)}...</span>
                          {copiedUid === u.uid ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </td>

                      {/* Role */}
                      <td className="p-4">
                        <Badge variant={roleName === 'superadmin' ? 'destructive' : (roleName === 'admin' ? 'default' : (roleName === 'moderator' ? 'secondary' : 'outline'))} className="text-[10px]">
                          {roleName.toUpperCase()}
                        </Badge>
                      </td>

                      {/* Organizer */}
                      <td className="p-4">
                        {isOrg ? (
                          <Badge className="bg-blue-600 text-white text-[10px]">
                            ORGANIZER
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Premium */}
                      <td className="p-4">
                        {isPrem ? (
                          <Badge className="bg-amber-500 text-white text-[10px]">
                            PREMIUM
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">FREE</span>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="p-4">
                        <Badge variant={isBanned ? 'destructive' : (isSuspended ? 'outline' : 'default')} className={isActive ? 'bg-emerald-600 text-white text-[10px]' : (isSuspended ? 'border-amber-500 text-amber-500 text-[10px]' : 'text-[10px]')}>
                          {isBanned ? 'BANNED' : (isSuspended ? 'SUSPENDED' : 'ACTIVE')}
                        </Badge>
                      </td>

                      {/* Created Date */}
                      <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                        {createdDate}
                      </td>

                      {/* Row Actions Menu */}
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-neutral-900">
                            <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDrawerForUser(u)}>
                              <Users className="h-4 w-4 mr-2 text-primary" /> Details Ansehen
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'role')}>
                              <Shield className="h-4 w-4 mr-2" /> Rolle Ändern
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'organizer')}>
                              <UserCheck className="h-4 w-4 mr-2 text-blue-500" /> Organizer-Status
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'premium')}>
                              <Crown className="h-4 w-4 mr-2 text-amber-500" /> Premium Verwalten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'suspend')} className="text-amber-600">
                              <AlertTriangle className="h-4 w-4 mr-2" /> Suspendieren
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'ban')} className="text-red-500">
                              <Ban className="h-4 w-4 mr-2" /> {isBanned ? 'Unban' : 'Bannen'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openSpecificDialog(u, 'delete')} className="text-red-600 font-medium">
                              <Trash2 className="h-4 w-4 mr-2" /> Account Löschen
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
        <div className="flex items-center justify-between p-4 border-t dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/50">
          <div className="text-xs text-muted-foreground">
            Zeige max. <strong>{pageSize}</strong> Nutzer pro Seite
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchUsers()}
              disabled={loading}
            >
              Erste Seite
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchUsers(lastDocId)}
              disabled={loading || !hasMore}
            >
              Nächste Seite <ChevronRight className="h-4 w-4 ml-1" />
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
