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
} from 'lucide-react';

export const availableTabs = [
  // --- KULTUR & HISTORIE ---
  { 
    id: "Sights", 
    label: "Sehenswürdigkeiten", 
    query: ["tourism.sights", "heritage", "building.historic", "man_made.lighthouse", "man_made.windmill", "man_made.watermill"], 
    icon: Landmark 
  },
  { 
    id: "Religion", 
    label: "Religion & Glaube", 
    query: ["religion.place_of_worship", "tourism.sights.place_of_worship", "building.place_of_worship"], 
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
    query: ["tourism.attraction"], 
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
    query: ["leisure.park", "natural.forest", "natural.protected_area", "national_park", "leisure.picnic"], 
    icon: TreePine 
  },
  { 
    id: "Water", 
    label: "Wasser & Strand", 
    query: ["natural.water", "beach", "man_made.pier"], 
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
    query: ["sport", "entertainment.activity_park", "entertainment.bowling_alley", "entertainment.water_park", "entertainment.escape_game", "entertainment.miniature_golf"], 
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
    icon: Flame 
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
    query: ["education.library", "building.university", "education.university", "building.college"], 
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
    query: ["commercial.shopping_mall", "commercial.clothing", "commercial.department_store", "commercial.marketplace", "commercial.gift_and_souvenir", "commercial.books", "commercial.hobby"], 
    icon: ShoppingBag 
  }
];
