'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import firebaseConfig, { isFirebaseConfigured } from './config';

// Initialize Firebase only if the config is available
const app: FirebaseApp | null = isFirebaseConfigured() && !getApps().length
  ? initializeApp(firebaseConfig)
  : (getApps().length > 0 ? getApp() : null);

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const functions = app ? getFunctions(app, 'us-central1') : null;
export const storage = app ? getStorage(app) : null;

// Connect to emulators if explicitly enabled via environment variable
if (app) {
  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' || 
                      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

  if (useEmulator) {
    // Only connect if they haven't been connected already to avoid errors during hot-reloads
    const alreadyConnectedKey = '_firebase_emulators_connected';
    const globalObj = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    
    if (!globalObj[alreadyConnectedKey]) {
      globalObj[alreadyConnectedKey] = true;
      
      if (auth) {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
        console.log('Connected Auth to emulator on port 9099');
      }
      if (db) {
        connectFirestoreEmulator(db, '127.0.0.1', 8080);
        console.log('Connected Firestore to emulator on port 8080');
      }
      if (functions) {
        connectFunctionsEmulator(functions, '127.0.0.1', 5001);
        console.log('Connected Functions to emulator on port 5001');
      }
      if (storage) {
        connectStorageEmulator(storage, '127.0.0.1', 9199);
        console.log('Connected Storage to emulator on port 9199');
      }
    }
  }
}

export { app };
