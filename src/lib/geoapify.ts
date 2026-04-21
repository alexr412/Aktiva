'use client';

import { GEOAPIFY_API_KEY } from '@/lib/config';
import type { Place, GeoapifyFeature, UserPreferences } from '@/lib/types';

/**
 * Stufe 0A: Absoluter Abbruch (Hard Veto)
 * Blockiert das Rendering dieser Knoten und ihrer Sub-Kategorien bedingungslos via .startsWith()
 */
export const BASE_HARD_VETO = [
  "adult.adult_gaming_centre",
  "adult.brothel",
  "adult.casino",
  "adult.stripclub",
  "adult.swingerclub",
  "administrative",
  "administrative.city_level",
  "administrative.continent_level",
  "administrative.country_level",
  "administrative.country_part_level",
  "administrative.county_level",
  "administrative.district_level",
  "administrative.neighbourhood_level",
  "administrative.state_level",
  "administrative.suburb_level",
  "building.dormitory",
  "building.driving_school",
  "building.garage",
  "building.healthcare",
  "building.holiday_house",
  "building.industrial",
  "building.kindergarten",
  "building.military",
  "building.office",
  "building.parking",
  "building.prison",
  "building.residential",
  "building.school",
  "building.service",
  "building.toilet",
  "building.transportation",
  "childcare",
  "childcare.kindergarten",
  "commercial.convenience",
  "commercial.discount_store",
  "commercial.elektronics",
  "commercial.erotic",
  "commercial.food_and_drink.butcher",
  "commercial.gas",
  "commercial.health_and_beauty.optician",
  "commercial.health_and_beauty.pharmacy",
  "commercial.houseware_and_hardware",
  "commercial.houseware_and_hardware.building_materials",
  "commercial.houseware_and_hardware.building_materials.doors",
  "commercial.houseware_and_hardware.building_materials.flooring",
  "commercial.houseware_and_hardware.building_materials.glaziery",
  "commercial.houseware_and_hardware.building_materials.paint",
  "commercial.houseware_and_hardware.building_materials.tiles",
  "commercial.houseware_and_hardware.building_materials.windows",
  "commercial.houseware_and_hardware.doityourself",
  "commercial.houseware_and_hardware.fireplace",
  "commercial.houseware_and_hardware.hardware_and_tools",
  "commercial.houseware_and_hardware.swimming_pool",
  "commercial.outdoor_and_sport.bicycle",
  "commercial.pet",
  "commercial.pyrotechnics",
  "commercial.supermarket",
  "commercial.vehicle",
  "commercial.weapons",
  "education.college",
  "education.driving_school",
  "education.language_school",
  "education.music_school",
  "education.school",
  "emergency",
  "emergency.access_point",
  "emergency.air_rescue_service",
  "emergency.ambulance_station",
  "emergency.assembly_point",
  "emergency.bleed_control_kit",
  "emergency.control_centre",
  "emergency.defibrillator",
  "emergency.disaster_help_point",
  "emergency.disaster_response",
  "emergency.drinking_water",
  "emergency.dry_riser_inlet",
  "emergency.emergency_ward_entrance",
  "emergency.fire_alarm_box",
  "emergency.fire_detection_system",
  "emergency.fire_extinguisher",
  "emergency.fire_flapper",
  "emergency.fire_hose",
  "emergency.fire_hydrant",
  "emergency.fire_lookout",
  "emergency.fire_service_inlet",
  "emergency.fire_water_pond",
  "emergency.first_aid",
  "emergency.first_aid_kit",
  "emergency.key_depot",
  "emergency.landing_site",
  "emergency.life_ring",
  "emergency.lifeguard",
  "emergency.lifeguard_base",
  "emergency.marine_rescue",
  "emergency.mountain_rescue",
  "emergency.phone",
  "emergency.rescue_box",
  "emergency.siren",
  "emergency.slipway",
  "emergency.suction_point",
  "emergency.water_rescue",
  "emergency.water_tank",
  "healthcare",
  "healthcare.clinic_or_praxis",
  "healthcare.clinic_or_praxis.allergology",
  "healthcare.clinic_or_praxis.cardiology",
  "healthcare.clinic_or_praxis.dermatology",
  "healthcare.clinic_or_praxis.endocrinology",
  "healthcare.clinic_or_praxis.gastroenterology",
  "healthcare.clinic_or_praxis.general",
  "healthcare.clinic_or_praxis.gynaecology",
  "healthcare.clinic_or_praxis.occupational",
  "healthcare.clinic_or_praxis.ophthalmology",
  "healthcare.clinic_or_praxis.orthopaedics",
  "healthcare.clinic_or_praxis.otolaryngology",
  "healthcare.clinic_or_praxis.paediatrics",
  "healthcare.clinic_or_praxis.psychiatry",
  "healthcare.clinic_or_praxis.pulmonology",
  "healthcare.clinic_or_praxis.radiology",
  "healthcare.clinic_or_praxis.rheumatology",
  "healthcare.clinic_or_praxis.trauma",
  "healthcare.clinic_or_praxis.urology",
  "healthcare.clinic_or_praxis.vascular_surgery",
  "healthcare.dentist",
  "healthcare.dentist.orthodontics",
  "healthcare.hospital",
  "healthcare.pharmacy",
  "low_emission_zone",
  "memorial",
  "memorial.buddhist",
  "memorial.cemetery",
  "memorial.cemetery.sector",
  "memorial.christian",
  "memorial.christian.catholic",
  "memorial.christian.orthodox",
  "memorial.christian.protestant",
  "memorial.graveyard",
  "memorial.hindu",
  "memorial.jewish",
  "memorial.muslim",
  "office.accountant",
  "office.advertising_agency",
  "office.architect",
  "office.association",
  "office.charity",
  "office.company",
  "office.consulting",
  "office.diplomatic",
  "office.educational_institution",
  "office.employment_agency",
  "office.energy_supplier",
  "office.estate_agent",
  "office.financial",
  "office.financial_advisor",
  "office.forestry",
  "office.foundation",
  "office.government",
  "office.government.administrative",
  "office.government.agriculture",
  "office.government.cadaster",
  "office.government.customs",
  "office.government.education",
  "office.government.environment",
  "office.government.forestry",
  "office.government.healthcare",
  "office.government.legislative",
  "office.government.migration",
  "office.government.ministry",
  "office.government.prosecutor",
  "office.government.public_service",
  "office.government.register_office",
  "office.government.social_security",
  "office.government.social_services",
  "office.government.tax",
  "office.government.transportation",
  "office.insurance",
  "office.it",
  "office.lawyer",
  "office.logistics",
  "office.newspaper",
  "office.non_profit",
  "office.notary",
  "office.political_party",
  "office.religion",
  "office.research",
  "office.security",
  "office.tax_advisor",
  "office.telecommunication",
  "office.travel_agent",
  "office.water_utility",
  "parking",
  "parking.bicycles",
  "parking.cars",
  "parking.cars.multistorey",
  "parking.cars.rooftop",
  "parking.cars.surface",
  "parking.cars.underground",
  "parking.motorcycle",
  "parking.multistorey",
  "parking.rooftop",
  "parking.surface",
  "parking.underground",
  "pet.crematorium",
  "pet.veterinary",
  "political",
  "postal_code",
  "power",
  "power.generator",
  "power.generator.biomass",
  "power.generator.coal",
  "power.generator.gas",
  "power.generator.geothermal",
  "power.generator.hydro",
  "power.generator.nuclear",
  "power.generator.oil",
  "power.generator.solar",
  "power.generator.wind",
  "power.line",
  "power.minor_line",
  "power.plant",
  "power.plant.biomass",
  "power.plant.coal",
  "power.plant.gas",
  "power.plant.geothermal",
  "power.plant.hydro",
  "power.plant.nuclear",
  "power.plant.oil",
  "power.plant.solar",
  "power.plant.waste",
  "power.plant.wind",
  "power.substation",
  "power.transformer",
  "school",
  "kindergarten",
  "service.ambulance_station",
  "service.crematorium",
  "service.crematorium.human",
  "service.crematorium.pet",
  "service.fire_station",
  "service.funeral_directors",
  "service.funeral_hall",
  "service.mortuary",
  "service.place_of_mourning",
  "service.police",
  "service.social_facility",
  "service.social_facility.clothers",
  "service.social_facility.food",
  "service.social_facility.shelter",
  "service.vehicle",
  "service.vehicle.car_wash",
  "service.vehicle.charging_station",
  "service.vehicle.fuel",
  "service.vehicle.repair",
  "service.vehicle.repair.car",
  "service.vehicle.repair.motorcycle",
  "tourism.information",
  "tourism.information.map",
  "tourism.information.office",
  "tourism.information.ranger_station",
  "tourism.sights.memorial",
  "tourism.sights.memorial.aircraft",
  "tourism.sights.memorial.boundary_stone",
  "tourism.sights.memorial.locomotive",
  "tourism.sights.memorial.milestone",
  "tourism.sights.memorial.monument",
  "tourism.sights.memorial.necropolis",
  "tourism.sights.memorial.pillory",
  "tourism.sights.memorial.railway_car",
  "tourism.sights.memorial.ship",
  "tourism.sights.memorial.tank",
  "tourism.sights.memorial.tomb",
  "tourism.sights.memorial.tumulus",
  "tourism.sights.memorial.wayside_cross",
  "commercial.health_and_beauty.medical_supply",
  "accommodation.hostel"
];

