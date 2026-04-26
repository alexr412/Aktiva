'use client';

import {
  Landmark,
  Church,
  Library,
  Ticket,
  Film,
  TreePine,
  Waves,
  Bird,
  Dumbbell,
  Utensils,
  Coffee,
  Drumstick,
  IceCream,
  Beer,
  Music,
  BookOpen,
  Building,
  ShoppingBag,
} from 'lucide-react';

export const availableTabs = [
  // --- KULTUR & HISTORIE ---
  {
    id: 'Sights',
    label: 'Sehenswürdigkeiten',
    labelEn: 'Sights',
    query: ['tourism.sights', 'building.historic'],
    icon: Landmark,
    color: '#f59e0b', // Amber
  },
  {
    id: 'Religion',
    label: 'Religion & Glaube',
    labelEn: 'Religion',
    query: ['religion'],
    icon: Church,
    color: '#8b5cf6', // Violet
  },
  {
    id: 'Museums',
    label: 'Museen',
    labelEn: 'Museums',
    query: ['entertainment.museum'],
    icon: Library,
    color: '#6366f1', // Indigo
  },
  {
    id: 'Attractions',
    label: 'Attraktionen',
    labelEn: 'Attractions',
    query: ['tourism.attraction'],
    icon: Ticket,
    color: '#ec4899', // Pink
  },
  {
    id: 'theater_cinema',
    label: 'Theater & Kinos',
    labelEn: 'Theater & Cinema',
    query: ['entertainment.cinema', 'entertainment.culture.theatre'],
    icon: Film,
    color: '#f43f5e', // Rose
  },

  // --- NATUR & AKTIV ---
  {
    id: 'Nature',
    label: 'Natur & Parks',
    labelEn: 'Nature & Parks',
    query: ['leisure.park', 'leisure.garden', 'leisure.nature_reserve'],
    icon: TreePine,
    color: '#10b981', // Green
  },
  {
    id: 'Water',
    label: 'Wasser & Strand',
    labelEn: 'Water & Beach',
    query: ['beach', 'leisure.beach', 'natural.water'],
    icon: Waves,
    color: '#0ea5e9', // Sky
  },
  {
    id: 'Zoos',
    label: 'Zoos & Aquarien',
    labelEn: 'Zoos & Aquaria',
    query: ['entertainment.zoo', 'entertainment.aquarium'],
    icon: Bird,
    color: '#06b6d4', // Cyan
  },
  {
    id: 'Sport',
    label: 'Sportanlagen',
    labelEn: 'Sports',
    query: ['sport', 'entertainment.activity_park'],
    icon: Dumbbell,
    color: '#f97316', // Orange
  },

  // --- SOCIAL & FOOD ---
  {
    id: 'Restaurants',
    label: 'Restaurants',
    labelEn: 'Restaurants',
    query: ['catering.restaurant'],
    icon: Utensils,
    color: '#059669', // Emerald
  },
  {
    id: 'Cafes',
    label: 'Cafés',
    labelEn: 'Cafes',
    query: ['catering.cafe'],
    icon: Coffee,
    color: '#78350f', // Brown
  },
  {
    id: 'FastFood',
    label: 'Fast Food',
    labelEn: 'Fast Food',
    query: ['catering.fast_food'],
    icon: Drumstick,
    color: '#eab308', // Yellow
  },
  {
    id: 'IceCream',
    label: 'Eisdielen',
    labelEn: 'Ice Cream',
    query: ['catering.ice_cream'],
    icon: IceCream,
    color: '#d946ef', // Fuchsia
  },
  {
    id: 'Nightlife',
    label: 'Bars & Pubs',
    labelEn: 'Bars & Pubs',
    query: ['catering.bar', 'catering.pub'],
    icon: Beer,
    color: '#ef4444', // Red
  },
  {
    id: 'Clubs',
    label: 'Clubs & Discos',
    labelEn: 'Clubs & Party',
    query: ['adult.nightclub'],
    icon: Music,
    color: '#a855f7', // Purple
  },

  // --- UTILITY & WISSEN ---
  {
    id: 'Education',
    label: 'Bildung',
    labelEn: 'Education',
    query: ['education'],
    icon: BookOpen,
    color: '#3b82f6', // Blue
  },
  {
    id: 'Coworking',
    label: 'Coworking',
    labelEn: 'Coworking',
    query: ['building.commercial'],
    icon: Building,
    color: '#6b7280', // Gray
  },
  {
    id: 'Shopping',
    label: 'Shopping',
    labelEn: 'Shopping',
    query: ['commercial.shopping_mall'],
    icon: ShoppingBag,
    color: '#84cc16', // Lime
  },
];
