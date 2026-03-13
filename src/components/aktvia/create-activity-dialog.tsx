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
import { Loader2, Clock, ChevronLeft, ChevronRight, Flame, PlayCircle, Coins, Users, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { earnToken } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
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

const MAX_FREE_PARTICIPANTS = 4;
const MAX_PRICE = 25;

interface CreateActivityDialogProps {
  place: Place | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateActivity: (
    startDate: Date, 
    endDate: Date | undefined, 
    isTimeFlexible: boolean, 
    customLocationName?: string, 
    maxParticipants?: number, 
    isBoosted?: boolean,
    isPaid?: boolean,
    price?: number
  ) => Promise<boolean>;
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
  const [isTimeFlexible, setIsTimeFlexible] = useState(true);
  const [isDateFlexible, setIsDateFlexible] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState<number>(4);
  
  // Monetization: Boost
  const [isBoosted, setIsBoosted] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  // Micro-Ticketing
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<number>(0);

  const isCustom = !place;
  const isPremium = userProfile?.isPremium || false;
  const availableTokens = userProfile?.tokens || 0;
  const canBoost = availableTokens > 0;

  useEffect(() => {
    if (open) {
      setIsCreating(false);
      setCustomLocationName('');
      const today = new Date();
      setSelectedDate(today);
      setSelectedRange({});
      setCurrentMonthDate(today);
      setSelectedTime('18:00');
      setIsTimeFlexible(true);
      setIsDateFlexible(false);
      setMaxParticipants(4);
      setIsBoosted(false);
      setIsPaid(false);
      setPrice(0);
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
    const success = await onCreateActivity(
      finalDate, 
      endDate, 
      timeIsFlexible, 
      isCustom ? customLocationName : undefined, 
      maxParticipants,
      isBoosted,
      isPaid,
      price
    );
    if (!success) {
      setIsCreating(false);
    }
  };

  const handleEarnToken = async () => {
    if (!user) return;
    setIsWatchingAd(true);
    toast({ title: "Video startet...", description: "Schau dir das Video an, um einen Token zu verdienen." });
    
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

  const firstDayOfMonth = startOfMonth(currentMonthDate);
  const lastDayOfMonth = endOfMonth(currentMonthDate);
  const firstDayOfGrid = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
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
    (isBoosted && availableTokens < 1) ||
    (isPaid && (price <= 0 || price > MAX_PRICE));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[2rem] p-0 sm:max-w-md mx-auto h-[90vh] flex flex-col bg-background border-none shadow-2xl overflow-hidden">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-muted/50" />
        
        <SheetHeader className="pt-10 px-6 pb-2 text-center items-center shrink-0">
          <div className="bg-primary/10 p-3 rounded-2xl mb-3">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <SheetTitle className="text-2xl font-black tracking-tight">
            {isCustom ? 'Eigene Aktivität' : 'Aktivität planen'}
          </SheetTitle>
          <SheetDescription className="text-sm font-medium text-muted-foreground px-4">
            {isCustom ? 'Wähle einen Namen und ein Datum für dein Treffen.' : <span>Plane ein Treffen bei <br /><strong className="text-foreground">{place?.name}</strong></span>}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Sektion: Name (Nur bei Custom) */}
          {isCustom && (
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Name der Aktivität</Label>
              <Input
                value={customLocationName}
                onChange={(e) => setCustomLocationName(e.target.value)}
                placeholder="z.B. Spieleabend oder Lauftreff"
                className="h-14 text-lg rounded-2xl border-none bg-secondary/50 font-bold focus-visible:ring-primary/20"
              />
            </div>
          )}
          
          {/* Sektion: Datum & Flexibilität */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-border p-4 shadow-sm bg-card/50">
              <div className="space-y-0.5">
                <Label htmlFor="date-flexible" className="text-base font-bold">Datumsflexibel</Label>
                <p className="text-xs text-muted-foreground font-medium">Genaues Datum steht noch nicht fest</p>
              </div>
              <Switch id="date-flexible" checked={isDateFlexible} onCheckedChange={setIsDateFlexible} />
            </div>

            <div className="rounded-2xl border border-border p-4 bg-card/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-xl h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-sm font-black uppercase tracking-widest">
                  {format(currentMonthDate, 'MMMM yyyy', { locale: de })}
                </h3>
                <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-xl h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-muted-foreground/60 mb-2 uppercase">
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
                    <button
                      key={day.toString()}
                      type="button"
                      onClick={() => handleDayClick(day)}
                      className={cn(
                        'flex items-center justify-center h-10 w-10 rounded-xl text-sm font-bold transition-all mx-auto',
                        !isSameMonth(day, currentMonthDate) && 'text-muted-foreground/20',
                        isToday(day) && !isSelected && !isRangeStart && !isRangeEnd && !isInRange && 'bg-primary/10 text-primary',
                        isSelected && 'bg-primary text-white shadow-lg shadow-primary/20 scale-110',
                        isRangeStart && 'bg-primary text-white rounded-r-none shadow-none',
                        isRangeEnd && 'bg-primary text-white rounded-l-none shadow-none',
                        isInRange && !isRangeStart && !isRangeEnd && 'bg-primary/20 text-primary rounded-none',
                        !isSelected && !isRangeStart && !isRangeEnd && !isInRange && 'hover:bg-secondary'
                      )}
                    >
                      {getDate(day)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          
          {/* Sektion: Uhrzeit */}
          <div className={cn("space-y-4", isDateFlexible && "hidden")}>
            <div className="flex items-center justify-between rounded-2xl border border-border p-4 shadow-sm bg-card/50">
              <div className="space-y-0.5">
                <Label htmlFor="flexible-time" className="text-base font-bold">Zeitlich flexibel</Label>
                <p className="text-xs text-muted-foreground font-medium">Uhrzeit wird im Chat besprochen</p>
              </div>
              <Switch id="flexible-time" checked={isTimeFlexible} onCheckedChange={setIsTimeFlexible} />
            </div>

            <div className={cn("transition-all duration-300", isTimeFlexible ? "opacity-0 h-0 pointer-events-none" : "opacity-100 h-auto")}>
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Geplante Uhrzeit</Label>
              <Input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="h-14 text-center rounded-2xl border-none bg-secondary/50 font-black text-2xl focus-visible:ring-primary/20 mt-2"
              />
            </div>
          </div>

          {/* Sektion: Teilnehmerlimit (Gated) */}
          <div className="space-y-3 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground">Teilnehmerlimit</Label>
              </div>
              {!isPremium && (
                <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] font-black uppercase border-none">
                  Premium für große Gruppen
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-6 bg-secondary/30 p-4 rounded-2xl">
              <Slider 
                value={[maxParticipants]} 
                max={isPremium ? 50 : MAX_FREE_PARTICIPANTS} 
                min={2} 
                step={1}
                onValueChange={(val) => setMaxParticipants(val[0])}
                className="flex-1"
              />
              <div className="flex flex-col items-center justify-center min-w-[40px]">
                <span className="text-2xl font-black text-primary leading-none">
                  {maxParticipants}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Pers.</span>
              </div>
            </div>

            {!isPremium && maxParticipants >= MAX_FREE_PARTICIPANTS && (
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
                <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                  Kostenlose Aktivitäten sind auf {MAX_FREE_PARTICIPANTS} Personen limitiert. 
                  <Link href="/settings" className="text-primary font-black ml-1 hover:underline">
                    Jetzt Premium sichern.
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Sektion: Teilnahmebeitrag (Micro-Ticketing) */}
          <div className="space-y-3 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground">Teilnahmebeitrag</Label>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border p-4 shadow-sm bg-card/50">
              <div className="space-y-0.5">
                <Label htmlFor="is-paid" className="text-base font-bold text-slate-900">Kostenpflichtig</Label>
                <p className="text-xs text-muted-foreground font-medium">Beitrag pro Person (Max. {MAX_PRICE}€)</p>
              </div>
              <Switch 
                id="is-paid" 
                checked={isPaid} 
                onCheckedChange={(checked) => {
                  setIsPaid(checked);
                  if (!checked) setPrice(0);
                }} 
              />
            </div>

            {isPaid && (
              <div className="flex items-center gap-3 mt-2 bg-secondary/30 p-4 rounded-2xl border border-dashed border-border transition-all animate-in fade-in slide-in-from-top-2">
                <span className="text-2xl font-black text-primary">€</span>
                <Input 
                  type="number" 
                  min="1" 
                  max={MAX_PRICE} 
                  value={price || ''} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val <= MAX_PRICE || isNaN(val)) setPrice(val || 0);
                  }}
                  className="text-2xl font-black w-32 h-14 bg-white border-none rounded-xl text-center focus-visible:ring-primary/20"
                  placeholder="0.00"
                />
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider ml-auto">
                  Pro Person
                </span>
              </div>
            )}
          </div>

          {/* Sektion: Booster */}
          <div className="space-y-4 pt-4 border-t border-border/50">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className={cn("h-5 w-5", isBoosted ? "text-orange-500 animate-pulse" : "text-muted-foreground")} />
                  <span className="font-black text-sm uppercase tracking-tight">Aktivitäts-Booster</span>
                </div>
                <div className="flex items-center gap-2 bg-secondary px-3 py-1 rounded-full">
                  <Coins className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-black">{availableTokens}</span>
                </div>
             </div>
             
             <div className="bg-orange-50/50 dark:bg-orange-950/10 rounded-2xl p-4 border border-orange-100 dark:border-orange-900/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="boost-toggle" className="text-base font-bold text-orange-900 dark:text-orange-200">Boost aktivieren</Label>
                    <p className="text-xs text-orange-800/60 dark:text-orange-300/60 font-medium">Maximale Sichtbarkeit im Feed. Preis: 1 Token.</p>
                  </div>
                  <Switch 
                    id="boost-toggle" 
                    checked={isBoosted} 
                    onCheckedChange={setIsBoosted}
                    disabled={!canBoost}
                  />
                </div>

                {!canBoost ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-destructive font-black uppercase tracking-wider">Nicht genügend Tokens vorhanden.</p>
                    <Button 
                      variant="outline" 
                      className="w-full h-12 rounded-xl font-black gap-2 border-orange-200 bg-white/50 hover:bg-orange-50 transition-all"
                      onClick={handleEarnToken}
                      disabled={isWatchingAd}
                    >
                      {isWatchingAd ? (
                        <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                      ) : (
                        <>
                          <PlayCircle className="h-5 w-5 text-orange-500" />
                          <span>Token verdienen (Video Ad)</span>
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-[10px] text-orange-600 font-bold uppercase">Booster bereit!</p>
                )}
             </div>
          </div>
        </div>

        <SheetFooter className="sticky bottom-0 bg-background pt-4 pb-8 px-6 border-t border-border/50 shrink-0">
          <Button 
            type="button" 
            onClick={handleCreate} 
            disabled={isCreateDisabled}
            className="w-full h-14 text-base font-black rounded-2xl shadow-xl shadow-primary/20 transition-transform active:scale-95"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Wird erstellt...
              </>
            ) : (
              'Aktivität jetzt erstellen'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
