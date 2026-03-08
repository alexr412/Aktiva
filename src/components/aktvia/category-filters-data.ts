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
} from 'lucide-react';

export const availableTabs = [
  // --- KULTUR & HISTORIE ---
  { id: "Sights", label: "Sehenswürdigkeiten", query: ["tourism.sights", "heritage"], icon: Landmark },
  { id: "Religion", label: "Religion & Glaube", query: ["religion.place_of_worship"], icon: Church },
  { id: "Museums", label: "Museen", query: ["entertainment.museum"], icon: Library },
  { id: "Attractions", label: "Attraktionen", query: ["tourism.attraction", "tourism.sights"], icon: Ticket },
  { id: "theater_cinema", label: "Theater & Kinos", query: ["entertainment.cinema", "entertainment.culture.theatre", "entertainment.culture.arts_centre"], icon: Film },
  
  // --- NATUR & AKTIV ---
  { id: "Nature", label: "Natur & Parks", query: ["leisure.park", "natural.forest"], icon: TreePine },
  { id: "Water", label: "Wasser & Strand", query: ["natural.water", "natural.beach"], icon: Waves },
  { id: "Zoos", label: "Zoos & Aquarien", query: ["entertainment.zoo", "entertainment.aquarium"], icon: Bird },
  { id: "Sport", label: "Sportanlagen", query: ["sport"], icon: Dumbbell },
  
  // --- SOCIAL & FOOD ---
  { id: "Gastronomy", label: "Gastro", query: ["catering.restaurant", "catering.cafe"], icon: UtensilsCrossed },
  { id: "Nightlife", label: "Bars & Pubs", query: ["catering.bar", "catering.pub"], icon: Beer },
  { id: "Clubs", label: "Clubs & Discos", query: ["adult.nightclub"], icon: Music },
  
  // --- UTILITY & WISSEN ---
  { 
    id: "Education", 
    label: "Bildung", 
    query: ["education.library", "building.university", "education.university"], 
    icon: BookOpen 
  },
  { id: "Coworking", label: "Coworking", query: ["office.coworking"], icon: Building },
  { id: "Shopping", label: "Shopping", query: ["commercial.shopping_mall", "commercial.clothing"], icon: ShoppingBag }
];