/**
 * Stufe 0B: Relativer Abbruch (Soft Veto)
 */
export const BASE_SOFT_VETO = [
  "accommodation",
  "accommodation.apartment",
  "accommodation.chalet",
  "accommodation.guest_house",
  "accommodation.hostel",
  "accommodation.hotel",
  "accommodation.hut",
  "accommodation.motel",
  "amenity",
  "amenity.drinking_water",
  "amenity.give_box",
  "amenity.give_box.books",
  "amenity.give_box.food",
  "amenity.toilet",
  "building.college",
  "commercial",
  "heritage",
  "heritage.unesco",
  "highway",
  "highway.busway",
  "highway.cycleway",
  "highway.footway",
  "highway.living_street",
  "highway.motorway",
  "highway.motorway.junction",
  "highway.motorway.link",
  "highway.path",
  "highway.pedestrian",
  "highway.primary",
  "highway.primary.link",
  "highway.public",
  "highway.residential",
  "highway.secondary",
  "highway.secondary.link",
  "highway.service",
  "highway.tertiary",
  "highway.tertiary.link",
  "highway.track",
  "highway.trunk",
  "highway.trunk.link",
  "office",
  "office.coworking",
  "pet",
  "pet.service",
  "pet.shop",
  "populated_place",
  "populated_place.allotments",
  "populated_place.borough",
  "populated_place.city",
  "populated_place.city_block",
  "populated_place.county",
  "populated_place.district",
  "populated_place.hamlet",
  "populated_place.municipality",
  "populated_place.neighbourhood",
  "populated_place.province",
  "populated_place.quarter",
  "populated_place.region",
  "populated_place.state",
  "populated_place.subdistrict",
  "populated_place.suburb",
  "populated_place.town",
  "populated_place.township",
  "populated_place.village",
  "public_transport",
  "public_transport.aerialway",
  "public_transport.bus",
  "public_transport.ferry",
  "public_transport.light_rail",
  "public_transport.monorail",
  "public_transport.subway",
  "public_transport.subway.entrance",
  "public_transport.train",
  "public_transport.tram",
  "rental",
  "rental.bicycle",
  "rental.boat",
  "rental.car",
  "rental.ski",
  "rental.storage",
  "service",
  "service.beauty",
  "service.beauty.hairdresser",
  "service.beauty.massage",
  "service.beauty.spa",
  "service.bookmaker",
  "service.cleaning",
  "service.cleaning.dry_cleaning",
  "service.cleaning.laundry",
  "service.cleaning.lavoir",
  "service.estate_agent",
  "service.financial",
  "service.financial.atm",
  "service.financial.bank",
  "service.financial.bureau_de_change",
  "service.financial.money_lender",
  "service.financial.money_transfer",
  "service.financial.payment_terminal",
  "service.locksmith",
  "service.post",
  "service.post.box",
  "service.post.office",
  "service.recycling",
  "service.recycling.bin",
  "service.recycling.centre",
  "service.recycling.container",
  "service.tailor",
  "service.taxi",
  "service.travel_agency",
  "building.university",
  "production.factory",
  "building.accommodation",
  "building.public_and_civil",
  "man_made"
];

