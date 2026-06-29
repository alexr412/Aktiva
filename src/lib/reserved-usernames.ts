/**
 * Reserved Usernames Module for Aktiva
 *
 * Provides a normalized set of reserved usernames and helpers to check
 * whether a given input collides with any reserved name.
 *
 * Rules:
 * - Only entries with >= MIN_USERNAME_LENGTH characters are kept.
 * - Normalization strips diacritics (NFD), lowercases, converts ß → ss.
 * - Strict normalization additionally removes all non-alphanumeric chars.
 * - isReservedUsername blocks exact matches AND reserved-word + trailing digits.
 */

export const MIN_USERNAME_LENGTH = 4;

// The raw list – every entry must be >= 4 chars; shorter ones are filtered out.
export const RESERVED_USERNAMES_RAW: string[] = [
  // Brand / App
  'aktiva', 'activa', 'aktiv', 'active', 'official', 'verified', 'original',

  // Admin / System
  'admin', 'administrator', 'admins', 'mods', 'moderator', 'moderators',
  'owner', 'founder', 'staff', 'team', 'crew', 'support', 'help', 'hilfe',
  'service', 'contact', 'kontakt', 'info', 'mail', 'email', 'system', 'root',
  'superuser', 'operator', 'manager',

  // Security / Auth
  'login', 'logout', 'signup', 'register', 'signin', 'account', 'accounts',
  'profile', 'profiles', 'user', 'users', 'username', 'password', 'passwort',
  'reset', 'verify', 'verification', 'auth', 'authentication', 'security',
  'secure', 'session', 'token', 'tokens',

  // App pages / routes
  'home', 'feed', 'chat', 'chats', 'message', 'messages', 'inbox', 'search',
  'explore', 'discover', 'activity', 'activities', 'event', 'events', 'place',
  'places', 'location', 'locations', 'maps', 'settings', 'notifications',
  'notification', 'privacy', 'terms', 'legal', 'imprint', 'impressum', 'about',
  'blog', 'news', 'status', 'docs', 'dashboard', 'analytics', 'adminpanel',

  // Test / placeholder
  'test', 'tester', 'testing', 'demo', 'example', 'sample', 'placeholder',
  'dummy', 'fake', 'null', 'undefined', 'none', 'unknown', 'anonymous', 'anon',
  'guest', 'deleted', 'removed', 'banned', 'blocked',

  // Payments / monetization
  'payment', 'payments', 'billing', 'invoice', 'invoices', 'refund', 'refunds',
  'payout', 'payouts', 'stripe', 'paypal', 'cash', 'money', 'wallet', 'premium',
  'plus', 'boost', 'booster',

  // Trust / abuse-sensitive
  'police', 'interpol', 'government', 'officialsupport', 'aktivasupport',
  'aktivateam', 'aktivaofficial', 'activaofficial', 'activaadmin', 'aktivaadmin',

  // Scam / abuse pattern
  'scam', 'scammer', 'spam', 'spammer', 'bots', 'hack', 'hacker', 'hacked',
  'phishing', 'fraud', 'fraudster', 'virus', 'malware', 'exploit', 'cheat',
  'cheater',

  // Premium names
  'alex', 'maxi', 'luca', 'lucas', 'leon', 'noah', 'finn', 'nico', 'milo',
  'jona', 'jonas', 'paul', 'luis', 'luki', 'luke', 'erik', 'emil', 'elia',
  'mats', 'matt', 'phil', 'nick', 'levi', 'david', 'dave', 'marc', 'mark',
  'arne', 'hugo', 'kian', 'ivan', 'noel', 'joel', 'adam', 'lian', 'lina',
  'lena', 'emma', 'ella', 'maya', 'maja', 'sara', 'sarah', 'anna', 'lara',
  'lisa', 'nina', 'mila', 'mina', 'zoey', 'emily', 'emilia', 'amelie',
  'amelia', 'sofia', 'sophia', 'clara', 'klara', 'julia', 'jule', 'lilly',
  'lily', 'luna', 'leni', 'mira', 'mara', 'nora', 'runa', 'tina', 'alina',

  // Cool generic names
  'wolf', 'bear', 'lion', 'lynx', 'hawk', 'raven', 'nova', 'nove', 'vibe',
  'wave', 'flux', 'byte', 'dash', 'bolt', 'blaze', 'spark', 'ghost', 'storm',
  'drip', 'mint', 'echo', 'halo', 'orbit', 'pixel', 'prime', 'alpha', 'omega',
  'delta', 'sigma', 'zeta', 'kilo', 'mamba', 'vanta', 'nexus', 'atlas',
  'orion', 'cosmo', 'astro', 'lunar', 'solar', 'terra', 'aero', 'aura', 'onyx',
  'jade', 'ruby', 'opal', 'gold', 'silver',

  // Social / local discovery
  'alle', 'heute', 'morgen', 'stadt', 'city', 'leben', 'life', 'freunde',
  'friend', 'friends', 'buddy', 'buddies', 'gruppe', 'group', 'local',
  'locals', 'nearby', 'near', 'spot', 'spots', 'hangout', 'meet', 'meets',
  'realife', 'reallife',

  // City names
  'bielefeld', 'bremerhaven', 'hamburg', 'berlin', 'munich', 'muenchen',
  'koeln', 'koln', 'cologne', 'bremen', 'hannover', 'leipzig', 'dresden',
  'stuttgart', 'frankfurt', 'duesseldorf', 'dusseldorf', 'dortmund', 'essen',
  'bochum', 'muenster', 'munster', 'bonn', 'mainz', 'kiel', 'luebeck',
  'lubeck', 'nuremberg', 'nuernberg', 'augsburg', 'regensburg', 'wuerzburg',
  'wurzburg',

  // Platform impersonation
  'instagram', 'insta', 'tiktok', 'youtube', 'snapchat', 'snap', 'facebook',
  'meta', 'twitter', 'discord', 'telegram', 'whatsapp', 'reddit', 'twitch',

  // Tech / infra
  'firebase', 'firestore', 'google', 'apple', 'android', 'vercel', 'cloud',
  'server', 'client', 'database', 'storage', 'bucket', 'function', 'functions',
  'config', 'production', 'development', 'staging', 'localhost',
];

