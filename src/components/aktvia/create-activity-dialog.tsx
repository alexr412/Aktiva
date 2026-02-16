'use client';

import { useState } from 'react';
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

interface CreateActivityDialogProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateActivity: (date: Date) => void;
}

export function CreateActivityDialog({ place, open, onOpenChange, onCreateActivity }: CreateActivityDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const handleCreate = () => {
    if (date) {
      onCreateActivity(date);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create an activity</DialogTitle>
          <DialogDescription>
            Select a date to create an activity at <span className="font-semibold">{place?.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
            className="rounded-md border"
          />
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleCreate} disabled={!date}>
            Create Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
