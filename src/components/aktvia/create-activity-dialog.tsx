'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import type { Place } from '@/lib/types';
import { CalendarPlus, Loader2 } from 'lucide-react';

interface CreateActivityDialogProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateActivity: (date: Date) => Promise<void>;
}

export function CreateActivityDialog({ place, open, onOpenChange, onCreateActivity }: CreateActivityDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(new Date());
      setIsCreating(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (date) {
      setIsCreating(true);
      await onCreateActivity(date);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 sm:max-w-md mx-auto">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-muted" />
        <SheetHeader className="pt-8 p-6 pb-4 text-center items-center">
          <div className="bg-primary/10 p-3 rounded-full mb-2">
            <CalendarPlus className="h-6 w-6 text-primary" />
          </div>
          <SheetTitle className="text-xl font-bold">Create an activity</SheetTitle>
          <SheetDescription className="text-base text-muted-foreground">
            Pick a date to meet up at <br /> <span className="font-semibold text-foreground">{place?.name}</span>.
          </SheetDescription>
        </SheetHeader>
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
        <SheetFooter className="p-6 sm:justify-center">
          <Button 
            type="button" 
            onClick={handleCreate} 
            disabled={!date || isCreating} 
            className="w-full h-12 text-base font-semibold"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Activity'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
