/**
 * Central Blacklist and Moderation Utility for Aktiva
 * Handles text normalization, username validation, and chat moderation rules.
 */

import { isReservedUsername } from '../reserved-usernames';

// Hard blacklist of usernames that are exact matches or system-reserved terms
export const USERNAME_BLACKLIST = [
  'admin',
  'administrator',
  'moderator',
  'support',
  'owner',
  'official',
  'system',
  'aktiva',
  'verified',
  'staff',
  'help',
  'info',
  'service',
  'team',
  'root',
  'security',
  'contact',
  'feedback',
  'aktivaapp',
  'aktivateam',
  'guest',
  'anonymous',
  'everyone',
  'all',
  'here'
];

// Exact chat terms that are forbidden but shouldn't trigger partial match (to avoid false positives)
export const CHAT_BLACKLIST: string[] = [
  // Add exact terms here if needed
];

// Partial match terms that are forbidden as substrings in usernames or chat
export const PARTIAL_MATCH_BLACKLIST = [
  // Extremist & Hate Speech
  'nazi',
  'hitler',
  'himmler',
  'goebbels',
  'swastika',
  'hakenkreuz',
  'siegheil',
  'neger',
  'nigger',
  'kanacke',
  'kuffar',
  
  // Severe Vulgarities & Insults (German)
  'hure',
  'wichser',
  'wixxer',
  'fotze',
  'schlampe',
  'arschloch',
  'bastard',
  'schwuchtel',
  'fresse',
  'missgeburt',
  'spast',
  'spasti',
  'pimmel',
  'sperma',
  'wanker',
  
  // Severe Vulgarities & Insults (English)
  'fick',
  'fuck',
  'bitch',
  'slut',
  'cunt',
  'asshole',
  'faggot',
  'dyke',
  'pedophil',
  'paedophil',
  'childporn'
];

/**
 * Normalizes text to handle Leetspeak, Unicode characters, and casing.
 * Strips special characters to detect obfuscated words.
 */
export function normalizeModerationText(text: string): string {
  if (!text) return '';

  // 1. Lowercase & Normalize Unicode to strip accents/diacritics
  let normalized = text.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 2. Map common Leetspeak replacements
  const leetMap: Record<string, string> = {
    '1': 'i',
    '3': 'e',
    '4': 'a',
    '5': 's',
    '0': 'o',
    '@': 'a',
    '$': 's',
    '!': 'i',
    '*': '', // Strip asterisks immediately
  };

  let leetReplaced = '';
  for (const char of normalized) {
    leetReplaced += leetMap[char] !== undefined ? leetMap[char] : char;
  }

  // 3. Remove all non-alphanumeric characters (spaces, punctuation, symbols)
  // E.g., "h*u*r*e" -> "hure", "b!tch" -> "bitch", "f.i.c.k" -> "fick"
  const cleaned = leetReplaced.replace(/[^a-z0-9]/g, '');

  return cleaned;
}

/**
 * Checks if a text string contains blocked terms, both by exact matching words
 * and by partial substring matching on normalized, non-spaced text.
 */
export function containsBlockedWord(text: string): boolean {
  if (!text) return false;

  // 1. Clean individual words for exact blacklist matching
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''));

  for (const word of words) {
    if (CHAT_BLACKLIST.includes(word) || USERNAME_BLACKLIST.includes(word)) {
      return true;
    }
  }

  // 2. Normalize entire text (removing all spaces and special characters)
  const normalizedText = normalizeModerationText(text);

  // Check against partial match blacklist
  for (const term of PARTIAL_MATCH_BLACKLIST) {
    if (normalizedText.includes(term)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates a username against system reserves and the blacklists.
 * Returns true if valid, false if blocked.
 */
export function validateUsername(username: string): boolean {
  if (!username) return false;

  const normalized = normalizeModerationText(username);

  // Check exact system reserves and username blacklist
  if (USERNAME_BLACKLIST.includes(normalized) || USERNAME_BLACKLIST.includes(username.toLowerCase())) {
    return false;
  }

  // Check reserved usernames
  if (isReservedUsername(username)) {
    return false;
  }

  // Check partial blacklist
  for (const term of PARTIAL_MATCH_BLACKLIST) {
    if (normalized.includes(term)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates a chat message or comment.
 * Returns true if valid, false if blocked.
 */
export function validateChatMessage(message: string): boolean {
  if (!message) return true; // Empty messages are benign
  return !containsBlockedWord(message);
}
