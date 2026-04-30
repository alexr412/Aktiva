'use client';

import {
  Anchor, Ship, Waves, Landmark, Mic, Palette, TreePine, Trees,
  Church, Flame, Film, Coffee, Utensils, Dumbbell,
  Building, Moon, Circle, Sun, Tent, Shield, Globe, User,
  BookOpen, Theater, BottleWine, Image,
  PawPrint,
  Star,
  MoonStar,
  Library,
  Drumstick,
  Gamepad2,
  Droplets,
  LandPlot,
  Users,
  Binoculars,
  Flower2,
  Zap,
  Sparkles,
  type LucideIcon
} from 'lucide-react';
import { cn } from './utils';

/**
 * Custom Icons für Kategorien, die Lucide nicht abdeckt
 */
const TrampolineIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/trampoline.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Trampoline"
  />
);

const WaterparkIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/waterpark.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Waterpark"
  />
);

const NightclubIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/nightclub.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Nightclub"
  />
);

const ZooIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/zoo.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Zoo"
  />
);

const GalleryIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/gallery.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Gallery"
  />
);

const PlaygroundIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/playground.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Playground"
  />
);

/**
 * TagStyle Interface für die visuelle Repräsentation
 */
export interface TagStyle {
  icon: LucideIcon;
  color: string;
  label: string;
  bgClass: string; // Basis-Klasse (z.B. bg-blue-50)
  gradientClass: string; // Vollständige Gradient-Klasse für Premium-Look
  imageUrl?: string;
}

/**
 * getPrimaryIconData - Hierarchisches Icon-Zuweisungssystem (Weighting Index).
 * Löst visuelle Prioritäten deterministisch nach einer definierten Kaskade auf.
 */