/**
 * Stufe 0C: Erlaubte Ausnahmen (Whitelist)
 */
export const BASE_WHITELIST = [
  "entertainment",
  "building.tourism",
  "tourism",
  "tourism.attraction",
  "building",
  "entertainment.museum",
  "tourism.sights.museum",
  "education.library",
  "tourism.sights.place_of_worship",
  "building.historic",
  "heritage",
  "heritage.unesco",
  "adult.nightclub",
  "building.entertainment",
  "commercial.shopping_mall",
  "entertainment.aquarium",


  "internet_access",
  "internet_access.free",
  "internet_access.for_customers",
  "wheelchair",
  "wheelchair.yes",
  "wheelchair.limited",
  "dogs",
  "dogs.yes",
  "dogs.leashed",
  "no-dogs",
  "access",
  "access.yes",
  "access.not_specified",
  "access_limited",
  "access_limited.private",
  "access_limited.customers",
  "access_limited.with_permit",
  "access_limited.services",
  "no_access",
  "fee",
  "no_fee",
  "no_fee.no",
  "no_fee.not_specified",
  "named",
  "vegetarian",
  "vegetarian.only",
  "vegan",
  "vegan.only",
  "halal",
  "halal.only",
  "kosher",
  "kosher.only",
  "organic",
  "organic.only",
  "gluten_free",
  "sugar_free",
  "egg_free",
  "soy_free"

];

