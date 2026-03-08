'use client';

import { 
  UtensilsCrossed, 
  Coffee, 
  TreePine, 
  Sparkles, 
  Landmark, 
  Library, 
  Film, 
  ShoppingBag, 
  Waves, 
  Dumbbell, 
  Users,
  Building,
  type LucideIcon
} from 'lucide-react';

export interface TagStyle {
  label: string;
  color: string;
  icon: LucideIcon;
}

/**
 * Zentrales Mapping von System-Tags auf visuelle Parameter.
 */
export const TAG_CONFIG: Record<string, TagStyle> = {
  'catering.restaurant': { label: 'Restaurant', color: '#ef4444', icon: UtensilsCrossed },
  'catering.cafe': { label: 'Café', color: '#8b4513', icon: Coffee },
  'catering.bar': { label: 'Bar', color: '#f59e0b', icon: Coffee },
  'leisure.park': { label: 'Park', color: '#22c55e', icon: TreePine },
  'natural.forest': { label: 'Wald', color: '#15803d', icon: TreePine },
  'tourism.attraction': { label: 'Attraktion', color: '#eab308', icon: Sparkles },
  'tourism.sights.memorial': { label: 'Denkmal', color: '#64748b', icon: Landmark },
  'entertainment.museum': { label: 'Museum', color: '#6366f1', icon: Library },
  'entertainment.cinema': { label: 'Kino', color: '#ec4899', icon: Film },
  'commercial.shopping_mall': { label: 'Shopping', color: '#f97316', icon: ShoppingBag },
  'commercial.clothing': { label: 'Mode', color: '#f97316', icon: ShoppingBag },
  'natural.water': { label: 'Wasser', color: '#06b6d4', icon: Waves },
  'natural.beach': { label: 'Strand', color: '#06b6d4', icon: Waves },
  'sport': { label: 'Sport', color: '#3b82f6', icon: Dumbbell },
  'user_event': { label: 'Community', color: '#8b5cf6', icon: Users },
};

export const DEFAULT_TAG_STYLE: TagStyle = {
  label: 'Ort',
  color: '#94a3b8',
  icon: Building
};

/**
 * Ermittelt den Stil für einen spezifischen Tag inkl. Parent-Fallback.
 */
export function getTagStyle(tag: string): TagStyle {
  if (TAG_CONFIG[tag]) return TAG_CONFIG[tag];
  
  const parts = tag.split('.');
  for (let i = parts.length - 1; i > 0; i--) {
    const parent = parts.slice(0, i).join('.');
    if (TAG_CONFIG[parent]) return TAG_CONFIG[parent];
  }
  
  return DEFAULT_TAG_STYLE;
}

/**
 * Isoliert das primäre Tag und liefert dessen Styling.
 */
export function getPrimaryTagStyle(tags: string[]): TagStyle {
  if (!tags || tags.length === 0) return DEFAULT_TAG_STYLE;
  
  // Bevorzugte Tags aus der Config suchen
  for (const tag of tags) {
    if (TAG_CONFIG[tag]) return TAG_CONFIG[tag];
  }
  
  // Fallback auf Parent-Suche
  for (const tag of tags) {
    const style = getTagStyle(tag);
    if (style !== DEFAULT_TAG_STYLE) return style;
  }
  
  return DEFAULT_TAG_STYLE;
}
