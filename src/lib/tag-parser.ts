'use client';

/**
 * @fileOverview Utility zur Bereinigung und Formatierung von Kategorien-Tags und Öffnungszeiten.
 * 
 * - formatTags: Filtert und lokalisiert Kategorien aus Geoapify/OSM.
 * - formatOpeningHours: Wandelt OSM-Format-Strings in lesbare deutsche Texte um.
 */

export const formatTags = (tags: string[], language: 'de' | 'en' = 'de'): string[] => {
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
  const tagDictionaryDE: Record<string, string> = {
    'entertainment.cinema': 'Kino',
    'entertainment.culture.theatre': 'Theater',
    'entertainment.museum': 'Museum',
    'entertainment.theme_park': 'Freizeitpark',
    'entertainment.zoo': 'Zoo',
    'leisure.park': 'Park',
    'leisure.playground': 'Spielplatz',
    'leisure.sports_centre': 'Sportzentrum',
    'leisure.swimming_pool': 'Schwimmbad',
    'tourism.sights.memorial': 'Denkmal',
    'tourism.sights': 'Sehenswürdigkeit',
    'tourism.attraction': 'Attraktion',
    'tourism.information': 'Tourist-Info',
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
    'building.entertainment': 'Unterhaltungsstätte',
    'activity.sport': 'Sportliche Aktivität',
    'sport': 'Sportstätte',
    'sport.soccer': 'Fußballplatz',
    'sport.tennis': 'Tennisplatz',
    'sport.swimming': 'Schwimmbad',
    'sport.basketball': 'Basketballplatz',
    'sport.fitness': 'Fitness-Station',
    'leisure.viewpoint': 'Aussichtspunkt',
    'tourism.viewpoint': 'Aussichtspunkt',
    'leisure.garden': 'Garten',
    'leisure.nature_reserve': 'Naturschutzgebiet',
    'leisure.beach_resort': 'Strandbad',
    'entertainment.aquarium': 'Aquarium',
    'entertainment.planetarium': 'Planetarium',
    'catering.bar': 'Bar/Pub',
    'catering.pub': 'Pub',
    'catering.ice_cream': 'Eisdiele',
    'catering.biergarten': 'Biergarten'
  };


  const tagDictionaryEN: Record<string, string> = {
    'entertainment.cinema': 'Cinema',
    'entertainment.culture.theatre': 'Theatre',
    'entertainment.museum': 'Museum',
    'entertainment.theme_park': 'Theme Park',
    'entertainment.zoo': 'Zoo',
    'leisure.park': 'Park',
    'leisure.playground': 'Playground',
    'leisure.sports_centre': 'Sports Centre',
    'leisure.swimming_pool': 'Swimming Pool',
    'tourism.sights.memorial': 'Memorial',
    'tourism.sights': 'Sight',
    'tourism.attraction': 'Attraction',
    'tourism.information': 'Information',
    'man_made.bridge': 'Bridge',
    'building.historic': 'Historic Building',
    'emergency.defibrillator': 'Defibrillator',
    'religion.place_of_worship': 'Place of Worship',
    'adult.nightclub': 'Nightclub/Disco',
    'catering.restaurant': 'Restaurant',
    'catering.cafe': 'Cafe',
    'catering.fast_food': 'Fast Food',
    'natural.water': 'Water',
    'natural.beach': 'Beach',
    'beach': 'Beach',
    'heritage': 'Heritage',
    'pet.dog_park': 'Dog Park',
    'camping.caravan_site': 'RV Park',
    'camping.camp_site': 'Campsite',
    'building.tourism': 'Tourism Building',
    'building.entertainment': 'Entertainment Venue',
    'activity.sport': 'Sport Activity',
    'sport': 'Sports Facility',
    'sport.soccer': 'Soccer Field',
    'sport.tennis': 'Tennis Court',
    'sport.swimming': 'Swimming Pool',
    'sport.basketball': 'Basketball Court',
    'sport.fitness': 'Fitness Station',
    'leisure.viewpoint': 'Viewpoint',
    'tourism.viewpoint': 'Viewpoint',
    'leisure.garden': 'Garden',
    'leisure.nature_reserve': 'Nature Reserve',
    'leisure.beach_resort': 'Beach Resort',
    'entertainment.aquarium': 'Aquarium',
    'entertainment.planetarium': 'Planetarium',
    'catering.bar': 'Bar/Pub',
    'catering.pub': 'Pub',
    'catering.ice_cream': 'Ice Cream Parlor',
    'catering.biergarten': 'Beer Garden'
  };


  return specificTags.map(tag => {
    const activeDict = language === 'en' ? tagDictionaryEN : tagDictionaryDE;
    
    // Recursive lookup for parent categories
    const parts = tag.split('.');
    for (let i = parts.length; i > 0; i--) {
      const subTag = parts.slice(0, i).join('.');
      if (activeDict[subTag]) {
        return activeDict[subTag];
      }
    }
    
    const lastPart = parts[parts.length - 1];
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/_/g, ' ');
  });
};

/**
 * Formatiert den rohen OSM Opening Hours String in ein lesbares, smartes Format.
 * Zeigt bevorzugt die Zeiten für den aktuellen Monat/Tag an.
 */
export const formatOpeningHours = (raw?: string | null): string => {
  if (!raw) return '';
  
  // 1. Grundbereinigung
  let formatted = raw.replace(/;/g, ' • ');
  
  // 2. Saisonale Filterung (Heuristik)
  // Beispiel: "Apr-Sep Mo-So 09:00-19:00; Nov-Feb Mo-So 09:00-18:00"
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const segments = raw.split(';');
  let bestSegment = segments[0] || '';

  // Suche nach einem Segment, das den aktuellen Monat abdeckt
  for (const seg of segments) {
    const monthsMatch = seg.match(/([A-Z][a-z]{2})-([A-Z][a-z]{2})/);
    if (monthsMatch) {
      const startIdx = monthNames.indexOf(monthsMatch[1]);
      const endIdx = monthNames.indexOf(monthsMatch[2]);
      if (startIdx !== -1 && endIdx !== -1) {
        // Handle Jahresübergang (z.B. Nov-Feb)
        const isInRange = startIdx <= endIdx 
          ? (currentMonth >= startIdx && currentMonth <= endIdx)
          : (currentMonth >= startIdx || currentMonth <= endIdx);
        
        if (isInRange) {
          bestSegment = seg;
          break;
        }
      }
    }
  }

  // 3. Wochentage & Begriffe lokalisieren
  const dayMap: Record<string, string> = {
    'Mo-Su': 'Täglich',
    'Mo-Fr': 'Mo-Fr',
    'Sa-Su': 'Wochenende',
    'Mo': 'Mo', 'Tu': 'Di', 'We': 'Mi', 'Th': 'Do', 'Fr': 'Fr', 'Sa': 'Sa', 'Su': 'So',
    'PH': 'Feiertage', '24/7': '24/7',
    'off': 'geschlossen',
    'open': 'geöffnet'
  };
  
  let result = bestSegment.trim();
  Object.entries(dayMap).forEach(([en, de]) => {
    const regex = new RegExp(`\\b${en}\\b`, 'g');
    result = result.replace(regex, de);
  });

  // Kürzen von Jahresangaben im Segment
  result = result.replace(/[A-Z][a-z]{2}-[A-Z][a-z]{2}/, '').trim();

  return result || formatted;
};
