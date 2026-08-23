export const LEVEL_THRESHOLDS: number[] = Array.from({ length: 100 }, (_, i) => {
  if (i === 0) return 0;
  return Math.round(30 * Math.pow(i, 1.68));
});

export function calculateLevel(pointsLifetime: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (pointsLifetime >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return Math.min(100, Math.max(1, level));
}

export interface LevelTierInfo {
  titleDe: string;
  titleEn: string;
  borderGradient: string;
  badgeBg: string;
  badgeText: string;
}

export function getLevelTierInfo(level: number = 1): LevelTierInfo {
  const lvl = Math.max(1, level);
  if (lvl >= 100) {
    return {
      titleDe: 'Aktiva Legende',
      titleEn: 'Aktiva Legend',
      borderGradient: 'bg-gradient-to-tr from-cyan-400 via-indigo-500 to-pink-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]',
      badgeBg: 'bg-gradient-to-r from-cyan-500 to-indigo-600',
      badgeText: 'text-white font-bold',
    };
  }
  if (lvl >= 50) {
    return {
      titleDe: 'Aktiva Legende',
      titleEn: 'Aktiva Legend',
      borderGradient: 'bg-gradient-to-tr from-rose-500 via-pink-500 to-red-600 shadow-[0_0_12px_rgba(244,63,94,0.4)]',
      badgeBg: 'bg-gradient-to-r from-rose-500 to-pink-600',
      badgeText: 'text-white font-bold',
    };
  }
  if (lvl >= 35) {
    return {
      titleDe: 'Pionier',
      titleEn: 'Pioneer',
      borderGradient: 'bg-gradient-to-tr from-rose-500 to-purple-600 shadow-[0_0_10px_rgba(225,29,72,0.3)]',
      badgeBg: 'bg-gradient-to-r from-rose-500 to-purple-600',
      badgeText: 'text-white font-bold',
    };
  }
  if (lvl >= 20) {
    return {
      titleDe: 'Stammmitglied',
      titleEn: 'Regular',
      borderGradient: 'bg-gradient-to-tr from-violet-600 via-purple-500 to-indigo-500 shadow-[0_0_10px_rgba(147,51,234,0.3)]',
      badgeBg: 'bg-gradient-to-r from-violet-600 to-purple-600',
      badgeText: 'text-white font-bold',
    };
  }
  if (lvl >= 10) {
    return {
      titleDe: 'Aktivist',
      titleEn: 'Activist',
      borderGradient: 'bg-gradient-to-tr from-blue-500 via-cyan-500 to-teal-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]',
      badgeBg: 'bg-gradient-to-r from-blue-600 to-cyan-500',
      badgeText: 'text-white font-bold',
    };
  }
  if (lvl >= 5) {
    return {
      titleDe: 'Entdecker',
      titleEn: 'Explorer',
      borderGradient: 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
      badgeBg: 'bg-gradient-to-r from-emerald-600 to-teal-600',
      badgeText: 'text-white font-bold',
    };
  }
  return {
    titleDe: 'Starter',
    titleEn: 'Starter',
    borderGradient: 'bg-gradient-to-tr from-slate-400 to-slate-500',
    badgeBg: 'bg-slate-600 dark:bg-slate-700',
    badgeText: 'text-slate-100 font-semibold',
  };
}

export function getLevelTitle(level: number = 1, language: 'de' | 'en' = 'de'): string {
  const tier = getLevelTierInfo(level);
  return language === 'de' ? tier.titleDe : tier.titleEn;
}

