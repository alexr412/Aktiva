'use client';

import { GEOAPIFY_API_KEY } from '@/lib/config';
import type { Place, GeoapifyFeature, UserPreferences } from '@/lib/types';

/**
 * Stufe 0A: Absoluter Abbruch (Hard Veto)
 * Blockiert das Rendering dieser Knoten und ihrer Sub-Kategorien bedingungslos via .startsWith()
 */
export const BASE_HARD_VETO = [
  "building.accommodation", "building.parking", "building.residential", "building.school", "building.service", "building.toilet",
  "memorial", "memorial.buddhist", "memorial.cemetery", "memorial.cemetery.sector", "memorial.christian", "memorial.christian.catholic", "memorial.christian.orthodox", "memorial.christian.protestant", "memorial.graveyard", "memorial.hindu", "memorial.jewish", "memorial.muslim",
  "tourism.information", "tourism.information.office",
  "commercial.supermarket", "commercial.convenience", "commercial.discount_store", "commercial.elektronics", "commercial.erotic", "commercial.health_and_beauty.optician", "commercial.health_and_beauty.pharmacy", "commercial.houseware_and_hardware", "commercial.pet",
  "service.vehicle", "commercial.outdoor_and_sport.bicycle", "commercial.food_and_drink.butcher"
];

/**
 * Stufe 0B: Relativer Abbruch (Soft Veto)
 * Greift nur, wenn keine validen Core-Tags nach der Isolation übrig bleiben.
 * Neu: Erfordert Strict Match (exakte Übereinstimmung) für den isolierten Tag.
 */
