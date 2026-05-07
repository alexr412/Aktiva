'use client';

import { Place, UserPreferences } from './types';

const tagRules = [
  // Tier 1: Absolute Highlights (90+)
  { pattern: /^entertainment\.zoo(\..*)?$/, score: 95 },
  { pattern: /^entertainment\.theme_park(\..*)?$/, score: 92 },
  { pattern: /^entertainment\.planetarium(\..*)?$/, score: 90 },
  { pattern: /^entertainment\.cinema(\..*)?$/, score: 90 },

  // Tier 2: Aktives Entertainment & Fun-Spots (80-89)
  { pattern: /^entertainment\.(miniature_golf|bowling_alley|escape_game|aquarium|water_park|amusement_arcade|activity_park|planetarium)(\..*)?$/, score: 85 },
  { pattern: /^sport\.ice_rink(\..*)?$/, score: 80 },
  { pattern: /laser_tag|paintball|trampoline|climbing|bouldering|karting|arcade|bowling/, score: 85 },
  { pattern: /^leisure\.spa(\..*)?$/, score: 85 },
  { pattern: /^adult\.nightclub(\..*)?$/, score: 80 },

  // Tier 3: Sport & generisches Entertainment (65-75)
  { pattern: /^sport\.stadium(\..*)?$/, score: 55 },
  { pattern: /^entertainment(\..*)?$/, score: 65 },

  // Tier 4: Kultur & Passiv (Bewusste Abwertung zur Vermeidung von Flooding)
  { pattern: /^tourism\.museum(\..*)?$/, score: 55 },
  { pattern: /^tourism(\..*)?$/, score: 60 },
  { pattern: /^sport(\..*)?$/, score: 50 },
  { pattern: /^leisure(\..*)?$/, score: 40 }
];

/**
 * Hilfsfunktion für den Basis-Score (wird von geoapify.ts genutzt)
 */
export function calculateRelevanceScore(tags: string[]): number {
  if (!tags || tags.length === 0) return 0;
  for (const rule of tagRules) {
    if (tags.some(tag => rule.pattern.test(tag))) {
      return rule.score;
    }
  }
  return 30; // System-Fallback
}

/**
 * Berechnet den Relevanz-Score für einen Ort (HMFR 2.0)
 * Formel: Score = (BaseScore * e^(-0.015 * distance)) - Penalty
 */
export function calculateRelevance(
  item: any,
  userProfile: any,
  userLocation: { lat: number; lng: number },
  options: { debug?: boolean } = {}
): number {
  if (!item) return 0;

  const categories: string[] = Array.isArray(item?.categories)
    ? item.categories
    : (Array.isArray(item?.properties?.categories) ? item.properties.categories : []);

  const distance = (item?.distance !== undefined && item?.distance !== null) ? item.distance : 0;
  const isDebug = options.debug || false;

  // 1. Basis-Score ermitteln (Erster Treffer in der Prioritätsliste gewinnt)
  let baseScore = 30; // System-Fallback
  for (const rule of tagRules) {
    if (categories.some(cat => rule.pattern.test(cat))) {
      baseScore = rule.score;
      break;
    }
  }

  // 2. Boring Penalty vs. Hero Override
  const isPassive = categories.some(cat => /^(leisure\.park|leisure\.playground|natural(\..*)?|playground)$/.test(cat));
  const hasHeroOverride = categories.some(cat => /^(entertainment|adult|sport\.stadium|tourism)/.test(cat));

  let penalty = 0;
  if (isPassive && !hasHeroOverride) {
    penalty = 55;
  }

  // 3. Distance Decay (0.015 Lambda)
  const decay = Math.exp(-0.015 * distance);

  // 4. Finaler Score
  let finalScore = (baseScore * decay) - penalty;

  // --- NAMENS-BOOSTING (Fallback für nicht unterstützte Sub-Tags) ---
  const itemName = item.name || item.properties?.name || '';
  if (itemName && /lasertag|kartbahn|paintball|kletter/i.test(itemName)) {
    // Override auf Tier 2 Score (85) wenn der Name ein Treffer ist
    finalScore = (85 * decay);
  }

  if (isDebug) {
    console.log(`[Rank] ${itemName || 'Unknown'} | Base: ${baseScore} | Dist: ${distance.toFixed(2)}km | Decay: ${decay.toFixed(3)} | Penalty: ${penalty} | Final: ${finalScore.toFixed(1)}`);
  }

  return Math.max(0, Number(finalScore.toFixed(1)));
}
