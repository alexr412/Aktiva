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
  Binoculars,
  Flower2,
  Zap,
} from 'lucide-react';

export const availableTabs = [
  // --- KULTUR & HISTORIE ---
  {
    id: 'Sights',
    label: 'Sehenswürdigkeiten',
    labelEn: 'Sights',
    query: ['tourism.sights'],
    icon: Landmark,
    color: '#f59e0b', // Amber
  },
  {
    id: 'Viewpoints',
    label: 'Aussichtspunkte',
    labelEn: 'Viewpoints',
    query: ['tourism.attraction.viewpoint'],
    icon: Binoculars,
    color: '#d97706', // Dark Amber
  },
  {
    id: 'Religion',
    label: 'Religion & Glaube',
    labelEn: 'Religion',
    query: ['religion', 'religion.place_of_worship'],
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
    query: ['leisure.park', 'leisure.park.garden', 'leisure.park.nature_reserve', 'leisure.playground'],
    icon: TreePine,
    color: '#10b981', // Green
  },
  {
    id: 'Wellness',
    label: 'Wellness & Spa',
    labelEn: 'Wellness',
    query: ['leisure.spa', 'leisure.spa.sauna'],
    icon: Flower2,
    color: '#06b6d4', // Cyan
  },
  {
    id: 'Water',
    label: 'Wasser & Strand',
    labelEn: 'Water & Beach',
    query: ['beach', 'entertainment.water_park', 'sport.swimming_pool'],
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
    query: ['sport'],
    icon: Dumbbell,
    color: '#f97316', // Orange
  },
  {
    id: 'ActivityParks',
    label: 'Aktivitätsparks',
    labelEn: 'Activity Parks',
    query: ['entertainment.activity_park', 'entertainment.activity_park.climbing', 'entertainment.activity_park.trampoline'],
    icon: Zap,
    color: '#4f46e5', // Indigo
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
    query: ['education.library', 'education.university'],
    icon: BookOpen,
    color: '#3b82f6', // Blue
  },
  {
    id: 'Coworking',
    label: 'Coworking',
    labelEn: 'Coworking',
    query: ['office.coworking'],
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
