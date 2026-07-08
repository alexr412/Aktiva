import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig, { isFirebaseConfigured } from './config';

// Initialize Firebase App for Server Components (running in Node.js on the server)
const app: FirebaseApp | null = isFirebaseConfigured() && !getApps().length
  ? initializeApp(firebaseConfig)
  : (getApps().length > 0 ? getApp() : null);

export const db = app ? getFirestore(app) : null;
