import type { Place } from '@/lib/types';

type IllustrationPlace = Pick<Place, 'name' | 'categories' | 'category' | 'normalizedCategory'>;
const normalize = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
const rule = <S extends string>(subject: S, name: RegExp, tags: RegExp, nameWeight = 120, tagWeight = 120, venueName = false) =>
  ({ subject, name, tags, nameWeight, tagWeight, venueName });

// Specific activities outrank their parent categories. Equal scores use this stable
// order, never the provider's tag order; repeated tags cannot inflate a score.
const rules = [
  rule('minigolf', /minigolf|mini[ _-]?golf|miniature golf|adventure golf/, /(?:minigolf|mini_golf|miniature_golf)/),
  rule('bowling', /bowling|kegel/, /bowling|kegel/),
  rule('escape', /escape|ratselraum/, /escape/),
  rule('trampoline', /trampolin/, /trampolin/),
  rule('climbing', /boulder|kletter|climbing/, /climbing|bouldering/),
  rule('billiards', /snooker|billard|billiard/, /snooker|billiard|pool_table/),
  rule('karaoke', /karaoke/, /karaoke/),
  rule('boardgames', /brettspiel|board[ _-]?gam|gesellschaftsspiel|spielabend|game[ _-]?bar|games?[ _-]?nights?/, /boardgames?|board_gaming|brettspiel/),
  rule('arcade', /arcade|spielhalle|videospiel|\bgaming\b/, /arcade|gaming|video_?game/),
  rule('padel', /\bpadel\b/, /(?:^|[._])padel(?:[._]|$)/, 135),
  rule('tennis', /\btennis\b/, /(?:^|[._])tennis(?:[._]|$)/),
  rule('football', /soccer|football|fussball/, /soccer|football|fussball/),
  rule('basketball', /basketball/, /basketball/),
  rule('skatepark', /skatepark|skateboard|rollsport|\bbmx\b/, /skatepark|skateboard|bmx/),
  rule('iceskating', /eislauf|eisbahn|eissport|schlittschuh|ice[ -]?skat/, /ice_rink|ice_skating/),
  rule('cinema', /kino|cinema|cinemotion|filmpalast|\bmovies\b/, /cinema|movies/),
  rule('planetarium', /planetarium|sternwarte/, /planetarium|observatory/),
  rule('themepark', /freizeitpark|vergnugungspark|amusement park|theme park/, /theme_park|amusement_park/),
  rule('activitypark', /aktivitatspark|activity park|hochseilgarten|seilgarten/, /activity_park|ropes_course/, 105, 85),
  rule('pool', /swimming|schwimm|\bbad\s?\d\b|lehrbecken|hallenbad|freibad|freizeitbad|waterpark|wasserpark/, /swimming|water_park|waterpark|aquatic/),
  rule('wellness', /wellness|sauna|thermal|therme|\bspa\b/, /wellness|sauna|thermal|(?:^|\.)spa(?:\.|$)/),
  rule('nightclub', /nightclub|nachtclub|disco|kuhlhouse|kuehlhouse|\bparty\b|tanzen|dancing/, /nightclub|dance_club|dancing/, 115, 115),
  rule('icecream', /eisdiele|\beis essen\b|ice cream|toddy.s eis/, /ice_cream/, 125, 125),
  rule('sushi', /sushi/, /(?:^|[._])sushi(?:[._]|$)/),
  rule('pizza', /pizza|pizzeria/, /(?:^|[._])pizza(?:[._]|$)/),
  rule('fastfood', /\bburger\b|burgermeister|street[ -]?food|imbiss|fast[ -]?food/, /fast_food|food_court|restaurant\.burger/),
  rule('fish', /fischhaus|fischhus|fischrestaurant|seafood/, /restaurant\.(fish|seafood)(?:\.|$)/),
  rule('biergarten', /biergarten|beer garden/, /biergarten|beer_garden/),
  rule('bakery', /backerei|baeckerei|konditorei|\bbakery\b/, /bakery|cafe\.cake/, 110, 110),
  rule('coffee', /cafe|coffee|kaffee/, /catering\.cafe|(?:^|\.)coffee$/, 55, 90),
  rule('bar', /\bbar\b|\bpub\b|russel|karlsburg|bier trinken|wein trinken|\bbeer\b|\bwine\b/, /catering\.(bar|pub)|(?:^|\.)(beer|wine)$/, 65, 85),
  rule('food', /restaurant|essen gehen|foodie|food and drink/, /^catering(?:\.|$)|food_and_drink|(?:^|\.)foodie$/, 55, 60),
  rule('gallery', /galerie|gallery|kunstausstellung/, /gallery|arts_centre/, 105, 110, true),
  rule('museum', /museum|auswandererhaus|klimahaus|phanomenta|phaenomenta/, /museum/, 105, 110, true),
  rule('library', /library|bibliothek|bucherei|buecherei|\blesen\b|\breading\b/, /library|(?:^|\.)reading$/, 105, 110, true),
  rule('aquarium', /aquarium/, /aquarium/, 105, 110, true),
  rule('seal', /zoo am meer|meereszoo|marine zoo|sea[ -]?life/, /marine_zoo/, 125, 120, true),
  rule('deer', /\bzoo\b|tierpark|tiergehege|\banimals\b/, /zoo|animal_park|tierpark|(?:^|\.)animals$/, 100, 105, true),
  rule('coworking', /coworking|co[ -]working/, /coworking/),
  rule('study', /universitat|universitaet|hochschule|gemeinsam lernen|lerngruppe|studying/, /university|college|(?:^|\.)study(?:\.|$)/, 105, 100, true),
  rule('festival', /festival/, /festival/),
  rule('concert', /konzert|concert|live[ -]?musik|live[ -]?music/, /concert|live_music/),
  rule('comedy', /comedy|stand[ -]?up|kabarett/, /comedy|stand_up/),
  rule('culture', /theater|theatre|\bkultur\b|\bculture\b|\bmusik\b|\bmusic\b/, /theatre|theater|culture|(?:^|\.)(music|art)$/, 75, 75, true),
  rule('painting', /malen|painting|kreativworkshop/, /painting|(?:^|\.)art$/, 120, 115),
  rule('photography', /fotografie|fotowalk|photography|photo walk/, /photography/),
  rule('cooking', /kochen|kochabend|cooking/, /cooking/),
  rule('baking', /\bbacken\b|baking/, /baking/),
  rule('running', /joggen|jogging|running|lauftreff|\blaufen\b/, /running|jogging/),
  rule('dogwalking', /hunderunde|hundewiese|hundepark|dog[ -]?(walk|park)/, /dog_park|dog_walking/),
  rule('playground', /spielplatz|playground/, /playground/, 105, 110, true),
  rule('hiking', /hiking|wandern|wanderweg|wanderung/, /hiking/),
  rule('cycling', /cycling|radfahren|rad fahren|fahrrad/, /cycling|cycle_path|bicycle/),
  rule('camping', /camping|zeltplatz/, /camping|camp_site|caravan_site/),
  rule('beach', /beach|strand|badeufer/, /beach/, 100, 105, true),
  rule('maritime', /\bhafen\b|schiff|\bship\b|\bboot\b|\bboat\b|promenade|harbou?r/, /harbou?r|marina/, 90, 100, true),
  rule('lake', /\bsee\b|seeufer|flussufer|lakeside/, /natural\.(water|lake|river)|waterway\.river|(?:^|\.)lake$/, 65, 105, true),
  rule('viewpoint', /aussichtspunkt|aussichtsplattform|viewpoint/, /viewpoint/, 100, 105, true),
  rule('park', /park|garten|garden|\bnatur\b|\bnature\b|spazieren|\boutdoor\b/, /^(?:leisure\.park|natural\.(?:forest|wood)|national_park|nature|outdoor)(?:\.|$)/, 50, 80, true),
  rule('shopping', /shopping|shoppen|fashion/, /^shop(?:\.|$)|^commercial(?:\.|$)|(?:^|\.)fashion$/, 95, 35),
  rule('fitness', /fitness|\bgym\b|yoga|\bsport\b/, /^(sport|sports)(?:\.|$)|sports_centre|fitness|yoga/, 65, 25),
  rule('travel', /reisen|ausflug|travel(?:ing|ling)?/, /traveling|travelling|activity\.travel/, 120, 120, true),
  rule('sightseeing', /sehensw|sightseeing|denkmal/, /sights|historic|heritage|attraction|artwork|sculpture|religion|church|mosque|synagogue|man_made\.bridge/, 70, 40, true),
] as const;

export type SpotIllustrationSubject = typeof rules[number]['subject'] | 'community';

/** Local artwork selection only: no API, generated-at-runtime image or database read. */
export function getSpotIllustrationSubject(place: IllustrationPlace): SpotIllustrationSubject {
  const name = normalize(place.name || '');
  const tags = [...new Set([...(place.categories || []), place.category, place.normalizedCategory]
    .filter((tag): tag is string => Boolean(tag)).map(normalize))];
  const gastronomy = tags.some(tag => /^catering(?:\.|$)/.test(tag));
  let subject: SpotIllustrationSubject = 'community';
  let bestScore = 0;
  for (const candidate of rules) {
    const named = (!candidate.venueName || !gastronomy) && candidate.name.test(name);
    const tagged = tags.some(tag => candidate.tags.test(tag));
    const score = Math.max(named ? candidate.nameWeight : 0, tagged ? candidate.tagWeight : 0) + (named && tagged ? 8 : 0);
    if (score > bestScore) {
      bestScore = score;
      subject = candidate.subject;
    }
  }
  return subject;
}
