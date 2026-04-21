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
  type LucideIcon
} from 'lucide-react';

/**
 * TagStyle Interface für die visuelle Repräsentation
 */
export interface TagStyle {
  icon: LucideIcon;
  color: string;
  label: string;
  bgClass: string;
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

  // --- SAKRALBAUTEN (Höchste Priorität) ---
  if (tags.includes('tourism.sights.place_of_worship.synagogue') || tags.includes('religion.place_of_worship.judaism') || n.includes('synagoge')) {
    return { icon: Star, color: '#3b82f6', label: language === 'de' ? 'Synagoge' : 'Synagogue', bgClass: 'bg-blue-50' };
  }
  if (tags.includes('tourism.sights.place_of_worship.mosque') || tags.includes('religion.place_of_worship.islam') || n.includes('moschee')) {
    return { icon: MoonStar, color: '#10b981', label: language === 'de' ? 'Moschee' : 'Mosque', bgClass: 'bg-emerald-50' };
  }
  if (tags.includes('tourism.sights.place_of_worship.church') || tags.includes('tourism.sights.place_of_worship.cathedral') || tags.includes('tourism.sights.place_of_worship.chapel') || tags.includes('religion.place_of_worship.christianity') || n.includes('kirche') || n.includes('dom') || n.includes('kapelle')) {
    return { icon: Church, color: '#8b5cf6', label: language === 'de' ? 'Kirche' : 'Church', bgClass: 'bg-violet-50' };
  }
  if (tags.includes('tourism.sights.place_of_worship.temple') || tags.includes('religion.place_of_worship.buddhism') || tags.includes('religion.place_of_worship.hinduism') || n.includes('tempel') || n.includes('schrein')) {
    return { icon: Landmark, color: '#f59e0b', label: language === 'de' ? 'Tempel/Schrein' : 'Temple/Shrine', bgClass: 'bg-amber-50' };
  }

  // --- PRIORITÄT 1: Maritim & Spezifische Namens-Überschreibungen ---
  if (tags.includes('tourism.sights.memorial.ship')) {
    return { icon: Ship, color: '#3b82f6', label: language === 'de' ? 'Schiff' : 'Ship', bgClass: 'bg-blue-50' };
  }
  if (tags.includes('entertainment.zoo') || name.includes('zoo') || name.includes('tierpark')) {
    return { icon: PawPrint, color: '#755317ff', label: language === 'de' ? 'Zoo/Tierpark' : 'Zoo', bgClass: 'bg-amber-50' };
  }
  if (name.includes('dock')) {
    return { icon: Anchor, color: '#3b82f6', label: language === 'de' ? 'Maritim' : 'Maritime', bgClass: 'bg-blue-50' };
  }
  if (name.includes('see')) {
    return { icon: Waves, color: '#0ea5e9', label: language === 'de' ? 'Gewässer' : 'Water body', bgClass: 'bg-sky-50' };
  }

  // --- PRIORITÄT 2: Kunst, Kultur & Theater ---
  if (tags.includes('entertainment.culture.theatre') || name.includes('theater')) {
    return { icon: Theater, color: '#ec4899', label: language === 'de' ? 'Theater' : 'Theater', bgClass: 'bg-pink-50' };
  }
  if (tags.includes('entertainment.culture.arts_centre') || name.includes('galerie') || name.includes('kunstzentrum')) {
    return { icon: Image, color: '#ec4899', label: language === 'de' ? 'Galerie' : 'Gallery', bgClass: 'bg-pink-50' };
  }
  if (tags.includes('tourism.attraction.artwork') || name.includes('statue') || name.includes('kunst')) {
    return { icon: Palette, color: '#f59e0b', label: language === 'de' ? 'Kunst' : 'Art', bgClass: 'bg-amber-50' };
  }
  if (tags.includes('entertainment.museum') || name.includes('museum')) {
    return { icon: Landmark, color: '#8b5cf6', label: language === 'de' ? 'Museum' : 'Museum', bgClass: 'bg-purple-50' };
  }

  if (name.includes('quest') || name.includes('escape') || name.includes('rätsel')) {
    return { icon: Gamepad2, color: '#f59e0b', label: language === 'de' ? 'Escape Game' : 'Escape Game', bgClass: 'bg-amber-50' };
  }

  if (name.includes('wasser') || name.includes('bad') || name.includes('schwimm')) {
    return { icon: Droplets, color: '#0ea5e9', label: language === 'de' ? 'Wasserpark' : 'Water park', bgClass: 'bg-sky-50' };
  }

