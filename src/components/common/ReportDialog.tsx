'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { submitReportAndHide } from '@/lib/firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldAlert, Flag } from 'lucide-react';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityType: 'activity' | 'user';
  entityName: string;
}

export function ReportDialog({ open, onOpenChange, entityId, entityType, entityName }: ReportDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const language = useLanguage();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDe = language === 'de';

  const reportReasons = [
    {
      id: 'spam',
      label: isDe ? 'Spam oder irreführende Angaben' : 'Spam or Misleading',
    },
    {
      id: 'inappropriate',
      label: isDe ? 'Unangemessene Inhalte / Anstößiges Profilbild' : 'Inappropriate Content or Profile Picture',
    },
    {
      id: 'harassment',
      label: isDe ? 'Belästigung, Stalking oder Hassrede' : 'Harassment, Stalking, or Hate Speech',
    },
    {
      id: 'danger',
      label: isDe ? 'Gefahr, Bedrohung oder Sicherheitsrisiko' : 'Imminent Danger or Harm',
    },
    {
      id: 'other',
      label: isDe ? 'Sonstiges / Verstoß gegen Nutzungsbedingungen' : 'Other / Terms of Service Violation',
    },
  ];

  const handleSubmit = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: isDe ? 'Anmeldung erforderlich' : 'Login required',
        description: isDe ? 'Du musst angemeldet sein, um jemanden zu melden.' : 'You must be logged in to report.',
      });
      return;
    }
    if (!reason) {
      toast({
        variant: 'destructive',
        title: isDe ? 'Grund auswählen' : 'Please select a reason',
        description: isDe ? 'Bitte wähle einen Grund für die Meldung aus.' : 'Please select a reason for reporting.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const fullReason = details.trim() ? `${reason}: ${details.trim()}` : reason;
      await submitReportAndHide(user.uid, entityId, entityType, fullReason);
      
      toast({
        title: isDe ? 'Meldung eingereicht' : 'Report Submitted',
        description: isDe
          ? `Vielen Dank. ${entityType === 'user' ? 'Der Nutzer' : 'Die Aktivität'} wurde gemeldet und wird für dich ausgeblendet.`
          : `Thank you. The ${entityType} has been reported and will be hidden from your view.`,
      });
      
      setReason('');
      setDetails('');
      router.refresh();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: isDe ? 'Fehler beim Absenden' : 'Error submitting report',
        description: error.message || (isDe ? `Konnte ${entityName} nicht melden.` : `Could not submit report for ${entityName}.`),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const entityTitle = entityType === 'user'
    ? (isDe ? 'Nutzer melden' : 'Report User')
    : (isDe ? 'Aktivität melden' : 'Report Activity');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl rounded-3xl p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
                {entityTitle}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                {isDe ? 'Warum möchtest du ' : 'Why are you reporting '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">{entityName}</span>
                {isDe ? ' melden? Deine Meldung ist vertraulich.' : '? Your report is anonymous.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2.5">
            {reportReasons.map((item) => (
              <div
                key={item.id}
                onClick={() => setReason(item.id)}
                className={`flex items-center space-x-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                  reason === item.id
                    ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 text-red-900 dark:text-red-300 shadow-sm'
                    : 'border-slate-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-neutral-800/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <RadioGroupItem value={item.id} id={`reason-${item.id}`} className="text-red-600 border-slate-300 dark:border-neutral-600" />
                <Label htmlFor={`reason-${item.id}`} className="text-xs font-semibold cursor-pointer flex-1">
                  {item.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {isDe ? 'Optionale Details / Anmerkungen' : 'Optional details'}
            </Label>
            <Textarea
              placeholder={isDe ? 'Beschreibe kurz das Problem...' : 'Briefly describe the issue...'}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="text-xs rounded-xl bg-slate-50 dark:bg-neutral-950 border-slate-200 dark:border-neutral-800 resize-none h-20"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100 dark:border-neutral-800">
          <DialogClose asChild>
            <Button variant="outline" className="rounded-xl text-xs font-medium">
              {isDe ? 'Abbrechen' : 'Cancel'}
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason}
            className="rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Flag className="mr-2 h-3.5 w-3.5 fill-current" />
            )}
            {isDe ? 'Meldung absenden' : 'Submit Report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

