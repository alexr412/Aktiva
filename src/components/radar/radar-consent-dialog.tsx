'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, MapPin, EyeOff, Navigation } from 'lucide-react';

interface RadarConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  onCancel: () => void;
  language?: 'de' | 'en';
}

export function RadarConsentDialog({
  open,
  onOpenChange,
  onAccept,
  onCancel,
  language = 'de',
}: RadarConsentDialogProps) {
  const isDe = language === 'de';

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) onCancel();
    }}>
      <DialogContent className="max-w-md p-6 rounded-3xl dark:bg-neutral-900 border-none sm:p-6 sm:max-w-md">
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-emerald-500" />
          </div>
          <DialogTitle className="text-lg font-black text-slate-800 dark:text-neutral-100">
            {isDe ? 'Einwilligung zum Freunde-Radar' : 'Friends Radar Consent'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 mt-1">
            {isDe ? 'Bitte lies dir die Datenschutzinformationen durch.' : 'Please read the privacy information.'}
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 space-y-4 text-sm text-slate-600 dark:text-neutral-300">
          <div className="flex gap-3">
            <Navigation className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              {isDe
                ? 'Wenn du den Freunde-Radar aktivierst, wird dein Standort während der aktiven Nutzung von Aktiva regelmäßig aktualisiert.'
                : 'When you enable the Friends Radar, your location will be updated regularly while using Aktiva.'}
            </p>
          </div>

          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              {isDe
                ? 'Nur bestätigte Freunde, die den Radar ebenfalls aktiviert haben und Premium- oder Organizer-Zugriff besitzen, können sehen, dass du dich ungefähr in ihrer Nähe befindest.'
                : 'Only confirmed friends who also enabled the radar and have Premium or Organizer access can see that you are roughly near them.'}
            </p>
          </div>

          <div className="flex gap-3">
            <EyeOff className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              {isDe
                ? 'Dein genauer Standort wird nicht angezeigt. Es wird kein Standortverlauf gespeichert. Aktiva aktualisiert deinen Standort nicht dauerhaft im Hintergrund.'
                : 'Your exact location is never shown. No location history is saved. Aktiva does not update your location constantly in the background.'}
            </p>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-3 sm:grid-cols-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
            className="rounded-full py-2.5 font-bold border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-300"
          >
            {isDe ? 'Abbrechen' : 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onAccept();
              onOpenChange(false);
            }}
            className="rounded-full py-2.5 font-bold bg-primary hover:bg-primary/95 text-white"
          >
            {isDe ? 'Aktivieren' : 'Enable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
