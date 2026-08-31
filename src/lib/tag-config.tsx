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
import { cn, formatLabel } from './utils';
import type { Activity, Place, Chat, UserProfile } from '@/lib/types';

/**
 * Custom Icons für Kategorien, die Lucide nicht abdeckt
 */
const AttractionIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/attraction.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Attraction"
  />
);

const SculptureIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/sculpture.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Sculpture"
  />
);

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

const BowlingIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/bowling.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Bowling"
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

const MinigolfIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/minigolf.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Minigolf"
  />
);

const EscapeRoomIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/escaperoom.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Escape Room"
  />
);

const ActivityParkIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/activitypark.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Activity Park"
  />
);

const ArcadeIcon = ({ className }: { className?: string }) => (
  <img
    src="/assets/icons/arcade.png"
    className={cn(className)}
    style={{ filter: 'brightness(0) invert(1)' }}
    alt="Arcade"
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

export type PlaceVisualMeta = TagStyle;

/**
 * getPrimaryIconData - Hierarchisches Icon-Zuweisungssystem (Weighting Index).
 * Löst visuelle Prioritäten deterministisch nach einer definierten Kaskade auf.
 */
export const getPrimaryIconData = (place: any, language: 'de' | 'en' = 'de'): TagStyle => {
  const placeCats = Array.isArray(place?.placeCategories) ? place.placeCategories : [];
  const baseTags = place?.categories || place?.category || place?.tags || [];
  const rawTags = placeCats.length > 0
    ? [...placeCats, ...(Array.isArray(baseTags) ? baseTags : (typeof baseTags === 'string' ? [baseTags] : []))]
    : baseTags;
  const tags = (Array.isArray(rawTags) ? rawTags.filter(Boolean) : (typeof rawTags === 'string' ? [rawTags] : [])).map((t: string) => t.trim().toLowerCase());
  let nameStr = '';
  if (place?.name) {
    if (typeof place.name === 'string') {
      nameStr = place.name;
    } else if (typeof place.name === 'object') {
      nameStr = place.name.de || place.name.en || place.name.name || '';
    } else {
      nameStr = String(place.name);
    }
  }
  const name = nameStr.toLowerCase();
  const n = name;

  const normalizeCommunityCategory = (cat: string): string => {
    const c = cat.trim().toLowerCase();
    if (c === 'sports' || c === 'sport') return 'sports';
    if (c === 'outdoor' || c === 'outdoors') return 'outdoor';
    if (c === 'party') return 'party';
    if (c === 'culture' || c === 'kultur') return 'culture';
    if (c === 'gaming') return 'gaming';
    if (c === 'tech' || c === 'technology') return 'tech';
    if (c === 'networking') return 'networking';
    if (c === 'other' || c === 'sonstiges' || c === 'andere') return 'other';
    return c;
  };

  const isFreeCommunityEvent = place?.isUserEvent === true || place?.creationSource === 'community' || tags.includes('user_event');

  if (isFreeCommunityEvent) {
    const cleanTags = tags.filter((t: string) => t !== 'user_event');
    let matchedCategory = '';
    for (const t of cleanTags) {
      const normalized = normalizeCommunityCategory(t);
      if (['sports', 'outdoor', 'party', 'culture', 'gaming', 'tech', 'networking', 'other'].includes(normalized)) {
        matchedCategory = normalized;
        break;
      }
    }

    if (matchedCategory === 'sports') {
      return { icon: Dumbbell, color: '#3b82f6', label: language === 'de' ? 'Sport' : 'Sports', bgClass: 'bg-blue-50', gradientClass: 'bg-gradient-to-br from-blue-500 to-cyan-500' };
    }
    if (matchedCategory === 'outdoor') {
      return { icon: Trees, color: '#059669', label: language === 'de' ? 'Outdoor' : 'Outdoor', bgClass: 'bg-green-50', gradientClass: 'bg-gradient-to-br from-emerald-500 to-lime-500' };
    }
    if (matchedCategory === 'party') {
      return { icon: Flame, color: '#f97316', label: language === 'de' ? 'Party' : 'Party', bgClass: 'bg-orange-50', gradientClass: 'bg-gradient-to-br from-orange-500 to-red-500' };
    }
    if (matchedCategory === 'culture') {
      return { icon: Landmark, color: '#f59e0b', label: language === 'de' ? 'Kultur' : 'Culture', bgClass: 'bg-amber-50', gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-500' };
    }
    if (matchedCategory === 'gaming') {
      return { icon: Gamepad2, color: '#8b5cf6', label: language === 'de' ? 'Gaming' : 'Gaming', bgClass: 'bg-violet-50', gradientClass: 'bg-gradient-to-br from-indigo-500 to-violet-600' };
    }
    if (matchedCategory === 'tech') {
      return { icon: Zap, color: '#06b6d4', label: language === 'de' ? 'Tech' : 'Tech', bgClass: 'bg-cyan-50', gradientClass: 'bg-gradient-to-br from-cyan-400 to-blue-500' };
    }
    if (matchedCategory === 'networking') {
      return { icon: Coffee, color: '#d97706', label: language === 'de' ? 'Networking' : 'Networking', bgClass: 'bg-amber-50', gradientClass: 'bg-gradient-to-br from-orange-400 to-rose-500' };
    }
    if (matchedCategory === 'other') {
      return { icon: Star, color: '#eab308', label: language === 'de' ? 'Sonstiges' : 'Other', bgClass: 'bg-yellow-50', gradientClass: 'bg-gradient-to-br from-yellow-400 to-amber-500' };
    }

    return { 
      icon: Users, 
      color: '#8b5cf6', 
      label: formatLabel(language === 'de' ? 'Community' : 'Community'), 
      bgClass: 'bg-purple-50', 
      gradientClass: 'bg-gradient-to-br from-blue-400 to-fuchsia-500' 
    };
  }

  // --- PRIORITÄT 0: Spezifische Entertainment-Kategorien ---
  if (tags.some((t: string) => t.includes('museum')) || name.includes('museum')) {
    return { icon: Landmark, color: '#4f46e5', label: language === 'de' ? 'Museum' : 'Museum', bgClass: 'bg-indigo-50', gradientClass: 'bg-gradient-to-br from-indigo-600 to-blue-700', imageUrl: 'https://images.unsplash.com/photo-1544333323-c242144ebd53?q=80&w=800&auto=format&fit=crop' };
  }
  if (tags.some((t: string) => t.includes('cinema')) || name.includes('kino')) {
    return { icon: Film, color: '#4c1d95', label: language === 'de' ? 'Kino' : 'Cinema', bgClass: 'bg-purple-50', gradientClass: 'bg-gradient-to-br from-rose-500 to-orange-500', imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=800&auto=format&fit=crop' };
  }
  if (tags.some((t: string) => t.includes('escape')) || name.includes('quest') || name.includes('escape') || name.includes('rätsel')) {
    return { icon: EscapeRoomIcon as any, color: '#7c3aed', label: language === 'de' ? 'Escape Room' : 'Escape Room', bgClass: 'bg-violet-50', gradientClass: 'bg-gradient-to-br from-slate-900 to-violet-800' };
  }
  if (tags.some((t: string) => t.includes('trampoline')) || name.includes('trampolin') || name.includes('sprung')) {
    return { icon: TrampolineIcon as any, color: '#6366f1', label: language === 'de' ? 'Trampolinhalle' : 'Trampoline Park', bgClass: 'bg-indigo-50', gradientClass: 'bg-gradient-to-br from-fuchsia-500 to-purple-600' };
  }
  if (tags.some((t: string) => t.startsWith('entertainment.activity_park')) || name.includes('aktivitätspark') || name.includes('activity park')) {
    return { icon: ActivityParkIcon as any, color: '#10b981', label: language === 'de' ? 'Aktivitätspark' : 'Activity Park', bgClass: 'bg-emerald-50', gradientClass: 'bg-gradient-to-br from-emerald-400 to-teal-500' };
  }
  if (tags.some((t: string) => t.includes('miniature_golf') || t.includes('minigolf')) || name.includes('minigolf') || name.includes('adventure golf')) {
    return { icon: MinigolfIcon as any, color: '#10b981', label: language === 'de' ? 'Minigolf' : 'Minigolf', bgClass: 'bg-emerald-50', gradientClass: 'bg-gradient-to-br from-emerald-500 to-teal-400' };
  }
  if (tags.some((t: string) => t.includes('bowling')) || name.includes('bowling') || name.includes('kegeln')) {
    return { icon: BowlingIcon as any, color: '#f43f5e', label: language === 'de' ? 'Bowling' : 'Bowling', bgClass: 'bg-rose-50', gradientClass: 'bg-gradient-to-br from-rose-500 to-pink-600' };
  }
  if (tags.some((t: string) => t.includes('arcade')) || name.includes('arcade') || name.includes('spielhalle')) {
    return { icon: ArcadeIcon as any, color: '#ec4899', label: language === 'de' ? 'Spielhalle' : 'Arcade', bgClass: 'bg-pink-50', gradientClass: 'bg-gradient-to-br from-pink-500 to-rose-600' };
  }

  // --- GASTRONOMIE ---
  if (tags.some((t: string) => t.startsWith('catering') || t.includes('restaurant') || t.includes('cafe') || t.includes('bar') || t.includes('pub')) || name.includes('restaurant') || name.includes('café') || name.includes('cafe') || name.includes('bar') || name.includes('pub')) {
    if (tags.some((t: string) => t.includes('cafe')) || name.includes('café') || name.includes('cafe')) {
      return { icon: Coffee, color: '#d97706', label: language === 'de' ? 'Café & Bar' : 'Café & Bar', bgClass: 'bg-amber-50', gradientClass: 'bg-gradient-to-br from-orange-400 to-red-600' };
    }
    return { icon: Utensils, color: '#dc2626', label: language === 'de' ? 'Essen & Trinken' : 'Gastronomy', bgClass: 'bg-red-50', gradientClass: 'bg-gradient-to-br from-red-600 to-orange-600' };
  }

  // --- SAKRALBAUTEN ---
  if (tags.some((t: string) => t.includes('synagogue') || t.includes('judaism')) || n.includes('synagoge')) {
    return { icon: Star, color: '#3b82f6', label: language === 'de' ? 'Synagoge' : 'Synagogue', bgClass: 'bg-blue-50', gradientClass: 'bg-gradient-to-br from-blue-500 to-indigo-600' };
  }
  if (tags.some((t: string) => t.includes('mosque') || t.includes('islam')) || n.includes('moschee')) {
    return { icon: MoonStar, color: '#10b981', label: language === 'de' ? 'Moschee' : 'Mosque', bgClass: 'bg-emerald-50', gradientClass: 'bg-gradient-to-br from-emerald-500 to-teal-400' };
  }
  if (tags.some((t: string) => t.includes('church') || t.includes('cathedral') || t.includes('chapel') || t.includes('christianity')) || n.includes('kirche') || n.includes('dom') || n.includes('kapelle')) {
    return { icon: Church, color: '#8b5cf6', label: language === 'de' ? 'Religiöser Ort' : 'Religious Site', bgClass: 'bg-violet-50', gradientClass: 'bg-gradient-to-br from-violet-500 to-fuchsia-500' };
  }

  // --- MARITIM & ZOO ---
  if (tags.some((t: string) => t.includes('zoo')) || name.includes('zoo') || name.includes('tierpark')) {
    return { icon: ZooIcon as any, color: '#7c2d12', label: language === 'de' ? 'Zoo & Tierpark' : 'Zoo', bgClass: 'bg-orange-50', gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-600', imageUrl: 'https://images.unsplash.com/photo-1541315570220-449e7591244d?q=80&w=800&auto=format&fit=crop' };
  }
  if (tags.some((t: string) => t.includes('ship')) || name.includes('schiff') || name.includes('boot')) {
    return { icon: Ship, color: '#3b82f6', label: language === 'de' ? 'Maritim' : 'Maritime', bgClass: 'bg-blue-50', gradientClass: 'bg-gradient-to-br from-blue-500 to-cyan-400', imageUrl: 'https://images.unsplash.com/photo-1540946484610-45cd54ff3ad2?q=80&w=800&auto=format&fit=crop' };
  }

  // --- WASSER & WELLNESS ---
  if (tags.some((t: string) => t.includes('water_park') || t.includes('waterpark')) || name.includes('wasserpark')) {
    return { icon: WaterparkIcon as any, color: '#0284c7', label: language === 'de' ? 'Schwimmbad' : 'Water Park', bgClass: 'bg-sky-50', gradientClass: 'bg-gradient-to-br from-sky-400 to-blue-600', imageUrl: 'https://images.unsplash.com/photo-1562095241-8c6714fd4178?q=80&w=800&auto=format&fit=crop' };
  }
  if (
    tags.some((t: string) =>
      t.includes('swimming_pool') ||
      t.includes('swimming') ||
      t.includes('water_park') ||
      t.includes('waterpark') ||
      t.includes('aquatic') ||
      t.includes('freizeitbad') ||
      t.includes('hallenbad') ||
      t.includes('freibad') ||
      t.includes('thermalbad') ||
      t.includes('badeanstalt')
    ) ||
    name.includes('schwimmbad') ||
    name.includes('freibad') ||
    name.includes('hallenbad') ||
    name.includes('freizeitbad') ||
    name.includes('thermalbad') ||
    name.includes('erlebnisbad') ||
    name.includes('badeanstalt')
  ) {
    return { icon: Droplets, color: '#0ea5e9', label: language === 'de' ? 'Schwimmbad' : 'Pool', bgClass: 'bg-sky-50', gradientClass: 'bg-gradient-to-br from-cyan-400 to-blue-500' };
  }
  if (
    tags.some((t: string) => t.includes('spa') || t.includes('wellness') || t.includes('sauna') || t.includes('therme')) ||
    name.includes('wellness') ||
    name.includes('sauna') ||
    name.includes('therme')
  ) {
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
  if (tags.some((t: string) => t.endsWith('.sculpture') || t.endsWith('.artwork') || t === 'sculpture' || t === 'artwork') || name.includes('skulptur') || name.includes('plastik') || name.includes('denkmal') || name.includes('sculpture')) {
    return { 
      icon: SculptureIcon as any, 
      color: '#db2777', 
      label: language === 'de' ? 'Kunstwerk' : 'Artwork', 
      bgClass: 'bg-pink-50', 
      gradientClass: 'bg-gradient-to-br from-pink-500 to-rose-500',
      imageUrl: 'https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?q=80&w=800&auto=format&fit=crop'
    };
  }
  if (tags.some((t: string) => t.endsWith('.attraction') || t === 'attraction') || name.includes('attraktion') || name.includes('attraction')) {
    return { 
      icon: AttractionIcon as any, 
      color: '#e11d48', 
      label: language === 'de' ? 'Attraktion' : 'Attraction', 
      bgClass: 'bg-rose-50', 
      gradientClass: 'bg-gradient-to-br from-rose-500 to-red-600',
      imageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=800&auto=format&fit=crop'
    };
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

  // --- USER EVENT SPECIFIC CATEGORIES ---
  if (tags.includes('sport')) {
    return { icon: Dumbbell, color: '#3b82f6', label: language === 'de' ? 'Sport' : 'Sports', bgClass: 'bg-blue-50', gradientClass: 'bg-gradient-to-br from-blue-500 to-cyan-500' };
  }
  if (tags.includes('outdoor')) {
    return { icon: Trees, color: '#059669', label: language === 'de' ? 'Outdoor' : 'Outdoor', bgClass: 'bg-green-50', gradientClass: 'bg-gradient-to-br from-emerald-500 to-lime-500' };
  }
  if (tags.includes('party')) {
    return { icon: Flame, color: '#f97316', label: language === 'de' ? 'Party' : 'Party', bgClass: 'bg-orange-50', gradientClass: 'bg-gradient-to-br from-orange-500 to-red-500' };
  }
  if (tags.includes('kultur') || tags.includes('culture')) {
    return { icon: Landmark, color: '#f59e0b', label: language === 'de' ? 'Kultur' : 'Culture', bgClass: 'bg-amber-50', gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-500' };
  }
  if (tags.includes('gaming')) {
    return { icon: Gamepad2, color: '#8b5cf6', label: language === 'de' ? 'Gaming' : 'Gaming', bgClass: 'bg-violet-50', gradientClass: 'bg-gradient-to-br from-indigo-500 to-violet-600' };
  }
  if (tags.includes('tech')) {
    return { icon: Zap, color: '#06b6d4', label: language === 'de' ? 'Tech' : 'Tech', bgClass: 'bg-cyan-50', gradientClass: 'bg-gradient-to-br from-cyan-400 to-blue-500' };
  }
  if (tags.includes('networking')) {
    return { icon: Coffee, color: '#d97706', label: language === 'de' ? 'Networking' : 'Networking', bgClass: 'bg-amber-50', gradientClass: 'bg-gradient-to-br from-orange-400 to-rose-500' };
  }
  if (tags.includes('sonstiges') || tags.includes('other') || tags.includes('andere')) {
    return { icon: Star, color: '#eab308', label: language === 'de' ? 'Sonstiges' : 'Other', bgClass: 'bg-yellow-50', gradientClass: 'bg-gradient-to-br from-yellow-400 to-amber-500' };
  }

  // --- COMMUNITY & SONSTIGES ---
  if (tags.includes('user_event')) {
    return { 
      icon: Users, 
      color: '#8b5cf6', 
      label: formatLabel(language === 'de' ? 'Community' : 'Community'), 
      bgClass: 'bg-purple-50', 
      gradientClass: 'bg-gradient-to-br from-blue-400 to-fuchsia-500' 
    };
  }

  // --- FALLBACK ---
  return { 
    icon: Building, 
    color: '#475569', 
    label: formatLabel(language === 'de' ? 'Interessanter Ort' : 'Point of Interest'), 
    bgClass: 'bg-slate-50', 
    gradientClass: 'bg-gradient-to-br from-slate-500 to-slate-600' 
  };
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
    'entertainment.bowling_alley': 'Bowling',
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
    'tourism.artwork': 'Kunstwerk',
    'tourism.artwork.sculpture': 'Skulptur',
    'sculpture': 'Skulptur',
    'artwork': 'Kunstwerk',
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
  let result = translations[tag.toLowerCase()];

  // 2. Check last part of the dot notation
  if (!result) {
    const lastPart = tag.split('.').pop() || tag;
    const lastPartLower = lastPart.toLowerCase();
    result = translations[lastPartLower] || lastPart;
  }

  return formatLabel(result);
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
    return !['yes', 'no', 'access', 'public', 'fee.yes', 'fee.no', 'building', 'no_fee', 'named', 'user_event'].includes(t) && 
           !t.endsWith('.no') && 
           !t.endsWith('.yes');
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

export function getRoomVisualCategory({
  activity,
  place,
  chat
}: {
  activity: Activity | null;
  place: Place | null;
  chat?: Chat | null;
}) {
  const isPlaceBased =
    Boolean(activity?.placeId && activity?.placeId !== 'custom') ||
    activity?.creationSource === 'place_activity' ||
    Boolean(chat?.placeId && chat?.placeId !== 'custom') ||
    chat?.creationSource === 'place_activity' ||
    Boolean(place);

  let categories: string[] = [];
  let name = place?.name || activity?.placeName || chat?.placeName || '';

  if (isPlaceBased) {
    if (place?.categories && place.categories.length > 0) {
      categories = place.categories;
    } else if (place?.category) {
      categories = [place.category];
    } else if (activity?.placeCategories && activity.placeCategories.length > 0) {
      categories = activity.placeCategories;
    } else if (chat?.placeCategories && chat.placeCategories.length > 0) {
      categories = chat.placeCategories;
    } else if (activity?.category) {
      categories = [activity.category];
    } else if (activity?.categories && activity.categories.length > 0) {
      categories = activity.categories.filter(c => c !== 'user_event');
    } else if (chat?.categories && chat.categories.length > 0) {
      categories = chat.categories.filter(c => c !== 'user_event');
    }
  } else {
    // Free Community Event
    if (activity?.category) {
      categories = [activity.category];
    } else if (activity?.categories && activity.categories.length > 0) {
      categories = activity.categories.filter(c => c !== 'user_event');
    } else if (chat?.categories && chat.categories.length > 0) {
      categories = chat.categories.filter(c => c !== 'user_event');
    }
  }

  const isUserEvent = activity?.isUserEvent ?? (chat?.isUserEvent ?? !isPlaceBased);
  const creationSource = activity?.creationSource ?? chat?.creationSource;

  return { categories, name, isUserEvent, creationSource };
}

/**
 * Localization Infrastructure for the home screen (Pulse red/green live status, etc.).
 */
const APP_TRANSLATIONS: Record<string, { de: string | ((...args: any[]) => string); en: string | ((...args: any[]) => string) }> = {
  'pulse.eyebrow': {
    de: 'ACTIVA PULSE',
    en: 'ACTIVA PULSE'
  },
  'pulse.heading.near_you': {
    de: 'Was geht in deiner Nähe?',
    en: "What's happening near you?"
  },
  'pulse.heading.city': {
    de: (city: string) => `Was geht in ${city}?`,
    en: (city: string) => `What's happening in ${city}?`
  },
  'pulse.cta': {
    de: 'Jetzt entdecken',
    en: 'Discover Now'
  },
  'pulse.cta.open_rooms': {
    de: 'Offene Räume ansehen',
    en: 'View open rooms'
  },
  'pulse.cta.create': {
    de: 'Aktivität erstellen',
    en: 'Create activity'
  },
  'pulse.feed_mode.open_rooms': {
    de: 'Offene Räume',
    en: 'Open rooms'
  },
  'pulse.fallback': {
    de: 'Entdecke, was heute passiert',
    en: "Discover what's happening today"
  },
  'pulse.fallback.places': {
    de: 'Aktivitäten in deiner Nähe',
    en: 'Activities in your area'
  },
  'pulse.open_rooms_count': {
    de: (count: number) => {
      if (count === 0) return 'Aktuell keine offenen Räume';
      if (count === 1) return '1 offener Raum';
      return `${count} offene Räume`;
    },
    en: (count: number) => {
      if (count === 0) return 'No open rooms right now';
      if (count === 1) return '1 open room';
      return `${count} open rooms`;
    }
  },
  'pulse.unique_participants_count': {
    de: (count: number) => {
      if (count === 0) return 'Noch niemand ist dabei';
      if (count === 1) return '1 Person ist dabei';
      return `${count} Personen sind dabei`;
    },
    en: (count: number) => {
      if (count === 0) return 'No one is taking part yet';
      if (count === 1) return '1 person is taking part';
      return `${count} people are taking part`;
    }
  },
  'pulse.location_fallback': {
    de: 'Offene Räume werden angezeigt, sobald dein Standort verfügbar ist.',
    en: 'Open rooms will appear once your location is available.'
  },
  'featured.label': {
    de: 'Top-Ergebnis',
    en: 'Top result'
  },
  'activity.spots_left': {
    de: (count: number) => count === 1 ? 'Noch 1 Platz' : `Noch ${count} Plätze`,
    en: (count: number) => count === 1 ? '1 spot left' : `${count} spots left`
  },
  'activity.full': {
    de: 'Voll',
    en: 'Full'
  },
  'activity.join': {
    de: 'Beitreten',
    en: 'Join'
  },
  'activity.request': {
    de: 'Anfragen',
    en: 'Request to join'
  },
  'activity.requested': {
    de: 'Angefragt',
    en: 'Requested'
  },
  'activity.joined': {
    de: 'Beigetreten',
    en: 'Joined'
  },
  'activity.host': {
    de: 'Veranstalter',
    en: 'Host'
  },
  'activity.community': {
    de: 'Community',
    en: 'Community'
  },
  'activity.starts_soon': {
    de: 'Startet in Kürze',
    en: 'Starting soon'
  },
  'activity.loading': {
    de: 'Wird geladen...',
    en: 'Loading...'
  },
  'activity.participants': {
    de: (count: number) => count === 1 ? '1 Teilnehmer' : `${count} Teilnehmer`,
    en: (count: number) => count === 1 ? '1 participant' : `${count} participants`
  },
  'activity.participants_list': {
    de: (count: number) => `Teilnehmerliste · ${count}`,
    en: (count: number) => `Participants · ${count}`
  },
  'ticket.show': {
    de: 'Ticket anzeigen',
    en: 'Show ticket'
  },
  'ticket.hide': {
    de: 'Ticket verbergen',
    en: 'Hide ticket'
  },
  'ticket.spot_open': {
    de: 'Freier Platz',
    en: 'Open spot'
  },
  'ticket.spots_remaining_summary': {
    de: (count: number) => `+${count} weitere freie Plätze`,
    en: (count: number) => `+${count} more open spots`
  },
  'loading.results': {
    de: 'Ergebnisse werden geladen...',
    en: 'Loading results...'
  },
  'loading.results_more': {
    de: 'Weitere Ergebnisse werden geladen...',
    en: 'Loading more results...'
  },
  'empty.no_search_matches': {
    de: 'Keine Übereinstimmungen für deine Suche gefunden.',
    en: 'No matches found for your search.'
  },
  'empty.no_places': {
    de: 'Keine passenden Orte gefunden.',
    en: 'No matching places found.'
  },
  'empty.no_activities': {
    de: 'Keine passenden Community-Aktivitäten gefunden.',
    en: 'No matching community activities found.'
  },
  'empty.action.clear_search': {
    de: 'Suche löschen',
    en: 'Clear search'
  },
  'empty.action.reset_filters': {
    de: 'Filter zurücksetzen',
    en: 'Reset filters'
  },
  'empty.action.increase_radius': {
    de: 'Radius erhöhen',
    en: 'Increase radius'
  },
  'empty.action.retry': {
    de: 'Erneut versuchen',
    en: 'Retry'
  },
  'error.location_unavailable': {
    de: 'Standort konnte nicht ermittelt werden. Bitte aktiviere den Standortzugriff.',
    en: 'Location could not be determined. Please enable location access.'
  },
  'error.connection_problem': {
    de: 'Verbindungsproblem. Bitte versuche es später noch einmal.',
    en: 'Connection problem. Please try again later.'
  },
  'tutorial.step1.title': {
    de: 'Dein Profil',
    en: 'Your Profile'
  },
  'tutorial.step1.description': {
    de: 'Hier siehst du deinen Namen und deinen Profilbereich.',
    en: 'Here you can see your name and profile section.'
  },
  'tutorial.step2.title': {
    de: 'Aktueller Standort',
    en: 'Current Location'
  },
  'tutorial.step2.description': {
    de: 'Hier siehst du, für welchen Ort dir gerade Aktivitäten und Spots angezeigt werden.',
    en: 'Here you can see the location currently selected for activities and spots.'
  },
  'tutorial.step3.title': {
    de: 'Dein Feed',
    en: 'Your Feed'
  },
  'tutorial.step3.description': {
    de: 'Das ist der Kern von Activa. Hier siehst du, was in deiner Umgebung gerade los ist.',
    en: 'This is the core of Activa. Here you can see what is happening around you.'
  },
  'tutorial.step4.title': {
    de: 'Aktivitäten an Orten',
    en: 'Activities at Places'
  },
  'tutorial.step4.description': {
    de: 'Unter Aktiv findest du aktuelle Räume und Aktivitäten an bestehenden Orten in deiner Nähe.',
    en: 'Under Active you will find current rooms and activities at existing spots nearby.'
  },
  'tutorial.step5.title': {
    de: 'Community-Aktivitäten',
    en: 'Community Activities'
  },
  'tutorial.step5.description': {
    de: 'Unter Community findest du Aktivitäten, die andere Nutzer selbst erstellt haben.',
    en: 'Under Community you will find meetups created directly by other users.'
  },
  'tutorial.step6.title': {
    de: 'Deine Favoriten',
    en: 'Your Favorites'
  },
  'tutorial.step6.description': {
    de: 'Hier findest du Aktivitäten und Orte wieder, die du gespeichert hast.',
    en: 'Here you can quickly find activities and spots you have saved.'
  },
  'tutorial.step7.title': {
    de: 'Filter & Umkreis',
    en: 'Filters & Radius'
  },
  'tutorial.step7.description': {
    de: 'Mit den Filtern und dem Umkreis bestimmst du, was dir im Feed angezeigt wird.',
    en: 'Use filters and radius to customize what appears in your feed.'
  },
  'tutorial.step8.title': {
    de: 'Aktivität an einem Ort',
    en: 'Activity at a Spot'
  },
  'tutorial.step8.description': {
    de: 'Mit dem + an einem Ort kannst du direkt dort eine Aktivität erstellen.',
    en: 'Use the + button on a spot to host an activity right there.'
  },
  'tutorial.step9.title': {
    de: 'Eigene Aktivität erstellen',
    en: 'Create Custom Activity'
  },
  'tutorial.step9.description': {
    de: 'Mit dem + unten kannst du eine eigene Aktivität unabhängig von einem vorgeschlagenen Ort erstellen.',
    en: 'Tap the + button below to create your own custom activity anytime.'
  },
  'tutorial.step10.title': {
    de: 'Entdecken',
    en: 'Explore'
  },
  'tutorial.step10.description': {
    de: 'Swipe durch Aktivitäten und Orte und finde schnell, was dich interessiert.',
    en: 'Swipe through activities and spots to quickly find what interests you.'
  },
  'tutorial.step11.title': {
    de: 'Karte',
    en: 'Map'
  },
  'tutorial.step11.description': {
    de: 'Auf der Karte siehst du Aktivitäten und Orte direkt in deiner Umgebung.',
    en: 'View activities and spots geographically around you on the map.'
  },
  'tutorial.step12.title': {
    de: 'Chats',
    en: 'Chats'
  },
  'tutorial.step12.description': {
    de: 'Hier schreibst du mit den Teilnehmern deiner Aktivitäten und planst eure Treffen.',
    en: 'Chat with participants of your activities and organize meetups.'
  },
  'tutorial.step13.title': {
    de: 'Profil',
    en: 'Profile'
  },
  'tutorial.step13.description': {
    de: 'Hier verwaltest du dein Profil, deine Aktivitäten, Favoriten und Einstellungen.',
    en: 'Manage your profile, hosted activities, saved spots, and settings.'
  },
  'tutorial.step14.title': {
    de: 'Regeln & Sicherheit',
    en: 'Rules & Safety'
  },
  'tutorial.step14.description': {
    de: 'Bleib stets respektvoll und freundlich. Beleidigungen sind nicht erlaubt – passe bei Treffen mit anderen immer auf deine Sicherheit auf!',
    en: 'Be respectful and friendly at all times. Insults are not tolerated – stay safe when meeting others in person!'
  },
  'tutorial.next': {
    de: 'Weiter',
    en: 'Next'
  },
  'tutorial.finish': {
    de: 'Fertig',
    en: 'Finish'
  },
  'tutorial.back': {
    de: 'Zurück',
    en: 'Back'
  },
  'tutorial.skip': {
    de: 'Überspringen',
    en: 'Skip'
  },
  'tutorial.progress': {
    de: (current: number, total: number) => `${current} von ${total}`,
    en: (current: number, total: number) => `${current} of ${total}`
  }
};

export const translateAppString = (
  key: string,
  language: 'de' | 'en' = 'de',
  ...args: (string | number)[]
): string => {
  const trans = APP_TRANSLATIONS[key];
  if (!trans) return key;
  const valueObj = trans[language] || trans['de'];
  if (typeof valueObj === 'function') {
    return valueObj(...(args as [any, ...any[]]));
  }
  return valueObj;
};

export const ACTIVITY_EXPIRY_THRESHOLD_MS = 86400000; // 24 hours

export function isActivityRoomOpen(
  activity: Activity,
  now: number,
  userProfile?: UserProfile | null
): boolean {
  if (!activity) return false;

  // 1. Status check
  if (activity.status !== 'active') return false;

  // 2. Personal safety/blacklist filters
  const hostId = activity.hostId;
  if (hostId && userProfile?.blacklist) {
    const hardBlocked = userProfile.blacklist.hard || [];
    const softBlocked = userProfile.blacklist.soft || [];
    if (hardBlocked.includes(hostId) || softBlocked.includes(hostId)) return false;
  }
  if (activity.id && userProfile?.hiddenEntityIds?.includes(activity.id)) return false;

  // 3. Expiry / Calendar logic
  let startMs = null;
  if (activity.activityDate) {
    if (typeof (activity.activityDate as any).toMillis === 'function') {
      startMs = (activity.activityDate as any).toMillis();
    } else if (typeof (activity.activityDate as any).toDate === 'function') {
      startMs = (activity.activityDate as any).toDate().getTime();
    } else if (typeof activity.activityDate === 'number') {
      startMs = activity.activityDate;
    } else if (typeof activity.activityDate === 'string') {
      startMs = Date.parse(activity.activityDate);
      if (isNaN(startMs)) startMs = null;
    }
  }
  if (startMs === null) return false;

  if (activity.activityEndDate) {
    let endMs = null;
    if (typeof (activity.activityEndDate as any).toMillis === 'function') {
      endMs = (activity.activityEndDate as any).toMillis();
    } else if (typeof (activity.activityEndDate as any).toDate === 'function') {
      endMs = (activity.activityEndDate as any).toDate().getTime();
    } else if (typeof activity.activityEndDate === 'number') {
      endMs = activity.activityEndDate;
    } else if (typeof activity.activityEndDate === 'string') {
      endMs = Date.parse(activity.activityEndDate);
      if (isNaN(endMs)) endMs = null;
    }
    if (endMs !== null && endMs < now) return false;
  } else if (activity.isTimeFlexible) {
    // Date-only: keep for full local calendar day
    const activityDay = new Date(startMs);
    const endOfActivityDay = new Date(
      activityDay.getFullYear(),
      activityDay.getMonth(),
      activityDay.getDate() + 1
    ).getTime();
    if (endOfActivityDay < now) return false;
  } else {
    // Exact time: expires after ACTIVITY_EXPIRY_THRESHOLD_MS
    if (startMs + ACTIVITY_EXPIRY_THRESHOLD_MS < now) return false;
  }

  // 4. Capacity rule
  const maxParts = activity.maxParticipants;
  const participantCount = Array.isArray(activity.participantIds) ? activity.participantIds.length : 0;
  if (typeof maxParts === 'number' && !isNaN(maxParts) && maxParts > 0) {
    if (participantCount >= maxParts) return false;
  }

  // 5. Joinability rules
  const joinMode = activity.joinMode || 'request';
  if (joinMode !== 'direct' && joinMode !== 'request') return false;

  return true;
}

