'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig, { isFirebaseConfigured } from './config';

// Initialize Firebase only if the config is available
const app = isFirebaseConfigured() && !getApps().length
  ? initializeApp(firebaseConfig)
  : (getApps().length > 0 ? getApp() : null);

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
