'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
  checkActionCode,
  type ActionCodeSettings,
  type ActionCodeInfo,
  deleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
  getAdditionalUserInfo,
  type User,
} from 'firebase/auth';
import { auth, db } from './client';
import { doc, getDoc } from 'firebase/firestore';
import { createUserProfileDocument, getUserProfile, updateUserProfile } from './firestore';
import { deleteFCMToken } from './messaging';

export { auth };

export async function signUp(name: string, email: string, password: string, username?: string, birthday?: string, marketingConsent: boolean = false): Promise<User> {
  if (!auth) throw new Error('Firebase has not been initialized.');

  const domain = email.split('@')[1]?.toLowerCase();
  const disposableDomains = [
    'yopmail.com', 'mailinator.com', 'tempmail.com', 'guerrillamail.com', 'sharklasers.com',
    '10minutemail.com', 'trashmail.com', 'dispostable.com', 'getairmail.com', 'burnermail.io',
    'temp-mail.org', 'maildrop.cc', 'fakeinbox.com', 'generator.email', 'moakt.com',
    'pokemail.net', 'temporary-mail.net', 'duck.com', 'yopmail.fr', 'yopmail.net',
    'cool.fr.nf', 'jetable.org', 'tempmailo.com', 'temp-mail.io', 'mailnesia.com',
    'mailcatch.com', 'disposable.com', 'tempmailaddress.com', 'mintemail.com',
    'spambox.us', 'discard.email', 'anonymousemail.me', 'boun.cr'
  ];
  if (disposableDomains.includes(domain)) {
    throw new Error('Temporäre E-Mail-Dienste sind nicht erlaubt.');
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);

  await updateProfile(userCredential.user, {
    displayName: name,
  });
  
  // Initiierung der Email-Verifizierung unmittelbar nach Kontoerstellung
  await sendEmailVerification(userCredential.user);
  
  // Create a corresponding user document in Firestore
  await createUserProfileDocument(userCredential.user, { username, birthday }, marketingConsent);
  
  return userCredential.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function signOut(): Promise<void> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      // Best-effort delete client-side FCM token
      await deleteFCMToken();
    } catch (e) {
      console.warn("deleteFCMToken failed during signOut:", e);
    }
    try {
      // Clear Firestore token
      await updateUserProfile(currentUser.uid, { fcmToken: null });
    } catch (e) {
      console.warn("Failed to clear fcmToken in Firestore during signOut:", e);
    }
    
    // Clear client-side IndexedDB caches for this user to ensure data sanitization
    try {
      const { 
        clearCachedChatsForUser, 
        clearCachedMessagesForUser, 
        clearCachedActivitiesForUser, 
        clearCachedPlacesForUser 
      } = await import('@/lib/db/indexed-db');
      await clearCachedChatsForUser(currentUser.uid);
      await clearCachedMessagesForUser(currentUser.uid);
      await clearCachedActivitiesForUser(currentUser.uid);
      await clearCachedPlacesForUser(currentUser.uid);
    } catch (e) {
      console.warn("Failed to clear IndexedDB cache during signOut:", e);
    }
  }
  
  await firebaseSignOut(auth);
}

export async function sendPasswordReset(email: string, continueUrl?: string): Promise<void> {
  if (!auth) throw new Error('Firebase has not been initialized.');

  let redirectUrl = continueUrl;
  if (!redirectUrl && typeof window !== 'undefined') {
    redirectUrl = `${window.location.origin}/login`;
  } else if (!redirectUrl) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://activa-444220.web.app';
    redirectUrl = `${baseUrl}/login`;
  }

  const actionCodeSettings: ActionCodeSettings = {
    url: redirectUrl,
    handleCodeInApp: false,
  };

  await sendPasswordResetEmail(auth, email, actionCodeSettings);
}

export async function verifyResetCode(code: string): Promise<string> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  return await verifyPasswordResetCode(auth, code);
}

export async function confirmResetPassword(code: string, newPassword: string): Promise<void> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  await confirmPasswordReset(auth, code, newPassword);
}

export async function verifyEmailCode(code: string): Promise<void> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  const info: ActionCodeInfo = await checkActionCode(auth, code);
  if (info.operation !== 'VERIFY_EMAIL' && info.operation !== 'VERIFY_AND_CHANGE_EMAIL') {
    throw new Error('auth/invalid-action-code');
  }
  await applyActionCode(auth, code);
}

export async function checkEmailActionCode(code: string): Promise<ActionCodeInfo> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  return await checkActionCode(auth, code);
}

export async function recoverEmailCode(code: string): Promise<{ email: string }> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  const info: ActionCodeInfo = await checkActionCode(auth, code);
  
  if (info.operation !== 'RECOVER_EMAIL') {
    throw new Error('auth/invalid-action-code');
  }

  const restoredEmail = info.data.email;
  if (!restoredEmail) {
    throw new Error('auth/invalid-action-code');
  }

  await applyActionCode(auth, code);
  return { email: restoredEmail };
}

