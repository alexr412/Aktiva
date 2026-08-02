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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import type { UserProfile } from '@/lib/types';

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onSuccess: () => void;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: DeleteUserDialogProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setConfirmInput('');
  }, [open]);

  if (!user) return null;

  const isConfirmed = confirmInput.trim() === user.uid;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    if (!functions) return;
    setLoading(true);
    try {
      const deleteFn = httpsCallable(functions, 'adminDeleteUser');
      await deleteFn({
        targetUid: user.uid,
        confirmationText: confirmInput.trim(),
      });

      toast({
        title: 'Account gelöscht',
        description: `Der Account ${user.displayName || user.username || user.uid} wurde dauerhaft gelöscht.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Löschen',
        description: err.message || 'Der Account konnte nicht gelöscht werden.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border dark:border-neutral-800">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
            <DialogTitle>Account Endgültig Löschen</DialogTitle>
          </div>
          <DialogDescription>
            Diese Aktion kann <strong>nicht rückgängig</strong> gemacht werden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Der Nutzer wird aus Firebase Auth entfernt. Die kaskadierende Bereinigung bereinigt Profil, Radar, Freundschaften und Aktivitätsreferenzen.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              Zur Bestätigung gebe bitte exakt die UID des Nutzers ein:
            </Label>
            <div className="p-2 bg-muted rounded border text-xs font-mono text-center select-all">
              {user.uid}
            </div>
            <Input
              placeholder="UID hier einfügen/eingeben..."
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              disabled={loading}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Account Unwiderruflich Löschen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