export const BASE_SOFT_VETO = [
  "education.school", "education.driving_school", "education.language_school", "education.music_school", "education.college",
  "heritage.unesco",
  "accommodation", "accommodation.apartment", "accommodation.chalet", "accommodation.guest_house", "accommodation.hostel", "accommodation.hotel", "accommodation.hut", "accommodation.motel",
  "emergency", "emergency.access_point", "emergency.air_rescue_service", "emergency.ambulance_station", "emergency.assembly_point", "emergency.bleed_control_kit", "emergency.control_centre", "emergency.defibrillator", "emergency.disaster_help_point", "emergency.disaster_response", "emergency.drinking_water", "emergency.dry_riser_inlet", "emergency.emergency_ward_entrance", "emergency.fire_alarm_box", "emergency.fire_detection_system", "emergency.fire_extinguisher", "emergency.fire_flapper", "emergency.fire_hose", "emergency.fire_hydrant", "emergency.fire_lookout", "emergency.fire_service_inlet", "emergency.fire_water_pond", "emergency.first_aid", "emergency.first_aid_kit", "emergency.key_depot", "emergency.landing_site", "emergency.life_ring", "emergency.lifeguard", "emergency.lifeguard_base", "emergency.marine_rescue", "emergency.mountain_rescue", "emergency.phone", "emergency.rescue_box", "emergency.siren", "emergency.slipway", "emergency.suction_point", "emergency.water_rescue", "emergency.water_tank",
  "childcare", "childcare.kindergarten",
  "healthcare", "healthcare.clinic_or_praxis", "healthcare.clinic_or_praxis.allergology", "healthcare.clinic_or_praxis.cardiology", "healthcare.clinic_or_praxis.dermatology", "healthcare.clinic_or_praxis.endocrinology", "healthcare.clinic_or_praxis.gastroenterology", "healthcare.clinic_or_praxis.general", "healthcare.clinic_or_praxis.gynaecology", "healthcare.clinic_or_praxis.occupational", "healthcare.clinic_or_praxis.ophthalmology", "healthcare.clinic_or_praxis.orthopaedics", "healthcare.clinic_or_praxis.otolaryngology", "healthcare.clinic_or_praxis.paediatrics", "healthcare.clinic_or_praxis.psychiatry", "healthcare.clinic_or_praxis.pulmonology", "healthcare.clinic_or_praxis.radiology", "healthcare.clinic_or_praxis.rheumatology", "healthcare.clinic_or_praxis.trauma", "healthcare.clinic_or_praxis.urology", "healthcare.clinic_or_praxis.vascular_surgery", "healthcare.dentist", "healthcare.dentist.orthodontics", "healthcare.hospital", "healthcare.pharmacy",
  "heritage",
  "office", "office.accountant", "office.advertising_agency", "office.architect", "office.association", "office.charity", "office.company", "office.consulting", "office.diplomatic", "office.educational_institution", "office.employment_agency", "office.energy_supplier", "office.estate_agent", "office.financial", "office.financial_advisor", "office.forestry", "office.foundation", "office.government", "office.government.administrative", "office.government.agriculture", "office.government.cadaster", "office.government.customs", "office.government.education", "office.government.environment", "office.government.forestry", "office.government.healthcare", "office.government.legislative", "office.government.migration", "office.government.ministry", "office.government.prosecutor", "office.government.public_service", "office.government.register_office", "office.government.social_security", "office.government.social_services", "office.government.tax", "office.government.transportation", "office.insurance", "office.it", "office.lawyer", "office.logistics", "office.newspaper", "office.non_profit", "office.notary", "office.political_party", "office.religion", "office.research", "office.security", "office.tax_advisor", "office.telecommunication", "office.travel_agent", "office.water_utility",
  "pet.crematorium", "pet.service", "pet.shop", "pet.veterinary",
  "production.factory",
  "rental", "rental.bicycle", "rental.boat", "rental.car", "rental.ski", "rental.storage",
  "amenity", "amenity.drinking_water", "amenity.give_box", "amenity.give_box.books", "amenity.give_box.food", "amenity.toilet",
  "public_transport", "public_transport.aerialway", "public_transport.bus", "public_transport.ferry", "public_transport.light_rail", "public_transport.monorail", "public_transport.subway", "public_transport.subway.entrance", "public_transport.train", "public_transport.tram",
  "power", "power.generator", "power.generator.biomass", "power.generator.coal", "power.generator.gas", "power.generator.geothermal", "power.generator.hydro", "power.generator.nuclear", "power.generator.oil", "power.generator.solar", "power.generator.wind", "power.line", "power.minor_line", "power.plant", "power.plant.biomass", "power.plant.coal", "power.plant.gas", "power.plant.geothermal", "power.plant.hydro", "power.plant.nuclear", "power.plant.oil", "power.plant.solar", "power.plant.waste", "power.plant.wind", "power.substation", "power.transformer",
  "administrative", "administrative.city_level", "administrative.continent_level", "administrative.country_level", "administrative.country_part_level", "administrative.county_level", "administrative.district_level", "administrative.neighbourhood_level", "administrative.state_level", "administrative.suburb_level",
  "postal_code", "political", "low_emission_zone",
  "populated_place", "populated_place.allotments", "populated_place.borough", "populated_place.city", "populated_place.city_block", "populated_place.county", "populated_place.district", "populated_place.hamlet", "populated_place.municipality", "populated_place.neighbourhood", "populated_place.province", "populated_place.quarter", "populated_place.region", "populated_place.state", "populated_place.subdistrict", "populated_place.suburb", "populated_place.town", "populated_place.township", "populated_place.village",
  "adult.brothel", "adult.adult_gaming_centre",
  "service", "service.ambulance_station", "service.beauty", "service.beauty.hairdresser", "service.bookmaker", "service.cleaning", "service.cleaning.dry_cleaning", "service.cleaning.laundry", "service.cleaning.lavoir", "service.crematorium", "service.crematorium.human", "service.crematorium.pet", "service.estate_agent", "service.financial", "service.financial.atm", "service.financial.bank", "service.financial.bureau_de_change", "service.financial.money_lender", "service.financial.money_transfer", "service.financial.payment_terminal", "service.fire_station", "service.funeral_directors", "service.funeral_hall", "service.locksmith", "service.mortuary", "service.place_of_mourning", "service.police", "service.post", "service.post.box", "service.post.office", "service.recycling", "service.recycling.bin", "service.recycling.centre", "service.recycling.container", "service.social_facility", "service.social_facility.clothers", "service.social_facility.food", "service.social_facility.shelter", "service.tailor", "service.taxi", "service.travel_agency", "service.vehicle", "service.vehicle.car_wash", "service.vehicle.charging_station", "service.vehicle.fuel", "service.vehicle.repair", "service.vehicle.repair.car", "service.vehicle.repair.motorcycle",
  "building.driving_school", "building.healthcare", "building.kindergarten", "building.prison", "building.transportation",
  "commercial.agrarian", "commercial.baby_goods", "commercial.bag", "commercial.chemist", "commercial.energy", "commercial.florist", "commercial.furniture_and_interior", "commercial.furniture_and_interior.bathroom", "commercial.furniture_and_interior.bed", "commercial.furniture_and_interior.carpet", "commercial.furniture_and_interior.curtain", "commercial.furniture_and_interior.kitchen", "commercial.furniture_and_interior.lighting", "commercial.garden", "commercial.gas", "commercial.health_and_beauty", "commercial.health_and_beauty.cosmetics", "commercial.health_and_beauty.hearing_aids", "commercial.health_and_beauty.herbalist", "commercial.health_and_beauty.medical_supply", "commercial.health_and_beauty.wigs", "commercial.jewelry", "commercial.kiosk", "commercial.newsagent", "commercial.pyrotechnics", "commercial.smoking", "commercial.stationery", "commercial.tickets_and_lottery", "commercial.trade", "commercial.vehicle", "commercial.watches", "commercial.weapons", "commercial.wedding",
  "tourism.attraction.clock", "commercial"
];

/**
 * Statische Metadaten-Attribute (Conditions), die nicht die Kern-Identität definieren.
 */
export const CONDITION_PREFIXES = [
  "internet_access", "wheelchair", "dogs", "access", "access_limited", 
  "no_access", "fee", "no_fee", "named", "vegetarian", "vegan", 
  "halal", "kosher", "organic", "gluten_free", "sugar_free", "egg_free", "soy_free"
];

