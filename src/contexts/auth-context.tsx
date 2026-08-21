'use client';

import { createContext, useState, useEffect, useMemo, useRef, useCallback, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { onAuthStateChanged, deleteUser, sendEmailVerification, signOut as firebaseSignOut, getRedirectResult, getAdditionalUserInfo } from 'firebase/auth';
import { handleSuccessfulSocialLogin } from '@/lib/firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Loader2, Ban } from 'lucide-react';
import { doc, getDoc, onSnapshot, updateDoc, deleteField, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { updateUserProfile } from '@/lib/firebase/firestore';
import { requestAndGetFCMToken, onForegroundMessage } from '@/lib/firebase/messaging';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { LegalConsentDialog } from '@/components/auth/LegalConsentDialog';
import { getMigratedItem, setMigratedItem, removeMigratedItem } from '@/lib/storage-migration';

import { isAccountActive, parseTimestampMillis } from '@/lib/types';

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  actualRole: 'superadmin' | 'admin' | 'moderator' | 'supporter' | 'user' | null;
  simulatedRole: 'superadmin' | 'admin' | 'moderator' | 'supporter' | 'user' | null;
  setSimulatedRole: (role: 'superadmin' | 'admin' | 'moderator' | 'supporter' | 'user') => void;
  isRefreshingProfile: boolean;
  error: any | null;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  socialLegalConsentPending: boolean;
  setSocialLegalConsentPending: (pending: boolean) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  actualRole: null,
  simulatedRole: null,
  setSimulatedRole: () => {},
  isRefreshingProfile: false,
  error: null,
  logout: async () => {},
  refreshUserProfile: async () => {},
  socialLegalConsentPending: false,
  setSocialLegalConsentPending: () => {},
});

const NotConfigured = () => (
    <div className="flex h-dvh w-full items-center justify-center p-6 bg-secondary">
        <Card className="max-w-md">
            <CardHeader className='text-center items-center'>
                <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
                <CardTitle className="">Firebase Not Configured</CardTitle>
            </CardHeader>
            <CardContent className='text-center'>
                <p className='text-muted-foreground'>
                    Your Firebase environment variables are not set. Please add your Firebase project configuration to the <code className='p-1 bg-muted rounded-sm text-sm'>.env</code> file to enable authentication and connect to the database.
                </p>
            </CardContent>
        </Card>
    </div>
);

const AccountStatusScreen = ({ profile }: { profile: UserProfile | null }) => {
  const isBanned = profile?.isBanned || profile?.accountStatus === 'banned';
  const reason = isBanned 
    ? (profile?.banReasonPublic || 'Verstoß gegen die Community-Richtlinien.') 
    : (profile?.suspensionReasonPublic || 'Vorübergehende Kontosperrung.');
  
  let suspendedUntilFormatted: string | null = null;
  if (!isBanned && profile?.suspendedUntil) {
    const millis = parseTimestampMillis(profile.suspendedUntil);
    if (millis) {
      suspendedUntilFormatted = new Date(millis).toLocaleString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }
  }

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center p-6 bg-slate-900 text-white text-center">
      <div className="bg-red-500 p-6 rounded-full mb-8 shadow-2xl shadow-red-500/20 animate-pulse">
        <Ban className="h-16 w-16" />
      </div>
      <h1 className="text-2xl font-bold mb-3">{isBanned ? 'Account Gesperrt (Banned)' : 'Account Suspendiert'}</h1>
      <div className="max-w-md text-slate-400 font-medium leading-relaxed space-y-4">
        <p>
          Dein Account wurde {isBanned ? 'permanent gesperrt' : 'vorübergehend suspendiert'}.
        </p>
        <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 text-left text-sm text-slate-200">
          <p className="font-semibold text-red-400 mb-1">Grund:</p>
          <p>{reason}</p>
          {suspendedUntilFormatted && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <p className="font-semibold text-amber-400">Suspendiert bis:</p>
              <p>{suspendedUntilFormatted}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Falls du glaubst, dass dies ein Fehler ist, kontaktiere bitte unseren Support unter{' '}
          <strong className="text-slate-300">support@aktiva.app</strong>.
        </p>
      </div>
    </div>
  );
};

