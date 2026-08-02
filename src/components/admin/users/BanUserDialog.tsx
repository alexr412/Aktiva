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
import { Textarea } from '@/components/ui/textarea';
import { Ban, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import type { UserProfile } from '@/lib/types';

interface BanUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onSuccess: () => void;
}

export function BanUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: BanUserDialogProps) {
  const [reasonPublic, setReasonPublic] = useState<string>('');
  const [noteInternal, setNoteInternal] = useState<string>('');
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const isBanned = user.isBanned || user.accountStatus === 'banned';

  const handleBanToggle = async () => {
    if (!functions) return;
    setLoading(true);
    try {
      if (isBanned) {
        const unbanFn = httpsCallable(functions, 'adminUnbanUser');
        await unbanFn({ targetUid: user.uid });
        toast({ title: 'Ban aufgehoben', description: `Der Bann für ${user.displayName || user.username || user.uid} wurde aufgehoben.` });
      } else {
        if (!reasonPublic.trim()) {
          toast({ variant: 'destructive', title: 'Grund erforderlich', description: 'Bitte gib einen öffentlichen Bangrund an.' });
          setLoading(false);
          return;
        }
        const banFn = httpsCallable(functions, 'adminBanUser');
        await banFn({
          targetUid: user.uid,
          reasonPublic: reasonPublic.trim(),
          noteInternal: noteInternal.trim() || undefined,
        });
        toast({ title: 'Nutzer gebannt', description: `${user.displayName || user.username || user.uid} wurde permanent gebannt.` });
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler bei Ban-Aktion',
        description: err.message || 'Die Aktion konnte nicht ausgeführt werden.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border dark:border-neutral-800">
        <DialogHeader>
          <div className="flex items-center gap-2 text-red-500">
            <Ban className="h-5 w-5" />
            <DialogTitle>{isBanned ? 'Bann Aufheben' : 'Nutzer Permanent Bannen'}</DialogTitle>
          </div>
          <DialogDescription>
            {isBanned 
              ? `Reaktiviere den Zugriff für ${user.displayName || user.username || user.uid}.` 
              : `Sperre ${user.displayName || user.username || user.uid} permanent im gesamten System.`}
          </DialogDescription>
        </DialogHeader>

        {!isBanned ? (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-400">
              <strong>Warnung:</strong> Ein gebannter Nutzer verliert sofort jeglichen App-Zugriff und wird in Firebase Auth deaktiviert.
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Öffentlicher Bangrund <span className="text-red-500">*</span></Label>
              <Input
                placeholder="z. B. Schwerwiegender Verstoß gegen die Nutzungsbedingungen."
                value={reasonPublic}
                onChange={(e) => setReasonPublic(e.target.value)}
                disabled={loading}
              />
              <p className="text-[11px] text-muted-foreground">Wird dem Nutzer auf dem Sperrbildschirm angezeigt.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Interne Moderationsnotiz (Optional)</Label>
              <Textarea
                placeholder="z. B. Interner Fall #9872 - Gefälschtes Profil & Betrugsversuch."
                value={noteInternal}
                onChange={(e) => setNoteInternal(e.target.value)}
                disabled={loading}
                rows={2}
              />
              <p className="text-[11px] text-muted-foreground">Ausschließlich für Admins sichtbar.</p>
            </div>
          </div>
        ) : (
          <div className="py-3">
            <p className="text-sm text-muted-foreground">
              Möchtest du den permanenten Bann für diesen Nutzer aufheben? Er erhält danach wieder regulären Zugriff auf seinen Account.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleBanToggle} disabled={loading} variant={isBanned ? 'default' : 'destructive'}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isBanned ? 'Bann Aufheben' : 'Permanent Bannen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