// Kombinierte Liste für den API-Ausschluss (optimierte Vor-Filterung)
export const GLOBAL_EXCLUDE_STRING = [...BASE_HARD_VETO].map(cat => `categories:${cat}`).join(',');

/**
 * Filter-Pipeline (Strict Match für Soft-Veto, Kaskadierend für Hard-Veto)
 */
export const applyFilters = (items: any[], userSoftVetoList: string[] = []) => {
  const combinedSoftVetoList = [...BASE_SOFT_VETO, ...userSoftVetoList];

  return items.filter(item => {
    // Deterministische Exklusion von Stolpersteinen
    const isStolperstein = item.properties?.datasource?.raw?.memorial === 'stolperstein';
    if (isStolperstein) return false;

    const allTags: string[] = Array.isArray(item.tags) ? item.tags : (item.properties?.categories ? (Array.isArray(item.properties.categories) ? item.properties.categories : [item.properties.categories]) : []);

    // 0. Absolute Exklusion (Hard Veto) - Kaskadierende Sperre bleibt aktiv
    const violatesHardVeto = allTags.some(tag => 
      BASE_HARD_VETO.some(veto => tag === veto || tag.startsWith(`${veto}.`))
    );
    if (violatesHardVeto) return false;

    // 1. Extraktion der Basis-Attribute
    const coreTags = allTags.filter(tag => 
      !CONDITION_PREFIXES.some(prefix => tag === prefix || tag.startsWith(`${prefix}.`)) &&
      (!tag.startsWith("building") || combinedSoftVetoList.includes(tag))
    );

    // 2. Isolation der tiefsten Sub-Tags (Zerstörung der Parent-Schutzfunktion)
    const specificCoreTags = coreTags.filter(tag => 
      !coreTags.some(otherTag => otherTag !== tag && otherTag.startsWith(`${tag}.`))
    );

    // 3. Exklusive Soft-Veto-Auswertung (Strict Match ohne kaskadierende Vererbung)
    if (specificCoreTags.length > 0) {
      const isSolelyExcludedIdentity = specificCoreTags.every(specificTag => 
        combinedSoftVetoList.includes(specificTag)
      );
      
      if (isSolelyExcludedIdentity) return false;
    }

    // 4. System-Freigabe
    return true;
  });
};

/**
 * Scoring-Algorithmus zur Berechnung der Relevanz (Gewichtete Pipeline)
 */
export const calculateRelevanceScore = (itemTags: string[], distanceInMeters: number, prefs: UserPreferences): number => {
  let score = 1000; // Basis-Score für Knoten, die den Filter passiert haben

  // Positives Gewichting durch Onboarding-Präferenzen
  const hasLikedTag = itemTags.some(tag => 
    prefs.likedTags.some(liked => tag === liked || tag.startsWith(`${liked}.`))
  );
  if (hasLikedTag) {
    score += 5000;
  }

  // Negatives Gewichting durch explizite Desinteresse-Markierungen
  const hasDislikedTag = itemTags.some(tag => 
    prefs.dislikedTags.some(disliked => tag === disliked || tag.startsWith(`${disliked}.`))
  );
  if (hasDislikedTag) {
    score -= 800;
  }

  // Distanz-Malus: Degradiert Knoten basierend auf räumlicher Entfernung
  // Beispiel: -1 Punkt pro 10 Meter
  score -= (distanceInMeters / 10);

  return score;
};

/**
 * Nachgelagerte Sortierung basierend auf dem Relevanz-Score
 */
export const sortFilteredItems = (filteredItems: any[], userPrefs: UserPreferences) => {
  return [...filteredItems].sort((a, b) => {
    // Falls relevanceScore noch nicht berechnet wurde (z.B. in Test-Umgebungen)
    const scoreA = a.relevanceScore ?? calculateRelevanceScore(a.categories || a.tags, a.distance || 0, userPrefs);
    const scoreB = b.relevanceScore ?? calculateRelevanceScore(b.categories || b.tags, b.distance || 0, userPrefs);
    
    return scoreB - scoreA; // Absteigende Sortierung (höchste Relevanz zuerst)
  });
};

export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
  categories: string[],
  limit: number,
  offset: number
): Promise<Place[]> {
  let targetCategories: string[];
  if (categories.length === 0 || categories.includes('all')) {
    targetCategories = ["tourism", "entertainment", "heritage"];
  } else {
    targetCategories = categories;
  }

  const fetchUrl = `https://api.geoapify.com/v2/places?categories=${targetCategories.join(',')}&filter=circle:${lon},${lat},${radiusMeters}&bias=proximity:${lon},${lat}&limit=${limit}&offset=${offset}&conditions=named&exclude=${GLOBAL_EXCLUDE_STRING}&apiKey=${GEOAPIFY_API_KEY}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.features) return [];

    const rawFeatures = data.features || [];
    
    // Map features to temporary items for applyFilters
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
      } as Place;
    });
  } catch (error) {
    console.error('Fetch error:', error);
    return [];
  }
}
