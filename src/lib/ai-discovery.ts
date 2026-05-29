import type { Place, UserProfile } from './types';

export interface AISuggestion extends Place {
  aiReasonDe: string;
  aiReasonEn: string;
  matchScore: number; // 0 - 100
}

/**
 * Heuristische Analyse des Ortes basierend auf Wetter, Uhrzeit und Nutzerprofil.
 * Simuliert ein KI-Modell clientseitig.
 */
export function generateDiscoverySuggestions(
  places: Place[],
  userProfile: UserProfile | null,
  options: { weather?: 'sunny' | 'rainy' | 'cold' | 'cloudy'; time?: Date } = {}
): AISuggestion[] {
  if (!places || places.length === 0) return [];

  const weather = options.weather || 'sunny';
  const now = options.time || new Date();
  const currentHour = now.getHours();

  const userInterests = new Set(
    (userProfile?.interests || userProfile?.tinderInterests || []).map(i => i.toLowerCase())
  );
  const likedTags = new Set((userProfile?.likedTags || []).map(t => t.toLowerCase()));

  return places
    .map(place => {
      let score = 50; // Base score
      let reasonDe = 'Entdeckung des Tages';
      let reasonEn = 'Discovery of the day';

      const cats = place.categories.map(c => c.toLowerCase());
      const name = place.name.toLowerCase();

      // 1. Wetter-Heuristiken
      const isOutdoor = cats.some(c => c.includes('outdoor') || c.includes('park') || c.includes('nature') || c.includes('zoo') || c.includes('beach'));
      if (weather === 'rainy' || weather === 'cold') {
        if (isOutdoor) {
          score -= 30; // Weniger attraktiv bei Regen
        } else {
          score += 15;
          reasonDe = 'Perfekter Unterschlupf bei Schmuddelwetter 🌧️';
          reasonEn = 'Perfect escape from the rainy weather 🌧️';
        }
      } else if (weather === 'sunny') {
        if (isOutdoor) {
          score += 25;
          reasonDe = 'Genieße die Sonne an der frischen Luft! ☀️';
          reasonEn = 'Enjoy the sunshine in the fresh air! ☀️';
        }
      }

      // 2. Uhrzeit-Heuristiken
      const isNightlife = cats.some(c => c.includes('nightclub') || c.includes('pub') || c.includes('bar'));
      const isCafe = cats.some(c => c.includes('cafe') || c.includes('bakery'));
      
      if (currentHour >= 20 || currentHour < 4) { // Nacht
        if (isNightlife) {
          score += 20;
          reasonDe = 'Passt perfekt zu deinen Plänen für den Abend 🌙';
          reasonEn = 'Fits your late evening vibe perfectly 🌙';
        } else if (isCafe) {
          score -= 20; // Geschlossen oder unpassend
        }
      } else if (currentHour >= 7 && currentHour < 11) { // Morgen
        if (isCafe) {
          score += 20;
          reasonDe = 'Starte deinen Tag mit einem leckeren Frühstück ☕';
          reasonEn = 'Start your day with a delicious breakfast ☕';
        }
      }

      // 3. User Interessen Match
      let interestMatchCount = 0;
      cats.forEach(cat => {
        if (userInterests.has(cat) || likedTags.has(cat)) {
          interestMatchCount++;
        }
      });

      if (interestMatchCount > 0) {
        score += interestMatchCount * 10;
        reasonDe = 'Matcht mit deinen Lieblingsthemen! ⭐';
        reasonEn = 'Matches your saved interests! ⭐';
      }

      // 4. Rating Boost
      if (place.rating) {
        score += (place.rating - 3) * 10; // E.g. 5 stars adds 20, 3 stars adds 0
      }

      // Clamping score between 0 and 100
      const finalScore = Math.max(0, Math.min(100, Math.round(score)));

      return {
        ...place,
        aiReasonDe: reasonDe,
        aiReasonEn: reasonEn,
        matchScore: finalScore
      } as AISuggestion;
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);
}

/**
 * Filtert Orte nach einer bestimmten Stimmung (Mood).
 */
export function generateMoodSuggestions(
  places: Place[],
  mood: 'relax' | 'adventure' | 'social' | 'focus',
  userProfile: UserProfile | null
): AISuggestion[] {
  if (!places || places.length === 0) return [];

  return places
    .map(place => {
      let score = 50;
      let reasonDe = '';
      let reasonEn = '';

      const cats = place.categories.map(c => c.toLowerCase());

      switch (mood) {
        case 'relax':
          const isRelaxing = cats.some(c => c.includes('park') || c.includes('nature') || c.includes('spa') || c.includes('library') || c.includes('museum') || c.includes('cafe'));
          if (isRelaxing) {
            score += 35;
            reasonDe = 'Perfekt zum Entspannen & Abschalten 🧘';
            reasonEn = 'Perfect place to wind down and relax 🧘';
          }
          break;
        case 'adventure':
          const isAdventurous = cats.some(c => c.includes('theme_park') || c.includes('climbing') || c.includes('stadium') || c.includes('sport') || c.includes('zoo') || c.includes('escape'));
          if (isAdventurous) {
            score += 35;
            reasonDe = 'Für Abenteurer! Action & Spaß garantiert ⚡';
            reasonEn = 'For adventurers! Action & fun guaranteed ⚡';
          }
          break;
        case 'social':
          const isSocial = cats.some(c => c.includes('nightclub') || c.includes('bar') || c.includes('pub') || c.includes('restaurant') || c.includes('bowling'));
          if (isSocial) {
            score += 35;
            reasonDe = 'Toller Treffpunkt für gesellige Stunden 👥';
            reasonEn = 'Great spot to socialize and meet people 👥';
          }
          break;
        case 'focus':
          const isFocus = cats.some(c => c.includes('library') || c.includes('coworking') || c.includes('museum') || c.includes('cafe'));
          if (isFocus) {
            score += 35;
            reasonDe = 'Ruhige Umgebung zum Arbeiten oder Lernen 🧠';
            reasonEn = 'Quiet environment to focus and study 🧠';
          }
          break;
      }

      // Add user preference matching
      if (userProfile?.likedTags?.some(tag => cats.includes(tag.toLowerCase()))) {
        score += 15;
      }

      const finalScore = Math.max(0, Math.min(100, Math.round(score)));

      return {
        ...place,
        aiReasonDe: reasonDe || 'Passt gut zu deiner Stimmung',
        aiReasonEn: reasonEn || 'Matches your mood well',
        matchScore: finalScore
      } as AISuggestion;
    })
    .filter(s => s.matchScore > 55)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);
}

