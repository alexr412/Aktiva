'use client';

import {
  Ship, Waves, Landmark, Route, TreePine,
  Star, Moon, Circle, Sun, Tent, Shield, Globe,
  Coffee, Utensils, Dumbbell, Film, Building,
  Church, Ticket, Library,
  type LucideIcon
} from 'lucide-react';

/**
 * Da 'Monument' in der Standard-Lucide-Bibliothek nicht existiert,
 * verwenden wir 'Landmark' als semantisch identische Entsprechung.
 */
const Monument = Landmark;

export interface TagStyle {
  icon: LucideIcon;
  color: string;
  label: string;
  bgClass: string;
}

/**
 * getPrimaryIconData - Hierarchisches Icon-Zuweisungssystem (Weighting Index).
 * Löst visuelle Prioritäten deterministisch nach der definierten Kaskade auf.
 * Berücksichtigt Tags und den Namen des Ortes zur Kompensation fehlender Metadaten.
 */
export const getPrimaryIconData = (place: { categories?: string[], name?: string }): TagStyle => {
  const tags = place.categories || [];
  const name = (place.name || '').toLowerCase();

  // --- PRIORITÄT 1: Höchste Spezifität ---
  if (tags.includes('tourism.sights.memorial.ship')) return { icon: Ship, color: '#3b82f6', label: 'Schiff', bgClass: 'bg-blue-50' };

  // --- PRIORITÄT 2: Namensbasierte Überschreibungen (Kompensation fehlender Tags) ---
  if (name.includes('synagoge')) return { icon: Star, color: '#64748b', label: 'Synagoge', bgClass: 'bg-slate-50' };
  if (name.includes('see')) return { icon: Waves, color: '#0ea5e9', label: 'Gewässer', bgClass: 'bg-sky-50' };

  // --- PRIORITÄT 3: Spezifische Infrastruktur & Kultur ---
  if (tags.includes('entertainment.museum')) return { icon: Library, color: '#8b5cf6', label: 'Museum', bgClass: 'bg-purple-50' };
  if (tags.includes('man_made.bridge')) return { icon: Route, color: '#9ca3af', label: 'Brücke', bgClass: 'bg-gray-100' };
  if (tags.includes('leisure.park') || tags.includes('leisure')) return { icon: TreePine, color: '#22c55e', label: 'Park', bgClass: 'bg-green-50' };

  // --- PRIORITÄT 3.5: Religiöse Stätten ---
  if (tags.includes('religion.place_of_worship.christianity')) return { icon: Church, color: '#64748b', label: 'Kirche', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.judaism')) return { icon: Star, color: '#64748b', label: 'Synagoge', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.islam')) return { icon: Moon, color: '#64748b', label: 'Moschee', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.buddhism')) return { icon: Circle, color: '#64748b', label: 'Buddhistische Stätte', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.hinduism')) return { icon: Sun, color: '#64748b', label: 'Hinduistische Stätte', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.shinto')) return { icon: Tent, color: '#64748b', label: 'Shinto-Schrein', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.sikhism')) return { icon: Shield, color: '#64748b', label: 'Sikh-Tempel', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.multifaith')) return { icon: Globe, color: '#64748b', label: 'Multifaith', bgClass: 'bg-slate-50' };

  // --- PRIORITÄT 4: Allgemeine Denkmäler ---
  if (tags.includes('tourism.sights.memorial')) return { icon: Monument, color: '#a8a29e', label: 'Denkmal', bgClass: 'bg-stone-100' }; 
  
  // --- PRIORITÄT 5: Basis-Kategorien ---
  if (tags.some((t: string) => t.startsWith('catering.cafe') || t.startsWith('catering.bar'))) return { icon: Coffee, color: '#d97706', label: 'Café/Bar', bgClass: 'bg-amber-50' };
  if (tags.some((t: string) => t.startsWith('catering'))) return { icon: Utensils, color: '#ef4444', label: 'Gastronomie', bgClass: 'bg-red-50' };
  if (tags.some((t: string) => t.startsWith('sport'))) return { icon: Dumbbell, color: '#3b82f6', label: 'Sport', bgClass: 'bg-blue-50' };
  if (tags.includes('entertainment.cinema')) return { icon: Film, color: '#8b5cf6', label: 'Kino', bgClass: 'bg-purple-50' };
  if (tags.includes('entertainment')) return { icon: Ticket, color: '#8b5cf6', label: 'Unterhaltung', bgClass: 'bg-purple-50' };

  // --- FALLBACK ---
  return { icon: Building, color: '#94a3b8', label: 'Ort', bgClass: 'bg-slate-50' };
};

/**
 * Kompatibilitäts-Wrapper für bestehende Komponenten, die nur Tags übergeben.
 */
export const getPrimaryTagStyle = (categories: string[]): TagStyle => {
  return getPrimaryIconData({ categories });
};