  // --- PRIORITÄT 2.5: Nachtleben ---
  if (tags.includes('adult.nightclub') || name.includes('club') || name.includes('disco') || name.includes('nachtclub')) {
    return { icon: Moon, color: '#a855f7', label: language === 'de' ? 'Club' : 'Club', bgClass: 'bg-purple-50' };
  }

  // --- PRIORITÄT 3: Infrastruktur & Natur ---
  if (tags.includes('man_made.bridge') || name.includes('brücke')) {
    return { icon: Waves, color: '#0ea5e9', label: language === 'de' ? 'Brücke' : 'Bridge', bgClass: 'bg-sky-50' };
  }

  if (name.includes('kulturzentrum') || name.includes('kultur') || name.includes('theater') || name.includes('lichtburg')) {
    return { icon: Palette, color: '#ec4899', label: language === 'de' ? 'Kultur' : 'Culture', bgClass: 'bg-pink-50' };
  }

  // Spezifische Wiesen/Parks Regel
  if (tags.includes('pet.dog_park') || n.includes('wiese') || n.includes('park') || n.includes('gehege') || n.includes('garten')) {
    return { icon: Trees, color: '#22c55e', label: language === 'de' ? 'Natur' : 'Nature', bgClass: 'bg-green-50 dark:bg-neutral-800' };
  }

  if (tags.includes('leisure.park') || tags.includes('leisure')) {
    return { icon: TreePine, color: '#22c55e', label: language === 'de' ? 'Park' : 'Park', bgClass: 'bg-green-50' };
  }

  // --- PRIORITÄT 4: Denkmäler & Monumente ---
  if (tags.some((t: string) => t.includes('memorial') || t.includes('monument')) || n.includes('denkmal') || n.includes('mahnmal')) {
    return { icon: Landmark, color: '#64748b', label: language === 'de' ? 'Denkmal' : 'Memorial', bgClass: 'bg-slate-50' };
  }

  // --- PRIORITÄT 4.5: Bildung ---
  if (tags.some((t: string) => t.startsWith('education') || t === 'building.university' || t === 'building.library' || t === 'building.school') || name.includes('schule') || name.includes('uni')) {
    return { icon: BookOpen, color: '#3b82f6', label: language === 'de' ? 'Bildung' : 'Education', bgClass: 'bg-blue-50' };
  }

  // --- PRIORITÄT 5: Verifizierte Basis-Kategorien ---
  if (tags.some((t: string) => t.startsWith('catering.fast_food'))) return { icon: Drumstick, color: '#f97316', label: language === 'de' ? 'Fast Food' : 'Fast Food', bgClass: 'bg-orange-50' };
  if (tags.some((t: string) => t.startsWith('catering.cafe') || t.startsWith('catering.bar') || t.startsWith('catering.pub')) || name.includes('cafe') || name.includes('bar') || name.includes('kneipe') || name.includes('pub')) {
    return { icon: tags.includes('catering.pub') || name.includes('pub') || name.includes('kneipe') ? BottleWine : Coffee, color: '#d97706', label: language === 'de' ? 'Bar/Pub' : 'Bar/Pub', bgClass: 'bg-amber-50' };
  }
  if (tags.some((t: string) => t.startsWith('catering')) || name.includes('restaurant')) return { icon: Utensils, color: '#ef4444', label: language === 'de' ? 'Gastronomie' : 'Gastronomy', bgClass: 'bg-red-50' };
  if (tags.some((t: string) => t.startsWith('sport')) || name.includes('sport')) return { icon: Dumbbell, color: '#3b82f6', label: language === 'de' ? 'Sport' : 'Sports', bgClass: 'bg-blue-50' };
  if (tags.includes('entertainment.cinema') || name.includes('kino')) return { icon: Film, color: '#8b5cf6', label: language === 'de' ? 'Kino' : 'Cinema', bgClass: 'bg-purple-50' };
  if (tags.includes('entertainment.amusement_arcade') || name.includes('arcade') || name.includes('spielhalle')) {
    return { icon: Gamepad2, color: '#8b5cf6', label: language === 'de' ? 'Spielhalle' : 'Arcade', bgClass: 'bg-purple-50' };
  }

  // --- FALLBACK ---
  return { icon: Building, color: '#94a3b8', label: language === 'de' ? 'Ort' : 'Place', bgClass: 'bg-slate-50' };
};

export const getPrimaryTagStyle = (categories: string[], language: 'de' | 'en' = 'de'): TagStyle => {
  return getPrimaryIconData({ categories }, language);
};
