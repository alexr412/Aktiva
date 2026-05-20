'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import type { Place, ActivityCategory } from '@/lib/types';
import { Loader2, Clock, ChevronLeft, ChevronRight, Flame, PlayCircle, Coins, Users, CreditCard, Lock, MapPin, Search, Navigation, X, Check, AlertTriangle, Dumbbell, Zap, Landmark, Trees, Gamepad2, Coffee, Star, ShieldCheck, UserCircle, StarHalf, type LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';

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
    category?: ActivityCategory,
    description?: string,
    requirements?: {
      ageRange?: { min?: number; max?: number };
      gender?: string[];
      requireProfilePicture?: boolean;
      requireVerification?: boolean;
      minimumRating?: number;
    },
    joinMode?: 'direct' | 'request'
  ) => Promise<boolean>;
}

export function CreateActivityDialog({ place: initialPlace, open, onOpenChange, onCreateActivity }: CreateActivityDialogProps) {
  const { userProfile, user } = useAuth();
  const language = useLanguage();
  const { toast } = useToast();
  
  const [isCreating, setIsCreating] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Place | null>(initialPlace);
  const [activityTitle, setActivityTitle] = useState('');
  const [description, setDescription] = useState('');
  
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
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>(language === 'de' ? 'Sonstiges' : 'Sonstiges');
  
  // Monetization: Boost
  const [isBoosted, setIsBoosted] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);

    // Micro-Ticketing
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState<number>(0);

  // Requirements State
  const [requireProfilePicture, setRequireProfilePicture] = useState(false);
  const [requireVerification, setRequireVerification] = useState(false);
  const [minAge, setMinAge] = useState<number | ''>('');
  const [maxAge, setMaxAge] = useState<number | ''>('');
  const [allowedGenders, setAllowedGenders] = useState<string[]>(['male', 'female', 'diverse']);
  const [minimumRating, setMinimumRating] = useState<number | ''>('');
  const [joinMode, setJoinMode] = useState<'direct' | 'request'>('request');

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
      setDescription('');
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
      setSelectedCategory(language === 'de' ? 'Sonstiges' : 'Sonstiges');
      setRequireProfilePicture(false);
      setRequireVerification(false);
      setMinAge('');
      setMaxAge('');
      setAllowedGenders(['male', 'female', 'diverse']);
      setMinimumRating('');
      setJoinMode('request');
    }
  }, [initialPlace, open]);

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
      toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: language === 'de' ? 'GPS wird nicht unterstützt.' : 'GPS not supported.' });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (place) {
        setSelectedLocation(place);
        toast({ title: language === 'de' ? 'Standort verifiziert' : 'Location verified', description: place.address });
      }
      setIsLocating(false);
    }, (err) => {
      setIsLocating(false);
      toast({ variant: 'destructive', title: language === 'de' ? 'GPS Fehler' : 'GPS Error', description: language === 'de' ? 'Standort konnte nicht ermittelt werden.' : 'Location could not be determined.' });
    }, { enableHighAccuracy: true, timeout: 10000 });
  };

  /**
   * Validierungs-Logik für Opening Hours
   */
  const openingHoursWarning = useMemo(() => {
    if (!selectedLocation?.openingHours || isTimeFlexible) return null;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const selectedDayIdx = selectedDate.getDay(); // 0=Sun, 1=Mon...
    const dayMap: Record<number, string> = { 0: 'Su', 1: 'Mo', 2: 'Tu', 3: 'We', 4: 'Th', 5: 'Fr', 6: 'Sa' };
    const currentDayCode = dayMap[selectedDayIdx];

    const ohStr = selectedLocation.openingHours.toLowerCase();
    
    // Einfache Heuristik: Prüfe ob der Wochentag im OSM String vorkommt
    // Und prüfe grob ob die Zeit im Intervall liegt (sehr vereinfacht für MVP)
    const segments = ohStr.split(';');
    const relevantSegment = segments.find(s => s.includes(currentDayCode.toLowerCase()) || s.includes('mo-su') || s.includes('mo-fr') && selectedDayIdx >= 1 && selectedDayIdx <= 5);

    if (relevantSegment) {
      const timeMatch = relevantSegment.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
      if (timeMatch) {
        const [startH, startM] = timeMatch[1].split(':').map(Number);
        const [endH, endM] = timeMatch[2].split(':').map(Number);
        
        const currentVal = hours * 60 + minutes;
        const startVal = startH * 60 + startM;
        const endVal = endH * 60 + endM;
        const locale = language === 'de' ? de : enUS;

        if (currentVal < startVal || currentVal > endVal) {
          const dayName = format(selectedDate, 'EEEE', { locale });
          return language === 'de' 
            ? `Der Ort hat laut Daten am ${dayName} von ${timeMatch[1]} bis ${timeMatch[2]} Uhr geöffnet. Deine Zeit liegt evtl. außerhalb.`
            : `According to the data, the place is open on ${dayName} from ${timeMatch[1]} to ${timeMatch[2]}. Your time might be outside these hours.`;
        }
      }
    } else if (ohStr.includes('closed') && ohStr.includes(currentDayCode.toLowerCase())) {
        const dayName = format(selectedDate, 'EEEE', { locale: language === 'de' ? de : enUS });
        return language === 'de'
            ? `Der Ort ist am ${dayName} voraussichtlich geschlossen.`
            : `The place is likely closed on ${dayName}.`;
    }

    return null;
  }, [selectedLocation, selectedDate, selectedTime, isTimeFlexible]);

  const handleCreate = async () => {
    if (!selectedLocation) return;

    const isRange = !!(isDateFlexible && selectedRange.from);
    const isSingleDay = !!(!isDateFlexible && selectedDate);

    if (!isRange && !isSingleDay) return;

    let derivedCategory: ActivityCategory = selectedCategory;
    
    // Auto-override category if specific place has clear tags and it's not custom mode
    if (isSpecificPlaceMode) {
        const cats = selectedLocation.categories || [];
        if (cats.some(c => c.startsWith('sport'))) derivedCategory = language === 'de' ? 'Sport' : 'Sport';
        else if (cats.some(c => c.startsWith('catering'))) derivedCategory = language === 'de' ? 'Networking' : 'Networking';
        else if (cats.some(c => c.startsWith('tourism'))) derivedCategory = language === 'de' ? 'Kultur' : 'Kultur';
        else if (cats.some(c => c.startsWith('leisure'))) derivedCategory = language === 'de' ? 'Outdoor' : 'Outdoor';
    }


    let startDate = isRange ? selectedRange.from! : selectedDate;
    let endDate = isRange ? selectedRange.to : undefined;

    let finalDate = new Date(startDate);
    const timeIsFlexible = !!(isTimeFlexible || isRange);

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
    const finalTitle = isSpecificPlaceMode ? (selectedLocation?.name || (language === 'de' ? 'Aktivität' : 'Activity')) : activityTitle;

    const reqs: any = {};
    if (minAge !== '' || maxAge !== '') {
      reqs.ageRange = {};
      if (minAge !== '') reqs.ageRange.min = Number(minAge);
      if (maxAge !== '') reqs.ageRange.max = Number(maxAge);
    }
    if (allowedGenders.length < 3) {
      reqs.gender = allowedGenders;
    }
    if (requireProfilePicture) {
      reqs.requireProfilePicture = true;
    }
    if (requireVerification) {
      reqs.requireVerification = true;
    }
    if (minimumRating !== '') {
      reqs.minimumRating = Number(minimumRating);
    }

    const finalRequirements = Object.keys(reqs).length > 0 ? reqs : undefined;

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
      derivedCategory,
      description,
      finalRequirements,
      joinMode
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
        toast({ title: language === 'de' ? "Token erhalten!" : "Token earned!" });
      } catch (err) {
        toast({ variant: "destructive", title: language === 'de' ? "Fehler" : "Error" });
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
            {isSpecificPlaceMode ? (language === 'de' ? 'Aktivität planen' : 'Plan activity') : (language === 'de' ? 'Community Aktivität' : 'Community Activity')}
          </SheetTitle>
          <SheetDescription className="text-sm font-medium text-muted-foreground px-4">
            {isSpecificPlaceMode 
              ? (language === 'de' ? `Plane ein Treffen bei ${initialPlace?.name}` : `Plan a meetup at ${initialPlace?.name}`) 
              : (language === 'de' ? 'Erstelle ein Event an einem Ort deiner Wahl.' : 'Create an event at a place of your choice.')}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
          {/* Sektion 1: Name & Ort */}
          <div className="space-y-4">
            {!isSpecificPlaceMode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{language === 'de' ? 'Was hast du vor?' : 'What are you planning?'}</Label>
                  <Input
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                    placeholder={language === 'de' ? "z.B. Street-Photography oder Yoga" : "e.g. Street Photography or Yoga"}
                    className="h-14 text-lg rounded-2xl border-none bg-secondary/50 font-bold focus-visible:ring-primary/20"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{language === 'de' ? 'Icon wählen' : 'Choose icon'}</Label>
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 hide-scrollbar">
                    {[
                      { id: 'Sport', icon: Dumbbell, label: language === 'de' ? 'Sport' : 'Sports' },
                      { id: 'Outdoor', icon: Trees, label: language === 'de' ? 'Outdoor' : 'Outdoor' },
                      { id: 'Party', icon: Flame, label: language === 'de' ? 'Party' : 'Party' },
                      { id: 'Kultur', icon: Landmark, label: language === 'de' ? 'Kultur' : 'Culture' },
                      { id: 'Gaming', icon: Gamepad2, label: language === 'de' ? 'Gaming' : 'Gaming' },
                      { id: 'Tech', icon: Zap, label: language === 'de' ? 'Tech' : 'Tech' },
                      { id: 'Networking', icon: Coffee, label: language === 'de' ? 'Networking' : 'Networking' },
                      { id: 'Sonstiges', icon: Star, label: language === 'de' ? 'Andere' : 'Other' },
                    ].map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id as ActivityCategory)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-2 flex-shrink-0 w-20 h-20 rounded-2xl transition-all duration-200 border-2",
                            isSelected 
                              ? "bg-primary/10 border-primary shadow-lg shadow-primary/5" 
                              : "bg-secondary/30 border-transparent hover:bg-secondary/50"
                          )}
                        >
                          <Icon className={cn("h-6 w-6", isSelected ? "text-primary" : "text-muted-foreground")} />
                          <span className={cn("text-[10px] font-black uppercase tracking-tighter", isSelected ? "text-primary" : "text-muted-foreground")}>
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{language === 'de' ? 'Wo treffen wir uns?' : 'Where do we meet?'}</Label>
              
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
                        placeholder={language === 'de' ? "Ort oder Adresse suchen..." : "Search place or address..."}
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
                      {language === 'de' ? 'Meinen Standort nutzen' : 'Use my location'}
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
            
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{language === 'de' ? 'Zusätzliche Infos (Optional)' : 'Additional Info (Optional)'}</Label>
              <div className="relative">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 150))}
                  placeholder={language === 'de' ? "Max. 150 Zeichen..." : "Max 150 characters..."}
                  className="min-h-[80px] resize-none rounded-2xl border-none bg-secondary/50 font-medium text-sm focus-visible:ring-primary/20 pb-6"
                />
                <span className="absolute bottom-2 right-3 text-[10px] font-bold text-muted-foreground">
                  {description.length}/150
                </span>
              </div>
            </div>
          </div>

          {/* Sektion 2: Datum & Zeit */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-border p-4 shadow-sm bg-card/50">
              <div className="space-y-0.5">
                <Label htmlFor="date-flexible" className="text-base font-bold">{language === 'de' ? 'Datumsflexibel' : 'Flexible date'}</Label>
                <p className="text-xs text-muted-foreground font-medium">{language === 'de' ? 'Genaues Datum steht noch nicht fest' : 'Fixed date not set yet'}</p>
              </div>
              <Switch id="date-flexible" checked={isDateFlexible} onCheckedChange={setIsDateFlexible} />
            </div>

            <div className="rounded-2xl border border-border p-4 bg-card/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))} className="rounded-xl h-8 w-8">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-sm font-black uppercase tracking-widest">{format(currentMonthDate, language === 'de' ? 'MMMM yyyy' : 'MMMM yyyy', { locale: language === 'de' ? de : enUS })}</h3>
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

            {!isDateFlexible && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-border p-4 shadow-sm bg-card/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="time-flexible" className="text-base font-bold">{language === 'de' ? 'Zeitlich flexibel' : 'Flexible time'}</Label>
                    <p className="text-xs text-muted-foreground font-medium">{language === 'de' ? 'Uhrzeit wird im Chat besprochen' : 'Time will be discussed in chat'}</p>
                  </div>
                  <Switch id="time-flexible" checked={isTimeFlexible} onCheckedChange={setIsTimeFlexible} />
                </div>

                {!isTimeFlexible && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">{language === 'de' ? 'Uhrzeit wählen' : 'Select time'}</Label>
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="h-14 rounded-2xl border-none bg-secondary/50 font-black text-lg focus-visible:ring-primary/20"
                    />
                    
                    {/* MODUL: Opening Hours Warning */}
                    {openingHoursWarning && (
                      <div className="mt-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3 animate-in fade-in zoom-in-95 duration-500">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                          {openingHoursWarning}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sektion 3: Gating (Participants & Payment) */}
          <div className="space-y-6 pt-4 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground">{language === 'de' ? 'Teilnehmerlimit' : 'Participant limit'}</Label>
              </div>
              {!isPremium && <Badge className="bg-primary/10 text-primary text-[10px] font-black border-none uppercase">{language === 'de' ? 'Limit' : 'Limit'}: {MAX_FREE_PARTICIPANTS}</Badge>}
            </div>

            <div className="flex items-center gap-6 bg-secondary/30 p-4 rounded-2xl">
              <Slider value={[maxParticipants]} max={isPremium ? 50 : MAX_FREE_PARTICIPANTS} min={2} onValueChange={(val) => setMaxParticipants(val[0])} className="flex-1" />
              <div className="min-w-[40px] text-center"><span className="text-2xl font-black text-primary">{maxParticipants}</span></div>
            </div>

            {/* Beitritts-Modus */}
            <div className="space-y-3">
              <Label className="text-sm font-black uppercase tracking-widest text-muted-foreground pl-1">{language === 'de' ? 'Beitritts-Modus' : 'Join Mode'}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setJoinMode('request')}
                  className={cn(
                    "h-14 rounded-2xl font-bold flex flex-col items-center justify-center gap-0.5 border-2 transition-all",
                    joinMode === 'request' 
                      ? "border-primary bg-primary/5 text-primary shadow-sm" 
                      : "border-border/50 text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  <span>{language === 'de' ? 'Auf Anfrage' : 'By Request'}</span>
                  <span className="text-[10px] opacity-70 font-medium">{language === 'de' ? 'Du entscheidest' : 'You decide'}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setJoinMode('direct')}
                  className={cn(
                    "h-14 rounded-2xl font-bold flex flex-col items-center justify-center gap-0.5 border-2 transition-all",
                    joinMode === 'direct' 
                      ? "border-primary bg-primary/5 text-primary shadow-sm" 
                      : "border-border/50 text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  <span>{language === 'de' ? 'Direkt' : 'Direct'}</span>
                  <span className="text-[10px] opacity-70 font-medium">{language === 'de' ? 'Jeder kann rein' : 'Anyone can join'}</span>
                </Button>
              </div>
            </div>

            {/* Sektion 4: Teilnahmebedingungen (Gating) */}
            <Accordion type="single" collapsible className="w-full bg-secondary/10 rounded-2xl border border-border/50 px-4">
              <AccordionItem value="requirements" className="border-none">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <span className="text-sm font-black uppercase tracking-widest text-slate-800">{language === 'de' ? 'Teilnahmebedingungen' : 'Requirements'}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2 pb-4">
                  
                  {/* Profilbild */}
                  <div className="flex items-center justify-between bg-white/50 p-4 rounded-xl border border-white">
                    <div className="flex items-center gap-3">
                      <UserCircle className="h-5 w-5 text-primary" />
                      <div>
                        <Label className="font-bold">{language === 'de' ? 'Profilbild erforderlich' : 'Profile picture required'}</Label>
                        <p className="text-xs text-muted-foreground">{language === 'de' ? 'Nur Nutzer mit Bild' : 'Only users with photo'}</p>
                      </div>
                    </div>
                    <Switch checked={requireProfilePicture} onCheckedChange={setRequireProfilePicture} />
                  </div>

                  {/* Verifizierung */}
                  <div className="flex items-center justify-between bg-white/50 p-4 rounded-xl border border-white">
                    <div className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-primary" />
                      <div>
                        <Label className="font-bold">{language === 'de' ? 'Verifizierung (KYC)' : 'Verified (KYC)'}</Label>
                        <p className="text-xs text-muted-foreground">{language === 'de' ? 'Echte Identität geprüft' : 'Real identity verified'}</p>
                      </div>
                    </div>
                    <Switch checked={requireVerification} onCheckedChange={setRequireVerification} />
                  </div>

                  {/* Alter */}
                  <div className="bg-white/50 p-4 rounded-xl border border-white space-y-3">
                    <Label className="font-bold text-sm">{language === 'de' ? 'Altersbegrenzung' : 'Age limit'}</Label>
                    <div className="flex items-center gap-3">
                      <Input type="number" placeholder="Min" value={minAge} onChange={(e) => setMinAge(e.target.value === '' ? '' : parseInt(e.target.value))} className="bg-white border-none text-center font-bold h-12" />
                      <span className="text-muted-foreground font-black">-</span>
                      <Input type="number" placeholder="Max" value={maxAge} onChange={(e) => setMaxAge(e.target.value === '' ? '' : parseInt(e.target.value))} className="bg-white border-none text-center font-bold h-12" />
                    </div>
                  </div>

                  {/* Geschlecht */}
                  <div className="bg-white/50 p-4 rounded-xl border border-white space-y-3">
                    <Label className="font-bold text-sm">{language === 'de' ? 'Geschlecht' : 'Gender'}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {['male', 'female', 'diverse'].map((g) => {
                        const labels: any = { male: language === 'de' ? 'Männer' : 'Men', female: language === 'de' ? 'Frauen' : 'Women', diverse: language === 'de' ? 'Divers' : 'Diverse' };
                        const isSelected = allowedGenders.includes(g);
                        return (
                          <Badge 
                            key={g} 
                            variant="outline" 
                            className={cn("cursor-pointer border-none text-xs font-bold py-2 px-4 rounded-xl transition-all", isSelected ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white text-muted-foreground hover:bg-slate-50")}
                            onClick={() => {
                              if (isSelected && allowedGenders.length > 1) {
                                setAllowedGenders(allowedGenders.filter(x => x !== g));
                              } else if (!isSelected) {
                                setAllowedGenders([...allowedGenders, g]);
                              }
                            }}
                          >
                            {labels[g]}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bewertung */}
                  <div className="bg-white/50 p-4 rounded-xl border border-white space-y-3">
                    <Label className="font-bold flex items-center gap-2 text-sm">
                      <StarHalf className="h-4 w-4 text-amber-500" />
                      {language === 'de' ? 'Mindestbewertung' : 'Minimum Rating'}
                    </Label>
                    <div className="flex items-center gap-4">
                      <Slider value={[Number(minimumRating) || 0]} max={5} min={0} step={0.1} onValueChange={(val) => setMinimumRating(val[0] === 0 ? '' : val[0])} className="flex-1" />
                      <span className="font-black text-lg text-primary w-8 text-right">{minimumRating ? Number(minimumRating).toFixed(1) : '0.0'}</span>
                    </div>
                  </div>

                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* 
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-2xl border border-border p-4 bg-card/50">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold flex items-center gap-2">{language === 'de' ? 'Bezahltes Event' : 'Paid event'} {!canMonetize && <Lock className="h-3 w-3" />}</Label>
                  <p className="text-xs text-muted-foreground">{language === 'de' ? 'Proof of Community' : 'Proof of Community'}: {currentFreeHosts}/{REQUIRED_FREE_HOSTS}</p>
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
            */}
          </div>

          {/* Sektion 4: Booster */}
          <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flame className={cn("h-5 w-5", isBoosted ? "text-orange-500" : "text-muted-foreground")} />
                <span className="font-black text-sm uppercase">{language === 'de' ? 'Booster Aktivieren' : 'Activate Booster'}</span>
              </div>
              <Switch checked={isBoosted} onCheckedChange={setIsBoosted} disabled={availableTokens < 1} />
            </div>
            {availableTokens < 1 && (
              <Button onClick={handleEarnToken} disabled={isWatchingAd} variant="outline" className="w-full h-12 rounded-xl font-black gap-2 mt-2 bg-white/50">
                {isWatchingAd ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                {language === 'de' ? 'Token verdienen' : 'Earn token'}
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
            {language === 'de' ? 'Aktivität jetzt erstellen' : 'Create activity now'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
