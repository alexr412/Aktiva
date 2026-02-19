'use client';

export default function CalendarPage() {
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="px-4 flex h-16 items-center">
          <h1 className="text-2xl font-bold tracking-tight">Calendar Grid Test</h1>
        </div>
      </header>
      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-muted/30">
        <div className="w-full max-w-md p-4 bg-card rounded-xl shadow-sm border">
          <h2 className="text-lg font-semibold text-center mb-4">7-Column Number Grid</h2>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => (
              <div
                key={day}
                className="flex items-center justify-center h-12 w-12 rounded-lg bg-secondary text-foreground font-medium"
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
