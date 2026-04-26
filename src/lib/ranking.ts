'use client';

import { UserProfile } from './types';
import { availableTabs } from '@/components/aktvia/category-filters-data';

export const ACTIVITY_BASE_SCORE = 100;

// Hierarchical Regex Matchers - Specific beats Generic
const tagRules: { pattern: RegExp; score: number }[] = [
  // --- Hero-Tier (90-100 Punkte) ---
  { pattern: /^entertainment\.activity_park\.trampoline$/, score: 98 },
  { pattern: /^entertainment\.activity_park(\..*)?$/, score: 95 },
  { pattern: /^entertainment\.theme_park$/, score: 95 },
  { pattern: /^entertainment\.water_park$/, score: 92 },
  { pattern: /^entertainment\.zoo$/, score: 70 },
  { pattern: /^entertainment\.aquarium$/, score: 90 },
  { pattern: /^entertainment\.planetarium$/, score: 90 },
  { pattern: /^entertainment\.cinema$/, score: 90 },
  { pattern: /^entertainment\.escape_game$/, score: 85 },

  // --- Mid-Tier (60-80 Punkte) ---
  { pattern: /^adult\.nightclub$/, score: 80 },
  { pattern: /^entertainment\.bowling_alley$/, score: 95 },
  { pattern: /^entertainment\.miniature_golf$/, score: 95 },
  { pattern: /^entertainment\.culture(\..*)?$/, score: 70 },
  { pattern: /^leisure\.playground$/, score: 65 },
  { pattern: /^leisure\.park(\..*)?$/, score: 60 },
  { pattern: /^beach(\..*)?$/, score: 60 },

  // --- Infrastructure & Catering (Sub-60) ---
  { pattern: /^catering\.pub$/, score: 55 },
  { pattern: /^catering\.bar$/, score: 55 },
  { pattern: /^catering\.biergarten$/, score: 55 },
  { pattern: /^catering\.restaurant$/, score: 50 },
  { pattern: /^catering\.cafe$/, score: 45 },
  { pattern: /^tourism\.sights$/, score: 65 },
  { pattern: /^building\.historic$/, score: 50 },
  { pattern: /^commercial\.shopping_mall$/, score: 60 },
  { pattern: /^sport\.sports_centre$/, score: 60 }
];

function getTagScore(tag: string): number {
  for (const rule of tagRules) {
    if (rule.pattern.test(tag)) {
      return rule.score;
    }
  }
  return 0; // Fallback-Tier
}

/**
 * Berechnet den Basis-Score basierend auf den Tags (wird für die Diagnose genutzt)
 */
export function calculateRelevanceScore(tags: string[]): number {
  if (!tags || tags.length === 0) return 0;
  const scores = tags.map(tag => getTagScore(tag)).filter(s => s > 0);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}


/**
 * Zerfallskonstante für die Distanz-Gewichtung im Cold-Start Algorithmus.
 * Dieser Konfigurationsparameter ist leicht modifizierbar für die iterative
 * Kalibrierung von Qualität vs. Entfernung.
 */
export const COLD_START_LAMBDA = 0.005;

/**
 * Toleranzkorridor für die stochastische Injektion (Rauschvariable).
 * Verhindert deterministische Startbedingungen für symmetrische Datenerhebung.
 */
export const EPSILON_TOLERANCE = 0.7;

/**
 * HMFR 2.0: Asymmetric Contextual Ranking (Wildcard-Edition)
 */
