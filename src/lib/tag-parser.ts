'use client';

/**
 * @fileOverview Utility zur Bereinigung und Formatierung von Kategorien-Tags und Öffnungszeiten.
 * 
 * - formatTags: Filtert und lokalisiert Kategorien aus Geoapify/OSM.
 * - formatOpeningHours: Wandelt OSM-Format-Strings in lesbare deutsche Texte um.
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

  return specificTags.map(tag => {
    if (tagDictionary[tag]) {
      return tagDictionary[tag];
    }
    const parts = tag.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/_/g, ' ');
  });
};

/**
 * Formatiert den rohen OSM Opening Hours String in ein lesbares Format.
 */
export const formatOpeningHours = (raw?: string | null): string => {
  if (!raw) return '';
  
  // 1. Semikolons durch Trennpunkte ersetzen
  let formatted = raw.replace(/;/g, ' • ');
  
  // 2. Wochentage lokalisieren
  const dayMap: Record<string, string> = {
    'Mo': 'Mo', 'Tu': 'Di', 'We': 'Mi', 'Th': 'Do', 'Fr': 'Fr', 'Sa': 'Sa', 'Su': 'So',
    'PH': 'Feiertage', '24/7': '24/7'
  };
  
  Object.entries(dayMap).forEach(([en, de]) => {
    const regex = new RegExp(`\\b${en}\\b`, 'g');
    formatted = formatted.replace(regex, de);
  });

  // 3. Schlüsselbegriffe bereinigen
  formatted = formatted.replace(/\boff\b/gi, 'geschlossen');
  formatted = formatted.replace(/\bopen\b/gi, 'geöffnet');

  return formatted;
};
