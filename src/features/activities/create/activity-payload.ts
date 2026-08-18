import type { Place, ActivityCategory } from '@/lib/types';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

export interface BuildActivityPayloadOptions {
  selectedLocation: Place | null;
  activityTitle: string;
  description: string;
  selectedCategory: ActivityCategory;
  selectedDate: Date;
  selectedRange: { from?: Date; to?: Date };
  selectedTime: string;
  isTimeFlexible: boolean;
  isDateFlexible: boolean;
  maxParticipants: number;
  isBoosted: boolean;
  isPaid: boolean;
  price: number;
  isSpecificPlaceMode: boolean;
  minAge: number | '';
  maxAge: number | '';
  allowedGenders: string[];
  requireProfilePicture: boolean;
  requireVerification: boolean;
  minimumRating: number | '';
  joinMode: 'direct' | 'request';
  language: string;
}

export interface ActivityPayloadResult {
  startDate: Date;
  endDate?: Date;
  timeIsFlexible: boolean;
  title: string;
  maxParticipants: number;
  isBoosted: boolean;
  isPaid: boolean;
  price: number;
  category: ActivityCategory;
  description: string;
  requirements?: {
    ageRange?: { min?: number; max?: number };
    gender?: string[];
    requireProfilePicture?: boolean;
    requireVerification?: boolean;
    minimumRating?: number;
  };
  joinMode: 'direct' | 'request';
  selectedLocation: Place;
}

export function buildActivityPayload(options: BuildActivityPayloadOptions): ActivityPayloadResult | null {
  const {
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
    isPaid,
    price,
    isSpecificPlaceMode,
    minAge,
    maxAge,
    allowedGenders,
    requireProfilePicture,
    requireVerification,
    minimumRating,
    joinMode,
    language,
  } = options;

  if (!selectedLocation) return null;

  const isRange = !!(isDateFlexible && selectedRange.from);
  const isSingleDay = !!(!isDateFlexible && selectedDate);

  if (!isRange && !isSingleDay) return null;

  let derivedCategory: ActivityCategory = selectedCategory;

  if (isSpecificPlaceMode) {
    const cats = selectedLocation.categories || [];
    if (cats.some((c) => c.startsWith('sport'))) derivedCategory = language === 'de' ? 'Sport' : 'Sport';
    else if (cats.some((c) => c.startsWith('catering'))) derivedCategory = language === 'de' ? 'Networking' : 'Networking';
    else if (cats.some((c) => c.startsWith('tourism'))) derivedCategory = language === 'de' ? 'Kultur' : 'Kultur';
    else if (cats.some((c) => c.startsWith('leisure'))) derivedCategory = language === 'de' ? 'Outdoor' : 'Outdoor';
  }

  const startDate = isRange ? selectedRange.from! : selectedDate;
  const rawEndDate = isRange ? selectedRange.to : undefined;

  const finalDate = new Date(startDate);
  const timeIsFlexible = !!(isTimeFlexible || isRange);

  if (!timeIsFlexible) {
    const [hours, minutes] = selectedTime.split(':').map(Number);
    finalDate.setHours(hours, minutes, 0, 0);
  } else {
    finalDate.setHours(0, 0, 0, 0);
  }

  let endDate: Date | undefined = undefined;
  if (rawEndDate) {
    endDate = new Date(rawEndDate);
    endDate.setHours(23, 59, 59, 999);
  }

  const finalTitle = isSpecificPlaceMode
    ? selectedLocation?.name || (language === 'de' ? 'Aktivität' : 'Activity')
    : activityTitle;

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

  return {
    startDate: finalDate,
    endDate,
    timeIsFlexible,
    title: finalTitle,
    maxParticipants,
    isBoosted,
    isPaid,
    price,
    category: derivedCategory,
    description,
    requirements: finalRequirements,
    joinMode,
    selectedLocation,
  };
}

export function isCreateActivityDisabled(options: {
  isCreating: boolean;
  isUnauthenticated: boolean;
  isOnboardingIncomplete: boolean;
  isBanned: boolean;
  selectedLocation: Place | null;
  isSpecificPlaceMode: boolean;
  activityTitle: string;
  isDateFlexible: boolean;
  selectedRange: { from?: Date; to?: Date };
  selectedDate: Date | null;
}): boolean {
  return (
    options.isCreating ||
    options.isUnauthenticated ||
    options.isOnboardingIncomplete ||
    options.isBanned ||
    !options.selectedLocation ||
    (!options.isSpecificPlaceMode && !options.activityTitle.trim()) ||
    (options.isDateFlexible ? !options.selectedRange.from : !options.selectedDate)
  );
}

export function computeOpeningHoursWarning(
  selectedLocation: Place | null,
  selectedDate: Date,
  selectedTime: string,
  isTimeFlexible: boolean,
  language: string
): string | null {
  if (!selectedLocation?.openingHours || isTimeFlexible) return null;

  const [hours, minutes] = selectedTime.split(':').map(Number);
  const selectedDayIdx = selectedDate.getDay(); // 0=Sun, 1=Mon...
  const dayMap: Record<number, string> = { 0: 'Su', 1: 'Mo', 2: 'Tu', 3: 'We', 4: 'Th', 5: 'Fr', 6: 'Sa' };
  const currentDayCode = dayMap[selectedDayIdx];

  const ohStr = selectedLocation.openingHours.toLowerCase();
  const segments = ohStr.split(';');
  const relevantSegment = segments.find(
    (s) =>
      s.includes(currentDayCode.toLowerCase()) ||
      s.includes('mo-su') ||
      (s.includes('mo-fr') && selectedDayIdx >= 1 && selectedDayIdx <= 5)
  );

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
}