export function calculateRelevance(
  item: any,
  userProfile: UserProfile,
  userLocation: { lat: number; lng: number },
  options: { disableBoringPenalty?: boolean } = {}
): number {
  if (!item) return 0;

  if (item.isCustomActivity) {
    return ACTIVITY_BASE_SCORE;
  }

  const distanceKm = (item?.distance !== undefined && item?.distance !== null)
    ? item.distance / 1000
    : 0;

  // SAFE-GUARD: Robust category extraction
  const categories: string[] = Array.isArray(item?.categories)
    ? item.categories
    : (Array.isArray(item?.properties?.categories) ? item.properties.categories : []);

  // FALLBACK: If no tags found, return a minimal base score of 10 instead of crashing or returning 0
  if (categories.length === 0) return 10;

  const affinities = userProfile?.categoryAffinities || {};

  // 1. Individuelle Tag-Gewichtung 
  const weightedScores = categories.map(cat => {
    if (!cat) return 0;
    const T_i = getTagScore(cat);
    if (T_i === 0) return 0;

    let w_i = 1.0;
    let matchingTab;
    let longestMatchLen = 0;
    const tabs = availableTabs || [];
    for (const tab of tabs) {
      if (!tab?.query) continue;
      for (const q of tab.query) {
        if (!q) continue;
        if (cat.startsWith(q) || cat === q) {
          if (q.length > longestMatchLen) {
            longestMatchLen = q.length;
            matchingTab = tab;
          }
        }
      }
    }

    if (matchingTab && affinities[matchingTab.id] !== undefined) {
      w_i = affinities[matchingTab.id];
    }
    return T_i * w_i;
  }).filter(score => score !== 0);

  if (weightedScores.length === 0) return 0;

  // 2. Weighted Cascade Modell (70% Best, 20% Second, 10% Third)
  const sortedScores = [...weightedScores].sort((a, b) => b - a);
  const T1 = sortedScores[0] || 0;
  const T2 = sortedScores[1] || T1;
  const T3 = sortedScores[2] || T2;

  const T_cascade = (T1 * 0.7) + (T2 * 0.2) + (T3 * 0.1);

  // 3. Logarithmische Dämpfungsfunktion (Soft-Cap)
  let T_final = Math.sign(T_cascade) * 100 * Math.log10(1 + (Math.abs(T_cascade) / 20));

  // --- BORING-PENALTY (VETO MECHANISM) ---
  // HEROS SIND IMMUN: Wenn ein Ort einen Hero-Tag (>= 90) hat, greift die Strafe NICHT.
  // Dies verhindert, dass z.B. das Klimahaus (Museum + Sights) abgestraft wird.
  const hasHeroTag = categories.some(cat => getTagScore(cat) >= 90);

  if (!options.disableBoringPenalty && !hasHeroTag) {
    const boringTags = [
      'religion', 'place_of_worship', 'historic', 'heritage', 'archaeological_site',
      'community_centre', 'arts_centre', 'social_facility', 'youth_centre',
      'natural.protected_area', 'leisure.nature_reserve', 'leisure.park',
      'catering.restaurant', 'catering.cafe', 'tourism.sights'
    ];
    const hasBoringTag = categories.some(cat =>
      boringTags.some(boring => cat.toLowerCase().includes(boring))
    );

    if (hasBoringTag) {
      T_final -= 55; // MASSIVE Strafe für passive/infrastrukturelle Orte (z.B. Wald vs. Kino)
    }
  }

  // 4. Dynamisches Lambda (Qualitäts-abhängiger Distanzverfall)
  // Highlights (>= 80) verfallen langsamer als Mid-Tier oder Low-Tier Content.
  let lambda = 0.015; // Default (Low-Tier)
  if (T_final >= 80) {
    lambda = 0.002;
  } else if (T_final >= 60) {
    lambda = 0.005;
  }

  // Deterministischer Epsilon
  const placeId = item.place_id || item.id || '';
  let hash = 0;
  for (let i = 0; i < placeId.length; i++) {
    hash = ((hash << 5) - hash + placeId.charCodeAt(i)) | 0;
  }
  const deterministicRandom = ((hash & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const epsilon = deterministicRandom * EPSILON_TOLERANCE;

  // 5. Basis-Score (Qualität * Exp-Verfall)
  // Formel: ((T_final * UserAffinity) + Epsilon) * Math.exp(-Lambda * Distanz_in_km)
  // Hinweis: UserAffinity ist hier bereits in T_final enthalten (w_i oben)
  const S_base = (T_final + epsilon) * Math.exp(-lambda * distanceKm);

  // 6. Vote-Integration (logarithmisch gedämpft)
  const upvotes = item.upvotes || 0;
  const downvotes = item.downvotes || 0;
  const V = (1.5 * Math.log(1 + upvotes)) - (2.0 * Math.log(1 + downvotes));

  return Number((S_base + V).toFixed(1));
}



/**
 * Berechnet den Cold-Start Score einer einzelnen Entität gemäß der Exponentialfunktion und Rauschvariable.
 * Formel: S = (T_final + epsilon) * e^(-lambda * D)
 * 
 * @param T_final Gedeckelter (Soft-Cap) Basiswert der Entität inkl. Profilgewichtung
 * @param D Distanz zwischen Nutzer und Entität in Kilometern
 * @param lambda Zerfallskonstante
 * @param epsilonRange Maximaler Toleranzkorridor für Rauschvariable
 * @returns Berechneter Skalar (Score S)
 */
export function calculateColdStartScore(
  T_final: number,
  D: number,
  lambda: number = COLD_START_LAMBDA,
  epsilonRange: number = EPSILON_TOLERANCE
): number {
  const epsilon = (Math.random() * 2 - 1) * epsilonRange;
  return (T_final + epsilon) * Math.exp(-lambda * D);
}

/**
 * Wendet den Cold-Start Ranking-Algorithmus auf ein Array von Entitäten an.
 * Inkludiert Nutzerpräferenzen W_u zur Modifikation der administrativen Tags und 
 * wendet eine Dämpfungsfunktion an, um das Verhältnis zur örtlichen Dekadenz zu wahren.
 * 
 * @param entities Array von Entitäten (müssen 'D' sowie optional 'categories' enthalten)
 * @param userPreferences Mapping von Tag-Namen auf Gewichtungsfaktoren (w_i), Standard w_i=1
 * @param lambda Steuerparameter zur Gewichtung (Fallback auf Konfigurationswert)
 * @param epsilonRange Maximaler Toleranzkorridor für Rauschvariable
 * @returns Ein neues Array der Entitäten, absteigend sortiert nach dem berechneten Wert 'S'
 */
export function sortColdStartEntities<E extends { D: number; categories?: string[] }>(
  entities: E[],
  userPreferences: Record<string, number> = {},
  lambda: number = COLD_START_LAMBDA,
  epsilonRange: number = EPSILON_TOLERANCE
): (E & { S: number })[] {
  return [...entities]
    .map(entity => {
      let T_weighted = 0;

      if (Array.isArray(entity.categories) && entity.categories.length > 0) {
        // Multiplikation jedes Tags der Entität mit dem individuellen Nutzerfaktor
        const weightedScores = entity.categories.map((cat: string) => {
          const T_i = getTagScore(cat);
          let w_i = 1;

          let matchingTab;
          let longestMatchLen = 0;
          for (const tab of availableTabs) {
            for (const q of tab.query) {
              if (cat.startsWith(q) || cat === q) {
                if (q.length > longestMatchLen) {
                  longestMatchLen = q.length;
                  matchingTab = tab;
                }
              }
            }
          }

          if (matchingTab && userPreferences[matchingTab.id] !== undefined) {
            w_i = userPreferences[matchingTab.id];
          } else if (userPreferences[cat] !== undefined) {
            w_i = userPreferences[cat];
          }

          return T_i * w_i;
        });

        if (weightedScores.length > 0) {
          // Durchschnitts-Berechnung (Average-Modell nach User-Wunsch)
          const scoreSum = weightedScores.reduce((acc, val) => acc + val, 0);
          T_weighted = scoreSum / weightedScores.length;
        }
      }

      // Soft-Cap Funktion (Option B) - Symmetrisch zum Nullpunkt inkl. Vorzeichen:
      // T_final = sgn(T_weighted) * 100 * log10(1 + |T_weighted| / 20)
      const T_final = Math.sign(T_weighted) * 100 * Math.log10(1 + (Math.abs(T_weighted) / 20));

      return {
        ...entity,
        S: calculateColdStartScore(T_final, entity.D, lambda, epsilonRange)
      };
    })
    .sort((a, b) => b.S - a.S);
}

