import type { Place, UserProfile } from '@/lib/types';
import { hasPremiumFeature } from '@/lib/types';

export function isOpenNow(openingHours: string | null | undefined): boolean {
  if (!openingHours) return false;
  if (openingHours.toLowerCase().includes('24/7')) return true;

  try {
    const now = new Date();
    const dayNames = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
    const currentDay = dayNames[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parts = openingHours.toLowerCase().split(';');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const dayRangeRegex = /([a-z]{2})\s*-\s*([a-z]{2})/;
      const singleDayRegex = /\b([a-z]{2})\b/g;

      const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (!timeMatch) continue;

      const startMin = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
      const endMin = parseInt(timeMatch[3], 10) * 60 + parseInt(timeMatch[4], 10);

      let daysMatch = false;
      const dayRange = trimmed.match(dayRangeRegex);
      if (dayRange) {
        const startDayIdx = dayNames.indexOf(dayRange[1]);
        const endDayIdx = dayNames.indexOf(dayRange[2]);
        if (startDayIdx !== -1 && endDayIdx !== -1) {
          const todayIdx = now.getDay();
          if (startDayIdx <= endDayIdx) {
            daysMatch = todayIdx >= startDayIdx && todayIdx <= endDayIdx;
          } else {
            daysMatch = todayIdx >= startDayIdx || todayIdx <= endDayIdx;
          }
        }
      } else {
        const singleDays = Array.from(trimmed.matchAll(singleDayRegex)).map(m => m[1]);
        if (singleDays.length > 0) {
          daysMatch = singleDays.includes(currentDay);
        } else {
          daysMatch = true;
        }
      }

      if (daysMatch) {
        if (endMin < startMin) {
          if (currentMinutes >= startMin || currentMinutes <= endMin) {
            return true;
          }
        } else {
          if (currentMinutes >= startMin && currentMinutes <= endMin) {
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
