'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import type { UserProfile } from '@/lib/types';

interface RoleChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  currentUserRole?: string;
  onSuccess: () => void;
}

export function RoleChangeDialog({
  open,
  onOpenChange,
  user,
  currentUserRole = 'admin',
  onSuccess,
}: RoleChangeDialogProps) {
  const [selectedRole, setSelectedRole] = useState<'user' | 'moderator' | 'admin' | 'superadmin'>('user');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user?.role && ['user', 'moderator', 'admin', 'superadmin'].includes(user.role)) {
      setSelectedRole(user.role as any);
    } else {
      setSelectedRole('user');
    }
  }, [user]);

  if (!user) return null;

  const isCallerAdmin = currentUserRole === 'admin';
  const isTargetAdminOrSuper = user.role === 'admin' || user.role === 'superadmin';

  const handleSave = async () => {
    if (!functions) return;
    setLoading(true);
    try {
      const setRoleFn = httpsCallable(functions, 'adminSetUserRole');
      await setRoleFn({
        targetUid: user.uid,
        role: selectedRole,
      });

      toast({
        title: 'Rolle aktualisiert',
        description: `Die Systemrolle für ${user.displayName || user.username || user.uid} wurde auf "${selectedRole}" geändert.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Ändern der Rolle',
        description: err.message || 'Die Rolle konnte nicht geändert werden.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border dark:border-neutral-800">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Shield className="h-5 w-5" />
            <DialogTitle>Systemrolle verwalten</DialogTitle>
          </div>
          <DialogDescription>
            Ändere die administrative Rolle für <strong>{user.displayName || user.username || user.uid}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isCallerAdmin && isTargetAdminOrSuper ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3 text-amber-600 dark:text-amber-400 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              Als Standard-Admin kannst du Konten mit der Rolle <strong>Admin</strong> oder <strong>Superadmin</strong> nicht verändern. Dies erfordert Superadmin-Rechte.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Systemrolle auswählen</Label>
              <Select
                value={selectedRole}
                onValueChange={(val: any) => setSelectedRole(val)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wähle eine Rolle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex flex-col">
                      <span className="font-semibold">User</span>
                      <span className="text-xs text-muted-foreground">Normaler Aktiva-Nutzer ohne Adminrechte</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="moderator">
                    <div className="flex flex-col">
                      <span className="font-semibold">Moderator</span>
                      <span className="text-xs text-muted-foreground">Moderationsrechte für Meldungen & Inhalte</span>
                    </div>
                  </SelectItem>

                  {!isCallerAdmin && (
                    <>
                      <SelectItem value="admin">
                        <div className="flex flex-col">
                          <span className="font-semibold">Admin</span>
                          <span className="text-xs text-muted-foreground">Verwaltet User, Moderatoren, Premium & Sperren</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="superadmin">
                        <div className="flex flex-col">
                          <span className="font-semibold">Superadmin</span>
                          <span className="text-xs text-muted-foreground">Höchste Berechtigungsstufe im System</span>
                        </div>
                      </SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {isCallerAdmin && (
              <p className="text-xs text-muted-foreground italic">
                * Das Erstellen von Admins oder Superadmins erfordert Superadmin-Berechtigungen.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          {!(isCallerAdmin && isTargetAdminOrSuper) && (
            <Button onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rolle Speichern
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
