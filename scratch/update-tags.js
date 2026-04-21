const fs = require('fs');
let c = fs.readFileSync('src/lib/tag-parser.ts', 'utf8');

c = c.replace('const tagDictionary: Record<string, string> = {', 'const tagDictionaryDE: Record<string, string> = {');

c = c.replace('if (tagDictionary[tag]) {', `const activeDict = language === 'en' ? tagDictionaryEN : tagDictionaryDE;
    if (activeDict[tag]) {`);

c = c.replace('return tagDictionary[tag];', 'return activeDict[tag];');

c = c.replace(/building\.entertainment': 'Unterhaltungsstätte'\r?\n  };/, `building.entertainment': 'Unterhaltungsstätte'
  };

  const tagDictionaryEN: Record<string, string> = {
    'entertainment.cinema': 'Cinema',
    'entertainment.culture.theatre': 'Theatre',
    'leisure.park': 'Park',
    'tourism.sights.memorial': 'Memorial',
    'entertainment.museum': 'Museum',
    'tourism.sights': 'Sight',
    'tourism.attraction': 'Attraction',
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
    'building.entertainment': 'Entertainment Venue'
  };`);

fs.writeFileSync('src/lib/tag-parser.ts', c);