/**
 * Set of normalised reserved usernames.
 * Built by trimming, lower-casing, and filtering out entries shorter than
 * MIN_USERNAME_LENGTH characters.
 */
export const RESERVED_USERNAMES: Set<string> = new Set(
  RESERVED_USERNAMES_RAW
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length >= MIN_USERNAME_LENGTH),
);

/**
 * Normalizes a username for display / comparison purposes.
 * - Trims whitespace
 * - Lowercases
 * - Removes diacritics via NFD decomposition + combining-mark strip
 * - Converts ß → ss
 */
export function normalizeUsername(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Strict normalization: same as normalizeUsername but also removes every
 * character that is not a-z or 0-9.
 */
export function normalizeUsernameStrict(input: string): string {
  return normalizeUsername(input).replace(/[^a-z0-9]/g, '');
}

/**
 * Returns true if the supplied username collides with a reserved name.
 *
 * Checks performed (after strict normalization):
 * 1. Exact match against the reserved set.
 * 2. Prefix + trailing digits – e.g. "admin1" → "admin" (reserved) → blocked.
 *    Only pure trailing digits are stripped; "alexander" is NOT blocked.
 */
export function isReservedUsername(input: string): boolean {
  if (!input) return false;

  const strict = normalizeUsernameStrict(input);
  if (strict.length < MIN_USERNAME_LENGTH) return false;

  // 1. Exact match
  if (RESERVED_USERNAMES.has(strict)) return true;

  // 2. Prefix + trailing digits
  const withoutTrailingDigits = strict.replace(/\d+$/, '');
  if (
    withoutTrailingDigits !== strict &&
    withoutTrailingDigits.length >= MIN_USERNAME_LENGTH &&
    RESERVED_USERNAMES.has(withoutTrailingDigits)
  ) {
    return true;
  }

  return false;
}