export interface PasswordValidationResult {
  hasLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

export function evaluatePassword(pass: string): PasswordValidationResult {
  const hasLength = pass.length >= 8 && pass.length <= 32;
  const hasUpper = /[A-Z]/.test(pass);
  const hasLower = /[a-z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);
  const hasSpecial = /[^A-Za-z0-9]/.test(pass);
  const isValid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
  return { hasLength, hasUpper, hasLower, hasNumber, hasSpecial, isValid };
}

export async function deleteAccount(password?: string): Promise<void> {
  if (!auth?.currentUser) {
    throw new Error('No user is currently signed in to delete.');
  }
  
  try {
    // Falls ein Passwort übergeben wurde (Email/Passwort Login), re-authentifizieren
    if (password && auth.currentUser.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
    }
    
    // Cascading deletion is handled asynchronously by the server-side onDelete Auth trigger (onUserDeleted)
    await deleteUser(auth.currentUser);
  } catch (error: any) {
    // Handle cases where recent login is required
    if (error.code === 'auth/requires-recent-login' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      throw new Error((error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') ? 'Falsches Passwort' : 'Bitte logge dich erneut ein, um dein Konto zu löschen.');
    }
    throw error;
  }
}
export async function handleSuccessfulSocialLogin(options: {
  user: User;
  router: any;
  language: 'de' | 'en';
  toast: any;
  setSocialLegalConsentPending: (pending: boolean) => void;
  setIsLoading?: (loading: boolean) => void;
  redirectTarget?: string | null;
}): Promise<void> {
  const { user, router, language, toast, setSocialLegalConsentPending, setIsLoading, redirectTarget } = options;

  if (typeof window !== 'undefined') {
    if ((window as any).__ACTIVA_LOGIN_PROCESSING__) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn("[LEGAL DEBUG] handleSuccessfulSocialLogin already processing/processed, skipping duplicate run.");
      }
      return;
    }
    (window as any).__ACTIVA_LOGIN_PROCESSING__ = true;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn("[LEGAL DEBUG] handleSuccessfulSocialLogin started", {
      uid: user.uid,
      email: user.email,
      timestamp: Date.now()
    });
  }

  // 1. Profil laden / anlegen
  if (!db) throw new Error('Firestore is not initialized.');
  const userDocRef = doc(db, 'users', user.uid);
  const userDocSnap = await getDoc(userDocRef);
  let profileData = userDocSnap.exists() ? userDocSnap.data() : null;

  if (!profileData) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn("[LEGAL DEBUG] Profile does not exist, creating profile", { uid: user.uid });
    }
    await createUserProfileDocument(user);
    const freshSnap = await getDoc(userDocRef);
    profileData = freshSnap.exists() ? freshSnap.data() : null;
  }

  const hasAcceptedLegal = !!profileData?.legalAcceptedAt;

  // 2. Legal Consent prüfen
  if (!hasAcceptedLegal) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn("[LEGAL DEBUG] Legal consent not accepted, opening dialog", { uid: user.uid });
    }
    setSocialLegalConsentPending(true);
    setIsLoading?.(false);
    if (typeof window !== 'undefined') {
      (window as any).__ACTIVA_LOGIN_PROCESSING__ = false;
    }
    return;
  }

  // 3. Email Verification Status prüfen
  await user.reload();
  
  if (!user.emailVerified) {
    let verificationEmailSent = false;
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions: clientFunctions } = await import('@/lib/firebase/client');
      if (clientFunctions) {
        const checkThrottle = httpsCallable(clientFunctions, 'checkAndRecordVerificationEmail');
        const res = await checkThrottle();
        const { allowed } = res.data as { allowed: boolean };
        if (allowed) {
          await sendEmailVerification(user);
          verificationEmailSent = true;
        }
      }
    } catch (verifError: any) {
      console.warn("Could not check/resend email verification link:", verifError);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
        source: "handleSuccessfulSocialLogin - email unverified",
        target: "signOut & redirect /login?verification=required",
        uid: user.uid,
        timestamp: Date.now()
      });
    }
    await signOut();

    router.replace('/login?verification=required');
    toast({
      variant: 'destructive',
      title: language === 'de' ? 'Verifizierung erforderlich' : 'Verification Required',
      description: language === 'de' 
        ? (verificationEmailSent
            ? "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Wir haben dir einen neuen Bestätigungs-Link an deine E-Mail-Adresse gesendet. Prüfe bitte auch deinen Spam-Ordner."
            : "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Ein neuer Bestätigungs-Link konnte erst vor kurzem gesendet werden, bitte prüfe dein Postfach (auch Spam-Ordner).")
        : (verificationEmailSent
            ? "Please verify your email address to log in. We have sent a new verification link to your email address. Please check your spam folder as well."
            : "Please verify your email address to log in. A new verification link could not be sent recently, please check your inbox."),
    });
    setIsLoading?.(false);
    if (typeof window !== 'undefined') {
      (window as any).__ACTIVA_LOGIN_PROCESSING__ = false;
    }
    return;
  }

  // 4. Onboarding prüfen und Router Navigation
  const onboardingCompleted = !!profileData?.onboardingCompleted;

  toast({
    title: language === 'de' ? 'Login erfolgreich' : 'Login successful',
    description: language === 'de' ? "Willkommen zurück!" : "Welcome back!",
  });

  if (process.env.NODE_ENV !== 'production') {
    console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
      source: "handleSuccessfulSocialLogin - flow completed",
      target: onboardingCompleted ? "/" : "/onboarding",
      uid: user.uid,
      onboardingCompleted,
      timestamp: Date.now()
    });
  }
  
  navigatePostLogin(router, onboardingCompleted);
}

export function navigatePostLogin(
  router: { replace: (url: string) => void },
  onboardingCompleted: boolean
) {
  if (onboardingCompleted) {
    router.replace('/');
  } else {
    router.replace('/onboarding');
  }
}

export async function signInWithApple(): Promise<{ user: User; isNewUser: boolean }> {
  if (!auth) throw new Error('Firebase has not been initialized.');
  const provider = new OAuthProvider('apple.com');
  const userCredential = await signInWithPopup(auth, provider);
  const additionalInfo = getAdditionalUserInfo(userCredential);
  const isNewUser = !!additionalInfo?.isNewUser;
  
  // Check if profile exists, if not create it
  const profile = await getUserProfile(userCredential.user.uid);
  if (!profile) {
    await createUserProfileDocument(userCredential.user);
  }
  
  return { user: userCredential.user, isNewUser };
}