export const getPrimaryIconData = (place: any, language: 'de' | 'en' = 'de'): TagStyle => {
  const rawTags = place.categories || place.category || place.tags || [];
  const tags = Array.isArray(rawTags) ? rawTags.filter(Boolean) : (typeof rawTags === 'string' ? [rawTags] : []);
  const name = (place.name || '').toLowerCase();
  const n = name;

  // --- PRIORITÄT 0: Spezifische Entertainment-Kategorien ---
  if (tags.includes('entertainment.museum') || name.includes('museum')) {
    return { icon: Landmark, color: '#4f46e5', label: language === 'de' ? 'Museum' : 'Museum', bgClass: 'bg-indigo-50', gradientClass: 'bg-gradient-to-br from-indigo-600 to-blue-700', imageUrl: 'https://images.unsplash.com/photo-1544333323-c242144ebd53?q=80&w=800&auto=format&fit=crop' };
  }
  if (tags.includes('entertainment.cinema') || name.includes('kino')) {
    return { icon: Film, color: '#4c1d95', label: language === 'de' ? 'Kino' : 'Cinema', bgClass: 'bg-purple-50', gradientClass: 'bg-gradient-to-br from-rose-500 to-orange-500', imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=800&auto=format&fit=crop' };
  }
  if (name.includes('quest') || name.includes('escape') || name.includes('rätsel')) {
    return { icon: Gamepad2, color: '#7c3aed', label: language === 'de' ? 'Escape Room' : 'Escape Room', bgClass: 'bg-violet-50', gradientClass: 'bg-gradient-to-br from-slate-900 to-violet-800' };
  }
  if (tags.includes('entertainment.activity_park.trampoline') || name.includes('trampolin')) {
    return { icon: TrampolineIcon as any, color: '#6366f1', label: language === 'de' ? 'Trampolinhalle' : 'Trampoline Park', bgClass: 'bg-indigo-50', gradientClass: 'bg-gradient-to-br from-fuchsia-500 to-purple-600' };
  }

  // --- SAKRALBAUTEN ---
  if (tags.includes('tourism.sights.place_of_worship.synagogue') || tags.includes('religion.place_of_worship.judaism') || n.includes('synagoge')) {
    return { icon: Star, color: '#3b82f6', label: language === 'de' ? 'Synagoge' : 'Synagogue', bgClass: 'bg-blue-50', gradientClass: 'bg-gradient-to-br from-blue-500 to-indigo-600' };
  }
  if (tags.includes('tourism.sights.place_of_worship.mosque') || tags.includes('religion.place_of_worship.islam') || n.includes('moschee')) {
    return { icon: MoonStar, color: '#10b981', label: language === 'de' ? 'Moschee' : 'Mosque', bgClass: 'bg-emerald-50', gradientClass: 'bg-gradient-to-br from-emerald-500 to-teal-400' };
  }
  if (tags.includes('tourism.sights.place_of_worship.church') || tags.includes('tourism.sights.place_of_worship.cathedral') || tags.includes('tourism.sights.place_of_worship.chapel') || tags.includes('religion.place_of_worship.christianity') || n.includes('kirche') || n.includes('dom') || n.includes('kapelle')) {
    return { icon: Church, color: '#8b5cf6', label: language === 'de' ? 'Religiöser Ort' : 'Religious Site', bgClass: 'bg-violet-50', gradientClass: 'bg-gradient-to-br from-violet-500 to-fuchsia-500' };
  }

  // --- MARITIM & ZOO ---
  if (tags.includes('entertainment.zoo') || name.includes('zoo') || name.includes('tierpark')) {
    return { icon: ZooIcon as any, color: '#7c2d12', label: language === 'de' ? 'Zoo & Tierpark' : 'Zoo', bgClass: 'bg-orange-50', gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-600', imageUrl: 'https://images.unsplash.com/photo-1541315570220-449e7591244d?q=80&w=800&auto=format&fit=crop' };
  }
  if (tags.includes('tourism.attraction.ship') || name.includes('schiff') || name.includes('boot')) {
    return { icon: Ship, color: '#3b82f6', label: language === 'de' ? 'Maritim' : 'Maritime', bgClass: 'bg-blue-50', gradientClass: 'bg-gradient-to-br from-blue-500 to-cyan-400', imageUrl: 'https://images.unsplash.com/photo-1540946484610-45cd54ff3ad2?q=80&w=800&auto=format&fit=crop' };
  }

  // --- WASSER & WELLNESS ---
  if (tags.includes('leisure.water_park') || tags.includes('entertainment.water_park') || name.includes('wasserpark')) {
    return { icon: WaterparkIcon as any, color: '#0284c7', label: language === 'de' ? 'Schwimmbad' : 'Water Park', bgClass: 'bg-sky-50', gradientClass: 'bg-gradient-to-br from-sky-400 to-blue-600', imageUrl: 'https://images.unsplash.com/photo-1562095241-8c6714fd4178?q=80&w=800&auto=format&fit=crop' };
  }
  if (tags.includes('leisure.swimming_pool') || name.includes('bad') || name.includes('schwimm')) {
    return { icon: Droplets, color: '#0ea5e9', label: language === 'de' ? 'Freibad' : 'Pool', bgClass: 'bg-sky-50', gradientClass: 'bg-gradient-to-br from-cyan-400 to-blue-500' };
  }
  if (tags.includes('leisure.spa') || name.includes('wellness') || name.includes('sauna') || name.includes('therme')) {
    return { icon: Flower2, color: '#0891b2', label: language === 'de' ? 'Wellness & Spa' : 'Wellness & Spa', bgClass: 'bg-cyan-50', gradientClass: 'bg-gradient-to-br from-teal-400 to-cyan-500' };
  }

  // --- NATUR & SPIEL ---
  if (tags.includes('leisure.playground') || name.includes('spielplatz')) {
    return { icon: PlaygroundIcon as any, color: '#10b981', label: language === 'de' ? 'Spielplatz' : 'Playground', bgClass: 'bg-emerald-50', gradientClass: 'bg-gradient-to-br from-emerald-400 to-teal-500' };
  }
  if (tags.includes('leisure.park') || tags.includes('pet.dog_park') || n.includes('wiese') || n.includes('park') || n.includes('garten')) {
    return { icon: Trees, color: '#059669', label: language === 'de' ? 'Natur & Park' : 'Nature & Park', bgClass: 'bg-green-50', gradientClass: 'bg-gradient-to-br from-emerald-500 to-lime-400' };
  }

  // --- KULTUR & FREIZEIT ---
  if (tags.includes('entertainment.culture.theatre') || name.includes('theater')) {
    return { icon: Theater, color: '#e11d48', label: language === 'de' ? 'Theater' : 'Theater', bgClass: 'bg-rose-50', gradientClass: 'bg-gradient-to-br from-rose-600 to-pink-500' };
  }
  if (tags.includes('entertainment.culture.arts_centre') || tags.includes('entertainment.culture.gallery') || name.includes('galerie') || name.includes('gallery')) {
    return { icon: GalleryIcon as any, color: '#db2777', label: language === 'de' ? 'Galerie' : 'Gallery', bgClass: 'bg-pink-50', gradientClass: 'bg-gradient-to-br from-pink-500 to-purple-600' };
  }
  if (tags.some((t: string) => t.startsWith('tourism.sights') || t.startsWith('building.historic'))) {
    return { icon: Landmark, color: '#f59e0b', label: language === 'de' ? 'Sehenswürdigkeit' : 'Sight', bgClass: 'bg-amber-50', gradientClass: 'bg-gradient-to-br from-yellow-500 to-orange-600' };
  }

  // --- GASTRONOMIE ---
  if (tags.some((t: string) => t.startsWith('catering.cafe') || t.startsWith('catering.bar') || name.includes('bar') || name.includes('pub'))) {
    return { icon: Coffee, color: '#d97706', label: language === 'de' ? 'Café & Bar' : 'Café & Bar', bgClass: 'bg-amber-50', gradientClass: 'bg-gradient-to-br from-orange-400 to-red-600' };
  }
  if (tags.some((t: string) => t.startsWith('catering')) || name.includes('restaurant')) {
    return { icon: Utensils, color: '#dc2626', label: language === 'de' ? 'Essen & Trinken' : 'Gastronomy', bgClass: 'bg-red-50', gradientClass: 'bg-gradient-to-br from-red-600 to-orange-600' };
  }

  // --- NACHTLEBEN ---
  if (tags.includes('adult.nightclub') || name.includes('club') || name.includes('disco')) {
    return { icon: NightclubIcon as any, color: '#9333ea', label: language === 'de' ? 'Nachtclub' : 'Nightclub', bgClass: 'bg-purple-50', gradientClass: 'bg-gradient-to-br from-pink-600 to-purple-700' };
  }

  // --- COMMUNITY & SONSTIGES ---
  if (tags.includes('user_event')) {
    return { icon: Users, color: '#8b5cf6', label: language === 'de' ? 'Community' : 'Community', bgClass: 'bg-purple-50', gradientClass: 'bg-gradient-to-br from-blue-400 to-fuchsia-500' };
  }

  // --- FALLBACK ---
  return { icon: Building, color: '#94a3b8', label: language === 'de' ? 'Interessanter Ort' : 'Point of Interest', bgClass: 'bg-slate-50', gradientClass: 'bg-gradient-to-br from-slate-400 to-slate-500' };
};

export const getPrimaryTagStyle = (categories: string[], language: 'de' | 'en' = 'de'): TagStyle => {
  return getPrimaryIconData({ categories }, language);
};

export const translateTag = (tag: string, language: 'de' | 'en' = 'de'): string => {
  if (language === 'en') {
    const lastPart = tag.split('.').pop() || tag;
    return (lastPart.charAt(0).toUpperCase() + lastPart.slice(1)).replace(/_/g, ' ');
  }

  const translations: Record<string, string> = {
    'entertainment': 'Unterhaltung',
    'entertainment.museum': 'Museum',
    'entertainment.cinema': 'Kino',
    'entertainment.theme_park': 'Freizeitpark',
    'entertainment.water_park': 'Erlebnisbad',
    'entertainment.zoo': 'Zoo',
    'entertainment.activity_park': 'Aktivitätspark',
    'entertainment.activity_park.trampoline': 'Trampolinhalle',
    'entertainment.culture.theatre': 'Theater',
    'leisure': 'Freizeit',
    'leisure.park': 'Park',
    'leisure.swimming_pool': 'Schwimmbad',
    'leisure.water_park': 'Schwimmbad',
    'leisure.playground': 'Spielplatz',
    'leisure.spa': 'Wellness',
    'leisure.beach': 'Strand',
    'leisure.ice_rink': 'Eissporthalle',
    'tourism': 'Tourismus',
    'tourism.sights': 'Sehenswürdigkeit',
    'tourism.attraction': 'Attraktion',
    'tourism.information': 'Information',
    'catering': 'Gastronomie',
    'catering.restaurant': 'Restaurant',
    'catering.cafe': 'Café',
    'catering.bar': 'Bar',
    'catering.fast_food': 'Schnellimbiss',
    'catering.pub': 'Kneipe',
    'sport': 'Sport',
    'sport.sports_centre': 'Sporthalle',
    'sport.swimming': 'Schwimmen',
    'sport.fitness': 'Fitness',
    'building': 'Gebäude',
    'building.commercial': 'Gewerblich',
    'building.historic': 'Historisch',
    'wheelchair': 'Barrierefrei',
    'wheelchair.yes': 'Barrierefrei',
    'wheelchair.limited': 'Teilw. Barrierefrei',
    'fee': 'Eintrittspflichtig',
    'fee.yes': 'Eintrittspflichtig',
    'fee.no': 'Kostenlos',
    'commercial': 'Gewerbe',
    'activity': 'Aktivität',
    'amenity': 'Einrichtung',
    'natural': 'Natur',
    'adult': 'Ab 18',
    'adult.nightclub': 'Club',
    'escape': 'Escape Room',
    'entertainment.escape_game': 'Escape Room',
    'internet_access': 'WLAN verfügbar',
    'internet_access.free': 'Gratis WLAN',
    'dogs': 'Hunde erlaubt',
    'dogs.leashed': 'Hunde (Leine)',
    'dogs.yes': 'Hunde willkommen',
    'parking': 'Parkplatz',
    'rental': 'Verleih',
    'shop': 'Geschäft'
  };

  // 1. Check full tag path
  if (translations[tag.toLowerCase()]) return translations[tag.toLowerCase()];

  // 2. Check last part of the dot notation
  const lastPart = tag.split('.').pop() || tag;
  const lastPartLower = lastPart.toLowerCase();
  
  if (translations[lastPartLower]) return translations[lastPartLower];

  // 3. Fallback: Remove underscores, spaces and capitalize
  return (lastPart.charAt(0).toUpperCase() + lastPart.slice(1))
    .replace(/_/g, ' ')
    .replace(/\./g, ' ');
};

export const getCleanTags = (tags: string[]): { tag: string, isMain: boolean }[] => {
  if (!tags || !Array.isArray(tags)) return [];

  // 1. Filter out redundant tags (if child exists, remove parent)
  let deduplicated = tags.filter(tag => 
    !tags.some(other => other !== tag && other.startsWith(tag + '.'))
  );

  // 2. Specific redundancy: If we have entertainment.*, remove building.entertainment or entertainment
  const hasSpecificEntertainment = deduplicated.some(t => 
    t.startsWith('entertainment.') && t !== 'entertainment'
  );
  
  if (hasSpecificEntertainment) {
    deduplicated = deduplicated.filter(t => t !== 'entertainment' && t !== 'building.entertainment');
  }

  // 3. Filter out low-value/technical tags
  const filtered = deduplicated.filter(tag => {
    const t = tag.toLowerCase();
    return !['yes', 'no', 'access', 'public', 'fee.yes', 'fee.no', 'building', 'no_fee'].includes(t);
  });

  // 4. Classify tags
  return filtered.map(tag => {
    const t = tag.toLowerCase();
    const isAttribute = t.startsWith('wheelchair') || 
                        t.startsWith('fee') || 
                        t.startsWith('access') || 
                        t.startsWith('internet_access') ||
                        t.startsWith('dogs') ||
                        t.startsWith('payment') ||
                        t.startsWith('building.'); // Mark building tags as attributes (grey)
    
    return {
      tag,
      isMain: !isAttribute
    };
  });
};
