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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/client';
import type { UserProfile } from '@/lib/types';

interface OrganizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile | null;
  onSuccess: () => void;
}

export function OrganizerDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: OrganizerDialogProps) {
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setIsOrganizer(!!user?.isOrganizer);
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    if (!functions) return;
    setLoading(true);
    try {
      const setOrgFn = httpsCallable(functions, 'adminSetOrganizerStatus');
      await setOrgFn({
        targetUid: user.uid,
        isOrganizer,
      });

      toast({
        title: 'Organizer-Status aktualisiert',
        description: `Der Organizer-Status für ${user.displayName || user.username || user.uid} wurde ${isOrganizer ? 'aktiviert (Teilnehmerlimit: 50)' : 'deaktiviert'}.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Ändern des Organizer-Status',
        description: err.message || 'Der Status konnte nicht aktualisiert werden.',
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
            <Users className="h-5 w-5" />
            <DialogTitle>Organizer-Status verwalten</DialogTitle>
          </div>
          <DialogDescription>
            Verwalte den Organizer-Status für <strong>{user.displayName || user.username || user.uid}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="flex items-center justify-between p-4 rounded-xl border dark:border-neutral-800 bg-slate-50 dark:bg-neutral-950">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Organizer Status</Label>
              <p className="text-xs text-muted-foreground">
                Gewährt ein erweitertes Teilnehmerlimit von <strong>50 Personen</strong> für selbst erstellte Aktivitäten.
              </p>
            </div>
            <Switch
              checked={isOrganizer}
              onCheckedChange={setIsOrganizer}
              disabled={loading}
            />
          </div>

          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-600 dark:text-blue-400">
            <strong>Hinweis:</strong> Organizer ist bei Aktiva ein Entitlement-Status und funktioniert unabhängig von Systemrollen (User, Moderator, Admin).
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Status Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
