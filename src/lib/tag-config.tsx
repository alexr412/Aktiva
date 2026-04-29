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

/**
 * TagStyle Interface für die visuelle Repräsentation
 */
export interface TagStyle {
  icon: LucideIcon;
  color: string;
  label: string;
  bgClass: string;
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

  // --- SAKRALBAUTEN (Höchste Priorität) ---
  if (tags.includes('tourism.sights.place_of_worship.synagogue') || tags.includes('religion.place_of_worship.judaism') || n.includes('synagoge')) {
    return { icon: Star, color: '#3b82f6', label: language === 'de' ? 'Synagoge' : 'Synagogue', bgClass: 'bg-blue-50' };
  }
  if (tags.includes('tourism.sights.place_of_worship.mosque') || tags.includes('religion.place_of_worship.islam') || n.includes('moschee')) {
    return { icon: MoonStar, color: '#10b981', label: language === 'de' ? 'Moschee' : 'Mosque', bgClass: 'bg-emerald-50' };
  }
  if (tags.includes('tourism.sights.place_of_worship.church') || tags.includes('tourism.sights.place_of_worship.cathedral') || tags.includes('tourism.sights.place_of_worship.chapel') || tags.includes('religion.place_of_worship.christianity') || tags.includes('religion') || tags.includes('religion.place_of_worship') || n.includes('kirche') || n.includes('dom') || n.includes('kapelle')) {
    return { icon: Church, color: '#8b5cf6', label: language === 'de' ? 'Religiöser Ort' : 'Religious Place', bgClass: 'bg-violet-50' };
  }
  if (tags.includes('tourism.sights.place_of_worship.temple') || tags.includes('religion.place_of_worship.buddhism') || tags.includes('religion.place_of_worship.hinduism') || n.includes('tempel') || n.includes('schrein')) {
    return { icon: Landmark, color: '#f59e0b', label: language === 'de' ? 'Tempel/Schrein' : 'Temple/Shrine', bgClass: 'bg-amber-50' };
  }

  // --- PRIORITÄT 1: Maritim & Spezifische Namens-Überschreibungen ---
  if (tags.includes('tourism.sights.memorial.ship')) {
    return { icon: Ship, color: '#3b82f6', label: language === 'de' ? 'Schiff' : 'Ship', bgClass: 'bg-blue-50' };
  }
  if (tags.includes('tourism.attraction.ship') || name.includes('schiff') || name.includes('boot')) {
    return { icon: Ship, color: '#3b82f6', label: language === 'de' ? 'Schiff' : 'Ship', bgClass: 'bg-blue-50', imageUrl: 'https://images.unsplash.com/photo-1540946484610-45cd54ff3ad2?q=80&w=800&auto=format&fit=crop' };
  }
  if (tags.includes('entertainment.zoo') || name.includes('zoo') || name.includes('tierpark')) {
    return { icon: ZooIcon as any, color: '#755317ff', label: language === 'de' ? 'Zoo/Tierpark' : 'Zoo', bgClass: 'bg-amber-50', imageUrl: 'https://images.unsplash.com/photo-1541315570220-449e7591244d?q=80&w=800&auto=format&fit=crop' };
  }
  if (name.includes('dock')) {
    return { icon: Anchor, color: '#3b82f6', label: language === 'de' ? 'Maritim' : 'Maritime', bgClass: 'bg-blue-50' };
  }
  if (name.includes('see')) {
    return { icon: Waves, color: '#0ea5e9', label: language === 'de' ? 'Gewässer' : 'Water body', bgClass: 'bg-sky-50' };
  }

  if (tags.includes('entertainment.miniature_golf') || name.includes('minigolf')) {
    return { icon: LandPlot, color: '#22c55e', label: language === 'de' ? 'Minigolf' : 'Mini Golf', bgClass: 'bg-green-50', imageUrl: 'https://images.unsplash.com/photo-1531390844884-f93dca7bc9f3?q=80&w=800&auto=format&fit=crop' };
  }

