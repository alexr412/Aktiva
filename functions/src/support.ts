import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { enforceRateLimit } from './rate-limit';

export interface SubmitSupportTicketInput {
  category: 'bug' | 'feedback' | 'account' | 'safety' | 'other';
  subject: string;
  message: string;
  appVersion?: string;
  platform?: 'ios' | 'android' | 'web';
}

const ALLOWED_CATEGORIES = ['bug', 'feedback', 'account', 'safety', 'other'];
const ALLOWED_PLATFORMS = ['ios', 'android', 'web'];

export const submitSupportTicket = onCall({ enforceAppCheck: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentifizierung erforderlich.');
  }

  const userId = request.auth.uid;

  // Rate Limiting: Max 5 tickets per user per hour
  await enforceRateLimit(userId, 'submit_support_ticket', 5, 3600);

  const data = (request.data || {}) as Partial<SubmitSupportTicketInput>;
  const { category, subject, message, appVersion, platform } = data;

  if (!category || typeof category !== 'string' || !ALLOWED_CATEGORIES.includes(category)) {
    throw new HttpsError('invalid-argument', 'Ungültige Kategorie.');
  }

  const trimmedSubject = typeof subject === 'string' ? subject.trim() : '';
  if (trimmedSubject.length < 3 || trimmedSubject.length > 100) {
    throw new HttpsError('invalid-argument', 'Der Betreff muss zwischen 3 und 100 Zeichen lang sein.');
  }

  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (trimmedMessage.length < 10 || trimmedMessage.length > 2000) {
    throw new HttpsError('invalid-argument', 'Die Nachricht muss zwischen 10 und 2000 Zeichen lang sein.');
  }

  let cleanPlatform: 'ios' | 'android' | 'web' | undefined;
  if (platform && typeof platform === 'string' && ALLOWED_PLATFORMS.includes(platform)) {
    cleanPlatform = platform as 'ios' | 'android' | 'web';
  }

  let cleanAppVersion: string | undefined;
  if (appVersion && typeof appVersion === 'string') {
    cleanAppVersion = appVersion.trim().slice(0, 20);
  }

  const db = admin.firestore();
  const ticketRef = db.collection('support_tickets').doc();

  const ticketData: Record<string, any> = {
    userId,
    category,
    subject: trimmedSubject,
    message: trimmedMessage,
    status: 'open',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (cleanPlatform) ticketData.platform = cleanPlatform;
  if (cleanAppVersion) ticketData.appVersion = cleanAppVersion;

  await ticketRef.set(ticketData);

  return {
    success: true,
    message: 'Deine Supportanfrage wurde erfolgreich übermittelt.',
    ticketId: ticketRef.id,
  };
});
