'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="px-4 flex h-16 items-center">
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center p-4 bg-muted/30">
         <div className="bg-card p-4 rounded-xl shadow-sm border w-auto inline-block">
            <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
            />
         </div>
      </div>
    </div>
  );
}
