'use client';

import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const firstDayOfMonth = startOfMonth(currentDate);
  const lastDayOfMonth = endOfMonth(currentDate);

  // By default, startOfWeek is Sunday. If you want it to be Monday, you can pass { weekStartsOn: 1 }
  const firstDayOfGrid = startOfWeek(firstDayOfMonth);
  const lastDayOfGrid = endOfWeek(lastDayOfMonth);

  const days = eachDayOfInterval({
    start: firstDayOfGrid,
    end: lastDayOfGrid,
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

          <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-muted-foreground mb-2">
            {weekDays.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => (
              <div
                key={day.toString()}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'flex cursor-pointer items-center justify-center h-12 w-12 rounded-lg font-medium transition-colors',
                  // Style for days not in the current month
                  !isSameMonth(day, currentDate) &&
                    'text-muted-foreground/50 hover:bg-accent/50',
                  // Style for today's date (but not selected)
                  isToday(day) &&
                    !isSameDay(day, selectedDay) &&
                    'bg-accent text-accent-foreground',
                  // Style for selected day
                  isSameDay(day, selectedDay)
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'hover:bg-accent hover:text-accent-foreground'
                )}
              >
                {getDate(day)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
