'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { format, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="px-4 flex h-16 items-center">
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        </div>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-muted/30">
        <div className="w-full max-w-md p-4 bg-card rounded-xl shadow-sm border">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold text-center">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => (
              <div
                key={day}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'flex cursor-pointer items-center justify-center h-12 w-12 rounded-lg font-medium transition-colors',
                  selectedDay === day
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {day}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