let isRedirectProcessing = false;
let hasProcessedPostLogin = false;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbProfile, setDbProfile] = useState<UserProfile | null>(null);
  const [simulatedRole, setSimulatedRoleState] = useState<'superadmin' | 'admin' | 'moderator' | 'supporter' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [error, setError] = useState<any | null>(null);
  const initialAuthResolutionRef = useRef(false);
  const language = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  const logout = useCallback(async () => {
    if (user) {
      try {
        const { unregisterDevicePush } = await import('@/lib/firebase/messaging');
        await unregisterDevicePush(user.uid).catch(() => {});
      } catch (e) {}
    }
    if (auth) {
      await firebaseSignOut(auth);
    }
  }, [user]);

  const refreshUserProfile = useCallback(async () => {
    if (!user || !db) return;
    setIsRefreshingProfile(true);
    try {
      const docRef = doc(db, 'users', user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setDbProfile(snap.data() as UserProfile);
      }
    } catch (e) {
      setError(e);
    } finally {
      setIsRefreshingProfile(false);
    }
  }, [user]);

  const [socialLegalConsentPending, setSocialLegalConsentPendingState] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const val = getMigratedItem('activa:socialLegalConsentPending', 'aktiva:socialLegalConsentPending', 'session') === 'true';
      setSocialLegalConsentPendingState(val);
    }
  }, []);

  const setSocialLegalConsentPending = (pending: boolean) => {
    setSocialLegalConsentPendingState(pending);
    if (typeof window !== 'undefined') {
      if (pending) {
        setMigratedItem("activa:socialLegalConsentPending", "aktiva:socialLegalConsentPending", "true", "session");
      } else {
        removeMigratedItem("activa:socialLegalConsentPending", "aktiva:socialLegalConsentPending", "session");
      }
    }
  };

  useEffect(() => {
    if (user && dbProfile && !dbProfile.legalAcceptedAt && !loading) {
      const providers = user.providerData.map(p => p.providerId);
      const isSocial = providers.includes('google.com') || providers.includes('apple.com');
      if (isSocial) {
        setSocialLegalConsentPending(true);
      }
    }
  }, [user, dbProfile, loading]);

  useEffect(() => {
    if (user) {
      const providers = user.providerData.map(p => p.providerId);
      const isSocial = providers.includes('google.com') || providers.includes('apple.com');
      if (!isSocial && socialLegalConsentPending) {
        setSocialLegalConsentPending(false);
      } else if (dbProfile?.legalAcceptedAt) {
        setSocialLegalConsentPending(false);
      }
    }
  }, [user, dbProfile, socialLegalConsentPending]);

  // Expose __LEGAL_DEBUG__ on window in dev mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as any).__LEGAL_DEBUG__ = {
        getState: () => ({
          socialLegalConsentPending,
          sessionStoragePending: getMigratedItem("activa:socialLegalConsentPending", "aktiva:socialLegalConsentPending", "session"),
          uid: auth?.currentUser?.uid ?? null,
          email: auth?.currentUser?.email ?? null,
          emailVerified: auth?.currentUser?.emailVerified ?? null,
          dbProfile,
          pathname,
        }),
        forcePending: () => setSocialLegalConsentPending(true),
        clearPending: () => setSocialLegalConsentPending(false),
      };
    }
  }, [socialLegalConsentPending, dbProfile, pathname]);

  const handleAcceptSocialConsent = async () => {
    const currentUser = auth?.currentUser;
    
    if (!currentUser) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: language === 'de' ? 'Kein Benutzer angemeldet.' : 'No user logged in.',
      });
      return;
    }

    setLoading(true);
    try {
      const { serverTimestamp } = await import('firebase/firestore');
      const userDocRef = doc(db!, 'users', currentUser.uid);
      
      await setDoc(userDocRef, {
        legalAcceptedAt: serverTimestamp(),
        termsAcceptedAt: serverTimestamp(),
        useTermsAcceptedAt: serverTimestamp(),
        privacyAcceptedAt: serverTimestamp(),
        cookiesAcceptedAt: serverTimestamp(),
        legalVersion: '1.0',
        legalLocale: language
      }, { merge: true });

      setSocialLegalConsentPending(false);

      await currentUser.reload();
      try {
        await currentUser.getIdToken(true);
      } catch (tokenErr) {
        console.warn('Failed to refresh token after reload:', tokenErr);
      }
      const freshUser = auth?.currentUser || currentUser;

      if (freshUser.emailVerified) {
        toast({
          title: language === 'de' ? 'Registrierung erfolgreich' : 'Registration successful',
          description: language === 'de' ? 'Willkommen bei Aktiva!' : 'Welcome to Aktiva!',
        });
        
        let onboardingCompleted = false;
        try {
          const { getDoc } = await import('firebase/firestore');
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            onboardingCompleted = !!docSnap.data().onboardingCompleted;
          }
        } catch (e) {
          console.warn("Could not check onboarding status:", e);
        }

        if (onboardingCompleted) {
          router.replace('/');
        } else {
          router.replace('/onboarding');
        }
      } else {
        const { httpsCallable } = await import('firebase/functions');
        const { functions: clientFunctions } = await import('@/lib/firebase/client');
        if (clientFunctions) {
          const requireVerif = httpsCallable(clientFunctions, 'requireSocialEmailVerification');
          await requireVerif();
        }

        try {
          await sendEmailVerification(freshUser);
        } catch (verifError: any) {
          console.warn("Could not send verification email:", verifError);
        }

        router.replace('/login?verification=required');
        const { signOut: authSignOut } = await import('@/lib/firebase/auth');
        await authSignOut();
        toast({
          title: language === 'de' ? 'Verifizierung erforderlich' : 'Verification Required',
          description: language === 'de'
            ? "Bitte bestätige deine E-Mail-Adresse, um dich einzuloggen. Wir haben dir einen Bestätigungs-Link an deine E-Mail-Adresse gesendet. Prüfe bitte auch deinen Spam-Ordner."
            : "Please verify your email address to log in. We have sent a verification link to your email address. Please check your spam folder as well.",
        });
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: error.message || (language === 'de' ? 'Es gab ein Problem bei der Registrierung.' : 'Something went wrong during registration.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineSocialConsent = async () => {
    const currentUser = auth?.currentUser;
    
    setLoading(true);
    try {
      if (currentUser) {
        try {
          await deleteUser(currentUser);
        } catch (e) {
          console.warn("Could not delete user in decline flow:", e);
        }
      }
      
      const { signOut: authSignOut } = await import('@/lib/firebase/auth');
      await authSignOut();

      toast({
        variant: "destructive",
        title: language === 'de' ? 'Registrierung abgebrochen' : 'Registration Cancelled',
        description: language === 'de'
          ? 'Für die Registrierung musst du die rechtlichen Hinweise akzeptieren.'
          : 'You must accept the legal agreements to register.',
      });
    } catch (error: any) {
      const { signOut: authSignOut } = await import('@/lib/firebase/auth');
      await authSignOut();
    } finally {
      setSocialLegalConsentPending(false);
      setLoading(false);
      router.replace('/login');
    }
  };

  // Load simulated role from localStorage on mount (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const stored = localStorage.getItem('simulated_role');
      if (['superadmin', 'admin', 'moderator', 'supporter', 'user'].includes(stored || '')) {
        setSimulatedRoleState(stored as any);
      }
    }
  }, []);

  const setSimulatedRole = (role: 'superadmin' | 'admin' | 'moderator' | 'supporter' | 'user') => {
    if (process.env.NODE_ENV !== 'development') return;
    setSimulatedRoleState(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('simulated_role', role);
    }
  };

  const actualRole = dbProfile?.role || null;

  const userProfile = useMemo(() => {
    if (!dbProfile) return null;
    
    let activeRole = dbProfile.role || 'user';
    const isDev = process.env.NODE_ENV === 'development';
    const isEligibleForSimulation = isDev && (dbProfile.role === 'admin' || dbProfile.role === 'supporter');
    if (isEligibleForSimulation && simulatedRole) {
      activeRole = simulatedRole;
    }
    
    return {
      ...dbProfile,
      role: activeRole,
    };
  }, [dbProfile, simulatedRole]);

  const publicRoutes = ['/login', '/signup', '/terms', '/privacy', '/imprint', '/licenses', '/accessibility', '/cancellation'];
  const isPublicInviteRoute = pathname ? (
    /^\/activities\/[^/]+\/invite$/.test(pathname) ||
    /^\/activity\/[^/]+\/invite$/.test(pathname)
  ) : false;
  const isPublicRoute = publicRoutes.includes(pathname) || isPublicInviteRoute;
  const legalPages = ['/terms', '/privacy', '/imprint', '/licenses', '/accessibility', '/cancellation'];
  const isLegalPage = legalPages.includes(pathname);

  useEffect(() => {
    setIsMounted(true);
    if (!auth || !db) {
      setLoading(false);
      initialAuthResolutionRef.current = true;
      return;
    }

    if (!isRedirectProcessing) {
      isRedirectProcessing = true;
      getRedirectResult(auth)
        .then(async (result) => {
          if (result) {
            hasProcessedPostLogin = true;
            await handleSuccessfulSocialLogin({
              user: result.user,
              router,
              language,
              toast,
              setSocialLegalConsentPending,
            });
          }
        })
        .catch((error) => {
          toast({
            variant: 'destructive',
            title: language === 'de' ? 'Login fehlgeschlagen' : 'Login failed',
            description: language === 'de' 
              ? 'Google-Login konnte nicht abgeschlossen werden.' 
              : 'Google login could not be completed.',
          });
        });
    }

    let unsubscribeDoc: (() => void) | undefined;

    const setupUserDocListener = (currentAuthUser: User) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
      const userRef = doc(db!, 'users', currentAuthUser.uid);
      
      unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.isAdmin !== undefined && data.role === undefined) {
            const targetRole = data.isAdmin === true ? 'admin' : 'user';
            updateDoc(userRef, {
              isAdmin: deleteField(),
              role: targetRole
            }).catch(err => console.error("Lazy migration failed:", err));
          }

          const profile: UserProfile = {
            uid: docSnap.id,
            ...data,
            role: data.role || 'user',
            isBanned: !!data.isBanned,
            friends: data.friends || [],
            friendRequestsSent: data.friendRequestsSent || [],
            friendRequestsReceived: data.friendRequestsReceived || []
          } as UserProfile;
          
          setDbProfile(prev => {
            if (prev) {
              try {
                if (JSON.stringify(prev) === JSON.stringify(profile)) {
                  return prev;
                }
              } catch (e) {
                console.error("Profile comparison failed, forcing update:", e);
              }
            }
            return profile;
          });
        } else {
          setDbProfile(null);
        }
        setLoading(false);
      }, (error) => {
        console.error("User document stream error:", error);
        setLoading(false);
      });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (authUser) {
        authUser.reload().then(async () => {
          try {
            await authUser.getIdToken(true);
          } catch (tokenErr) {
            console.warn('Failed to refresh token after authUser reload:', tokenErr);
          }
          const freshUser = auth?.currentUser || authUser;
          
          setUser(freshUser);
          setupUserDocListener(freshUser);

          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          const cleanPath = currentPath.replace(/\/+$/, '') || '/';
          const isLoginPage = cleanPath === '/login';
          const isSignupPage = cleanPath === '/signup';
          const isAuthPage = isLoginPage || isSignupPage;

          if (isAuthPage && !hasProcessedPostLogin) {
            hasProcessedPostLogin = true;
            await handleSuccessfulSocialLogin({
              user: freshUser,
              router,
              language,
              toast,
              setSocialLegalConsentPending,
            });
          }
        }).catch(async (err) => {
          setUser(authUser);
          setupUserDocListener(authUser);

          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
          const cleanPath = currentPath.replace(/\/+$/, '') || '/';
          const isLoginPage = cleanPath === '/login';
          const isSignupPage = cleanPath === '/signup';
          const isAuthPage = isLoginPage || isSignupPage;

          if (isAuthPage && !hasProcessedPostLogin) {
            hasProcessedPostLogin = true;
            await handleSuccessfulSocialLogin({
              user: authUser,
              router,
              language,
              toast,
              setSocialLegalConsentPending,
            });
          }
        }).finally(() => {
          initialAuthResolutionRef.current = true;
        });
      } else {
        setUser(null);
        setDbProfile(null);
        setSocialLegalConsentPending(false);
        setLoading(false);
        initialAuthResolutionRef.current = true;
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  // Synchronize verification flag when email becomes verified
  useEffect(() => {
    const isLoginPage = pathname === '/login';
    const isSignupPage = pathname === '/signup';

    if (user && user.emailVerified && dbProfile?.emailVerificationRequired === true && !isLoginPage && !isSignupPage) {
      const runVerificationSync = async () => {
        try {
          const { httpsCallable } = await import('firebase/functions');
          const { functions: clientFunctions } = await import('@/lib/firebase/client');
          if (clientFunctions) {
            const verifyFn = httpsCallable(clientFunctions, 'verifyEmailStatus');
            await verifyFn();
          }
        } catch (err) {
          console.error("Failed to sync email verification status:", err);
        }
      };
      runVerificationSync();
    }
  }, [user?.emailVerified, dbProfile?.emailVerificationRequired, user?.uid, pathname]);

  // Route guard
  useEffect(() => {
    if (!isMounted || loading) {
      return;
    }

    if (socialLegalConsentPending) {
      return;
    }

    const isInternalOnboarding = pathname === '/onboarding';
    const isLoginPage = pathname === '/login';
    const isSignupPage = pathname === '/signup';

    if (user && !user.emailVerified && !isLoginPage && !isSignupPage && !isPublicRoute) {
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Verifizierung erforderlich' : 'Verification Required',
        description: language === 'de'
          ? 'Bitte verifiziere deine E-Mail-Adresse, um Activa zu nutzen.'
          : 'Please verify your email address to use Activa.',
      });
      router.replace('/login?verification=required');
      import('@/lib/firebase/auth').then(({ signOut: authSignOut }) => {
        authSignOut();
      });
      return;
    }

    if (user && userProfile) {
      if (user.emailVerified && dbProfile?.emailVerificationRequired !== true && userProfile.onboardingCompleted === false && !isInternalOnboarding && !isLoginPage && !isSignupPage && !isLegalPage && !isPublicRoute) {
        router.replace('/onboarding');
      }
    } else if (!user && !loading && !isPublicRoute && !isLoginPage && !isSignupPage) {
      const isDev = process.env.NODE_ENV === 'development';
      const isTestingBypass = isDev && typeof window !== 'undefined' && (
        window.location.search.includes('bypass_auth=true') ||
        localStorage.getItem('bypass_auth') === 'true'
      );
      if (isTestingBypass) {
        return;
      }
      router.replace('/login');
    }
  }, [user, userProfile?.onboardingCompleted, dbProfile?.emailVerificationRequired, loading, isMounted, pathname, isPublicRoute, router, socialLegalConsentPending]);

  // FCM Token Auto-Refresh
  useEffect(() => {
    if (!user) return;
    import('@/lib/firebase/messaging').then(({ refreshDevicePushRegistration }) => {
      refreshDevicePushRegistration(user.uid).catch((err) => {
        console.warn('Auto refresh push token failed:', err);
      });
    });
  }, [user?.uid]);

  const contextValue = useMemo(() => ({ 
    user, 
    userProfile, 
    loading, 
    actualRole, 
    simulatedRole: simulatedRole || (dbProfile?.role || 'user'), 
    setSimulatedRole,
    isRefreshingProfile,
    error,
    logout,
    refreshUserProfile,
    socialLegalConsentPending,
    setSocialLegalConsentPending
  }), [user, userProfile, loading, actualRole, simulatedRole, dbProfile?.role, isRefreshingProfile, error, logout, refreshUserProfile, socialLegalConsentPending]);

  if (!auth && !loading) {
    return <NotConfigured />;
  }

  if (userProfile && !isAccountActive(userProfile)) {
    return <AccountStatusScreen profile={userProfile} />;
  }

  if (!isMounted) return null;

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {socialLegalConsentPending && (
        <LegalConsentDialog
          open={true}
          onOpenChange={() => {}}
          onAccept={handleAcceptSocialConsent}
          onDecline={handleDeclineSocialConsent}
          language={language}
        />
      )}
    </AuthContext.Provider>
  );
};

