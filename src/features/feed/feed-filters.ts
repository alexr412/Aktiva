import type { Place, UserProfile } from '@/lib/types';
import { hasPremiumFeature } from '@/lib/types';

export function isOpenNow(openingHours: string | null | undefined, now = new Date()): boolean {
  if (!openingHours) return false;
  if (openingHours.toLowerCase().includes('24/7')) return true;

  try {
    const dayNames = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
    const currentDay = now.getDay();
    const previousDay = (currentDay + 6) % 7;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parts = openingHours.toLowerCase().split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const days = new Set<number>();
      const dayPattern = /\b(su|mo|tu|we|th|fr|sa)\b(?:\s*-\s*\b(su|mo|tu|we|th|fr|sa)\b)?/g;
      for (const match of trimmed.matchAll(dayPattern)) {
        const startDay = dayNames.indexOf(match[1]);
        const endDay = match[2] ? dayNames.indexOf(match[2]) : startDay;
        for (let day = startDay; ; day = (day + 1) % 7) {
          days.add(day);
          if (day === endDay) break;
        }
      }
      const appliesOn = (day: number) => days.size === 0 || days.has(day);
      // Every comma-separated interval matters. Overnight intervals belong to
      // the day they start on, so their early-morning part uses yesterday.
      for (const timeMatch of trimmed.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)) {
        const startHour = Number(timeMatch[1]);
        const startMinute = Number(timeMatch[2]);
        const endHour = Number(timeMatch[3]);
        const endMinute = Number(timeMatch[4]);
        if (startHour > 23 || endHour > 24 || startMinute > 59 || endMinute > 59 || (endHour === 24 && endMinute !== 0)) continue;
        const startMin = startHour * 60 + startMinute;
        const endMin = endHour * 60 + endMinute;
        if (endMin < startMin) {
          if ((appliesOn(currentDay) && currentMinutes >= startMin) || (appliesOn(previousDay) && currentMinutes < endMin)) {
            return true;
          }
        } else {
          if (appliesOn(currentDay) && currentMinutes >= startMin && currentMinutes < endMin) {
            return true;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error parsing opening hours:', err);
  }
  return false;
}

export function applyPremiumFeedFilters(
  places: Place[],
  activePremiumFilters: string[] | undefined,
  userProfile: UserProfile | null | undefined
): Place[] {
  if (!activePremiumFilters || activePremiumFilters.length === 0) return places;
  if (!hasPremiumFeature(userProfile as any, 'advanced_filters')) return places;

  return places.filter(place => {
    return activePremiumFilters.every(filterId => {
      if (filterId === 'only_open_now') {
        return isOpenNow(place.openingHours);
      }
      if (filterId === 'hidden_gems') {
        const hasRatingMatch = typeof place.rating === 'number' && place.rating >= 4.2;
        const hasVotesMatch = typeof place.upvotes === 'number' && place.upvotes >= 1 && (!place.downvotes || place.downvotes === 0);
        return (hasRatingMatch || hasVotesMatch) && !place.categories.some(cat => cat.startsWith('tourism.attraction'));
      }
      if (filterId === 'high_rated') {
        return typeof place.rating === 'number' && place.rating >= 4.4;
      }
      if (filterId === 'outdoor_only') {
        return place.categories.some(cat =>
          cat.includes('outdoor') || cat.includes('nature') || cat.includes('park') || cat.includes('beach') || cat.includes('zoo')
        );
      }
      if (filterId === 'quiet_places') {
        return place.categories.every(cat =>
          !['party', 'nightclub', 'bar', 'pub', 'stadium', 'arcade', 'casino', 'entertainment'].some(bad => cat.includes(bad))
        );
      }
      if (filterId === 'date_ideas') {
        return place.categories.some(cat =>
          ['catering.restaurant', 'catering.cafe', 'catering.bar', 'entertainment.cinema', 'tourism.sights', 'entertainment.museum', 'leisure.spa'].some(target => cat === target || cat.startsWith(target + '.'))
        );
      }
      if (filterId === 'group_activities') {
        return place.categories.some(cat =>
          ['sport', 'entertainment.escape_game', 'entertainment.bowling_alley', 'entertainment.miniature_golf', 'entertainment.theme_park', 'sport.stadium'].some(target => cat === target || cat.startsWith(target + '.'))
        );
      }
      return true;
    });
  });
}
