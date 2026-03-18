'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import type { Place, ActivityCategory } from '@/lib/types';
import { Loader2, Clock, ChevronLeft, ChevronRight, Flame, PlayCircle, Coins, Users, CreditCard, Lock, MapPin, Search, Navigation, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { earnToken } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { reverseGeocode, autocompletePlaces } from '@/lib/geoapify';
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
const REQUIRED_FREE_HOSTS = 5;

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
    price?: number,
    category?: ActivityCategory
  ) => Promise<boolean>;
}

export function CreateActivityDialog({ place: initialPlace, open, onOpenChange, onCreateActivity }: CreateActivityDialogProps) {
  const { userProfile, user } = useAuth();
  const { toast } = useToast();
  
  const [isCreating, setIsCreating] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Place | null>(initialPlace);
  const [activityTitle, setActivityTitle] = useState('');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

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

  const isPremium = userProfile?.isPremium || false;
  const availableTokens = userProfile?.tokens || 0;
  const canBoost = availableTokens > 0;

  // Proof of Community logic
  const currentFreeHosts = userProfile?.successfulFreeHosts || 0;
  const canMonetize = currentFreeHosts >= REQUIRED_FREE_HOSTS;

  // Kontext-Entscheidung
  const isSpecificPlaceMode = !!initialPlace;

  useEffect(() => {
    if (open) {
      setIsCreating(false);
      setSelectedLocation(initialPlace);
      setActivityTitle('');
      setSearchQuery('');
      setSearchResults([]);
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
  }, [open, initialPlace]);

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 3) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results = await autocompletePlaces(val);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'GPS wird nicht unterstützt.' });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (place) {
        setSelectedLocation(place);
        toast({ title: 'Standort verifiziert', description: place.address });
      }
      setIsLocating(false);
    }, (err) => {
      setIsLocating(false);
      toast({ variant: 'destructive', title: 'GPS Fehler', description: 'Standort konnte nicht ermittelt werden.' });
    });
  };

  const handleCreate = async () => {
    if (!selectedLocation) return;

    const isRange = isDateFlexible && selectedRange.from;
    const isSingleDay = !isDateFlexible && selectedDate;

    if (!isRange && !isSingleDay) return;

    let derivedCategory: ActivityCategory = 'Sonstiges';
    const cats = selectedLocation.categories || [];
    if (cats.some(c => c.startsWith('sport'))) derivedCategory = 'Sport';
    else if (cats.some(c => c.startsWith('catering'))) derivedCategory = 'Networking';
    else if (cats.some(c => c.startsWith('tourism'))) derivedCategory = 'Kultur';
    else if (cats.some(c => c.startsWith('leisure'))) derivedCategory = 'Outdoor';

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

    // Automatische Titel-Zuweisung bei festen Orten
    const finalTitle = isSpecificPlaceMode ? (selectedLocation?.name || 'Aktivität') : activityTitle;

    setIsCreating(true);
    const success = await onCreateActivity(
      finalDate, 
      endDate, 
      timeIsFlexible, 
      finalTitle,
      maxParticipants,
      isBoosted,
      isPaid,
      price,
      derivedCategory
    );
    if (!success) {
      setIsCreating(false);
    }
  };

  const handleEarnToken = async () => {
    if (!user) return;
    setIsWatchingAd(true);
    setTimeout(async () => {
      try {
        await earnToken(user.uid);
        toast({ title: "Token erhalten!" });
      } catch (err) {
        toast({ variant: "destructive", title: "Fehler" });
      } finally {
        setIsWatchingAd(false);
      }
    }, 3000);
  };

  // Calendar Helpers
  const firstDayOfMonth = startOfMonth(currentMonthDate);
  const lastDayOfMonth = endOfMonth(currentMonthDate);
  const days = eachDayOfInterval({
    start: startOfWeek(firstDayOfMonth, { weekStartsOn: 1 }),
    end: endOfWeek(lastDayOfMonth, { weekStartsOn: 1 }),
  });

  const isCreateDisabled = isCreating || !selectedLocation || (!isSpecificPlaceMode && !activityTitle.trim()) || (isDateFlexible ? !selectedRange.from : !selectedDate);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[2.5rem] p-0 sm:max-w-md mx-auto h-[92vh] flex flex-col bg-background border-none shadow-2xl overflow-hidden">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-muted/50" />
        
        <SheetHeader className="pt-10 px-6 pb-2 text-center items-center shrink-0">
          <div className="bg-primary/10 p-3 rounded-2xl mb-3">
            {isSpecificPlaceMode ? (
              <Clock className="h-6 w-6 text-primary" />
            ) : (
              <Navigation className="h-6 w-6 text-primary" />
            )}
          </div>
          <SheetTitle className="text-2xl font-black tracking-tight">
            {isSpecificPlaceMode ? 'Aktivität planen' : 'Community Aktivität'}
          </SheetTitle>
          <SheetDescription className="text-sm font-medium text-muted-foreground px-4">
            {isSpecificPlaceMode 
              ? `Plane ein Treffen bei ${initialPlace?.name}` 
              : 'Erstelle ein Event an einem Ort deiner Wahl.'}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
          {/* Sektion 1: Name & Ort */}
          <div className="space-y-4">
            {!isSpecificPlaceMode && (
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Was hast du vor?</Label>
                <Input
                  value={activityTitle}
                  onChange={(e) => setActivityTitle(e.target.value)}
                  placeholder="z.B. Street-Photography oder Yoga"
                  className="h-14 text-lg rounded-2xl border-none bg-secondary/50 font-bold focus-visible:ring-primary/20"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Wo treffen wir uns?</Label>
              
              {isSpecificPlaceMode ? (
                <div className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-xl">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-black text-sm text-slate-900 dark:text-neutral-200 leading-tight">{selectedLocation?.name}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{selectedLocation?.address}</p>
                    </div>
                  </div>
                </div>
              ) : (
                !selectedLocation ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder="Ort oder Adresse suchen..."
                        className="h-14 pl-12 rounded-2xl border-none bg-secondary/50 font-bold"
                      />
                      {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
                    </div>

                    {searchResults.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                        {searchResults.map((res) => (
                          <button
                            key={res.id}
                            onClick={() => { setSelectedLocation(res); setSearchResults([]); }}
                            className="w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-start gap-3"
                          >
                            <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-sm text-slate-900">{res.name}</p>
                              <p className="text-xs text-slate-500">{res.address}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <Button 
                      variant="outline" 
                      onClick={handleGetCurrentLocation}
                      disabled={isLocating}
                      className="w-full h-14 rounded-2xl font-black gap-2 border-dashed border-2"
                    >
                      {isLocating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
                      Meinen Standort nutzen
                    </Button>
                  </div>
                ) : (
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between animate-in zoom-in-95 duration-300">
                    <div className="flex items-start gap-3">
                      <div className="bg-primary/10 p-2 rounded-xl">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-black text-sm text-slate-900 leading-tight">{selectedLocation.name}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{selectedLocation.address}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedLocation(null)} className="rounded-full text-slate-400">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Sektion 2: Datum & Zeit */}
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
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))} className="rounded-xl h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-sm font-black uppercase tracking-widest">{format(currentMonthDate, 'MMMM yyyy', { locale: de })}</h3>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))} className="rounded-xl h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const isSelected = !isDateFlexible && isSameDay(day, selectedDate);
                  const isInRange = isDateFlexible && selectedRange.from && selectedRange.to && isWithinInterval(day, { start: selectedRange.from, end: selectedRange.to });
                  const isStart = isDateFlexible && selectedRange.from && isSameDay(day, selectedRange.from);
                  const isEnd = isDateFlexible && selectedRange.to && isSameDay(day, selectedRange.to);

                  return (
                    <button
                      key={day.toString()}
                      type="button"
                      onClick={() => {
                        if (isDateFlexible) {
                          if (!selectedRange.from || selectedRange.to) setSelectedRange({ from: day, to: undefined });
                          else if (isAfter(day, selectedRange.from)) setSelectedRange({ ...selectedRange, to: day });
                          else setSelectedRange({ from: day, to: selectedRange.from });
                        } else setSelectedDate(day);
                      }}
                      className={cn(
                        'flex items-center justify-center h-10 w-10 rounded-xl text-sm font-bold transition-all mx-auto',
                        !isSameMonth(day, currentMonthDate) && 'text-muted-foreground/20',
                        isToday(day) && 'text-primary',
                        isSelected && 'bg-primary text-white shadow-lg',
                        (isStart || isEnd) && 'bg-primary text-white',
                        isInRange && 'bg-primary/20 text-primary rounded-none'
                      )}
                    >
                      {getDate(day)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sektion 3: Gating (Participants & Payment) */}
          <div className="space-y-6 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground">Teilnehmerlimit</Label>
              </div>
              {!isPremium && <Badge className="bg-primary/10 text-primary text-[10px] font-black border-none uppercase">Limit: {MAX_FREE_PARTICIPANTS}</Badge>}
            </div>

            <div className="flex items-center gap-6 bg-secondary/30 p-4 rounded-2xl">
              <Slider value={[maxParticipants]} max={isPremium ? 50 : MAX_FREE_PARTICIPANTS} min={2} onValueChange={(val) => setMaxParticipants(val[0])} className="flex-1" />
              <div className="min-w-[40px] text-center"><span className="text-2xl font-black text-primary">{maxParticipants}</span></div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-border p-4 bg-card/50">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold flex items-center gap-2">Bezahltes Event {!canMonetize && <Lock className="h-3 w-3" />}</Label>
                  <p className="text-xs text-muted-foreground">Proof of Community: {currentFreeHosts}/{REQUIRED_FREE_HOSTS}</p>
                </div>
                <Switch checked={isPaid} onCheckedChange={setIsPaid} disabled={!canMonetize} />
              </div>
              {isPaid && (
                <div className="flex items-center gap-3 p-4 bg-secondary/30 rounded-2xl border border-dashed border-border">
                  <span className="text-2xl font-black text-primary">€</span>
                  <Input type="number" value={price || ''} onChange={(e) => setPrice(Number(e.target.value))} className="text-2xl font-black w-32 h-14 bg-white border-none text-center" />
                </div>
              )}
            </div>
          </div>

          {/* Sektion 4: Booster */}
          <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flame className={cn("h-5 w-5", isBoosted ? "text-orange-500" : "text-muted-foreground")} />
                <span className="font-black text-sm uppercase">Booster Aktivieren</span>
              </div>
              <Switch checked={isBoosted} onCheckedChange={setIsBoosted} disabled={availableTokens < 1} />
            </div>
            {availableTokens < 1 && (
              <Button onClick={handleEarnToken} disabled={isWatchingAd} variant="outline" className="w-full h-12 rounded-xl font-black gap-2 mt-2 bg-white/50">
                {isWatchingAd ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Token verdienen
              </Button>
            )}
          </div>
        </div>

        <SheetFooter className="sticky bottom-0 bg-background pt-4 pb-8 px-6 border-t border-border/50 shrink-0">
          <Button 
            onClick={handleCreate} 
            disabled={isCreateDisabled}
            className="w-full h-14 text-base font-black rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95"
          >
            {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
            Aktivität jetzt erstellen
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
