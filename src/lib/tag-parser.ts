'use client';

/**
 * @fileOverview Utility zur Bereinigung und Formatierung von Kategorien-Tags.
 * 
 * - Filtert Tags basierend auf einer Whitelist an validen Root-Kategorien.
 * - Eliminiert hierarchische Redundanzen (z.B. löscht 'tourism', wenn 'tourism.sights' existiert).
 * - Übersetzt Kern-Kategorien über eine erweiterte Lokalisierungs-Matrix ins Deutsche.
 * - Formatiert Fallbacks (Letzter Teil des Pfads, Kapitalisierung, Unterstriche zu Leerzeichen).
 */

export const formatTags = (tags: string[]): string[] => {
  if (!tags || !Array.isArray(tags)) return [];

  // 1. Whitelist-Architektur für valide Root-Kategorien
  const validRoots = [
    'activity', 'commercial', 'catering', 'education', 'entertainment',
    'heritage', 'leisure', 'man_made', 'natural', 'national_park', 'pet',
    'tourism', 'religion', 'camping', 'beach', 'adult', 'building', 'ski',
    'sport', 'emergency'
  ];

  const cleanedTags = tags.filter(tag => {
    if (!tag) return false;
    const root = tag.split('.')[0].toLowerCase();
    return validRoots.includes(root);
  });

  // 2. Hierarchische Redundanzen filtern
  // Ein Tag bleibt nur, wenn kein anderer Tag existiert, der mit "dieserTag." beginnt.
  const specificTags = cleanedTags.filter(tag1 => {
    return !cleanedTags.some(tag2 => tag2 !== tag1 && tag2.startsWith(tag1 + '.'));
  });

  // 3. Erweiterte Lokalisierungs-Matrix (Deutsch)
  const tagDictionary: Record<string, string> = {
    'entertainment.cinema': 'Kino',
    'entertainment.culture.theatre': 'Theater',
    'leisure.park': 'Park',
    'tourism.sights.memorial': 'Denkmal',
    'entertainment.museum': 'Museum',
    'tourism.sights': 'Sehenswürdigkeit',
    'tourism.attraction': 'Attraktion',
    'man_made.bridge': 'Brücke',
    'building.historic': 'Historisches Gebäude',
    'emergency.defibrillator': 'Defibrillator',
    'religion.place_of_worship': 'Kultstätte',
    'adult.nightclub': 'Club/Disco',
    'catering.restaurant': 'Restaurant',
    'catering.cafe': 'Café',
    'catering.fast_food': 'Fast Food',
    'natural.water': 'Gewässer',
    'natural.beach': 'Strand',
    'beach': 'Strand',
    'heritage': 'Kulturerbe',
    'pet.dog_park': 'Hundewiese',
    'camping.caravan_site': 'Wohnmobilstellplatz',
    'camping.camp_site': 'Campingplatz',
    'building.tourism': 'Tourismus-Gebäude',
    'building.entertainment': 'Unterhaltungsstätte'
  };

  // 4. Transformation und Fallback
  return specificTags.map(tag => {
    if (tagDictionary[tag]) {
      return tagDictionary[tag];
    }
    // Fallback: Extrahiere String nach dem letzten Punkt, ersetze Unterstriche, kapitalisiere
    const parts = tag.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/_/g, ' ');
  });
};
