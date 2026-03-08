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
} from 'lucide-react';

export const availableTabs = [
  // --- KULTUR & SIGHTS ---
  { id: "Sights", label: "Sehenswürdigkeiten", query: ["tourism.sights", "heritage"], icon: Landmark },
  { id: "Museums", label: "Museen", query: ["entertainment.museum"], icon: Library },
  { id: "Attractions", label: "Attraktionen", query: ["tourism.attraction", "tourism.sights"], icon: Ticket },
  { id: "Cinemas", label: "Kinos", query: ["entertainment.cinema"], icon: Film },
  
  // --- NATUR & AKTIV ---
  { id: "Nature", label: "Natur & Parks", query: ["leisure.park", "natural.forest"], icon: TreePine },
  { id: "Water", label: "Wasser & Strand", query: ["natural.water", "natural.beach"], icon: Waves },
  { id: "Zoos", label: "Zoos & Aquarien", query: ["entertainment.zoo", "entertainment.aquarium"], icon: Bird },
  { id: "Sport", label: "Sportanlagen", query: ["sport"], icon: Dumbbell },
  
  // --- SOCIAL & FOOD ---
  { id: "Gastronomy", label: "Gastro", query: ["catering.restaurant", "catering.cafe"], icon: UtensilsCrossed },
  { id: "FastFood", label: "Fast Food", query: ["catering.fast_food"], icon: Utensils },
  { id: "Nightlife", label: "Bars & Pubs", query: ["catering.bar", "catering.pub"], icon: Beer },
  { id: "Clubs", label: "Clubs & Discos", query: ["adult.nightclub"], icon: Music },
  
  // --- UTILITY-LAYER ---
  { id: "Shopping", label: "Shopping", query: ["commercial.shopping_mall", "commercial.clothing"], icon: ShoppingBag },
  { id: "Coworking", label: "Coworking", query: ["office.coworking"], icon: Building }
];
