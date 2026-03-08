'use client';

import {
  Anchor, Waves, Landmark, Mic, Palette, TreePine,
  Church, Flame, Film, Coffee, Utensils, Dumbbell, 
  Building, Moon, Circle, Sun, Tent, Shield, Globe, User,
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
 * Nutzt sowohl Geoapify-Kategorien als auch den Namen zur Kompensation unvollständiger Daten.
 */
export const getPrimaryIconData = (place: any): TagStyle => {
  // Unterstützung für beide Datenmodelle (categories in Firestore, tags im Geoapify-Service)
  const tags = place.categories || place.tags || [];
  const name = (place.name || '').toLowerCase();

  // --- PRIORITÄT 1: Maritim & Spezifische Namens-Überschreibungen ---
  if (tags.includes('tourism.sights.memorial.ship') || name.includes('dock')) {
    return { icon: Anchor, color: '#3b82f6', label: 'Maritim', bgClass: 'bg-blue-50' };
  }
  if (name.includes('synagoge')) {
    // Ersetzt das 'Star'-Icon (Verwechslungsgefahr mit Favoriten) durch Landmark
    return { icon: Landmark, color: '#64748b', label: 'Synagoge', bgClass: 'bg-slate-50' }; 
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
    // Landmark für historische und Museums-Gebäude
    return { icon: Landmark, color: '#8b5cf6', label: 'Museum', bgClass: 'bg-purple-50' }; 
  }

  // --- PRIORITÄT 3: Infrastruktur & Natur ---
  if (tags.includes('man_made.bridge') || name.includes('brücke')) {
    // Waves als Repräsentation für eine Wasserüberquerung
    return { icon: Waves, color: '#0ea5e9', label: 'Brücke', bgClass: 'bg-sky-50' }; 
  }
  if (tags.includes('leisure.park') || tags.includes('leisure')) {
    return { icon: TreePine, color: '#22c55e', label: 'Park', bgClass: 'bg-green-50' };
  }

  // --- PRIORITÄT 3.5: Verifizierte Religiöse Stätten ---
  if (tags.includes('religion.place_of_worship.christianity')) return { icon: Church, color: '#64748b', label: 'Kirche', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.islam')) return { icon: Moon, color: '#64748b', label: 'Moschee', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.buddhism')) return { icon: Circle, color: '#64748b', label: 'Buddhistische Stätte', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.hinduism')) return { icon: Sun, color: '#64748b', label: 'Hinduistische Stätte', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.shinto')) return { icon: Tent, color: '#64748b', label: 'Shinto-Schrein', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.sikhism')) return { icon: Shield, color: '#64748b', label: 'Sikh-Tempel', bgClass: 'bg-slate-50' };
  if (tags.includes('religion.place_of_worship.multifaith')) return { icon: Globe, color: '#64748b', label: 'Multifaith', bgClass: 'bg-slate-50' };

  // --- PRIORITÄT 4: Denkmäler ---
  if (tags.includes('tourism.sights.memorial')) {
    // Ewige Flamme (Flame) als Symbol für Gedenkstätten
    return { icon: Flame, color: '#f97316', label: 'Denkmal', bgClass: 'bg-orange-50' }; 
  }
  
  // --- PRIORITÄT 5: Verifizierte Basis-Kategorien ---
  if (tags.some((t: string) => t.startsWith('catering.cafe') || t.startsWith('catering.bar'))) return { icon: Coffee, color: '#d97706', label: 'Café/Bar', bgClass: 'bg-amber-50' };
  if (tags.some((t: string) => t.startsWith('catering'))) return { icon: Utensils, color: '#ef4444', label: 'Gastronomie', bgClass: 'bg-red-50' };
  if (tags.some((t: string) => t.startsWith('sport'))) return { icon: Dumbbell, color: '#3b82f6', label: 'Sport', bgClass: 'bg-blue-50' };
  if (tags.includes('entertainment.cinema')) return { icon: Film, color: '#8b5cf6', label: 'Kino', bgClass: 'bg-purple-50' };

  // --- FALLBACK ---
  return { icon: Building, color: '#94a3b8', label: 'Ort', bgClass: 'bg-slate-50' };
};

/**
 * Kompatibilitäts-Wrapper für Komponenten, die nur Kategorien übergeben.
 */
export const getPrimaryTagStyle = (categories: string[]): TagStyle => {
  return getPrimaryIconData({ categories });
};