/**
 * Ermittelt den deterministischen Veto-Status basierend auf Hierarchie-Tiefe und Priorität.
 * FINALE Prioritätsmatrix: 
 * 3 = Hard Veto (Sicherheit zuerst)
 * 2 = Soft Veto (Bedingtes Veto)
 * 1 = Whitelist (Passive Rettung)
 * 0 = Keine Übereinstimmung
 */
export function getPlaceVetoStatus(placeTags: string[], softVetoList: string[], hardVetoList: string[], whitelist: string[]): string {
  let currentMaxDepth = 0;
  let currentPriority = 0;
  let finalStatus = "none";

  for (const tag of placeTags) {
    if (!tag) continue;
    const depth = tag.split('.').length;

    let tagDepth = 0;
    let tagPriority = 0;
    let tagStatus = "none";

    // DETERMINISTISCHE PRÜFUNG (EXAKTER TREFFER)
    if (hardVetoList.includes(tag)) {
      tagDepth = depth;
      tagPriority = 3;
      tagStatus = "hard";
    } else if (softVetoList.includes(tag)) {
      tagDepth = depth;
      tagPriority = 2;
      tagStatus = "soft";
    } else if (whitelist.includes(tag)) {
      tagDepth = depth;
      tagPriority = 1;
      tagStatus = "none";
    }
    // PRÜFUNG DER HIERARCHIE (PREFIX-TREFFER)
    else {
      // Höchste Priorität: Hard Veto Präfixe
      for (const entry of hardVetoList) {
        if (tag.startsWith(entry + '.')) {
          const entryDepth = entry.split('.').length;
          if (entryDepth > tagDepth || (entryDepth === tagDepth && tagPriority < 3)) {
            tagDepth = entryDepth;
            tagPriority = 3;
            tagStatus = "hard";
          }
        }
      }
      // Zweite Priorität: Soft Veto Präfixe
      for (const entry of softVetoList) {
        if (tag.startsWith(entry + '.')) {
          const entryDepth = entry.split('.').length;
          if (entryDepth > tagDepth || (entryDepth === tagDepth && tagPriority < 2)) {
            tagDepth = entryDepth;
            tagPriority = 2;
            tagStatus = "soft";
          }
        }
      }
      // Dritte Priorität: Whitelist Präfixe
      for (const entry of whitelist) {
        if (tag.startsWith(entry + '.')) {
          const entryDepth = entry.split('.').length;
          if (entryDepth > tagDepth || (entryDepth === tagDepth && tagPriority < 1)) {
            tagDepth = entryDepth;
            tagPriority = 1;
            tagStatus = "none";
          }
        }
      }
    }

    // Wenn ein Tag eine höhere Priorität hat oder bei gleicher Tiefe die Priorität steigt, 
    // dann überschreiben wir das globale Ergebnis für diesen Spot.
    if (tagPriority > currentPriority || (tagPriority === currentPriority && tagDepth > currentMaxDepth)) {
      currentMaxDepth = tagDepth;
      currentPriority = tagPriority;
      finalStatus = tagStatus;
    }
  }

  return finalStatus;
}

/**
 * Statische Metadaten-Attribute (Conditions)
 */
export const CONDITION_PREFIXES = [
  "internet_access", "wheelchair", "dogs", "access", "access_limited",
  "no_access", "fee", "no_fee", "named", "vegetarian", "vegan",
  "halal", "kosher", "organic", "gluten_free", "sugar_free", "egg_free", "soy_free"
];

export const GLOBAL_EXCLUDE_STRING = [...BASE_HARD_VETO].slice(0, 10).join(',');

const BLACKLIST_REGEX = /sex|porn|fetish|escort|nudity|brothel|gaming_centre|erotic/i;

