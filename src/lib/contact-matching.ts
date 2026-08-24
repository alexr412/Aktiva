'use client';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase/client';
import { getReferralLink, shareOrCopyReferralLink } from './referral';

export interface RawContactItem {
  id: string;
  name?: string;
  emails: string[];
  phones: string[];
}

export interface MatchedActivaUser {
  uid: string;
  displayName: string | null;
  username: string | null;
  photoURL: string | null;
  friendState: 'self' | 'friend' | 'sent' | 'received' | 'none';
}

export interface ContactMatchResultItem {
  contactKey: string;
  contactName: string;
  emails: string[];
  phones: string[];
  matchedUser?: MatchedActivaUser;
}

/**
 * Feature Detection for Web Contact Picker API (`navigator.contacts.select`)
 */
export function hasContactPickerSupport(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return 'contacts' in navigator && 'select' in (navigator.contacts as any);
}

/**
 * Safe Contact Picker Invoker using `getProperties()` guard.
 * MUST be invoked directly from a user gesture (e.g. click event handler).
 */
export async function pickDeviceContacts(): Promise<RawContactItem[]> {
  if (!hasContactPickerSupport()) {
    throw new Error('CONTACT_PICKER_UNSUPPORTED');
  }

  const contactsManager = (navigator as any).contacts;
  let supportedProps: string[] = [];

  try {
    if (typeof contactsManager.getProperties === 'function') {
      supportedProps = await contactsManager.getProperties();
    } else {
      supportedProps = ['name', 'email', 'tel'];
    }
  } catch {
    supportedProps = ['name', 'email', 'tel'];
  }

  const wantedProps = ['name', 'email', 'tel'];
  const safeProps = wantedProps.filter((p) => supportedProps.includes(p));

  if (safeProps.length === 0) {
    throw new Error('NO_SUPPORTED_CONTACT_PROPERTIES');
  }

  try {
    const rawContacts = await contactsManager.select(safeProps, { multiple: true });
    if (!Array.isArray(rawContacts) || rawContacts.length === 0) {
      return [];
    }

    return rawContacts.map((c: any, index: number) => {
      const name = Array.isArray(c.name) && c.name.length > 0 ? c.name[0] : (typeof c.name === 'string' ? c.name : undefined);
      const emails: string[] = Array.isArray(c.email) ? c.email.filter(Boolean) : (c.email ? [c.email] : []);
      const phones: string[] = Array.isArray(c.tel) ? c.tel.filter(Boolean) : (c.tel ? [c.tel] : []);

      return {
        id: `c_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
        name: name ? String(name).trim() : undefined,
        emails: emails.map((e) => String(e).trim().toLowerCase()),
        phones: phones.map((p) => String(p).trim()),
      };
    });
  } catch (err: any) {
    // If user cancelled / aborted selection, return empty array without raising an exception modal
    if (
      err?.name === 'AbortError' ||
      err?.code === 20 ||
      (typeof err?.message === 'string' && err.message.toLowerCase().includes('cancel'))
    ) {
      return [];
    }
    throw err;
  }
}

/**
 * Invokes the protected `matchContacts` Cloud Function.
 */
export async function matchContactsWithServer(
  contacts: RawContactItem[]
): Promise<ContactMatchResultItem[]> {
  if (!contacts || contacts.length === 0) {
    return [];
  }

  // 1. Prepare payload with contactKey + email pairs (max 100)
  const payloadItems: Array<{ contactKey: string; email: string }> = [];
  const contactMap = new Map<string, RawContactItem>();

  for (const c of contacts) {
    contactMap.set(c.id, c);
    for (const email of c.emails) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail && payloadItems.length < 100) {
        payloadItems.push({
          contactKey: c.id,
          email: normalizedEmail,
        });
      }
    }
  }

  let matchedResultsMap = new Map<string, MatchedActivaUser>();

  if (payloadItems.length > 0) {
    try {
      const functions = getFunctions(app || undefined, 'us-central1');
      const matchContactsFn = httpsCallable<
        { contacts: Array<{ contactKey: string; email: string }> },
        { matches: Array<{ contactKey: string; user: MatchedActivaUser }> }
      >(functions, 'matchContacts');

      const response = await matchContactsFn({ contacts: payloadItems });
      const matches = response.data?.matches || [];

      for (const m of matches) {
        if (m && m.contactKey && m.user) {
          // Store first matched user per contact item (or deduplicate)
          matchedResultsMap.set(m.contactKey, m.user);
        }
      }
    } catch (err) {
      console.error('Error invoking matchContacts Cloud Function:', err);
    }
  }

  // 2. Build result array & deduplicate Activa users by UID
  const seenUserUids = new Set<string>();
  const results: ContactMatchResultItem[] = [];

  for (const c of contacts) {
    const matchedUser = matchedResultsMap.get(c.id);
    if (matchedUser) {
      if (seenUserUids.has(matchedUser.uid)) {
        // Skip duplicate Activa user matches
        continue;
      }
      seenUserUids.add(matchedUser.uid);
    }

    results.push({
      contactKey: c.id,
      contactName: c.name || (c.emails[0] ? c.emails[0].split('@')[0] : (c.phones[0] || 'Kontakt')),
      emails: c.emails,
      phones: c.phones,
      matchedUser,
    });
  }

  return results;
}

/**
 * Builds direct invite link URLs (WhatsApp, SMS, Email, Share).
 */
export function buildContactInviteUrls(referralCode: string, language: 'de' | 'en' = 'de') {
  const link = getReferralLink(referralCode);
  const text =
    language === 'de'
      ? `Hey! Komm zu Activa und entdecke Aktivitäten, Orte und neue Leute in deiner Nähe: ${link}`
      : `Hey! Join Activa and discover activities, places and new people near you: ${link}`;

  const emailSubject = language === 'de' ? 'Einladung zu Activa' : 'Invitation to Activa';

  return {
    link,
    text,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(text)}`,
    smsUrl: `sms:?body=${encodeURIComponent(text)}`,
    mailtoUrl: `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(text)}`,
  };
}
