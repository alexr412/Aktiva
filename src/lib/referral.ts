import { getMigratedItem, setMigratedItem, removeMigratedItem } from './storage-migration';

export const ACTIVA_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://aktiva-six.vercel.app";

const STORAGE_NEW_KEY = 'activa:pending_referral_code';
const STORAGE_OLD_KEY = 'aktiva:pending_referral_code';

/**
 * Generates the personal referral invite link for a user.
 * Output format: https://aktiva-six.vercel.app/invite/CODE
 */
export function getReferralLink(referralCode: string): string {
  const code = (referralCode || '').trim();
  if (!code) return ACTIVA_APP_URL;
  return `${ACTIVA_APP_URL}/invite/${encodeURIComponent(code.toUpperCase())}`;
}

/**
 * Extracts and normalizes a referral code from URLSearchParams, string, URL, or route path.
 * Supports both /invite/CODE and legacy ?ref=CODE formats.
 * Returns normalized uppercase code or null if missing/invalid.
 */
export function extractReferralCode(
  input: URLSearchParams | string | URL | null | undefined
): string | null {
  if (!input) return null;

  let codeParam: string | null = null;

  if (typeof input === 'string') {
    const trimmedInput = input.trim();
    try {
      // 1. Check for /invite/CODE route path or URL
      const inviteMatch = trimmedInput.match(/\/invite\/([A-Za-z0-9_-]{3,32})/i);
      if (inviteMatch) {
        codeParam = inviteMatch[1];
      } else if (trimmedInput.includes('?')) {
        const url = new URL(trimmedInput, ACTIVA_APP_URL);
        codeParam = url.searchParams.get('ref');
      } else if (trimmedInput.startsWith('ref=')) {
        const params = new URLSearchParams(trimmedInput);
        codeParam = params.get('ref');
      } else {
        codeParam = trimmedInput;
      }
    } catch {
      codeParam = trimmedInput;
    }
  } else if (input instanceof URL) {
    const inviteMatch = input.pathname.match(/\/invite\/([A-Za-z0-9_-]{3,32})/i);
    if (inviteMatch) {
      codeParam = inviteMatch[1];
    } else {
      codeParam = input.searchParams.get('ref');
    }
  } else if (typeof input === 'object' && 'get' in input && typeof input.get === 'function') {
    codeParam = input.get('ref');
  }

  if (!codeParam) return null;

  const trimmed = codeParam.trim();
  if (!trimmed) return null;

  // Basic sanity check for referral code format (3-32 alphanumeric chars / hyphens / underscores)
  const isValidFormat = /^[A-Za-z0-9_-]{3,32}$/.test(trimmed);
  if (!isValidFormat) return null;

  return trimmed.toUpperCase();
}

/**
 * Stores pending referral code using existing storage migration helper.
 * Rules:
 * - No referral stored -> store new code
 * - Same code stored -> do nothing
 * - Different code stored -> update code
 */
export function storePendingReferralCode(code: string): void {
  const normalized = extractReferralCode(code);
  if (!normalized) return;

  const current = getPendingReferralCode();
  if (current === normalized) return;

  setMigratedItem(STORAGE_NEW_KEY, STORAGE_OLD_KEY, normalized, 'local');
}

/**
 * Retrieves the pending referral code from storage.
 */
export function getPendingReferralCode(): string | null {
  return getMigratedItem(STORAGE_NEW_KEY, STORAGE_OLD_KEY, 'local');
}

/**
 * Clears the pending referral code from storage.
 */
export function clearPendingReferralCode(): void {
  removeMigratedItem(STORAGE_NEW_KEY, STORAGE_OLD_KEY, 'local');
}

export type ShareResult =
  | { action: 'share'; success: true }
  | { action: 'share'; success: false; isAbort: true }
  | { action: 'copy'; success: true; copied: true }
  | { action: 'copy'; success: false; error: any; copied: false }
  | { action: 'error'; success: false; error: any };

export interface ShareOptions {
  referralCode: string;
  language?: 'de' | 'en';
}

/**
 * Handles Web Share API with AbortError prevention and Clipboard fallback.
 */
export async function shareOrCopyReferralLink(
  options: ShareOptions
): Promise<ShareResult> {
  const { referralCode, language = 'de' } = options;
  const link = getReferralLink(referralCode);

  const title = "Activa";
  const text = language === 'de'
    ? "Komm zu Activa und entdecke Aktivitäten, Orte und neue Leute in deiner Nähe."
    : "Join Activa and discover activities, places and new people near you.";

  // 1. Try Native Share API if supported
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title,
        text,
        url: link,
      });
      return { action: 'share', success: true };
    } catch (err: any) {
      // Check if user cancelled / aborted
      const isAbort =
        err?.name === 'AbortError' ||
        err?.code === 20 ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('cancel')) ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('abort'));

      if (isAbort) {
        return { action: 'share', success: false, isAbort: true };
      }
      // Technical failure -> proceed to clipboard fallback
    }
  }

  // 2. Clipboard Fallback
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(link);
      return { action: 'copy', success: true, copied: true };
    } catch (copyErr) {
      return { action: 'copy', success: false, error: copyErr, copied: false };
    }
  }

  return { action: 'error', success: false, error: new Error('Sharing and Clipboard API not available') };
}

/**
 * Determines whether a referral error is permanent (should clear pending code)
 * or temporary (network/timeout error - keep pending code).
 */
export function isPermanentReferralError(error: any): boolean {
  if (!error) return false;

  const code = error.code || error.status || '';
  const message = (error.message || '').toLowerCase();

  // Firebase HttpsError codes that are permanent business logic failures
  const permanentCodes = [
    'not-found',
    'failed-precondition',
    'already-exists',
    'invalid-argument',
    'permission-denied',
    'unauthenticated'
  ];

  if (permanentCodes.includes(code)) {
    return true;
  }

  // Common permanent error message strings
  if (
    message.includes('ungültig') ||
    message.includes('invalid') ||
    message.includes('selbst') ||
    message.includes('already') ||
    message.includes('bereits') ||
    message.includes('verwaist') ||
    message.includes('not found')
  ) {
    return true;
  }

  // Temporary network/server codes
  const temporaryCodes = [
    'unavailable',
    'resource-exhausted',
    'deadline-exceeded',
    'cancelled',
    'internal',
    'network-error'
  ];

  if (temporaryCodes.includes(code)) {
    return false;
  }

  if (message.includes('network') || message.includes('fetch') || message.includes('offline') || message.includes('timeout')) {
    return false;
  }

  // Default to false for unknown errors to preserve pending code
  return false;
}
