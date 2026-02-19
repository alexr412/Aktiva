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
import type { Place } from '@/lib/types';
import { Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';

interface CreateActivityDialogProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateActivity: (date: Date, customLocationName?: string) => Promise<boolean>;
}

export function CreateActivityDialog({ place, open, onOpenChange, onCreateActivity }: CreateActivityDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [customLocationName, setCustomLocationName] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const isCustom = !place;

  useEffect(() => {
    if (open) {
      setIsCreating(false);
      setCustomLocationName('');
      setSelectedDate(new Date());
    }
  }, [open]);

  const handleCreate = async () => {
    if (!selectedDate) {
        return;
    }
    setIsCreating(true);
    const success = await onCreateActivity(selectedDate, isCustom ? customLocationName : undefined);
    if (!success) {
      setIsCreating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 sm:max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-background">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-muted" />
        <SheetHeader className="pt-8 p-6 pb-4 text-center items-center">
          <div className="bg-primary/10 p-3 rounded-full mb-2">
            <CalendarIcon className="h-6 w-6 text-primary" />
          </div>
          <SheetTitle className="text-xl font-bold">{isCustom ? 'Create a custom activity' : 'Create an activity'}</SheetTitle>
          <SheetDescription className="text-base text-muted-foreground">
            {isCustom ? 'Choose a date and name for your activity.' : <>Create an activity at <br /> <span className="font-semibold">{place?.name}</span>.</>}
          </SheetDescription>
        </SheetHeader>
        
        {isCustom && (
          <div className="px-6 pb-4">
            <Input
              value={customLocationName}
              onChange={(e) => setCustomLocationName(e.target.value)}
              placeholder="E.g., Board Game Night"
              className="text-center h-12 text-lg rounded-xl"
            />
          </div>
        )}

        <div className="px-4 flex justify-center">
             <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md border"
            />
        </div>

        <SheetFooter className="p-6 pt-4 sm:justify-center">
          <Button 
            type="button" 
            onClick={handleCreate} 
            disabled={isCreating || !selectedDate || (isCustom && !customLocationName.trim())} 
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
