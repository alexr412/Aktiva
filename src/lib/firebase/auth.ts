'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from './client';
import { createUserProfileDocument } from './firestore';

export { auth };

export async function signUp(name: string, email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase has not been initialized.');

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  await updateProfile(userCredential.user, {
    displayName: name,
  });
  
  // Create a corresponding user document in Firestore
  await createUserProfileDocument(userCredential.user);
  
  return userCredential.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function signOut(): Promise<void> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  
  await firebaseSignOut(auth);
}
