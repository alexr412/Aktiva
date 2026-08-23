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

export function getLevelTitle(
  level: number = 1, 
  language: 'de' | 'en' = 'de',
  equippedTitleId?: string | null
): string {
  if (equippedTitleId && equippedTitleId !== 'default') {
    const custom = ALL_TITLE_OPTIONS.find(t => t.id === equippedTitleId);
    if (custom) {
      return language === 'de' ? custom.titleDe : custom.titleEn;
    }
  }
  const tier = getLevelTierInfo(level);
  return language === 'de' ? tier.titleDe : tier.titleEn;
}

export interface TitleOption {
  id: string;
  minLevel: number;
  titleDe: string;
  titleEn: string;
}

export interface BorderOption {
  id: string;
  minLevel: number;
  nameDe: string;
  nameEn: string;
  gradient: string;
  isPremiumOnly?: boolean;
}

export const ALL_TITLE_OPTIONS: TitleOption[] = [
  { id: 'default', minLevel: 1, titleDe: 'Automatischer Rang-Titel', titleEn: 'Automatic Rank Title' },
  { id: 'starter', minLevel: 1, titleDe: 'Starter', titleEn: 'Starter' },
  { id: 'explorer', minLevel: 5, titleDe: 'Entdecker', titleEn: 'Explorer' },
  { id: 'activist', minLevel: 10, titleDe: 'Aktivist', titleEn: 'Activist' },
  { id: 'regular', minLevel: 20, titleDe: 'Stammmitglied', titleEn: 'Regular' },
  { id: 'pioneer', minLevel: 35, titleDe: 'Pionier', titleEn: 'Pioneer' },
  { id: 'legend', minLevel: 50, titleDe: 'Aktiva Legende', titleEn: 'Aktiva Legend' },
];

export const ALL_BORDER_OPTIONS: BorderOption[] = [
  { id: 'default', minLevel: 1, nameDe: 'Automatischer Level-Rahmen', nameEn: 'Automatic Level Frame', gradient: '' },
  { id: 'starter', minLevel: 1, nameDe: 'Starter (Slate)', nameEn: 'Starter (Slate)', gradient: 'bg-gradient-to-tr from-slate-400 to-slate-500' },
  { id: 'explorer', minLevel: 5, nameDe: 'Entdecker (Smaragd)', nameEn: 'Explorer (Emerald)', gradient: 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-[0_0_8px_rgba(16,185,129,0.3)]' },
  { id: 'activist', minLevel: 10, nameDe: 'Aktivist (Saphir)', nameEn: 'Activist (Sapphire)', gradient: 'bg-gradient-to-tr from-blue-500 via-cyan-500 to-teal-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]' },
  { id: 'regular', minLevel: 20, nameDe: 'Stammmitglied (Amethyst)', nameEn: 'Regular (Amethyst)', gradient: 'bg-gradient-to-tr from-violet-600 via-purple-500 to-indigo-500 shadow-[0_0_10px_rgba(147,51,234,0.3)]' },
  { id: 'pioneer', minLevel: 35, nameDe: 'Pionier (Rubin)', nameEn: 'Pioneer (Ruby)', gradient: 'bg-gradient-to-tr from-rose-500 to-purple-600 shadow-[0_0_10px_rgba(225,29,72,0.3)]' },
  { id: 'legend', minLevel: 50, nameDe: 'Aktiva Legende (Cosmic)', nameEn: 'Aktiva Legend (Cosmic)', gradient: 'bg-gradient-to-tr from-cyan-400 via-indigo-500 to-pink-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' },
  { id: 'premium_gold', minLevel: 1, nameDe: 'Goldener Premium-Glow', nameEn: 'Golden Premium Glow', gradient: 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-700 shadow-[0_0_15px_rgba(217,119,6,0.5)]', isPremiumOnly: true },
];

export function getUnlockedTitles(level: number = 1): TitleOption[] {
  const lvl = Math.max(1, level);
  return ALL_TITLE_OPTIONS.filter(t => t.minLevel <= lvl);
}

export function getUnlockedBorders(level: number = 1, isPremium?: boolean): BorderOption[] {
  const lvl = Math.max(1, level);
  return ALL_BORDER_OPTIONS.filter(b => {
    if (b.isPremiumOnly) return Boolean(isPremium);
    return b.minLevel <= lvl;
  });
}

export function getCustomBorderGradient(equippedBorderId?: string | null): string | null {
  if (!equippedBorderId || equippedBorderId === 'default') return null;
  const match = ALL_BORDER_OPTIONS.find(b => b.id === equippedBorderId);
  return match ? match.gradient : null;
}

