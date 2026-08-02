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
import { AlertOctagon, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import type { UserProfile } from '@/lib/types';

interface SuspendUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onSuccess: () => void;
}

export function SuspendUserDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: SuspendUserDialogProps) {
  const [durationHours, setDurationHours] = useState<number>(24);
  const [customUntilIso, setCustomUntilIso] = useState<string>('');
  const [reasonPublic, setReasonPublic] = useState<string>('');
  const [noteInternal, setNoteInternal] = useState<string>('');
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const presets = [
    { label: '1 Std.', hours: 1 },
    { label: '24 Std.', hours: 24 },
    { label: '3 Tage', hours: 72 },
    { label: '7 Tage', hours: 168 },
    { label: '30 Tage', hours: 720 },
  ];

  const handleSuspend = async () => {
    if (!reasonPublic.trim()) {
      toast({ variant: 'destructive', title: 'Grund erforderlich', description: 'Bitte gib einen öffentlichen Sperrgrund an.' });
      return;
    }
    if (!functions) return;
    setLoading(true);
    try {
      const suspendFn = httpsCallable(functions, 'adminSuspendUser');
      const payload: any = {
        targetUid: user.uid,
        reasonPublic: reasonPublic.trim(),
        noteInternal: noteInternal.trim() || undefined,
      };

      if (customUntilIso) {
        payload.customUntilIso = new Date(customUntilIso).toISOString();
      } else {
        payload.durationHours = durationHours;
      }

      await suspendFn(payload);

      toast({
        title: 'Nutzer suspendiert',
        description: `${user.displayName || user.username || user.uid} wurde vorübergehend suspendiert.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler bei Suspension',
        description: err.message || 'Nutzer konnte nicht suspendiert werden.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 border dark:border-neutral-800">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-500">
            <AlertOctagon className="h-5 w-5" />
            <DialogTitle>Nutzer Suspendieren</DialogTitle>
          </div>
          <DialogDescription>
            Sperre den Account von <strong>{user.displayName || user.username || user.uid}</strong> vorübergehend.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Duration Presets */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Dauer der Suspension
            </Label>
            <div className="grid grid-cols-5 gap-1.5">
              {presets.map((preset) => (
                <Button
                  key={preset.hours}
                  type="button"
                  variant={durationHours === preset.hours && !customUntilIso ? 'default' : 'outline'}
                  size="sm"
                  className="px-1 text-xs"
                  onClick={() => {
                    setDurationHours(preset.hours);
                    setCustomUntilIso('');
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="pt-1">
              <Label className="text-xs">Oder Enddatum & Uhrzeit:</Label>
              <Input
                type="datetime-local"
                value={customUntilIso}
                onChange={(e) => setCustomUntilIso(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Public Reason */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Öffentlicher Grund <span className="text-red-500">*</span></Label>
            <Input
              placeholder="z. B. Vorübergehende Sperre wegen Verstoßes gegen Chatroregeln."
              value={reasonPublic}
              onChange={(e) => setReasonPublic(e.target.value)}
              disabled={loading}
            />
            <p className="text-[11px] text-muted-foreground">Wird dem Nutzer auf seinem Sperrbildschirm angezeigt.</p>
          </div>

          {/* Internal Note */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Interne Moderationsnotiz (Optional)</Label>
            <Textarea
              placeholder="z. B. Meldung #1243 - 3. Verwarnung im Chat."
              value={noteInternal}
              onChange={(e) => setNoteInternal(e.target.value)}
              disabled={loading}
              rows={2}
            />
            <p className="text-[11px] text-muted-foreground">Ausschließlich für Admins im Audit Log sichtbar.</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSuspend} disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Account Suspendieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