  // --- PRIORITÄT 2: Kunst, Kultur & Theater ---
  if (tags.includes('entertainment.culture.theatre') || name.includes('theater')) {
    return { icon: Theater, color: '#ec4899', label: language === 'de' ? 'Theater' : 'Theater', bgClass: 'bg-pink-50', imageUrl: '/assets/categories/theater.png' };
  }
  if (tags.includes('entertainment.culture.arts_centre') || name.includes('galerie') || name.includes('kunstzentrum')) {
    return { icon: Image, color: '#ec4899', label: language === 'de' ? 'Galerie' : 'Gallery', bgClass: 'bg-pink-50', imageUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=800&auto=format&fit=crop' };
  }
  if (tags.some((t: string) => t.startsWith('tourism.sights') || t.startsWith('building.historic'))) {
    return { icon: Landmark, color: '#f59e0b', label: language === 'de' ? 'Sehenswürdigkeit' : 'Sight', bgClass: 'bg-amber-50', imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop' };
  }

  if (tags.includes('tourism.attraction.artwork') || name.includes('statue') || name.includes('kunst')) {
    return { icon: Palette, color: '#f59e0b', label: language === 'de' ? 'Kunst' : 'Art', bgClass: 'bg-amber-50' };
  }
  if (tags.includes('entertainment.museum') || name.includes('museum')) {
    return { icon: Landmark, color: '#6366f1', label: language === 'de' ? 'Museum' : 'Museum', bgClass: 'bg-indigo-50', imageUrl: 'https://images.unsplash.com/photo-1544333323-c242144ebd53?q=80&w=800&auto=format&fit=crop' };
  }

  if (tags.includes('tourism.attraction.viewpoint') || name.includes('aussicht')) {
    return { icon: Binoculars, color: '#d97706', label: language === 'de' ? 'Aussichtspunkt' : 'Viewpoint', bgClass: 'bg-amber-50', imageUrl: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?q=80&w=800&auto=format&fit=crop' };
  }

  if (tags.includes('leisure.spa') || tags.includes('leisure.sauna') || tags.includes('leisure.spa.sauna') || name.includes('wellness') || name.includes('sauna') || name.includes('therme')) {
    return { icon: Flower2, color: '#06b6d4', label: language === 'de' ? 'Wellness/Spa' : 'Wellness/Spa', bgClass: 'bg-cyan-50', imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800&auto=format&fit=crop' };
  }

  if (tags.includes('entertainment.activity_park.trampoline') || name.includes('trampolin')) {
    return { icon: TrampolineIcon as any, color: '#4f46e5', label: language === 'de' ? 'Trampolin' : 'Trampoline', bgClass: 'bg-indigo-50' };
  }

  if (tags.includes('entertainment.activity_park') || tags.includes('entertainment.activity_park.climbing') || name.includes('kletterwald')) {
    return { icon: Zap, color: '#4f46e5', label: language === 'de' ? 'Aktivitätspark' : 'Activity Park', bgClass: 'bg-indigo-50', imageUrl: 'https://images.unsplash.com/photo-1541604193435-22287d32c2c2?q=80&w=800&auto=format&fit=crop' };
  }

  if (name.includes('quest') || name.includes('escape') || name.includes('rätsel')) {
    return { icon: Gamepad2, color: '#f59e0b', label: language === 'de' ? 'Escape Game' : 'Escape Game', bgClass: 'bg-amber-50' };
  }

  if (tags.includes('leisure.water_park') || tags.includes('entertainment.water_park') || name.includes('wasserpark')) {
    return { icon: WaterparkIcon as any, color: '#0ea5e9', label: language === 'de' ? 'Wasserpark' : 'Water Park', bgClass: 'bg-sky-50', imageUrl: 'https://images.unsplash.com/photo-1562095241-8c6714fd4178?q=80&w=800&auto=format&fit=crop' };
  }

  if (tags.includes('leisure.swimming_pool') || name.includes('wasser') || name.includes('bad') || name.includes('schwimm')) {
    return { icon: Droplets, color: '#0ea5e9', label: language === 'de' ? 'Schwimmbad' : 'Pool', bgClass: 'bg-sky-50', imageUrl: 'https://images.unsplash.com/photo-1562095241-8c6714fd4178?q=80&w=800&auto=format&fit=crop' };
  }

  if (tags.includes('beach') || name.includes('strand')) {
    return { icon: Waves, color: '#0ea5e9', label: language === 'de' ? 'Strand' : 'Beach', bgClass: 'bg-sky-50', imageUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?q=80&w=800&auto=format&fit=crop' };
  }

  // --- PRIORITÄT 2.5: Nachtleben ---
  if (tags.includes('adult.nightclub') || name.includes('club') || name.includes('disco') || name.includes('nachtclub')) {
    return { icon: NightclubIcon as any, color: '#a855f7', label: language === 'de' ? 'Club' : 'Club', bgClass: 'bg-purple-50' };
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
    return { icon: TreePine, color: '#22c55e', label: language === 'de' ? 'Park' : 'Park', bgClass: 'bg-green-50', imageUrl: 'https://images.unsplash.com/photo-1444333509404-89ce9b2c7a0e?q=80&w=800&auto=format&fit=crop' };
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
  if (tags.some((t: string) => t.startsWith('catering.fast_food'))) return { icon: Drumstick, color: '#f97316', label: language === 'de' ? 'Fast Food' : 'Fast Food', bgClass: 'bg-orange-50', imageUrl: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?q=80&w=800&auto=format&fit=crop' };
  if (tags.some((t: string) => t.startsWith('catering.cafe') || t.startsWith('catering.bar') || t.startsWith('catering.pub')) || name.includes('cafe') || name.includes('bar') || name.includes('kneipe') || name.includes('pub')) {
    return { icon: tags.includes('catering.pub') || name.includes('pub') || name.includes('kneipe') ? BottleWine : Coffee, color: '#d97706', label: language === 'de' ? 'Bar/Pub' : 'Bar/Pub', bgClass: 'bg-amber-50', imageUrl: 'https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?q=80&w=800&auto=format&fit=crop' };
  }
  if (tags.some((t: string) => t.startsWith('catering')) || name.includes('restaurant')) return { icon: Utensils, color: '#ef4444', label: language === 'de' ? 'Gastronomie' : 'Gastronomy', bgClass: 'bg-red-50', imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop' };
  if (tags.some((t: string) => t.startsWith('sport')) || name.includes('sport')) return { icon: Dumbbell, color: '#3b82f6', label: language === 'de' ? 'Sport' : 'Sports', bgClass: 'bg-blue-50', imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop' };
  if (tags.includes('entertainment.cinema') || name.includes('kino')) return { icon: Film, color: '#8b5cf6', label: language === 'de' ? 'Kino' : 'Cinema', bgClass: 'bg-purple-50', imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=800&auto=format&fit=crop' };
  if (tags.includes('entertainment.amusement_arcade') || name.includes('arcade') || name.includes('spielhalle')) {
    return { icon: Gamepad2, color: '#8b5cf6', label: language === 'de' ? 'Spielhalle' : 'Arcade', bgClass: 'bg-purple-50' };
  }

  // --- PRIORITÄT 6: Community Events ---
  if (tags.includes('user_event')) {
    return { icon: Users, color: '#8b5cf6', label: language === 'de' ? 'Community' : 'Community', bgClass: 'bg-purple-50' };
  }

  // --- FALLBACK ---
  return { icon: Building, color: '#94a3b8', label: language === 'de' ? 'Ort' : 'Place', bgClass: 'bg-slate-50' };
};

export const getPrimaryTagStyle = (categories: string[], language: 'de' | 'en' = 'de'): TagStyle => {
  return getPrimaryIconData({ categories }, language);
};
