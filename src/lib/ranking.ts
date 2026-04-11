'use client';

import { UserProfile } from './types';

export const ACTIVITY_BASE_SCORE = 100;

// Hierarchical Regex Matchers - Specific beats Generic
const tagRules: { pattern: RegExp; score: number }[] = [
  // --- High-Tier (90 Punkte) ---
  { pattern: /^tourism\.attraction(\..*)?$/, score: 10 }, // 90
  { pattern: /^tourism\.sights(\..*)?$/, score: 10 }, // 90
  { pattern: /^entertainment\.museum$/, score: 75 },
  { pattern: /^entertainment\.planetarium$/, score: 100 },
  { pattern: /^entertainment\.aquarium$/, score: 100 },
  { pattern: /^entertainment\.theme_park$/, score: 80 },
  { pattern: /^entertainment\.water_park$/, score: 80 },
  { pattern: /^entertainment\.escape_game$/, score: 80 },
  { pattern: /^entertainment\.activity_park(\..*)?$/, score: 80 },
  { pattern: /^entertainment\.cinema$/, score: 80 },
  { pattern: /^entertainment\.bowling_alley$/, score: 80 },
  { pattern: /^entertainment\.miniature_golf$/, score: 80 },
  { pattern: /^adult\.nightclub$/, score: 75 },
  { pattern: /^catering\.pub$/, score: 80 },
  { pattern: /^catering\.bar$/, score: 80 },
  { pattern: /^catering\.biergarten$/, score: 80 },
  { pattern: /^sport\.stadium$/, score: 80 },
  { pattern: /^building\.tourism$/, score: 80 },
  { pattern: /^entertainment\.zoo$/, score: 79 },
  { pattern: /^entertainment(\..*)?$/, score: 75 },
  { pattern: /^building\.entertainment$/, score: 70 },



  // --- Mid-Tier (60 Punkte) ---
  { pattern: /^leisure\.park(\..*)?$/, score: 55 },
  { pattern: /^leisure\.nature_reserve$/, score: 45 },
  { pattern: /^leisure\.garden$/, score: 45 },
  { pattern: /^beach(\..*)?$/, score: 60 },
  { pattern: /^leisure\.beach$/, score: 45 }, // Alias coverage
  { pattern: /^sport(\..*)?$/, score: 60 }, // Will match if not stadium (already matched above)
  { pattern: /^entertainment\.culture(\..*)?$/, score: 60 },
  { pattern: /^camping(\..*)?$/, score: 40 },
  { pattern: /^tourism\.camping$/, score: 40 }, // Alias coverage
  { pattern: /^leisure\.spa(\..*)?$/, score: 60 },
  { pattern: /^building\.historic$/, score: 10 }, //60
  { pattern: /^man_made\.tower$/, score: 30 },
  { pattern: /^man_made\.lighthouse$/, score: 30 },
  { pattern: /^man_made\.bridge$/, score: 30 },
  { pattern: /^education\.library$/, score: 65 },
  { pattern: /^education\.university$/, score: 65 },
  { pattern: /^catering\.cafe(\..*)?$/, score: 60 },
  { pattern: /^catering\.ice_cream$/, score: 60 },
  { pattern: /^commercial\.shopping_mall$/, score: 50 },
  { pattern: /^building\.commercial$/, score: 50 },

  // --- Low-Tier (20 Punkte) ---
  { pattern: /^national_park$/, score: 20 },
  { pattern: /^natural\.protected_area$/, score: 20 },
  { pattern: /^natural\.mountain(\..*)?$/, score: 20 },
  { pattern: /^natural\.water(\..*)?$/, score: 20 },
  { pattern: /^catering(\..*)?$/, score: 20 }, // Generic catering
  { pattern: /^catering\.fast_food$/, score: 20 },
  { pattern: /^commercial(\..*)?$/, score: 20 },
  { pattern: /^leisure\.playground$/, score: 10 },
  { pattern: /^leisure\.picnic(\..*)?$/, score: 20 },
  { pattern: /^natural\.forest$/, score: 20 },
  { pattern: /^natural\.sand$/, score: 20 },
  { pattern: /^religion\.place_of_worship$/, score: -120 },
  { pattern: /^building\.place_of_worship$/, score: -120 },
  { pattern: /^building\.historic$/, score: -120 },
  { pattern: /^accommodation\.hotel$/, score: -120 },

  { pattern: /^building(\..*)?$/, score: 20 }, // Generic building (MUSS IMMER UNTER DEN SPEZIFISCHEN SEIN)
  { pattern: /^production(\..*)?$/, score: 20 },
  { pattern: /^education(\..*)?$/, score: 20 }

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
  userLocation: { lat: number; lng: number }
): number {
  if (!item) return 0;

  if (item.isCustomActivity) {
    return ACTIVITY_BASE_SCORE;
  }

  const distanceKm = (item.distance !== undefined && item.distance !== null)
    ? item.distance / 1000
    : 0;

  // Extraktion der Tags
  const categories: string[] = Array.isArray(item.categories) ? item.categories : [];

  if (categories.length === 0) return 0;

  const affinities = userProfile?.categoryAffinities || {};

  // 1. Individuelle Tag-Gewichtung (T_i' = T_i * w_i)
  const weightedScores = categories.map(cat => {
    const T_i = getTagScore(cat);
    if (T_i === 0) return 0;

    // Standardwert bei fehlender Affinität ist w_i = 1 (Statischen Boost eliminieren)
    let w_i = 1.0;
    if (affinities[cat] !== undefined) {
      w_i = affinities[cat];
    }

    return T_i * w_i;
  }).filter(score => score !== 0);

  if (weightedScores.length === 0) return 0;

  // 2. Durchschnitts-Berechnung (Average-Modell)
  const scoreSum = weightedScores.reduce((sum, val) => sum + val, 0);
  const T_weighted = scoreSum / weightedScores.length;

  // 3. Logarithmische Dämpfungsfunktion (Soft-Cap)
  const T_final = Math.sign(T_weighted) * 100 * Math.log10(1 + (Math.abs(T_weighted) / 20));

  // 4. Basis-Score (Zwischenergebnis — reine Formel ohne Votes)
  const lambda = COLD_START_LAMBDA > 0 ? COLD_START_LAMBDA : 0.5;
  // Deterministischer Epsilon basierend auf Place-ID (stabil über Re-Renders)
  const placeId = item.place_id || item.id || '';
  let hash = 0;
  for (let i = 0; i < placeId.length; i++) {
    hash = ((hash << 5) - hash + placeId.charCodeAt(i)) | 0;
  }
  const deterministicRandom = ((hash & 0x7fffffff) / 0x7fffffff) * 2 - 1; // -1 bis +1
  const epsilon = deterministicRandom * EPSILON_TOLERANCE;
  const S_base = (T_final + epsilon) * Math.exp(-lambda * distanceKm);

  // 5. Vote-Integration (additiver Bonus/Malus auf Zwischenergebnis)
  //    V = W_up * ln(1 + upvotes) - W_down * ln(1 + downvotes)
  //    Log-Dämpfung verhindert, dass wenige Power-Voter das Ranking dominieren.
  const upvotes = item.upvotes || 0;
  const downvotes = item.downvotes || 0;
  const W_UP = 1.5;    // Gewicht pro Upvote (gedämpft)
  const W_DOWN = 2.0;  // Gewicht pro Downvote (asymmetrisch stärker)

  const V = (W_UP * Math.log(1 + upvotes)) - (W_DOWN * Math.log(1 + downvotes));

  // 6. Finale Zusammenführung
  return S_base + V;
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
          const w_i = userPreferences[cat] !== undefined ? userPreferences[cat] : 1;
          return T_i * w_i;
        });

        if (weightedScores.length > 0) {
          // Identifikation des dominanten gewichteten Wertes
          const T_max = Math.max(...weightedScores);

          let maxRemoved = false;
          const secondaryScores = weightedScores.filter(score => {
            if (score === T_max && !maxRemoved) {
              maxRemoved = true;
              return false;
            }
            return true;
          });

          // Akkumulation der sekundären Tags mit Bonus-Faktor
          const secondarySum = secondaryScores.reduce((acc, val) => acc + val, 0);
          T_weighted = T_max + (secondarySum * 0.1);
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

