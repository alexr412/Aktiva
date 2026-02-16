'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import type { Place } from '@/lib/types';
import { CalendarPlus } from 'lucide-react';

interface CreateActivityDialogProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateActivity: (date: Date) => void;
}

export function CreateActivityDialog({ place, open, onOpenChange, onCreateActivity }: CreateActivityDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  // Reset date when dialog opens for a new place
  useEffect(() => {
    if (open) {
      setDate(new Date());
    }
  }, [open]);

  const handleCreate = () => {
    if (date) {
      onCreateActivity(date);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="p-6 pb-4 text-center items-center">
          <div className="bg-primary/10 p-3 rounded-full mb-2">
            <CalendarPlus className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold">Create an activity</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            Pick a date to meet up at <br /> <span className="font-semibold text-foreground">{place?.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="px-6">
            <div className="bg-muted/50 rounded-xl flex justify-center">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
                    className="p-0"
                />
          </div>
        </div>
        <DialogFooter className="p-6 sm:justify-center">
          <Button type="submit" onClick={handleCreate} disabled={!date} className="w-full h-12 text-base font-semibold">
            Create Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