export const isSanitized = (text: string, tags: string[]): boolean => {
  if (BLACKLIST_REGEX.test(text)) return false;
  return !tags.some(tag => {
    if (tag === 'adult.nightclub' || tag.startsWith('adult.nightclub.')) return false;
    return BLACKLIST_REGEX.test(tag);
  });
};

export const applyFilters = (
  items: any[],
  activeCategories: string[] = [],
  userBlacklist: string[] = [],
  isGlobalSearch: boolean = false
) => {
  // Wir trennen strikt: System-Vetos vs. UI-Kategorie-Zuweisung
  const combinedSoftVetoList = BASE_SOFT_VETO;
  const combinedHardVetoList = [...BASE_HARD_VETO, ...userBlacklist];

  return items.filter(item => {
    const props = item.properties || {};
    const name = props.name || props.address_line1 || "";
    const address = props.address_line2 || "";
    const allTags: string[] = Array.isArray(item.tags) ? item.tags : (props.categories ? (Array.isArray(props.categories) ? props.categories : [props.categories]) : []);

    // Keine Tags? Dann handelt es sich meist um nutzlose Geo-Polygone oder Duplikate ohne echten Wert. Weg damit!
    if (allTags.length === 0) return false;

    // Phase 1: Data Sanitization (Regex Blacklist)
    if (!isSanitized(name + " " + address, allTags)) return false;

    const isStolperstein = props.datasource?.raw?.memorial === 'stolperstein';
    if (isStolperstein) return false;

    // --- STUFE 1: POSITIV-PRÜFUNG (UI-KATEGORIE EINSCHLUSS) ---
    // Bypass: Im Globalen Suchmodus (Null-State) oder wenn kein Tab gewählt ist, passiert ALLES diese Stufe.
    const passesCategoryFilter = isGlobalSearch || activeCategories.length === 0 ||
      allTags.some(tag => activeCategories.includes(tag) ||
        activeCategories.some(cat => tag.startsWith(cat + '.')));

    if (!passesCategoryFilter) return false;

    // --- STUFE 2: SYSTEM-VETOS (EXKLUSION) ---
    // Determinierte Prüfung gegen System-Listen (Hard Veto hat Priorität 3)
    const vetoStatus = getPlaceVetoStatus(allTags, combinedSoftVetoList, combinedHardVetoList, BASE_WHITELIST);
    if (vetoStatus === "hard") return false;

    const coreTags = allTags.filter(tag =>
      !CONDITION_PREFIXES.some(prefix => tag === prefix || tag.startsWith(`${prefix}.`))
    );

    const specificCoreTags = coreTags.filter(tag =>
      !coreTags.some(otherTag => otherTag !== tag && otherTag.startsWith(`${tag}.`))
    );

    // SOLELY EXCLUDED CHECK (SOFT)
    // Wenn alle Tags eines Spots Soft-Vetos sind (und kein Whitelist-Tag rettet), wird er gefiltert.
    if (specificCoreTags.length > 0) {
      const isSolelyExcluded = specificCoreTags.every(tag => {
        return getPlaceVetoStatus([tag], combinedSoftVetoList, combinedHardVetoList, BASE_WHITELIST) === "soft";
      });
      if (isSolelyExcluded) return false;
    }

    return true;
  });
};

export const calculateRelevanceScore = (itemTags: string[], distanceInMeters: number, prefs: UserPreferences): number => {
  let score = 500;

  if (itemTags.includes('education.library')) score += 5000;

  const matchingCount = prefs.likedTags.reduce((count, liked) => {
    const isMatch = itemTags.some(tag => tag === liked || tag.startsWith(`${liked}.`));
    return isMatch ? count + 1 : count;
  }, 0);

  if (matchingCount > 0) {
    score += (matchingCount * 2500);
  }

  // Deterministic Soft Veto Penalty
  const vetoStatus = getPlaceVetoStatus(itemTags, BASE_SOFT_VETO, BASE_HARD_VETO, BASE_WHITELIST);
  if (vetoStatus === "soft") score -= 300;

  const distancePenalty = (distanceInMeters / 25);
  score -= distancePenalty;

  return Math.round(Math.max(0, score));
};

