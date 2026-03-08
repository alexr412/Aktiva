'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  deleteUser,
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
  
  // Initiierung der Email-Verifizierung unmittelbar nach Kontoerstellung
  await sendEmailVerification(userCredential.user);
  
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

export async function sendPasswordReset(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  await sendPasswordResetEmail(auth, email);
}

export async function deleteAccount(): Promise<void> {
  if (!auth?.currentUser) {
    throw new Error('No user is currently signed in to delete.');
  }
  try {
    await deleteUser(auth.currentUser);
  } catch (error: any) {
    // Handle cases where recent login is required
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('This is a sensitive operation and requires a recent login. Please sign in again and retry.');
    }
    throw error;
  }
}
