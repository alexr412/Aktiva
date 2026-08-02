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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';

interface BulkActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUids: string[];
  onSuccess: () => void;
}

export function BulkActionDialog({
  open,
  onOpenChange,
  selectedUids,
  onSuccess,
}: BulkActionDialogProps) {
  const [action, setAction] = useState<'grant_premium' | 'extend_premium' | 'suspend'>('grant_premium');
  const [durationDays, setDurationDays] = useState<number>(30);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [reasonPublic, setReasonPublic] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const count = selectedUids.length;

  const handleExecuteBulk = async () => {
    if (count === 0) return;
    if (action === 'suspend' && !reasonPublic.trim()) {
      toast({ variant: 'destructive', title: 'Grund erforderlich', description: 'Bitte gib einen öffentlichen Grund für die Massen-Suspension an.' });
      return;
    }
    if (!functions) return;

    setLoading(true);
    try {
      const bulkFn = httpsCallable(functions, 'adminBulkUpdateUsers');
      const res: any = await bulkFn({
        targetUids: selectedUids,
        action,
        durationDays,
        durationHours,
        reasonPublic: reasonPublic.trim() || undefined,
      });

      const { successCount, failureCount } = res.data || {};
      toast({
        title: 'Bulk-Aktion ausgeführt',
        description: `Erfolgreich: ${successCount} Nutzer. ${failureCount > 0 ? `Fehler: ${failureCount}` : ''}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk-Aktion fehlgeschlagen',
        description: err.message || 'Die Massenänderung konnte nicht ausgeführt werden.',
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
            <Layers className="h-5 w-5" />
            <DialogTitle>Bulk Action ({count} Nutzer)</DialogTitle>
          </div>
          <DialogDescription>
            Führe eine sichere Massenaktion für <strong>{count} ausgewählte Nutzer</strong> aus.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Aktion auswählen</Label>
            <Select value={action} onValueChange={(val: any) => setAction(val)} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grant_premium">Premium vergeben (neu setzen)</SelectItem>
                <SelectItem value="extend_premium">Premium verlängern (+ Tage)</SelectItem>
                <SelectItem value="suspend">Accounts suspendieren (vorübergehend)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(action === 'grant_premium' || action === 'extend_premium') && (
            <div className="space-y-2">
              <Label className="text-xs">Premium Dauer (Tage)</Label>
              <Select value={String(durationDays)} onValueChange={(v) => setDurationDays(Number(v))} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Tage</SelectItem>
                  <SelectItem value="14">14 Tage</SelectItem>
                  <SelectItem value="30">30 Tage (1 Monat)</SelectItem>
                  <SelectItem value="90">90 Tage (3 Monate)</SelectItem>
                  <SelectItem value="365">365 Tage (1 Jahr)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {action === 'suspend' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Suspension Dauer (Stunden)</Label>
                <Select value={String(durationHours)} onValueChange={(v) => setDurationHours(Number(v))} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Stunde</SelectItem>
                    <SelectItem value="24">24 Stunden (1 Tag)</SelectItem>
                    <SelectItem value="72">72 Stunden (3 Tage)</SelectItem>
                    <SelectItem value="168">168 Stunden (7 Tage)</SelectItem>
                    <SelectItem value="720">720 Stunden (30 Tage)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Öffentlicher Grund <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="z. B. Massen-Suspension wegen Spam-Welle."
                  value={reasonPublic}
                  onChange={(e) => setReasonPublic(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleExecuteBulk} disabled={loading || count === 0}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aktion Ausführen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
