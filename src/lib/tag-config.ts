'use client';

import {
  Anchor, Ship, Waves, Landmark, Mic, Palette, TreePine, Trees,
  Church, Flame, Film, Coffee, Utensils, Dumbbell, 
  Building, Moon, Circle, Sun, Tent, Shield, Globe, User,
  BookOpen,
  PawPrint,
  Star,
  MoonStar,
  Library,
  Drumstick,
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
export const getPrimaryIconData = (place: any): TagStyle => {
  const rawTags = place.categories || place.category || place.tags || [];
  const tags = Array.isArray(rawTags) ? rawTags.filter(Boolean) : (typeof rawTags === 'string' ? [rawTags] : []);
  const name = (place.name || '').toLowerCase();
  const n = name;

  // --- SAKRALBAUTEN (Höchste Priorität) ---
  if (tags.includes('tourism.sights.place_of_worship.synagogue') || tags.includes('religion.place_of_worship.judaism') || n.includes('synagoge')) {
    return { icon: Star, color: '#3b82f6', label: 'Synagoge', bgClass: 'bg-blue-50' };
  }
  if (tags.includes('tourism.sights.place_of_worship.mosque') || tags.includes('religion.place_of_worship.islam') || n.includes('moschee')) {
    return { icon: MoonStar, color: '#10b981', label: 'Moschee', bgClass: 'bg-emerald-50' };
  }
  if (tags.includes('tourism.sights.place_of_worship.church') || tags.includes('tourism.sights.place_of_worship.cathedral') || tags.includes('tourism.sights.place_of_worship.chapel') || tags.includes('religion.place_of_worship.christianity') || n.includes('kirche') || n.includes('dom') || n.includes('kapelle')) {
    return { icon: Church, color: '#8b5cf6', label: 'Kirche', bgClass: 'bg-violet-50' };
  }
  if (tags.includes('tourism.sights.place_of_worship.temple') || tags.includes('religion.place_of_worship.buddhism') || tags.includes('religion.place_of_worship.hinduism') || n.includes('tempel') || n.includes('schrein')) {
    return { icon: Landmark, color: '#f59e0b', label: 'Tempel/Schrein', bgClass: 'bg-amber-50' };
  }

  // --- PRIORITÄT 1: Maritim & Spezifische Namens-Überschreibungen ---
  if (tags.includes('tourism.sights.memorial.ship')) {
    return { icon: Ship, color: '#3b82f6', label: 'Schiff', bgClass: 'bg-blue-50' };
  }
  if (tags.includes('entertainment.zoo') || name.includes('zoo') || name.includes('tierpark')) {
    return { icon: PawPrint, color: '#f59e0b', label: 'Zoo/Tierpark', bgClass: 'bg-amber-50' };
  }
  if (name.includes('dock')) {
    return { icon: Anchor, color: '#3b82f6', label: 'Maritim', bgClass: 'bg-blue-50' };
  }
  if (name.includes('see')) {
    return { icon: Waves, color: '#0ea5e9', label: 'Gewässer', bgClass: 'bg-sky-50' };
  }

  // --- PRIORITÄT 2: Kunst, Kultur & Theater ---
  if (tags.includes('entertainment.culture.theatre') || name.includes('theater')) {
    return { icon: Mic, color: '#ec4899', label: 'Theater', bgClass: 'bg-pink-50' };
  }
  if (tags.includes('tourism.attraction.artwork') || name.includes('statue') || name.includes('kunst')) {
    return { icon: Palette, color: '#f59e0b', label: 'Kunst', bgClass: 'bg-amber-50' };
  }
  if (tags.includes('entertainment.museum')) {
    return { icon: Library, color: '#8b5cf6', label: 'Museum', bgClass: 'bg-purple-50' }; 
  }

  // --- PRIORITÄT 3: Infrastruktur & Natur ---
  if (tags.includes('man_made.bridge') || name.includes('brücke')) {
    return { icon: Waves, color: '#0ea5e9', label: 'Brücke', bgClass: 'bg-sky-50' }; 
  }
  
  // Spezifische Wiesen/Parks Regel
  if (tags.includes('pet.dog_park') || n.includes('wiese') || n.includes('park')) {
    return { icon: Trees, color: '#22c55e', label: 'Wiese/Park', bgClass: 'bg-green-50 dark:bg-neutral-800' };
  }

  if (tags.includes('leisure.park') || tags.includes('leisure')) {
    return { icon: TreePine, color: '#22c55e', label: 'Park', bgClass: 'bg-green-50' };
  }

  // --- PRIORITÄT 4: Denkmäler & Monumente ---
  if (tags.some((t: string) => t.includes('memorial') || t.includes('monument')) || n.includes('denkmal') || n.includes('mahnmal')) {
    return { icon: Landmark, color: '#64748b', label: 'Denkmal', bgClass: 'bg-slate-50' };
  }

  // --- PRIORITÄT 4.5: Bildung ---
  if (tags.some((t: string) => t.startsWith('education') || t === 'building.university' || t === 'building.library' || t === 'building.school')) {
    return { icon: BookOpen, color: '#3b82f6', label: 'Bildung', bgClass: 'bg-blue-50' };
  }
  
  // --- PRIORITÄT 5: Verifizierte Basis-Kategorien ---
  if (tags.some((t: string) => t.startsWith('catering.fast_food'))) return { icon: Drumstick, color: '#f97316', label: 'Fast Food', bgClass: 'bg-orange-50' };
  if (tags.some((t: string) => t.startsWith('catering.cafe') || t.startsWith('catering.bar'))) return { icon: Coffee, color: '#d97706', label: 'Café/Bar', bgClass: 'bg-amber-50' };
  if (tags.some((t: string) => t.startsWith('catering'))) return { icon: Utensils, color: '#ef4444', label: 'Gastronomie', bgClass: 'bg-red-50' };
  if (tags.some((t: string) => t.startsWith('sport'))) return { icon: Dumbbell, color: '#3b82f6', label: 'Sport', bgClass: 'bg-blue-50' };
  if (tags.includes('entertainment.cinema')) return { icon: Film, color: '#8b5cf6', label: 'Kino', bgClass: 'bg-purple-50' };

  // --- FALLBACK ---
  return { icon: Building, color: '#94a3b8', label: 'Ort', bgClass: 'bg-slate-50' };
};

export const getPrimaryTagStyle = (categories: string[]): TagStyle => {
  return getPrimaryIconData({ categories });
};
