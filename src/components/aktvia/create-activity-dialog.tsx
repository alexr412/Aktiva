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
import { CalendarPlus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface CreateActivityDialogProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateActivity: (date: Date, customLocationName?: string) => Promise<boolean>;
}

export function CreateActivityDialog({ place, open, onOpenChange, onCreateActivity }: CreateActivityDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [customLocationName, setCustomLocationName] = useState('');

  const isCustom = !place;

  useEffect(() => {
    if (open) {
      setIsCreating(false);
      setCustomLocationName('');
    }
  }, [open]);

  const handleCreate = async () => {
    setIsCreating(true);
    // Activity is created for right now.
    const success = await onCreateActivity(new Date(), isCustom ? customLocationName : undefined);
    if (!success) {
      setIsCreating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 sm:max-w-md mx-auto max-h-[90vh] overflow-y-auto bg-white">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-gray-200" />
        <SheetHeader className="pt-8 p-6 pb-4 text-center items-center">
          <div className="bg-indigo-50 p-3 rounded-full mb-2">
            <CalendarPlus className="h-6 w-6 text-indigo-600" />
          </div>
          <SheetTitle className="text-xl font-bold text-gray-900">{isCustom ? 'Create a custom activity' : 'Create an activity'}</SheetTitle>
          <SheetDescription className="text-base text-gray-500">
            {isCustom ? (
                'Enter a name for your activity. It will be scheduled for today.'
            ) : (
                <>Create an activity at <br /> <span className="font-semibold text-gray-900">{place?.name}</span>. It will be scheduled for right now.</>
            )}
          </SheetDescription>
        </SheetHeader>
        
        {isCustom && (
          <div className="px-6 py-4">
            <Input
              value={customLocationName}
              onChange={(e) => setCustomLocationName(e.target.value)}
              placeholder="E.g., Board Game Night at my place"
              className="text-center h-12 text-lg rounded-xl"
            />
          </div>
        )}

        <SheetFooter className="p-6 pt-4 sm:justify-center">
          <Button 
            type="button" 
            onClick={handleCreate} 
            disabled={isCreating || (isCustom && !customLocationName.trim())} 
            className="w-full h-12 text-base font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Activity for Now'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
