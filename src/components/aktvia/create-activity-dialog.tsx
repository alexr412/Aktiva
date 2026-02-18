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
import { Input } from '@/components/ui/input';

interface CreateActivityDialogProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateActivity: (date: Date, customLocationName?: string) => Promise<boolean>;
}

export function CreateActivityDialog({ place, open, onOpenChange, onCreateActivity }: CreateActivityDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isCreating, setIsCreating] = useState(false);
  const [customLocationName, setCustomLocationName] = useState('');

  const isCustom = !place;

  useEffect(() => {
    if (open) {
      setDate(new Date());
      setIsCreating(false);
      setCustomLocationName('');
    }
  }, [open]);

  const handleCreate = async () => {
    if (date) {
      setIsCreating(true);
      const success = await onCreateActivity(date, isCustom ? customLocationName : undefined);
      if (!success) {
        setIsCreating(false);
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* sm:max-w-md sorgt für gute Breite auf Desktop */}
      <SheetContent side="bottom" className="rounded-t-2xl p-0 sm:max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-muted" />
        <SheetHeader className="pt-8 p-6 pb-2 text-center items-center">
          <div className="bg-primary/10 p-3 rounded-full mb-2">
            <CalendarPlus className="h-6 w-6 text-primary" />
          </div>
          <SheetTitle className="text-xl font-bold">{isCustom ? 'Create a custom activity' : 'Create an activity'}</SheetTitle>
          <SheetDescription className="text-base text-muted-foreground">
            {isCustom ? (
                'Choose a name and date for your activity.'
            ) : (
                <>Pick a date to meet up at <br /> <span className="font-semibold text-foreground">{place?.name}</span>.</>
            )}
          </SheetDescription>
        </SheetHeader>
        
        {isCustom && (
          <div className="px-6 pb-2">
            <Input
              value={customLocationName}
              onChange={(e) => setCustomLocationName(e.target.value)}
              placeholder="E.g., Board Game Night at my place"
              className="text-center h-12 text-lg"
            />
          </div>
        )}

        {/* CONTAINER FÜR DEN KALENDER */}
        <div className="flex justify-center w-full py-2 px-4">
            <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() - 1))}
                className="rounded-xl border shadow-sm bg-card w-fit mx-auto"
            />
        </div>

        <SheetFooter className="p-6 pt-2 sm:justify-center">
          <Button 
            type="button" 
            onClick={handleCreate} 
            disabled={!date || isCreating || (isCustom && !customLocationName.trim())} 
            className="w-full h-12 text-base font-semibold rounded-xl"
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
