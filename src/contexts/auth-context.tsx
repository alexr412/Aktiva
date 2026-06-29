'use client';

import { createContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { onAuthStateChanged, deleteUser, sendEmailVerification, signOut as firebaseSignOut } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Loader2, Ban } from 'lucide-react';
import { doc, onSnapshot, updateDoc, deleteField, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { updateUserLocation, updateUserProfile } from '@/lib/firebase/firestore';
import { requestAndGetFCMToken, onForegroundMessage } from '@/lib/firebase/messaging';
import { toast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { LegalConsentDialog } from '@/components/auth/LegalConsentDialog';

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  actualRole: 'admin' | 'supporter' | 'user' | null;
  simulatedRole: 'admin' | 'supporter' | 'user' | null;
  setSimulatedRole: (role: 'admin' | 'supporter' | 'user') => void;
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
  socialLegalConsentPending: false,
  setSocialLegalConsentPending: () => {},
});

const NotConfigured = () => (
    <div className="flex h-screen w-full items-center justify-center p-6 bg-secondary">
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

const BannedScreen = () => (
  <div className="flex h-screen w-full flex-col items-center justify-center p-6 bg-slate-900 text-white text-center">
    <div className="bg-red-500 p-6 rounded-full mb-8 shadow-2xl shadow-red-500/20 animate-pulse">
      <Ban className="h-16 w-16" />
    </div>
    <h1 className="">Account Suspended</h1>
    <p className="max-w-md text-slate-400 font-medium leading-relaxed">
      Dein Account wurde aufgrund von wiederholten Verstößen gegen unsere Community-Richtlinien permanent gesperrt. 
      <br /><br />
      Falls du glaubst, dass dies ein Fehler ist, kontaktiere bitte unseren Support unter <strong className="text-white">support@aktiva.app</strong>.
    </p>
  </div>
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbProfile, setDbProfile] = useState<UserProfile | null>(null);
  const [simulatedRole, setSimulatedRoleState] = useState<'admin' | 'supporter' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const language = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  const [socialLegalConsentPending, setSocialLegalConsentPendingState] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const val = sessionStorage.getItem('aktiva:socialLegalConsentPending') === 'true';
      
      setSocialLegalConsentPendingState(val);
    }
  }, []);

  const setSocialLegalConsentPending = (pending: boolean) => {
    if (typeof window !== 'undefined') {
      
    }
    setSocialLegalConsentPendingState(pending);
    if (typeof window !== 'undefined') {
      if (pending) {
        sessionStorage.setItem("aktiva:socialLegalConsentPending", "true");
      } else {
        sessionStorage.removeItem("aktiva:socialLegalConsentPending");
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      
    }
  }, [socialLegalConsentPending, user, dbProfile, loading, pathname]);

  // Expose __LEGAL_DEBUG__ on window in dev mode
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as any).__LEGAL_DEBUG__ = {
        getState: () => ({
          socialLegalConsentPending,
          sessionStoragePending: sessionStorage.getItem("aktiva:socialLegalConsentPending"),
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
      
      console.warn("[LEGAL DEBUG] Legal consent write detected", {
        source: "handleAcceptSocialConsent",
        uid: currentUser.uid,
        isExplicitAcceptFlow: true,
        data: {
          legalAcceptedAt: 'serverTimestamp()',
          termsAcceptedAt: 'serverTimestamp()',
          useTermsAcceptedAt: 'serverTimestamp()',
          privacyAcceptedAt: 'serverTimestamp()',
          cookiesAcceptedAt: 'serverTimestamp()',
          legalVersion: '1.0',
          legalLocale: language
        },
        timestamp: Date.now()
      });
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
      console.error("[LEGAL DEBUG] handleAcceptSocialConsent failed", {
        error: error.message || error,
        timestamp: Date.now()
      });
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
        // Cascading deletion of user profile and data is handled asynchronously by the server-side onDelete Auth trigger (onUserDeleted)
        try {
          console.warn("[LEGAL DEBUG] deleting user in decline flow", { uid: currentUser.uid, timestamp: Date.now() });
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
      console.error("[LEGAL DEBUG] handleDeclineSocialConsent failed", {
        error: error.message || error,
        timestamp: Date.now()
      });
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
      if (stored === 'admin' || stored === 'supporter' || stored === 'user') {
        setSimulatedRoleState(stored as 'admin' | 'supporter' | 'user');
      }
    }
  }, []);

  const setSimulatedRole = (role: 'admin' | 'supporter' | 'user') => {
    if (process.env.NODE_ENV !== 'development') return;
    setSimulatedRoleState(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('simulated_role', role);
    }
  };

  const actualRole = dbProfile?.role || null;

  const userProfile = useMemo(() => {
    if (!dbProfile) return null;
    
    // Determine the active role
    let activeRole = dbProfile.role || 'user';
    
    // Only allow simulation in development mode if the real role in database is admin or supporter
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
  const isPublicRoute = publicRoutes.includes(pathname);

  const legalPages = ['/terms', '/privacy', '/imprint', '/licenses', '/accessibility', '/cancellation'];
  const isLegalPage = legalPages.includes(pathname);

  useEffect(() => {
    setIsMounted(true);
    if (!auth || !db) {
        setLoading(false);
        return;
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
          
          // Lazy migration check: if they have 'isAdmin' but not 'role'
          if (data.isAdmin !== undefined && data.role === undefined) {
            const targetRole = data.isAdmin === true ? 'admin' : 'user';
            
            updateDoc(userRef, {
              isAdmin: deleteField(),
              role: targetRole
            }).catch(err => console.error("Lazy migration failed:", err));
          }

          // Explizite Zuweisung wichtiger Felder zur Vermeidung von State-Verlust
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
            // Deep equality check using JSON stringify to avoid state flutter
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
          console.warn("[LEGAL DEBUG] setupUserDocListener - user doc does not exist", { uid: currentAuthUser.uid, timestamp: Date.now() });
          setDbProfile(null);
        }
        setLoading(false);
      }, (error) => {
        console.error("[LEGAL DEBUG] User document stream error:", {
          uid: currentAuthUser.uid,
          error: error.message || error,
          timestamp: Date.now()
        });
        setLoading(false);
      });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      

      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const cleanPath = currentPath.replace(/\/+$/, '') || '/';

      const isPublicAuthRoute = cleanPath === '/login' || cleanPath === '/signup' || cleanPath === '/onboarding';
      if (!isPublicAuthRoute) {
        setLoading(true);
      }
      if (unsubscribeDoc) {
        
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (authUser) {
        
        authUser.reload().then(() => {
          const freshUser = auth?.currentUser || authUser;
          
          setUser(freshUser);
          setupUserDocListener(freshUser);
        }).catch((err) => {
          console.warn("[LEGAL DEBUG] onAuthStateChanged - failed to reload user:", err);
          setUser(authUser);
          setupUserDocListener(authUser);
        });
      } else {
        
        setUser(null);
        setDbProfile(null);
        setSocialLegalConsentPending(false);
        setLoading(false);
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      
    }
  }, [pathname]);

  // Separate effect strictly for routing
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
      console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
        source: "route guard - email unverified",
        target: "/login",
        pathname,
        socialLegalConsentPending,
        sessionStoragePending: sessionStorage.getItem("aktiva:socialLegalConsentPending"),
        uid: auth?.currentUser?.uid ?? null,
        timestamp: Date.now()
      });
      
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Verifizierung erforderlich' : 'Verification Required',
        description: language === 'de'
          ? 'Bitte verifiziere deine E-Mail-Adresse, um Aktiva zu nutzen.'
          : 'Please verify your email address to use Aktiva.',
      });
      router.replace('/login?verification=required');
      import('@/lib/firebase/auth').then(({ signOut: authSignOut }) => {
        authSignOut();
      });
      return;
    }

    if (user && userProfile) {
        // Only redirect if email is verified AND onboarding is definitely not completed
        // AND we are not already on the onboarding page
        // AND we are not on the login/signup page (to prevent race conditions during OAuth check)
        // AND the user does not require email verification
        if (user.emailVerified && dbProfile?.emailVerificationRequired !== true && userProfile.onboardingCompleted === false && !isInternalOnboarding && !isLoginPage && !isSignupPage && !isLegalPage) {
            console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
              source: "route guard - onboarding not completed",
              target: "/onboarding",
              pathname,
              socialLegalConsentPending,
              sessionStoragePending: sessionStorage.getItem("aktiva:socialLegalConsentPending"),
              uid: auth?.currentUser?.uid ?? null,
              timestamp: Date.now()
            });
            
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
        console.warn("[LEGAL DEBUG] Redirect/signout/delete triggered", {
          source: "route guard - unauthenticated user",
          target: "/login",
          pathname,
          socialLegalConsentPending,
          sessionStoragePending: sessionStorage.getItem("aktiva:socialLegalConsentPending"),
          uid: auth?.currentUser?.uid ?? null,
          timestamp: Date.now()
        });
        
        router.replace('/login');
    }
  }, [user, userProfile?.onboardingCompleted, dbProfile?.emailVerificationRequired, loading, isMounted, pathname, isPublicRoute, router, socialLegalConsentPending]);

  // FCM Integration - Optimized to prevent loops
  useEffect(() => {
    if (!user || !userProfile?.notificationSettings?.localHighlights) return;

    let isSubscribed = true;

    const setupFCM = async () => {
      try {
        const token = await requestAndGetFCMToken();
        if (isSubscribed && token && token !== userProfile.fcmToken) {
          await updateUserProfile(user.uid, { fcmToken: token });
        }
      } catch (err) {
        console.error("FCM Setup failed:", err);
      }
    };

    setupFCM();

    const unsubscribeFCM = onForegroundMessage((payload) => {
      if (!isSubscribed) return;
      toast({
        title: payload.notification?.title || "Benachrichtigung",
        description: payload.notification?.body,
      });
    });

    return () => {
      isSubscribed = false;
      if (unsubscribeFCM) unsubscribeFCM();
    };
  }, [user?.uid, userProfile?.notificationSettings?.localHighlights, userProfile?.fcmToken]);

  // Proximity Radar
  useEffect(() => {
    if (!user || !userProfile?.proximitySettings?.enabled) return;

    const updateLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Try to get city name for friends list using our reliable helper
            let cityName = undefined;
            try {
              const { reverseGeocode: geoapifyReverse } = await import('@/lib/geoapify');
              const place = await geoapifyReverse(latitude, longitude);
              if (place) {
                const props = (place as any)._rawProperties || {};
                cityName = props.city || props.town || props.village || props.suburb || props.municipality || place.name;
              }
            } catch (e) {}

            updateUserLocation(user.uid, latitude, longitude, cityName);
          },
          (error) => console.warn("Location update failed:", error),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    };

    updateLocation();
    const interval = setInterval(updateLocation, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, userProfile?.proximitySettings?.enabled]);

  const contextValue = useMemo(() => ({ 
    user, 
    userProfile, 
    loading, 
    actualRole, 
    simulatedRole: simulatedRole || (dbProfile?.role || 'user'), 
    setSimulatedRole,
    socialLegalConsentPending,
    setSocialLegalConsentPending
  }), [user, userProfile, loading, actualRole, simulatedRole, dbProfile?.role, socialLegalConsentPending]);

  if (!auth && !loading) {
    return <NotConfigured />;
  }

  if (userProfile?.isBanned) {
    return <BannedScreen />;
  }

  // Hydration-Sicherheit: Auf dem Server rendern wir nichts Kritisches
  if (!isMounted) return null;

  const isSyncingVerification = !!(user && user.emailVerified && dbProfile?.emailVerificationRequired === true);

  return (
    <AuthContext.Provider value={contextValue}>
      {(loading || isSyncingVerification) && !socialLegalConsentPending ? (
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-neutral-950">
          <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
        </div>
      ) : (
        <>
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
        </>
      )}
    </AuthContext.Provider>
  );
};