export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
  categories: string[],
  limit: number,
  offset: number
): Promise<Place[]> {
  // Synchronisierung: Wir fügen 'building' und 'education' zur API-Anfrage hinzu,
  // da wir diese in der BASE_WHITELIST erlauben (z.B. für das Klimahaus).
  let targetCategories: string[] = categories.length === 0 || categories.includes('all')
    ? ["tourism", "entertainment", "heritage", "building", "education", "adult.nightclub", "catering", "religion", "leisure"]
    : categories.slice(0, 10);
  const fetchUrl = `https://api.geoapify.com/v2/places?categories=${targetCategories.join(',')}&filter=circle:${lon},${lat},${radiusMeters}&bias=proximity:${lon},${lat}&limit=${limit}&offset=${offset}&conditions=named&apiKey=${GEOAPIFY_API_KEY}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.features) return [];
    const rawFeatures = data.features || [];
    const itemsToFilter = rawFeatures.map((f: any) => ({
      tags: Array.isArray(f.properties.categories) ? f.properties.categories : [f.properties.categories],
      properties: f.properties,
      distance: f.properties.distance || 0
    }));
    const safeItems = applyFilters(itemsToFilter);
    return safeItems.map((item: any) => {
      const props = item.properties;
      let rating;
      if (props.datasource?.raw?.rating) {
        const parsedRating = parseFloat(props.datasource.raw.rating);
        if (!isNaN(parsedRating)) rating = Math.max(0, Math.min(5, parsedRating));
      }
      return {
        id: props.place_id,
        name: props.name || props.address_line1,
        address: props.address_line2,
        categories: Array.isArray(props.categories) ? props.categories : [props.categories],
        lat: props.lat,
        lon: props.lon,
        rating: rating,
        distance: props.distance,
        openingHours: props.opening_hours || props.datasource?.raw?.opening_hours || null
      } as Place;
    });
  } catch (error) {
    console.error('Fetch error:', error);
    return [];
  }
}

export async function reverseGeocode(lat: number, lon: number): Promise<Place | null> {
  const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const props = data.features[0].properties;
      return {
        id: props.place_id,
        name: props.name || props.address_line1,
        address: props.address_line2,
        categories: props.categories || [],
        lat: props.lat,
        lon: props.lon,
        openingHours: props.opening_hours || props.datasource?.raw?.opening_hours || null
      } as Place;
    }
  } catch (error) {
    console.error("Reverse Geocode failed:", error);
  }
  return null;
}

export async function autocompletePlaces(text: string): Promise<Place[]> {
  if (!text || text.length < 3) return [];
  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&limit=5&apiKey=${GEOAPIFY_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (data.features) {
      return data.features.map((f: any) => ({
        id: f.properties.place_id,
        name: f.properties.name || f.properties.address_line1,
        address: f.properties.address_line2,
        categories: f.properties.categories || [],
        lat: f.properties.lat,
        lon: f.properties.lon,
        openingHours: f.properties.opening_hours || f.properties.datasource?.raw?.opening_hours || null
      } as Place));
    }
  } catch (error) {
    console.error("Autocomplete failed:", error);
  }
  return [];
}

/**
 * Diagnostik-Funktion: Ruft ungefilderte Informationen zu einem Ort ab.
 * Wird ausschließlich im Debug-Kontext (/debug) verwendet, um Veto-Kollisionen zu identifizieren.
 */
export async function fetchUnfilteredPlaceInfo(searchQuery: string) {
  try {
    const response = await fetch(`/api/debug-search?text=${encodeURIComponent(searchQuery)}`);
    if (!response.ok) throw new Error("API Request failed");
    const data = await response.json();

    if (!data.results) return [];

    return data.results.map((item: any) => {
      // Defensive Extraktion der Tags für unterschiedliche API-Response-Formate
      // Geocoding-API nutzt oft 'category' (singular string), Places-API 'categories' (plural array)

      let extracted: string[] = [];

      if (item.categories && Array.isArray(item.categories)) {
        extracted = item.categories;
      } else if (item.category && typeof item.category === 'string') {
        extracted = [item.category];
      } else if (item.properties?.categories && Array.isArray(item.properties.categories)) {
        extracted = item.properties.categories;
      } else if (item.properties?.category && typeof item.properties.category === 'string') {
        extracted = [item.properties.category];
      }

      return {
        name: item.name || item.formatted || "Unbekannte Entität",
        address: item.formatted,
        rawCategories: extracted,
        // Führt die Logik isoliert aus, um das blockierende Tag zu diagnostizieren
        simulatedVetoStatus: getPlaceVetoStatus(extracted, BASE_SOFT_VETO, BASE_HARD_VETO, BASE_WHITELIST)
      };
    });
  } catch (error) {
    console.error("Diagnosis fetch failed:", error);
    return [];
  }
}
