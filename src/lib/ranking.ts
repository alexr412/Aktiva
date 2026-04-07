'use client';

import { UserProfile } from './types';

export const ACTIVITY_BASE_SCORE = 100;

// Hierarchical Regex Matchers - Specific beats Generic
const tagRules: { pattern: RegExp; score: number }[] = [
  // --- High-Tier (90 Punkte) ---
  { pattern: /^tourism\.attraction(\..*)?$/, score: 10 }, // 90
  { pattern: /^tourism\.sights(\..*)?$/, score: 10 }, // 90
  { pattern: /^entertainment\.museum$/, score: 90 },
  { pattern: /^entertainment\.planetarium$/, score: 90 },
  { pattern: /^entertainment\.aquarium$/, score: 90 },
  { pattern: /^tourism(\.sights)?\.zoo$/, score: 10 },
  { pattern: /^entertainment\.theme_park$/, score: 90 },
  { pattern: /^entertainment\.water_park$/, score: 90 },
  { pattern: /^leisure\.water_park$/, score: 90 }, // Alias coverage
  { pattern: /^entertainment\.escape_game$/, score: 90 },
  { pattern: /^entertainment\.activity_park(\..*)?$/, score: 90 },
  { pattern: /^entertainment\.cinema$/, score: 90 },
  { pattern: /^entertainment\.bowling_alley$/, score: 90 },
  { pattern: /^leisure\.bowling_alley$/, score: 90 }, // Alias coverage
  { pattern: /^entertainment\.miniature_golf$/, score: 90 },
  { pattern: /^leisure\.miniature_golf$/, score: 90 }, // Alias coverage
  { pattern: /^adult\.nightclub$/, score: 90 },
  { pattern: /^catering\.pub$/, score: 90 },
  { pattern: /^catering\.bar$/, score: 90 },
  { pattern: /^catering\.biergarten$/, score: 90 },
  { pattern: /^sport\.stadium$/, score: 90 },
  { pattern: /^leisure\.stadium$/, score: 90 }, // Alias coverage
  { pattern: /^building\.tourism$/, score: 90 },
  { pattern: /^entertainment\.zoo$/, score: 90 },
  { pattern: /^entertainment(\..*)?$/, score: 75 },


  // --- Mid-Tier (60 Punkte) ---
  { pattern: /^leisure\.park(\..*)?$/, score: 60 },
  { pattern: /^leisure\.nature_reserve$/, score: 60 },
  { pattern: /^leisure\.garden$/, score: 60 },
  { pattern: /^beach(\..*)?$/, score: 60 },
  { pattern: /^leisure\.beach$/, score: 60 }, // Alias coverage
  { pattern: /^sport(\..*)?$/, score: 60 }, // Will match if not stadium (already matched above)
  { pattern: /^entertainment\.culture(\..*)?$/, score: 60 },
  { pattern: /^camping(\..*)?$/, score: 60 },
  { pattern: /^tourism\.camping$/, score: 60 }, // Alias coverage
  { pattern: /^leisure\.spa(\..*)?$/, score: 60 },
  { pattern: /^building\.historic$/, score: 10 }, //60
  { pattern: /^man_made\.tower$/, score: 60 },
  { pattern: /^man_made\.lighthouse$/, score: 60 },
  { pattern: /^man_made\.bridge$/, score: 60 },
  { pattern: /^education\.library$/, score: 60 },
  { pattern: /^education\.university$/, score: 60 },
  { pattern: /^catering\.cafe(\..*)?$/, score: 60 },
  { pattern: /^catering\.ice_cream$/, score: 60 },

  // --- Low-Tier (20 Punkte) ---
  { pattern: /^national_park$/, score: 20 },
  { pattern: /^natural\.protected_area$/, score: 20 },
  { pattern: /^natural\.mountain(\..*)?$/, score: 20 },
  { pattern: /^natural\.water(\..*)?$/, score: 20 },
  { pattern: /^catering(\..*)?$/, score: 20 }, // Generic catering
  { pattern: /^commercial(\..*)?$/, score: 20 },
  { pattern: /^leisure\.playground$/, score: 20 },
  { pattern: /^leisure\.picnic(\..*)?$/, score: 20 },
  { pattern: /^natural\.forest$/, score: 20 },
  { pattern: /^natural\.sand$/, score: 20 },
  { pattern: /^building(\..*)?$/, score: 20 }, // Generic building
  { pattern: /^production(\..*)?$/, score: 20 },
  { pattern: /^education(\..*)?$/, score: 20 },
  { pattern: /^religion\.place_of_worship$/, score: -120 },
  { pattern: /^building\.place_of_worship$/, score: -120 },
  { pattern: /^building\.historic$/, score: -120 },
  { pattern: /^accommodation\.hotel$/, score: -120 }

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

  const userInterests = userProfile?.likedTags || userProfile?.interests || [];
  const affinities = userProfile?.categoryAffinities || {};

  // 1. Individuelle Tag-Gewichtung (T_i' = T_i * w_i)
  const weightedScores = categories.map(cat => {
    const T_i = getTagScore(cat);
    if (T_i === 0) return 0; // Fallback überspringen um Logik nicht zu verschmutzen

    // Fallback: 1.0 ist neutral. Wenn gemagte Tags, dann 1.5. Wenn explizite Affinity (-5 bis +5) gesetzt, nutze diese.
    let w_i = 1.0;
    if (affinities[cat] !== undefined) {
      w_i = affinities[cat];
    } else if (userInterests.includes(cat)) {
      w_i = 1.5;
    }

    return T_i * w_i;
  }).filter(score => score !== 0);

  if (weightedScores.length === 0) return 0;

  // 2. Durchschnittsberechnung (Nutzer-Korrektur)
  const sum = weightedScores.reduce((acc, curr) => acc + curr, 0);
  const T_weighted = sum / weightedScores.length;

  // 3. Logarithmische Dämpfung (Soft-Cap)
  // T_final = sgn(T_weighted) * 100 * log10(1 + |T_weighted| / 100)
  const T_final = Math.sign(T_weighted) * 100 * Math.log10(1 + (Math.abs(T_weighted) / 100));

  // 4. Basis-Relevanz (Distanz & Stochastik)
  // S = (T_final + epsilon) * e^(-lambda * D)
  const lambda = COLD_START_LAMBDA > 0 ? COLD_START_LAMBDA : 0.5; // Fallback auf 0.5, falls in config 0 ist
  const epsilon = (Math.random() * 2 - 1) * EPSILON_TOLERANCE;

  const S = (T_final + epsilon) * Math.exp(-lambda * distanceKm);

  // 5. Voting Integration (Finale Priorität)
  const communityScore = item.communityScore || 0;
  return S + (communityScore * 50);
}

// -----------------------------------------------------
// Cold-Start Ranking Algorithm
// -----------------------------------------------------

/**
 * Zerfallskonstante für die Distanz-Gewichtung im Cold-Start Algorithmus.
 * Dieser Konfigurationsparameter ist leicht modifizierbar für die iterative
 * Kalibrierung von Qualität vs. Entfernung.
 */
export const COLD_START_LAMBDA = 0.05; //0.5

/**
 * Toleranzkorridor für die stochastische Injektion (Rauschvariable).
 * Verhindert deterministische Startbedingungen für symmetrische Datenerhebung.
 */
export const EPSILON_TOLERANCE = 0.0; //2.0

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

