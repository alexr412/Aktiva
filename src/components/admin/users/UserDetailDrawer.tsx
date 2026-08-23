'use client';

import React, { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Shield,
  Crown,
  Users,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  AlertTriangle,
  Ban,
  Trash2,
  Loader2,
  Mail,
  KeyRound,
  Activity,
  UserCheck
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import { isPremiumActive, isAccountActive, getEffectiveAccountStatus, parseTimestampMillis, type UserProfile } from '@/lib/types';
import { RoleChangeDialog } from './RoleChangeDialog';
import { OrganizerDialog } from './OrganizerDialog';
import { PremiumManagementDialog } from './PremiumManagementDialog';
import { SuspendUserDialog } from './SuspendUserDialog';
import { BanUserDialog } from './BanUserDialog';
import { DeleteUserDialog } from './DeleteUserDialog';

interface UserDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  currentUserRole?: string;
  onRefresh: () => void;
}

export function UserDetailDrawer({
  open,
  onOpenChange,
  user: initialUser,
  currentUserRole = 'admin',
  onRefresh,
}: UserDetailDrawerProps) {
  const [userDoc, setUserDoc] = useState<UserProfile | null>(initialUser);
  const [authData, setAuthData] = useState<any>(null);
  const [stats, setStats] = useState<{ hostedActivitiesCount: number; joinedActivitiesCount: number; friendsCount: number } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Dialog states
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [organizerDialogOpen, setOrganizerDialogOpen] = useState(false);
  const [premiumDialogOpen, setPremiumDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    setUserDoc(initialUser);
  }, [initialUser]);

  useEffect(() => {
    if (!open || !initialUser?.uid || !functions) return;

    let isSubscribed = true;
    setLoadingDetails(true);

    const fetchDetails = async () => {
      const activeFunctions = functions;
      if (!activeFunctions) return;
      try {
        const getDetailFn = httpsCallable(activeFunctions, 'adminGetUserDetail');
        const res: any = await getDetailFn({ targetUid: initialUser.uid });
        if (isSubscribed && res.data) {
          if (res.data.profile) setUserDoc(res.data.profile);
          if (res.data.authUser) setAuthData(res.data.authUser);
          if (res.data.stats) setStats(res.data.stats);
        }
      } catch (err) {
        console.warn('Could not load detailed user info:', err);
      } finally {
        if (isSubscribed) setLoadingDetails(false);
      }
    };

    fetchDetails();

    return () => {
      isSubscribed = false;
    };
  }, [open, initialUser?.uid]);

  if (!userDoc) return null;

  const copyUid = () => {
    navigator.clipboard.writeText(userDoc.uid);
    setCopiedUid(true);
    toast({ title: 'UID Kopiert', description: userDoc.uid });
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const effectiveStatus = getEffectiveAccountStatus(userDoc);
  const isPrem = isPremiumActive(userDoc);
  const isOrg = !!userDoc.isOrganizer;
  const isBanned = effectiveStatus === 'banned';
  const isSuspended = effectiveStatus === 'suspended';
  const isActive = effectiveStatus === 'active';

  const roleName = userDoc.role || 'user';
  const createdDate = userDoc.createdAt ? new Date(parseTimestampMillis(userDoc.createdAt) || Date.now()).toLocaleDateString('de-DE') : '-';
  const premiumExpiresStr = userDoc.premiumExpiresAt ? new Date(parseTimestampMillis(userDoc.premiumExpiresAt) || Date.now()).toLocaleDateString('de-DE') : null;
  const suspendedUntilStr = userDoc.suspendedUntil ? new Date(parseTimestampMillis(userDoc.suspendedUntil) || Date.now()).toLocaleString('de-DE') : null;

  const handleActionSuccess = () => {
    onRefresh();
    // Refetch details
    if (functions && userDoc.uid) {
      const getDetailFn = httpsCallable(functions, 'adminGetUserDetail');
      getDetailFn({ targetUid: userDoc.uid }).then((res: any) => {
        if (res.data?.profile) setUserDoc(res.data.profile);
      });
    }
  };

  const handleUnsuspend = async () => {
    if (!functions) return;
    try {
      const unsuspendFn = httpsCallable(functions, 'adminUnsuspendUser');
      await unsuspendFn({ targetUid: userDoc.uid });
      toast({ title: 'Suspension aufgehoben', description: 'Der Nutzer ist wieder aktiv.' });
      handleActionSuccess();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Fehler', description: err.message });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-slate-50 dark:bg-neutral-950 p-4 sm:p-6 border-l dark:border-neutral-800">
          <SheetHeader className="pb-4 border-b dark:border-neutral-800">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border-2 border-primary/20">
                  <AvatarImage src={userDoc.photoURL || undefined} alt={userDoc.displayName || 'User'} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                    {(userDoc.displayName || userDoc.username || 'U').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div>
                  <SheetTitle className="text-xl font-bold flex items-center gap-2">
                    {userDoc.displayName || 'Unbenannter Nutzer'}
                    {isPrem && <Crown className="h-4 w-4 text-amber-500 fill-amber-500" />}
                  </SheetTitle>
                  <SheetDescription className="text-sm font-mono text-muted-foreground flex items-center gap-2 mt-0.5">
                    {userDoc.username ? `@${userDoc.username.replace(/^@/, '')}` : 'Kein Username'}
                    <span className="text-slate-300 dark:text-neutral-700">•</span>
                    <button onClick={copyUid} className="hover:text-primary transition-colors flex items-center gap-1">
                      <span>UID: {userDoc.uid.slice(0, 8)}...</span>
                      {copiedUid ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </SheetDescription>
                </div>
              </div>
            </div>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-3">
              <Badge variant={roleName === 'superadmin' ? 'destructive' : (roleName === 'admin' ? 'default' : (roleName === 'moderator' ? 'secondary' : 'outline'))}>
                <Shield className="h-3 w-3 mr-1" />
                {roleName.toUpperCase()}
              </Badge>

              {isOrg && (
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Users className="h-3 w-3 mr-1" />
                  ORGANIZER (50 Limit)
                </Badge>
              )}

              <Badge variant={isPrem ? 'default' : 'outline'} className={isPrem ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}>
                <Crown className="h-3 w-3 mr-1" />
                {isPrem ? 'PREMIUM (12 Limit)' : 'FREE (4 Limit)'}
              </Badge>

              <Badge variant={isBanned ? 'destructive' : (isSuspended ? 'outline' : 'default')} className={isActive ? 'bg-emerald-600 text-white' : (isSuspended ? 'border-amber-500 text-amber-500' : '')}>
                {isBanned ? 'BANNED' : (isSuspended ? 'SUSPENDED' : 'ACTIVE')}
              </Badge>
            </div>
          </SheetHeader>

          {loadingDetails && (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Lade Firebase Auth & Aktiva Statistiken...</span>
            </div>
          )}

          <Tabs defaultValue="profile" className="mt-4">
            <TabsList className="grid grid-cols-4 w-full bg-white dark:bg-neutral-900 border dark:border-neutral-800">
              <TabsTrigger value="profile" className="text-xs">Profil</TabsTrigger>
              <TabsTrigger value="rights" className="text-xs">Rechte</TabsTrigger>
              <TabsTrigger value="stats" className="text-xs">Stats</TabsTrigger>
              <TabsTrigger value="status" className="text-xs">Status</TabsTrigger>
            </TabsList>

            {/* TAB 1: PROFIL & AUTH */}
            <TabsContent value="profile" className="space-y-4 pt-3">
              <Card className="bg-white dark:bg-neutral-900 border dark:border-neutral-800">
                <CardContent className="p-4 space-y-3 text-sm">
                  <div className="flex justify-between items-center pb-2 border-b dark:border-neutral-800">
                    <span className="text-muted-foreground flex items-center gap-1.5"><User className="h-4 w-4" /> Name:</span>
                    <span className="font-semibold">{userDoc.displayName || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b dark:border-neutral-800">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Mail className="h-4 w-4" /> E-Mail:</span>
                    <span className="font-medium text-xs font-mono">{userDoc.email || authData?.email || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b dark:border-neutral-800">
                    <span className="text-muted-foreground flex items-center gap-1.5"><KeyRound className="h-4 w-4" /> UID:</span>
                    <button onClick={copyUid} className="font-mono text-xs hover:text-primary flex items-center gap-1">
                      {userDoc.uid} <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b dark:border-neutral-800">
                    <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Registriert:</span>
                    <span className="font-medium">{createdDate}</span>
                  </div>
                  {authData && (
                    <>
                      <div className="flex justify-between items-center pb-2 border-b dark:border-neutral-800">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-4 w-4" /> Letzter Auth-Login:</span>
                        <span className="font-medium text-xs">{authData.lastSignInTime ? new Date(authData.lastSignInTime).toLocaleString('de-DE') : '-'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1.5"><UserCheck className="h-4 w-4" /> E-Mail verifiziert:</span>
                        <span className={authData.emailVerified ? "text-emerald-500 font-bold text-xs" : "text-amber-500 font-medium text-xs"}>
                          {authData.emailVerified ? 'Ja ✓' : 'Nein'}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: RECHTE & ENTITLEMENTS */}
            <TabsContent value="rights" className="space-y-4 pt-3">
              <Card className="bg-white dark:bg-neutral-900 border dark:border-neutral-800">
                <CardContent className="p-4 space-y-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Systemrolle</p>
                      <p className="text-xs text-muted-foreground">Aktuell: <strong className="uppercase">{roleName}</strong></p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setRoleDialogOpen(true)}>
                      Rolle Ändern
                    </Button>
                  </div>

                  <div className="pt-2 border-t dark:border-neutral-800 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Organizer Status</p>
                      <p className="text-xs text-muted-foreground">{isOrg ? 'Aktiv (Limit 50 Teilnehmer)' : 'Inaktiv'}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setOrganizerDialogOpen(true)}>
                      Organizer Verwalten
                    </Button>
                  </div>

                  <div className="pt-2 border-t dark:border-neutral-800 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">Premium Paket</p>
                      <p className="text-xs text-muted-foreground">
                        {isPrem ? `Aktiv (bis ${premiumExpiresStr || 'Dauerhaft'})` : 'Inaktiv (Free-Nutzer)'}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setPremiumDialogOpen(true)}>
                      Premium Verwalten
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: AKTIVA STATS */}
            <TabsContent value="stats" className="space-y-4 pt-3">
              <div className="grid grid-cols-3 gap-3">
                <Card className="bg-white dark:bg-neutral-900 border dark:border-neutral-800 p-4 text-center">
                  <Activity className="h-5 w-5 mx-auto text-primary mb-1" />
                  <p className="text-2xl font-bold">{stats ? stats.hostedActivitiesCount : '-'}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">Erstellte Events</p>
                </Card>
                <Card className="bg-white dark:bg-neutral-900 border dark:border-neutral-800 p-4 text-center">
                  <Users className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                  <p className="text-2xl font-bold">{stats ? stats.joinedActivitiesCount : '-'}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">Teilnahmen</p>
                </Card>
                <Card className="bg-white dark:bg-neutral-900 border dark:border-neutral-800 p-4 text-center">
                  <UserCheck className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
                  <p className="text-2xl font-bold">{stats ? stats.friendsCount : '-'}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">Freunde</p>
                </Card>
              </div>
            </TabsContent>

            {/* TAB 4: ACCOUNTSTATUS */}
            <TabsContent value="status" className="space-y-4 pt-3">
              <Card className="bg-white dark:bg-neutral-900 border dark:border-neutral-800">
                <CardContent className="p-4 space-y-3 text-sm">
                  <div className="flex justify-between items-center pb-2 border-b dark:border-neutral-800">
                    <span className="text-muted-foreground">Account-Status:</span>
                    <Badge variant={isBanned ? 'destructive' : (isSuspended ? 'outline' : 'default')}>
                      {isBanned ? 'BANNED' : (isSuspended ? 'SUSPENDED' : 'ACTIVE')}
                    </Badge>
                  </div>

                  {isSuspended && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-1.5 text-xs text-amber-700 dark:text-amber-300">
                      <p className="font-semibold">Suspendiert bis: {suspendedUntilStr}</p>
                      {userDoc.suspensionReasonPublic && <p>Öffentlicher Grund: "{userDoc.suspensionReasonPublic}"</p>}
                      {userDoc.suspensionNoteInternal && <p className="italic text-muted-foreground">Interne Notiz: "{userDoc.suspensionNoteInternal}"</p>}
                    </div>
                  )}

                  {isBanned && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg space-y-1.5 text-xs text-red-700 dark:text-red-300">
                      <p className="font-semibold">Permanent Gebannt</p>
                      {userDoc.banReasonPublic && <p>Öffentlicher Grund: "{userDoc.banReasonPublic}"</p>}
                      {userDoc.banNoteInternal && <p className="italic text-muted-foreground">Interne Notiz: "{userDoc.banNoteInternal}"</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* ADMIN ACTION TOOLBAR */}
          <div className="mt-6 pt-4 border-t dark:border-neutral-800 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin Aktionen</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => setRoleDialogOpen(true)}>
                <Shield className="h-4 w-4 mr-1.5 text-primary" /> Rolle Ändern
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOrganizerDialogOpen(true)}>
                <Users className="h-4 w-4 mr-1.5 text-blue-500" /> Organizer
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPremiumDialogOpen(true)}>
                <Crown className="h-4 w-4 mr-1.5 text-amber-500" /> Premium
              </Button>

              {isSuspended ? (
                <Button variant="outline" size="sm" onClick={handleUnsuspend} className="text-amber-600">
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Unsuspend
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSuspendDialogOpen(true)} className="text-amber-600">
                  <AlertTriangle className="h-4 w-4 mr-1.5" /> Suspendieren
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={() => setBanDialogOpen(true)} className="text-red-500">
                <Ban className="h-4 w-4 mr-1.5" /> {isBanned ? 'Unban' : 'Bannen'}
              </Button>

              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Account Löschen
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* DIALOG MODALS */}
      <RoleChangeDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        user={userDoc}
        currentUserRole={currentUserRole}
        onSuccess={handleActionSuccess}
      />
      <OrganizerDialog
        open={organizerDialogOpen}
        onOpenChange={setOrganizerDialogOpen}
        user={userDoc}
        onSuccess={handleActionSuccess}
      />
      <PremiumManagementDialog
        open={premiumDialogOpen}
        onOpenChange={setPremiumDialogOpen}
        user={userDoc}
        onSuccess={handleActionSuccess}
      />
      <SuspendUserDialog
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
        user={userDoc}
        onSuccess={handleActionSuccess}
      />
      <BanUserDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        user={userDoc}
        onSuccess={handleActionSuccess}
      />
      <DeleteUserDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        user={userDoc}
        onSuccess={handleActionSuccess}
      />
    </>
  );
}
