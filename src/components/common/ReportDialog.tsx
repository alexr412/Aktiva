'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
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
import { Loader2 } from 'lucide-react';

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityType: 'activity' | 'user';
  entityName: string;
}

const reportReasons = [
  { id: 'spam', label: 'Spam or Misleading' },
  { id: 'inappropriate', label: 'Inappropriate Content' },
  { id: 'harassment', label: 'Harassment or Hate Speech' },
  { id: 'danger', label: 'Imminent Danger or Harm' },
];

export function ReportDialog({ open, onOpenChange, entityId, entityType, entityName }: ReportDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'You must be logged in to report.' });
      return;
    }
    if (!reason) {
      toast({ variant: 'destructive', title: 'Please select a reason.' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await submitReportAndHide(user.uid, entityId, entityType, reason);
      toast({
        title: 'Report Submitted',
        description: `Thank you. The ${entityType} has been reported and will be hidden from your view.`,
      });
      router.refresh();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || `Could not submit report for ${entityName}.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {entityType === 'user' ? 'User' : 'Activity'}</DialogTitle>
          <DialogDescription>
            Why are you reporting <span className="font-semibold">{entityName}</span>? Your report is anonymous.
          </DialogDescription>
        </DialogHeader>
        
        <RadioGroup value={reason} onValueChange={setReason} className="py-4 space-y-2">
          {reportReasons.map((item) => (
            <div key={item.id} className="flex items-center space-x-2">
              <RadioGroupItem value={item.id} id={`reason-${item.id}`} />
              <Label htmlFor={`reason-${item.id}`}>{item.label}</Label>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting || !reason}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