/**
 * Findet Orte, die sich perfekt für Dates eignen.
 */
export function generateDateIdeas(
  places: Place[],
  partnerInterests: string[] = []
): AISuggestion[] {
  if (!places || places.length === 0) return [];

  const partnerPrefs = new Set(partnerInterests.map(i => i.toLowerCase()));

  return places
    .map(place => {
      let score = 40;
      let reasonDe = 'Romantischer Treffpunkt ❤️';
      let reasonEn = 'Romantic meeting spot ❤️';

      const cats = place.categories.map(c => c.toLowerCase());

      const isRestaurant = cats.some(c => c.includes('restaurant'));
      const isBarOrCafe = cats.some(c => c.includes('bar') || c.includes('cafe') || c.includes('pub'));
      const isRomanticScenic = cats.some(c => c.includes('park') || c.includes('nature') || c.includes('attraction') || c.includes('spa'));
      const isCultural = cats.some(c => c.includes('cinema') || c.includes('museum') || c.includes('theatre'));

      if (isRestaurant) {
        score += 40;
        reasonDe = 'Kerzenschein & kulinarischer Genuss 🕯️';
        reasonEn = 'Candlelight and culinary delight 🕯️';
      } else if (isBarOrCafe) {
        score += 35;
        reasonDe = 'Entspannte Gespräche bei gutem Drink 🍷';
        reasonEn = 'Relaxed conversations over good drinks 🍷';
      } else if (isRomanticScenic) {
        score += 30;
        reasonDe = 'Spaziergang & tiefgründige Gespräche 🌲';
        reasonEn = 'Nice walk and deep conversations 🌲';
      } else if (isCultural) {
        score += 30;
        reasonDe = 'Gemeinsame Erlebnisse verbinden 🍿';
        reasonEn = 'Shared cultural experience connects 🍿';
      }

      // Check partner matching
      let partnerMatch = false;
      cats.forEach(cat => {
        if (partnerPrefs.has(cat)) {
          partnerMatch = true;
        }
      });

      if (partnerMatch) {
        score += 20;
        reasonDe = 'Erfüllt die Interessen deines Partners! ✨';
        reasonEn = 'Matches your partner\'s interests! ✨';
      }

      // High rated is great for dates
      if (place.rating && place.rating >= 4.2) {
        score += 10;
      }

      const finalScore = Math.max(0, Math.min(100, Math.round(score)));

      return {
        ...place,
        aiReasonDe: reasonDe,
        aiReasonEn: reasonEn,
        matchScore: finalScore
      } as AISuggestion;
    })
    .filter(s => s.matchScore > 60)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);
}
