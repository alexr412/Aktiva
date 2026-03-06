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
import { Loader2, Clock, ChevronLeft, ChevronRight, Flame, PlayCircle, Coins } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { earnToken } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
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
  isAfter,
  isWithinInterval,
} from 'date-fns';
import { de } from 'date-fns/locale';

interface CreateActivityDialogProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateActivity: (startDate: Date, endDate: Date | undefined, isTimeFlexible: boolean, customLocationName?: string, maxParticipants?: number, isBoosted?: boolean) => Promise<boolean>;
}

export function CreateActivityDialog({ place, open, onOpenChange, onCreateActivity }: CreateActivityDialogProps) {
  const { userProfile, user } = useAuth();
  const { toast } = useToast();
  
  const [isCreating, setIsCreating] = useState(false);
  const [customLocationName, setCustomLocationName] = useState('');
  
  // Calendar State
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedRange, setSelectedRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedTime, setSelectedTime] = useState<string>('18:00');
  const [isTimeFlexible, setIsTimeFlexible] = useState(false);
  const [isDateFlexible, setIsDateFlexible] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');
  
  // Monetization: Boost
  const [isBoosted, setIsBoosted] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  const isCustom = !place;

  useEffect(() => {
    if (open) {
      setIsCreating(false);
      setCustomLocationName('');
      const today = new Date();
      setSelectedDate(today);
      setSelectedRange({});
      setCurrentMonthDate(today);
      setSelectedTime('18:00');
      setIsTimeFlexible(false);
      setIsDateFlexible(false);
      setMaxParticipants('');
      setIsBoosted(false);
    }
  }, [open]);

  const handleCreate = async () => {
    const isRange = isDateFlexible && selectedRange.from;
    const isSingleDay = !isDateFlexible && selectedDate;

    if (!isRange && !isSingleDay) return;

    let startDate = isRange ? selectedRange.from! : selectedDate;
    let endDate = isRange ? selectedRange.to : undefined;

    let finalDate = new Date(startDate);
    const timeIsFlexible = isTimeFlexible || isRange;

    if (!timeIsFlexible) {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      finalDate.setHours(hours, minutes, 0, 0);
    } else {
      finalDate.setHours(0, 0, 0, 0);
    }
    
    if(endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    setIsCreating(true);
    const numMaxParticipants = parseInt(maxParticipants, 10);
    const success = await onCreateActivity(
      finalDate, 
      endDate, 
      timeIsFlexible, 
      isCustom ? customLocationName : undefined, 
      isNaN(numMaxParticipants) ? undefined : numMaxParticipants,
      isBoosted
    );
    if (!success) {
      setIsCreating(false);
    }
  };

  // Rewarded Video Simulation
  const handleEarnToken = async () => {
    if (!user) return;
    setIsWatchingAd(true);
    toast({ title: "Video startet...", description: "Schau dir das Video an, um einen Token zu verdienen." });
    
    // Simulate 5s video
    setTimeout(async () => {
      try {
        await earnToken(user.uid);
        toast({ title: "Token erhalten!", description: "Du hast erfolgreich 1 Token verdient." });
      } catch (err) {
        toast({ variant: "destructive", title: "Fehler", description: "Token konnte nicht gutgeschrieben werden." });
      } finally {
        setIsWatchingAd(false);
      }
    }, 5000);
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
  
  const handleDayClick = (day: Date) => {
    if (isDateFlexible) {
      if (!selectedRange.from || selectedRange.to) {
        setSelectedRange({ from: day, to: undefined });
      } else {
        if (isAfter(day, selectedRange.from)) {
          setSelectedRange({ ...selectedRange, to: day });
        } else {
          setSelectedRange({ from: day, to: selectedRange.from });
        }
      }
    } else {
      setSelectedDate(day);
    }
  };

  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const isCreateDisabled = isCreating ||
    (isCustom && !customLocationName.trim()) ||
    (isDateFlexible ? !selectedRange.from : !selectedDate) ||
    (!isTimeFlexible && !isDateFlexible && !selectedTime) ||
    (isBoosted && (userProfile?.adTokens || 0) < 1);

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
          
          <div className="flex items-center justify-center space-x-2 pt-2 pb-4">
            <Switch id="date-flexible" checked={isDateFlexible} onCheckedChange={setIsDateFlexible} />
            <Label htmlFor="date-flexible">Ich bin datumsflexibel</Label>
          </div>

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
              {days.map((day) => {
                const isSelected = !isDateFlexible && selectedDate && isSameDay(day, selectedDate);
                const isRangeStart = isDateFlexible && selectedRange.from && isSameDay(day, selectedRange.from);
                const isRangeEnd = isDateFlexible && selectedRange.to && isSameDay(day, selectedRange.to);
                const isInRange = isDateFlexible && selectedRange.from && selectedRange.to && isWithinInterval(day, { start: selectedRange.from, end: selectedRange.to });

                return (
                  <div
                    key={day.toString()}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      'flex cursor-pointer items-center justify-center h-10 w-10 rounded-full font-medium transition-colors mx-auto',
                      !isSameMonth(day, currentMonthDate) && 'text-muted-foreground/50 hover:bg-accent/50',
                      isToday(day) && !isSelected && !isRangeStart && !isRangeEnd && !isInRange && 'bg-accent text-accent-foreground',
                      isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                      isRangeStart && 'bg-primary text-primary-foreground hover:bg-primary/90',
                      isRangeEnd && 'bg-primary text-primary-foreground hover:bg-primary/90',
                      isInRange && !isRangeStart && !isRangeEnd && 'bg-primary/20 text-primary-foreground',
                      !isSelected && !isRangeStart && !isRangeEnd && !isInRange && 'hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {getDate(day)}
                  </div>
                )
              })}
            </div>
          </div>
          
          <div className={cn("w-full max-w-md p-4 pt-2 mx-auto", (isDateFlexible) && "hidden")}>
             <h3 className="text-lg font-semibold text-center mb-4 capitalize">
                Uhrzeit
              </h3>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full h-12 text-lg text-center rounded-xl"
                disabled={isTimeFlexible}
              />
              <div className="flex items-center justify-center space-x-2 pt-4">
                <Switch id="flexible-time" checked={isTimeFlexible} onCheckedChange={setIsTimeFlexible} />
                <Label htmlFor="flexible-time">Ich bin zeitlich flexibel</Label>
              </div>
          </div>

          <div className="w-full max-w-md p-4 pt-2 mx-auto space-y-2">
             <h3 className="text-lg font-semibold text-center mb-2 capitalize">
                Teilnehmerlimit (optional)
              </h3>
              <Input
                type="number"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                placeholder="Unbegrenzt"
                className="w-full h-12 text-lg text-center rounded-xl"
                min="1"
              />
          </div>

          {/* Token Economy & Boost Functionality */}
          <div className="w-full max-w-md p-4 pt-2 mx-auto mt-4 border-t border-border">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className={cn("h-5 w-5", isBoosted ? "text-orange-500 animate-pulse" : "text-muted-foreground")} />
                  <span className="font-bold">Aktivitäts-Booster</span>
                </div>
                <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-bold">{userProfile?.adTokens || 0}</span>
                </div>
             </div>
             
             <div className="bg-secondary/30 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="boost-toggle" className="text-base font-semibold">Boost aktivieren</Label>
                    <p className="text-xs text-muted-foreground">Erhöht Sichtbarkeit & Push-Radius. Preis: 1 Token.</p>
                  </div>
                  <Switch 
                    id="boost-toggle" 
                    checked={isBoosted} 
                    onCheckedChange={setIsBoosted}
                    disabled={(userProfile?.adTokens || 0) < 1}
                  />
                </div>

                {(userProfile?.adTokens || 0) < 1 && (
                  <Button 
                    variant="outline" 
                    className="w-full h-12 rounded-xl font-bold gap-2 border-primary/20 hover:bg-primary/5"
                    onClick={handleEarnToken}
                    disabled={isWatchingAd}
                  >
                    {isWatchingAd ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <PlayCircle className="h-5 w-5 text-primary" />
                        Token verdienen (Video Ad)
                      </>
                    )}
                  </Button>
                )}
             </div>
          </div>

        </div>

        <SheetFooter className="p-6 pt-4 sm:justify-center mt-auto">
          <Button 
            type="button" 
            onClick={handleCreate} 
            disabled={isCreateDisabled}
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
