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
import { Crown, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import { isPremiumActive, parseTimestampMillis, type UserProfile } from '@/lib/types';

interface PremiumManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onSuccess: () => void;
}

export function PremiumManagementDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: PremiumManagementDialogProps) {
  const [mode, setMode] = useState<'set' | 'extend' | 'remove'>('set');
  const [selectedPresetDays, setSelectedPresetDays] = useState<number>(30);
  const [customDateIso, setCustomDateIso] = useState<string>('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user && isPremiumActive(user)) {
      setMode('extend');
    } else {
      setMode('set');
    }
    setCustomDateIso('');
  }, [user]);

  if (!user) return null;

  const isActive = isPremiumActive(user);
  const existingExpiresMillis = parseTimestampMillis(user.premiumExpiresAt);
  const existingExpiresStr = existingExpiresMillis
    ? new Date(existingExpiresMillis).toLocaleDateString('de-DE')
    : null;

  const presets = [
    { label: '1 Tag', days: 1 },
    { label: '7 Tage', days: 7 },
    { label: '14 Tage', days: 14 },
    { label: '30 Tage', days: 30 },
    { label: '3 Monate', days: 90 },
    { label: '1 Jahr', days: 365 },
  ];

  const handleSave = async () => {
    if (!functions) return;
    setLoading(true);
    try {
      const setPremFn = httpsCallable(functions, 'adminSetUserPremium');
      const payload: any = {
        targetUid: user.uid,
        mode,
      };

      if (mode !== 'remove') {
        if (customDateIso) {
          payload.customExpirationIso = new Date(customDateIso).toISOString();
        } else {
          payload.durationDays = selectedPresetDays;
        }
      }

      await setPremFn(payload);

      toast({
        title: 'Premium-Status aktualisiert',
        description: mode === 'remove'
          ? `Premium für ${user.displayName || user.username || user.uid} wurde entfernt.`
          : `Premium für ${user.displayName || user.username || user.uid} wurde ${mode === 'extend' ? 'verlängert' : 'gesetzt'}.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler bei Premium-Verwaltung',
        description: err.message || 'Der Premium-Status konnte nicht geändert werden.',
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
            <Crown className="h-5 w-5" />
            <DialogTitle>Premium verwalten</DialogTitle>
          </div>
          <DialogDescription>
            Premium vergeben, verlängern oder entfernen für <strong>{user.displayName || user.username || user.uid}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Premium Banner */}
          <div className="p-3 bg-slate-50 dark:bg-neutral-950 rounded-lg border dark:border-neutral-800 text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-muted-foreground">Aktueller Premium-Status:</span>
              <span className={isActive ? "text-amber-500 font-bold" : "text-slate-400 font-medium"}>
                {isActive ? 'Aktiv ✨' : 'Inaktiv'}
              </span>
            </div>
            {existingExpiresStr && (
              <p className="text-muted-foreground">Ablaufdatum: <strong className="text-foreground">{existingExpiresStr}</strong></p>
            )}
            {user.premiumSource && (
              <p className="text-muted-foreground">Quelle: <code className="bg-muted px-1 rounded">{user.premiumSource}</code></p>
            )}
          </div>

          {/* Mode Selector */}
          <div className="flex rounded-lg border dark:border-neutral-800 p-1 bg-slate-50 dark:bg-neutral-950 gap-1 text-sm font-medium">
            <button
              type="button"
              className={`flex-1 py-1.5 rounded-md transition-colors ${mode === 'set' ? 'bg-white dark:bg-neutral-900 shadow-xs font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => { setMode('set'); setCustomDateIso(''); }}
            >
              Neu Setzen
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 rounded-md transition-colors ${mode === 'extend' ? 'bg-white dark:bg-neutral-900 shadow-xs font-bold text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => { setMode('extend'); setCustomDateIso(''); }}
            >
              Verlängern
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 rounded-md transition-colors ${mode === 'remove' ? 'bg-red-500/10 text-red-500 font-bold' : 'text-muted-foreground hover:text-red-500'}`}
              onClick={() => setMode('remove')}
            >
              Entfernen
            </button>
          </div>

          {mode !== 'remove' && (
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Vordefinierte Dauer {mode === 'extend' ? '(wird addiert)' : ''}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.days}
                    type="button"
                    variant={selectedPresetDays === preset.days && !customDateIso ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedPresetDays(preset.days);
                      setCustomDateIso('');
                    }}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="space-y-1 pt-2">
                <Label className="text-xs">Oder benutzerdefiniertes Ablaufdatum:</Label>
                <Input
                  type="date"
                  value={customDateIso}
                  onChange={(e) => setCustomDateIso(e.target.value)}
                  disabled={loading}
                  className="w-full min-w-0 max-w-full"
                />
              </div>
            </div>
          )}

          {mode === 'remove' && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-400">
              <strong>Achtung:</strong> Entfernt das Premium-Paket des Nutzers sofort. Das Teilnehmerlimit reduziert sich wieder auf 4 (bzw. 50 falls Organizer).
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={loading} variant={mode === 'remove' ? 'destructive' : 'default'}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'remove' ? 'Premium Entfernen' : 'Premium Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
