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
import { Loader2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  isSameDay,
  getDate,
} from 'date-fns';
import { de } from 'date-fns/locale';

interface CreateActivityDialogProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateActivity: (date: Date, customLocationName?: string) => Promise<boolean>;
}

export function CreateActivityDialog({ place, open, onOpenChange, onCreateActivity }: CreateActivityDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [customLocationName, setCustomLocationName] = useState('');
  
  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>('18:00'); // Default to 6 PM

  const isCustom = !place;
  const timeSlots = ['10:00', '14:00', '18:00', '20:00'];

  useEffect(() => {
    if (open) {
      setIsCreating(false);
      setCustomLocationName('');
      const today = new Date();
      setSelectedDate(today);
      setCurrentMonthDate(today);
      setSelectedTime('18:00'); // Reset time
    }
  }, [open]);

  const handleCreate = async () => {
    if (!selectedDate || !selectedTime) {
        return;
    }
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const finalDate = new Date(selectedDate);
    finalDate.setHours(hours, minutes, 0, 0);

    setIsCreating(true);
    const success = await onCreateActivity(finalDate, isCustom ? customLocationName : undefined);
    if (!success) {
      setIsCreating(false);
    }
  };

  // Calendar Logic
  const firstDayOfMonth = startOfMonth(currentMonthDate);
  const lastDayOfMonth = endOfMonth(currentMonthDate);
  const firstDayOfGrid = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 }); // Start week on Monday
  const lastDayOfGrid = endOfWeek(lastDayOfMonth, { weekStartsOn: 1 });

  const days = eachDayOfInterval({
    start: firstDayOfGrid,
    end: lastDayOfGrid,
  });

  const nextMonth = () => setCurrentMonthDate(addMonths(currentMonthDate, 1));
  const prevMonth = () => setCurrentMonthDate(subMonths(currentMonthDate, 1));

  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 sm:max-w-md mx-auto max-h-[95vh] flex flex-col bg-background">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-muted" />
        <SheetHeader className="pt-8 p-6 pb-4 text-center items-center">
          <div className="bg-primary/10 p-3 rounded-full mb-2">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <SheetTitle className="text-xl font-bold">{isCustom ? 'Create a custom activity' : 'Create an activity'}</SheetTitle>
          <SheetDescription className="text-base text-muted-foreground">
            {isCustom ? 'Choose a date and name for your activity.' : <>Create an activity at <br /> <span className="font-semibold">{place?.name}</span>.</>}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto px-4">
          {isCustom && (
            <div className="px-2 pb-4">
              <Input
                value={customLocationName}
                onChange={(e) => setCustomLocationName(e.target.value)}
                placeholder="E.g., Board Game Night"
                className="text-center h-12 text-lg rounded-xl"
              />
            </div>
          )}

          {/* Calendar Implementation */}
          <div className="w-full max-w-md p-4 mx-auto">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={prevMonth}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-semibold text-center capitalize">
                {format(currentMonthDate, 'MMMM yyyy', { locale: de })}
              </h2>
              <Button variant="ghost" size="icon" onClick={nextMonth}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-muted-foreground mb-2">
              {weekDays.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => (
                <div
                  key={day.toString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'flex cursor-pointer items-center justify-center h-10 w-10 rounded-full font-medium transition-colors mx-auto',
                    !isSameMonth(day, currentMonthDate) && 'text-muted-foreground/50 hover:bg-accent/50',
                    isToday(day) && !(selectedDate && isSameDay(day, selectedDate)) && 'bg-accent text-accent-foreground',
                    selectedDate && isSameDay(day, selectedDate)
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {getDate(day)}
                </div>
              ))}
            </div>
          </div>
          
          <div className="w-full max-w-md p-4 pt-2 mx-auto">
             <h3 className="text-lg font-semibold text-center mb-4 capitalize">
                Uhrzeit
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map(time => (
                  <Button
                    key={time}
                    variant={selectedTime === time ? 'default' : 'outline'}
                    onClick={() => setSelectedTime(time)}
                  >
                    {time}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4">
                 <div className="flex-1 border-t" />
                 <span className="text-sm text-muted-foreground">ODER</span>
                 <div className="flex-1 border-t" />
              </div>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full mt-4 h-12 text-lg text-center rounded-xl"
              />
          </div>

        </div>

        <SheetFooter className="p-6 pt-4 sm:justify-center mt-auto">
          <Button 
            type="button" 
            onClick={handleCreate} 
            disabled={isCreating || !selectedDate || !selectedTime || (isCustom && !customLocationName.trim())} 
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
