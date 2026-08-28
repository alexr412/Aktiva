import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || 'activa-444220';
    admin.initializeApp({ projectId });
  } catch (e) {
    console.warn('[Firebase Admin Server] Already initialized or running in limited env:', e);
  }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
export const adminAppCheck = admin.apps.length ? admin.appCheck() : null;
