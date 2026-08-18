'use client';

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
import {
  Loader2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Flame,
  PlayCircle,
  Coins,
  Users,
  CreditCard,
  Lock,
  MapPin,
  Search,
  Navigation,
  X,
  Check,
  AlertTriangle,
  Dumbbell,
  Zap,
  Landmark,
  Trees,
  Gamepad2,
  Coffee,
  Star,
  ShieldCheck,
  UserCircle,
  StarHalf,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCreateActivity } from '@/features/activities/create/use-create-activity';
import Link from 'next/link';
import { format, addMonths, subMonths, isSameMonth, isToday, isSameDay, getDate, isAfter } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

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
    joinMode?: 'direct' | 'request',
    selectedPlace?: Place | null
  ) => Promise<boolean>;
  initialTitle?: string;
  initialCategory?: string;
}

export function CreateActivityDialog({
  place: initialPlace,
  open,
  onOpenChange,
  onCreateActivity,
  initialTitle,
  initialCategory,
}: CreateActivityDialogProps) {
  const {
    isCreating,
    selectedLocation,
    setSelectedLocation,
    activityTitle,
    setActivityTitle,
    description,
    setDescription,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    isSearching,
    isLocating,
    handleSearch,
    handleGetCurrentLocation,
    currentMonthDate,
    setCurrentMonthDate,
    selectedDate,
    setSelectedDate,
    selectedRange,
    setSelectedRange,
    selectedTime,
    setSelectedTime,
    isTimeFlexible,
    setIsTimeFlexible,
    isDateFlexible,
    setIsDateFlexible,
    maxParticipants,
    setMaxParticipants,
    selectedCategory,
    setSelectedCategory,
    isBoosted,
    setIsBoosted,
    isWatchingAd,
    isPaid,
    setIsPaid,
    price,
    setPrice,
    requireProfilePicture,
    setRequireProfilePicture,
    requireVerification,
    setRequireVerification,
    minAge,
    setMinAge,
    maxAge,
    setMaxAge,
    allowedGenders,
    setAllowedGenders,
    minimumRating,
    setMinimumRating,
    joinMode,
    setJoinMode,
    isPremium,
    participantLimit,
    availableTokens,
    canBoost,
    currentFreeHosts,
    canMonetize,
    isLocal,
    isUnauthenticated,
    isOnboardingIncomplete,
    isBanned,
    isSpecificPlaceMode,
    openingHoursWarning,
    handleCreate,
    handleEarnToken,
    days,
    isCreateDisabled,
    language,
    userProfile,
  } = useCreateActivity({
    initialPlace,
    open,
    onCreateActivity,
    initialTitle,
    initialCategory,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[2.5rem] p-0 sm:max-w-md lg:!max-w-[1400px] mx-auto h-[92dvh] max-h-[92dvh] flex flex-col bg-background border-none shadow-2xl overflow-hidden">
        <div className="absolute left-1/2 top-3 h-1.5 w-12 -translate-x-1/2 rounded-full bg-muted/50" />
        
        <SheetHeader className="pt-10 lg:pt-5 px-6 lg:px-12 pb-2 lg:pb-1 text-center items-center shrink-0 lg:max-w-[1200px] lg:mx-auto lg:w-full">
          <div className="bg-primary/10 p-3 lg:p-2.5 rounded-2xl lg:rounded-xl mb-3 lg:mb-1.5">
            {isSpecificPlaceMode ? (
              <Clock className="h-6 w-6 lg:h-5 lg:w-5 text-primary" />
            ) : (
              <Navigation className="h-6 w-6 lg:h-5 lg:w-5 text-primary" />
            )}
          </div>
          <SheetTitle className="text-2xl lg:text-xl font-black tracking-tight">
            {isSpecificPlaceMode ? (language === 'de' ? 'Aktivität planen' : 'Plan activity') : (language === 'de' ? 'Community Aktivität' : 'Community Activity')}
          </SheetTitle>
          <SheetDescription className="text-sm font-medium text-muted-foreground px-4 lg:px-0">
            {isSpecificPlaceMode 
              ? (language === 'de' ? `Plane ein Treffen bei ${initialPlace?.name}` : `Plan a meetup at ${initialPlace?.name}`) 
              : (language === 'de' ? 'Erstelle ein Event an einem Ort deiner Wahl.' : 'Create an event at a place of your choice.')}
          </SheetDescription>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto px-6 lg:px-12 py-4 lg:py-6 space-y-8 lg:space-y-6">
          <div className="lg:max-w-[1200px] lg:mx-auto space-y-8 lg:space-y-6">
          {/* Sektion 1: Name & Ort */}
          <div className="space-y-4">
            {!isSpecificPlaceMode && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="activity-title-input" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{language === 'de' ? 'Was hast du vor?' : 'What are you planning?'}</Label>
                  <Input
                    id="activity-title-input"
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                    placeholder={language === 'de' ? 'z.B. Bouldern, Spikeball, Kaffee trinken...' : 'e.g. Bouldering, Spikeball, Coffee...'}
                    className="h-12 rounded-2xl bg-muted/30 border-muted-foreground/15 text-base font-semibold focus-visible:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{language === 'de' ? 'Kategorie' : 'Category'}</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Sport', label: language === 'de' ? 'Sport' : 'Sport', icon: Dumbbell },
                      { id: 'Outdoor', label: language === 'de' ? 'Outdoor' : 'Outdoor', icon: Trees },
                      { id: 'Kultur', label: language === 'de' ? 'Kultur' : 'Culture', icon: Landmark },
                      { id: 'Gaming', label: language === 'de' ? 'Gaming' : 'Gaming', icon: Gamepad2 },
                      { id: 'Networking', label: language === 'de' ? 'Networking' : 'Networking', icon: Coffee },
                      { id: 'Sonstiges', label: language === 'de' ? 'Sonstiges' : 'Other', icon: Zap },
                    ].map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id as ActivityCategory)}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all text-left",
                            isSelected 
                              ? "border-primary bg-primary/10 text-primary shadow-sm" 
                              : "border-muted/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{language === 'de' ? 'Ort der Aktivität' : 'Activity Location'}</Label>
                  {selectedLocation ? (
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div className="truncate">
                          <p className="text-sm font-bold text-foreground truncate">{selectedLocation.name}</p>
                          <p className="text-xs font-medium text-muted-foreground truncate">{selectedLocation.address}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedLocation(null)}
                        className="h-8 w-8 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => handleSearch(e.target.value)}
                          placeholder={language === 'de' ? 'Ort, Park, Cafe suchen...' : 'Search place, park, cafe...'}
                          className="h-11 pl-10 pr-10 rounded-xl bg-muted/30 border-muted-foreground/15 text-sm font-medium"
                        />
                        {isSearching && (
                          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGetCurrentLocation}
                        disabled={isLocating}
                        className="w-full h-10 rounded-xl border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold flex items-center justify-center gap-2"
                      >
                        {isLocating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Navigation className="h-4 w-4" />
                        )}
                        <span>{language === 'de' ? 'Aktuellen Standort verwenden' : 'Use current location'}</span>
                      </Button>

                      {searchResults.length > 0 && (
                        <div className="rounded-xl border bg-card p-1 shadow-md space-y-0.5 max-h-48 overflow-y-auto">
                          {searchResults.map((res) => (
                            <button
                              key={res.id}
                              type="button"
                              onClick={() => {
                                setSelectedLocation(res);
                                setSearchResults([]);
                                setSearchQuery('');
                              }}
                              className="w-full p-2.5 rounded-lg hover:bg-muted text-left text-xs flex items-center gap-2 transition-colors"
                            >
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="truncate">
                                <span className="font-bold block truncate">{res.name}</span>
                                <span className="text-[10px] text-muted-foreground block truncate">{res.address}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{language === 'de' ? 'Beschreibung & Infos' : 'Description & Info'}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={language === 'de' ? 'Details zur Aktivität, Mitzubringen, Treffpunkt-Infos...' : 'Details about activity, what to bring, meeting spot...'}
                className="min-h-[80px] rounded-2xl bg-muted/30 border-muted-foreground/15 text-sm font-medium resize-none focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* Sektion 2: Datum & Uhrzeit */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{language === 'de' ? 'Wann gehts los?' : 'When is it?'}</Label>
                <p className="text-xs text-muted-foreground ml-1 font-medium">{language === 'de' ? 'Wähle ein festes Datum oder einen Zeitraum.' : 'Select a date or range.'}</p>
              </div>
              <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsDateFlexible(false)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    !isDateFlexible ? "bg-background shadow text-foreground" : "text-muted-foreground"
                  )}
                >
                  {language === 'de' ? 'Tag' : 'Day'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDateFlexible(true)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                    isDateFlexible ? "bg-background shadow text-foreground" : "text-muted-foreground"
                  )}
                >
                  {language === 'de' ? 'Zeitraum' : 'Range'}
                </button>
              </div>
            </div>

            {/* Kalender */}
            <div className="rounded-2xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">
                  {format(currentMonthDate, 'MMMM yyyy', { locale: language === 'de' ? de : enUS })}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonthDate(subMonths(currentMonthDate, 1))}
                    className="h-7 w-7 rounded-lg"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonthDate(addMonths(currentMonthDate, 1))}
                    className="h-7 w-7 rounded-lg"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                  <span key={d} className="text-[10px] font-black uppercase text-muted-foreground py-1">
                    {d}
                  </span>
                ))}
                {days.map((day, idx) => {
                  const isSelectedSingle = !isDateFlexible && isSameDay(day, selectedDate);
                  const isRangeStart = isDateFlexible && selectedRange.from && isSameDay(day, selectedRange.from);
                  const isRangeEnd = isDateFlexible && selectedRange.to && isSameDay(day, selectedRange.to);
                  const isInRange = isDateFlexible && selectedRange.from && selectedRange.to && isAfter(day, selectedRange.from) && isAfter(selectedRange.to, day);
                  const isCurrentMonth = isSameMonth(day, currentMonthDate);

                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!isCurrentMonth}
                      onClick={() => {
                        if (!isDateFlexible) {
                          setSelectedDate(day);
                        } else {
                          if (!selectedRange.from || (selectedRange.from && selectedRange.to)) {
                            setSelectedRange({ from: day, to: undefined });
                          } else {
                            if (isAfter(day, selectedRange.from)) {
                              setSelectedRange({ from: selectedRange.from, to: day });
                            } else {
                              setSelectedRange({ from: day, to: undefined });
                            }
                          }
                        }
                      }}
                      className={cn(
                        "h-8 w-full rounded-lg text-xs font-bold flex items-center justify-center transition-all",
                        !isCurrentMonth && "opacity-20 cursor-not-allowed",
                        isCurrentMonth && "hover:bg-muted",
                        (isSelectedSingle || isRangeStart || isRangeEnd) && "bg-primary text-primary-foreground font-black shadow-sm hover:bg-primary/90",
                        isInRange && "bg-primary/20 text-primary rounded-none"
                      )}
                    >
                      {getDate(day)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Uhrzeit */}
            {!isDateFlexible && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-muted-foreground">{language === 'de' ? 'Uhrzeit festlegen' : 'Set Time'}</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="time-flex-switch" className="text-xs font-medium text-muted-foreground cursor-pointer">
                      {language === 'de' ? 'Flexibel / Den ganzen Tag' : 'Flexible / All day'}
                    </Label>
                    <Switch
                      id="time-flex-switch"
                      checked={isTimeFlexible}
                      onCheckedChange={setIsTimeFlexible}
                    />
                  </div>
                </div>

                {!isTimeFlexible && (
                  <Input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="h-11 rounded-xl bg-muted/30 border-muted-foreground/15 font-semibold text-center text-lg focus-visible:ring-primary"
                  />
                )}
              </div>
            )}

            {openingHoursWarning && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{openingHoursWarning}</span>
              </div>
            )}
          </div>

          {/* Sektion 3: Rahmenbedingungen & Monetarisierung */}
          <Accordion type="single" collapsible className="w-full border-t pt-4 space-y-4">
            {/* 1. Teilnehmer & Beitritt */}
            <AccordionItem value="participants" className="border rounded-2xl px-4 py-1 bg-card">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 text-left">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{language === 'de' ? 'Teilnehmer & Beitritt' : 'Participants & Join'}</p>
                    <p className="text-xs text-muted-foreground">{maxParticipants} {language === 'de' ? 'Personen' : 'People'} • {joinMode === 'direct' ? (language === 'de' ? 'Direkt' : 'Direct') : (language === 'de' ? 'Anfrage' : 'Request')}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-4 border-t mt-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>{language === 'de' ? 'Max. Teilnehmeranzahl' : 'Max Participants'}</span>
                    <span className="text-primary font-black">{maxParticipants}</span>
                  </div>
                  <Slider
                    value={[maxParticipants]}
                    min={2}
                    max={participantLimit}
                    step={1}
                    onValueChange={(vals) => setMaxParticipants(vals[0])}
                  />
                  {!isPremium && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Lock className="h-3 w-3 text-amber-500" />
                      <span>{language === 'de' ? 'Kostenlos max. 4 Personen. ' : 'Free max. 4 people. '}</span>
                      <Link href="/profile" className="text-primary font-bold hover:underline">
                        {language === 'de' ? 'Mehr mit Premium' : 'More with Premium'}
                      </Link>
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs font-bold text-muted-foreground">{language === 'de' ? 'Beitritts-Modus' : 'Join Mode'}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setJoinMode('request')}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-bold text-left transition-all",
                        joinMode === 'request' ? "border-primary bg-primary/10 text-primary" : "border-muted text-muted-foreground"
                      )}
                    >
                      <span className="block font-black">{language === 'de' ? 'Anfrage nötig' : 'Approval Required'}</span>
                      <span className="text-[10px] font-normal block opacity-80">{language === 'de' ? 'Du bestätigst jeden Teilnehmer' : 'You approve each participant'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setJoinMode('direct')}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs font-bold text-left transition-all",
                        joinMode === 'direct' ? "border-primary bg-primary/10 text-primary" : "border-muted text-muted-foreground"
                      )}
                    >
                      <span className="block font-black">{language === 'de' ? 'Sofort-Beitritt' : 'Direct Join'}</span>
                      <span className="text-[10px] font-normal block opacity-80">{language === 'de' ? 'Jeder kann sofort beitreten' : 'Anyone can join instantly'}</span>
                    </button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Voraussetzungen & Filter */}
            <AccordionItem value="requirements" className="border rounded-2xl px-4 py-1 bg-card">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 text-left">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{language === 'de' ? 'Teilnehmer-Kriterien' : 'Participant Requirements'}</p>
                    <p className="text-xs text-muted-foreground">{language === 'de' ? 'Alter, Geschlecht, Verifizierung' : 'Age, Gender, Verification'}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-4 border-t mt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold">{language === 'de' ? 'Profilbild erforderlich' : 'Profile picture required'}</Label>
                    <p className="text-[10px] text-muted-foreground">{language === 'de' ? 'Nur Nutzer mit echtem Foto' : 'Only users with real photo'}</p>
                  </div>
                  <Switch checked={requireProfilePicture} onCheckedChange={setRequireProfilePicture} />
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold">{language === 'de' ? 'Verifizierter Status' : 'Verified Status'}</Label>
                    <p className="text-[10px] text-muted-foreground">{language === 'de' ? 'Nur mit ID / Haken' : 'Only with ID / checkmark'}</p>
                  </div>
                  <Switch checked={requireVerification} onCheckedChange={setRequireVerification} />
                </div>

                <div className="space-y-2 border-t pt-3">
                  <Label className="text-xs font-bold text-muted-foreground">{language === 'de' ? 'Altersbeschränkung' : 'Age Restriction'}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minAge}
                      onChange={(e) => setMinAge(e.target.value ? Number(e.target.value) : '')}
                      className="h-9 text-xs rounded-xl"
                    />
                    <span className="text-xs font-bold text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxAge}
                      onChange={(e) => setMaxAge(e.target.value ? Number(e.target.value) : '')}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Push & Visibility Boost */}
            <AccordionItem value="boost" className="border rounded-2xl px-4 py-1 bg-card">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 text-left">
                  <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <span>{language === 'de' ? 'Event Boosten' : 'Boost Event'}</span>
                      <Badge variant="secondary" className="text-[9px] bg-amber-500/10 text-amber-600 font-bold px-1.5 py-0">Hot</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">{language === 'de' ? 'Erhöhe die Reichweite im Feed' : 'Increase reach in feed'}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-4 border-t mt-2">
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-bold">{language === 'de' ? '1 Token verbrauchen' : 'Use 1 Token'}</span>
                    </div>
                    <Badge variant="outline" className="text-xs font-bold">
                      {availableTokens} {language === 'de' ? 'verfügbar' : 'available'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {language === 'de' ? 'Deine Aktivität erscheint ganz oben im Feed aller Nutzer in deiner Nähe.' : 'Your activity appears at the top of the feed for users near you.'}
                  </p>
                  
                  {canBoost ? (
                    <Button
                      type="button"
                      variant={isBoosted ? "default" : "outline"}
                      onClick={() => setIsBoosted(!isBoosted)}
                      className={cn("w-full h-9 text-xs font-bold rounded-xl", isBoosted && "bg-amber-500 hover:bg-amber-600 text-white")}
                    >
                      {isBoosted ? (language === 'de' ? '✓ Boost aktiviert' : '✓ Boost active') : (language === 'de' ? 'Jetzt boosten (1 Token)' : 'Boost now (1 Token)')}
                    </Button>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isWatchingAd}
                        onClick={handleEarnToken}
                        className="w-full h-9 text-xs font-bold rounded-xl border-amber-500/40 text-amber-600 hover:bg-amber-500/10 flex items-center justify-center gap-2"
                      >
                        {isWatchingAd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                        <span>{language === 'de' ? 'Gratis Token durch Ad verdienen' : 'Earn free token via Ad'}</span>
                      </Button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 4. Monetarisierung / Micro-Ticketing */}
            <AccordionItem value="monetization" className="border rounded-2xl px-4 py-1 bg-card">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 text-left">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <span>{language === 'de' ? 'Kostenbeitrag / Ticket' : 'Cost Share / Ticket'}</span>
                      {!canMonetize && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </p>
                    <p className="text-xs text-muted-foreground">{language === 'de' ? 'Nimm Geld für dein Event ein' : 'Charge for your event'}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-4 border-t mt-2">
                {!canMonetize ? (
                  <div className="p-3.5 rounded-xl bg-muted/40 border space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-muted-foreground">{language === 'de' ? 'Proof of Community Status' : 'Proof of Community Status'}</span>
                      <span className="text-primary">{currentFreeHosts} / {REQUIRED_FREE_HOSTS} {language === 'de' ? 'Events' : 'Events'}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${Math.min(100, (currentFreeHosts / REQUIRED_FREE_HOSTS) * 100)}%` }} 
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {language === 'de' 
                        ? `Veranstalte noch ${REQUIRED_FREE_HOSTS - currentFreeHosts} kostenlose Treffen, um gebührenpflichtige Events freizuschalten.` 
                        : `Host ${REQUIRED_FREE_HOSTS - currentFreeHosts} more free meetups to unlock paid events.`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold">{language === 'de' ? 'Kostenpflichtiges Event' : 'Paid Event'}</Label>
                      <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                    </div>

                    {isPaid && (
                      <div className="space-y-2 pt-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span>{language === 'de' ? 'Preis pro Person' : 'Price per person'}</span>
                          <span className="text-emerald-500 font-black text-sm">{price} €</span>
                        </div>
                        <Slider
                          value={[price]}
                          min={1}
                          max={50}
                          step={1}
                          onValueChange={(vals) => setPrice(vals[0])}
                        />
                      </div>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          </div>
        </div>

        <SheetFooter className="p-6 lg:px-12 pt-3 pb-6 border-t bg-background shrink-0 lg:max-w-[1200px] lg:mx-auto lg:w-full">
          {isUnauthenticated ? (
            <Button
              asChild
              className="w-full h-12 rounded-2xl font-black text-sm bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
            >
              <Link href="/login">{language === 'de' ? 'Anmelden um Aktivität zu erstellen' : 'Log in to create activity'}</Link>
            </Button>
          ) : isOnboardingIncomplete ? (
            <Button
              asChild
              className="w-full h-12 rounded-2xl font-black text-sm bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
            >
              <Link href="/onboarding">{language === 'de' ? 'Onboarding abschließen' : 'Complete onboarding'}</Link>
            </Button>
          ) : isBanned ? (
            <Button
              disabled
              className="w-full h-12 rounded-2xl font-black text-sm bg-destructive text-destructive-foreground"
            >
              {language === 'de' ? 'Konto gesperrt' : 'Account banned'}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isCreateDisabled}
              onClick={handleCreate}
              className="w-full h-12 rounded-2xl font-black text-sm bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{language === 'de' ? 'Wird erstellt...' : 'Creating...'}</span>
                </>
              ) : (
                <span>{language === 'de' ? 'Aktivität jetzt veröffentlichen' : 'Publish activity now'}</span>
              )}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
