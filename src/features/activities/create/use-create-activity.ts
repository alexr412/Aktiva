import { useState, useEffect, useMemo, useRef } from 'react';
import type { Place, ActivityCategory } from '@/lib/types';
import { isPremiumActive, getParticipantLimit } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from '@/contexts/location-context';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { earnToken } from '@/lib/firebase/firestore';
import { reverseGeocode, autocompletePlaces } from '@/lib/geoapify';
import { startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import {
  buildActivityPayload,
  buildCallableActivityPayload,
  computeActivityPayloadFingerprint,
  isCreateActivityDisabled,
  computeOpeningHoursWarning,
  type CallableActivityPayload,
  type AllowedGender,
} from './activity-payload';

import { generateUUIDv4 } from '@/lib/uuid';
export { generateUUIDv4 };

const REQUIRED_FREE_HOSTS = 5;

export interface UseCreateActivityOptions {
  initialPlace: Place | null;
  open: boolean;
  onCreateActivity: (submission: CallableActivityPayload) => Promise<boolean>;
  initialTitle?: string;
  initialCategory?: string;
}

export function useCreateActivity(options: UseCreateActivityOptions) {
  const { initialPlace, open, onCreateActivity, initialTitle, initialCategory } = options;
  const { userProfile, user } = useAuth();
  const language = useLanguage();
  const { toast } = useToast();
  const { gateState, position } = useLocation();

  const [isCreating, setIsCreating] = useState(false);
  const operationIdRef = useRef<string | null>(null);
  const payloadFingerprintRef = useRef<string | null>(null);
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
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>(
    language === 'de' ? 'Sonstiges' : 'Sonstiges'
  );

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
  const [allowedGenders, setAllowedGenders] = useState<AllowedGender[]>(['male', 'female', 'diverse']);
  const [minimumRating, setMinimumRating] = useState<number | ''>('');
  const [joinMode, setJoinMode] = useState<'direct' | 'request'>('request');

  const isPremium = isPremiumActive(userProfile);
  const participantLimit = getParticipantLimit(userProfile);
  const availableTokens = userProfile?.tokens || 0;
  const canBoost = availableTokens > 0;

  // Proof of Community logic
  const currentFreeHosts = userProfile?.successfulFreeHosts || 0;
  const canMonetize = currentFreeHosts >= REQUIRED_FREE_HOSTS;

  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isUnauthenticated = !user;
  const isOnboardingIncomplete = user && userProfile?.onboardingCompleted !== true;
  const isBanned = user && userProfile?.isBanned === true;

  // Kontext-Entscheidung
  const isSpecificPlaceMode = !!initialPlace;

  useEffect(() => {
    if (open) {
      setIsCreating(false);
      setSelectedLocation(initialPlace);
      setActivityTitle(initialTitle || '');
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
      setSelectedCategory((initialCategory as any) || (language === 'de' ? 'Sonstiges' : 'Sonstiges'));
      setRequireProfilePicture(false);
      setRequireVerification(false);
      setMinAge('');
      setMaxAge('');
      setAllowedGenders(['male', 'female', 'diverse']);
      setMinimumRating('');
      setJoinMode('request');
    } else {
      operationIdRef.current = null;
      payloadFingerprintRef.current = null;
    }
  }, [initialPlace, open, initialTitle, initialCategory, language]);

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

  const handleGetCurrentLocation = async () => {
    if (gateState !== 'granted' || !position) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: language === 'de' ? 'Standort nicht verfügbar.' : 'Location not available.',
      });
      return;
    }
    setIsLocating(true);
    try {
      const place = await reverseGeocode(position.latitude, position.longitude);
      if (place) {
        setSelectedLocation(place);
        toast({ title: language === 'de' ? 'Standort verifiziert' : 'Location verified', description: place.address });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'GPS Fehler' : 'GPS Error',
        description: language === 'de' ? 'Standort konnte nicht ermittelt werden.' : 'Location could not be determined.',
      });
    } finally {
      setIsLocating(false);
    }
  };

  const openingHoursWarning = useMemo(() => {
    return computeOpeningHoursWarning(selectedLocation, selectedDate, selectedTime, isTimeFlexible, language);
  }, [selectedLocation, selectedDate, selectedTime, isTimeFlexible, language]);

  const handleCreate = async () => {
    const payload = buildActivityPayload({
      selectedLocation,
      activityTitle,
      description,
      selectedCategory,
      selectedDate,
      selectedRange,
      selectedTime,
      isTimeFlexible,
      isDateFlexible,
      maxParticipants,
      isBoosted,
      isSpecificPlaceMode,
      minAge,
      maxAge,
      allowedGenders,
      requireProfilePicture,
      requireVerification,
      minimumRating,
      joinMode,
      language,
    });

    if (!payload) return;

    const isPlaceBased = Boolean(payload.selectedLocation?.id && payload.selectedLocation?.name && !payload.selectedLocation.id.startsWith('custom'));
    const placeIdVal = isPlaceBased ? payload.selectedLocation.id : undefined;

    const rawBusinessPayload = buildCallableActivityPayload({
      operationId: 'temp',
      startDate: payload.startDate,
      endDate: payload.endDate,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      placeId: placeIdVal,
      customLocationName: !isPlaceBased ? payload.title : undefined,
      place: payload.selectedLocation,
      isTimeFlexible: payload.timeIsFlexible,
      maxParticipants: payload.maxParticipants,
      requirements: payload.requirements,
      joinMode: payload.joinMode,
      isBoosted: payload.isBoosted,
    });

    const currentFingerprint = await computeActivityPayloadFingerprint(rawBusinessPayload);

    if (payloadFingerprintRef.current === currentFingerprint && operationIdRef.current) {
      // Reuse existing operationId for retries of exact same payload
    } else {
      operationIdRef.current = generateUUIDv4();
      payloadFingerprintRef.current = currentFingerprint;
    }

    setIsCreating(true);
    const finalCallablePayload: CallableActivityPayload = {
      ...rawBusinessPayload,
      operationId: operationIdRef.current,
    };

    const success = await onCreateActivity(finalCallablePayload);
    if (!success) {
      setIsCreating(false);
    } else {
      operationIdRef.current = null;
      payloadFingerprintRef.current = null;
    }
  };

  const handleEarnToken = async () => {
    if (!user) return;
    setIsWatchingAd(true);
    setTimeout(async () => {
      try {
        const adWatchId = `ad_${user.uid}_${Date.now()}`;
        await earnToken(user.uid, adWatchId);
        toast({ title: language === 'de' ? 'Token erhalten!' : 'Token earned!' });
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: language === 'de' ? 'Fehler' : 'Error',
          description: err.message || (language === 'de' ? 'Konnte Token nicht gutschreiben.' : 'Could not award token.'),
        });
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

  const isCreateDisabled = isCreateActivityDisabled({
    isCreating,
    isUnauthenticated: !!isUnauthenticated,
    isOnboardingIncomplete: !!isOnboardingIncomplete,
    isBanned: !!isBanned,
    selectedLocation,
    isSpecificPlaceMode,
    activityTitle,
    isDateFlexible,
    selectedRange,
    selectedDate,
  });

  return {
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
    firstDayOfMonth,
    lastDayOfMonth,
    days,
    isCreateDisabled,
    language,
    userProfile,
  };
}
