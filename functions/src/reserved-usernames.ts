/**
 * Reserved Usernames – Server-side copy for Cloud Functions.
 *
 * This is a self-contained copy of the reserved username logic from
 * src/lib/reserved-usernames.ts for use in the CommonJS Cloud Functions
 * environment. The canonical list lives in the frontend module; keep both
 * in sync when adding or removing entries.
 */

const MIN_USERNAME_LENGTH = 4;

const RESERVED_USERNAMES_RAW: string[] = [
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

const RESERVED_USERNAMES: Set<string> = new Set(
  RESERVED_USERNAMES_RAW
    .map(e => e.trim().toLowerCase())
    .filter(e => e.length >= MIN_USERNAME_LENGTH),
);

function normalizeUsernameStrict(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Partial-match blacklist for offensive content.
 * Duplicated from src/lib/moderation/blacklist.ts for server-side enforcement.
 */
const PARTIAL_MATCH_BLACKLIST = [
  'nazi', 'hitler', 'himmler', 'goebbels', 'swastika', 'hakenkreuz',
  'siegheil', 'neger', 'nigger', 'kanacke', 'kuffar',
  'hure', 'wichser', 'wixxer', 'fotze', 'schlampe', 'arschloch',
  'bastard', 'schwuchtel', 'fresse', 'missgeburt', 'spast', 'spasti',
  'pimmel', 'sperma', 'wanker',
  'fick', 'fuck', 'bitch', 'slut', 'cunt', 'asshole', 'faggot',
  'dyke', 'pedophil', 'paedophil', 'childporn',
];

/**
 * Normalizes text with leetspeak handling for moderation checks.
 * Duplicated from src/lib/moderation/blacklist.ts.
 */
function normalizeModerationText(text: string): string {
  if (!text) return '';
  let normalized = text.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const leetMap: Record<string, string> = {
    '1': 'i', '3': 'e', '4': 'a', '5': 's', '0': 'o',
    '@': 'a', '$': 's', '!': 'i', '*': '',
  };
  let leetReplaced = '';
  for (const char of normalized) {
    leetReplaced += leetMap[char] !== undefined ? leetMap[char] : char;
  }
  return leetReplaced.replace(/[^a-z0-9]/g, '');
}

export function isReservedUsername(input: string): boolean {
  if (!input) return false;
  const strict = normalizeUsernameStrict(input);
  if (strict.length < MIN_USERNAME_LENGTH) return false;
  if (RESERVED_USERNAMES.has(strict)) return true;
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

/**
 * Validates a username against the moderation blacklist (offensive content).
 * Returns true if the username passes moderation, false if it contains blocked content.
 */
export function passesModeration(username: string): boolean {
  if (!username) return false;
  const normalized = normalizeModerationText(username);
  for (const term of PARTIAL_MATCH_BLACKLIST) {
    if (normalized.includes(term)) return false;
  }
  return true;
}

/** Username format regex: only letters, digits, dots, underscores */
export const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;
export const USERNAME_MIN_LENGTH = 4;
export const USERNAME_MAX_LENGTH = 32;

/**
 * Full server-side username validation.
 * Checks length, pattern, moderation blacklist, and reserved list.
 */
export function isValidUsername(username: string): boolean {
  if (!username) return false;
  const trimmed = username.trim().toLowerCase();
  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) return false;
  if (!USERNAME_PATTERN.test(trimmed)) return false;
  if (!passesModeration(trimmed)) return false;
  if (isReservedUsername(trimmed)) return false;
  return true;
}
