'use client';

import {
  UtensilsCrossed,
  TreePine,
  ShoppingBag,
  Film,
  Dumbbell,
  Utensils,
  Waves,
  Beer,
  Ticket,
  Bird,
  Library,
  Music,
  Building,
  Landmark,
  Church,
  BookOpen,
  Coffee,
  Flame,
  IceCream,
  Drumstick,
} from 'lucide-react';

export const availableTabs = [
  // --- KULTUR & HISTORIE ---
  { 
    id: "Sights", 
    label: "Sehenswürdigkeiten", 
    query: [
      "tourism.sights", "heritage", "building.historic", 
      "man_made.lighthouse", "man_made.windmill", "man_made.watermill",
      "tourism.sights.castle", "tourism.sights.fort", 
      "tourism.sights.archaeological_site"
    ], 
    icon: Landmark 
  },
  { 
    id: "Religion", 
    label: "Religion & Glaube", 
    query: [
      "religion.place_of_worship", "tourism.sights.place_of_worship",
      "tourism.sights.monastery"
    ], 
    icon: Church 
  },
  { 
    id: "Museums", 
    label: "Museen", 
    query: ["entertainment.museum"], 
    icon: Library 
  },
  { 
    id: "Attractions", 
    label: "Attraktionen", 
    query: [
      "tourism.attraction", "entertainment.theme_park", 
      "tourism.attraction.viewpoint", "entertainment.planetarium", 
      "tourism.attraction.fountain"
    ], 
    icon: Ticket 
  },
  { 
    id: "theater_cinema", 
    label: "Theater & Kinos", 
    query: ["entertainment.cinema", "entertainment.culture.theatre", "entertainment.culture.arts_centre"], 
    icon: Film 
  },
  
  // --- NATUR & AKTIV ---
  { 
    id: "Nature", 
    label: "Natur & Parks", 
    query: [
      "leisure.park", "natural.forest", "natural.protected_area", "national_park", 
      "leisure.picnic", "pet.dog_park", "camping.camp_site", "camping.caravan_site", 
      "camping.summer_camp", "natural.mountain", "natural.mountain.peak"
    ], 
    icon: TreePine 
  },
  { 
    id: "Water", 
    label: "Wasser & Strand", 
    query: [
      "natural.water", "natural.water.sea", "natural.water.hot_spring", 
      "beach", "beach.beach_resort", "natural.sand.dune", "man_made.pier",
      "leisure.spa", "building.spa"
    ], 
    icon: Waves 
  },
  { 
    id: "Zoos", 
    label: "Zoos & Aquarien", 
    query: ["entertainment.zoo", "entertainment.aquarium"], 
    icon: Bird 
  },
  { 
    id: "Sport", 
    label: "Sportanlagen", 
    query: [
      "sport.sports_centre", "sport.fitness.fitness_centre", "sport.swimming_pool", 
      "sport.stadium", "sport.ice_rink", "sport.pitch", "sport.track", 
      "sport.horse_riding", "sport.dive_centre", "building.sport", "activity.sport_club", 
      "entertainment.activity_park", "entertainment.bowling_alley", "entertainment.water_park", 
      "entertainment.escape_game", "entertainment.miniature_golf", "ski", "ski.lift", 
      "commercial.outdoor_and_sport"
    ], 
    icon: Dumbbell 
  },
  
  // --- SOCIAL & FOOD ---
  { 
    id: "Restaurants", 
    label: "Restaurants", 
    query: ["catering.restaurant", "catering.food_court"], 
    icon: Utensils 
  },
  { 
    id: "Cafes", 
    label: "Cafés", 
    query: ["catering.cafe"], 
    icon: Coffee 
  },
  { 
    id: "FastFood", 
    label: "Fast Food", 
    query: ["catering.fast_food"], 
    icon: Drumstick 
  },
  { 
    id: "IceCream", 
    label: "Eisdielen", 
    query: ["catering.ice_cream", "catering.cafe.ice_cream", "catering.cafe.frozen_yogurt"], 
    icon: IceCream 
  },
  { 
    id: "Nightlife", 
    label: "Bars & Pubs", 
    query: ["catering.bar", "catering.pub", "catering.biergarten", "catering.taproom"], 
    icon: Beer 
  },
  { 
    id: "Clubs", 
    label: "Clubs & Discos", 
    query: ["adult.nightclub"], 
    icon: Music 
  },
  
  // --- UTILITY & WISSEN ---
  { 
    id: "Education", 
    label: "Bildung", 
    query: ["education.library", "building.university", "education.university", "building.college", "education.college"], 
    icon: BookOpen 
  },
  { 
    id: "Coworking", 
    label: "Coworking", 
    query: ["office.coworking"], 
    icon: Building 
  },
  { 
    id: "Shopping", 
    label: "Shopping", 
    query: [
      "commercial.shopping_mall", "commercial.clothing", "commercial.department_store", 
      "commercial.marketplace", "commercial.gift_and_souvenir", "commercial.books", 
      "commercial.hobby"
    ], 
    icon: ShoppingBag 
  }
];
