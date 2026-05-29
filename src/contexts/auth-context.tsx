'use client';

import { createContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Loader2, Ban } from 'lucide-react';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { updateUserLocation, updateUserProfile } from '@/lib/firebase/firestore';
import { requestAndGetFCMToken, onForegroundMessage } from '@/lib/firebase/messaging';
import { toast } from '@/hooks/use-toast';

export interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
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
      Falls du glaubst, dass dies ein Fehler ist, kontaktiere bitte unseren Support unter <strong className="text-white">support@aktvia.app</strong>.
    </p>
  </div>
);


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const publicRoutes = ['/login', '/signup', '/onboarding', '/terms', '/privacy'];
  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    setIsMounted(true);
    if (!auth || !db) {
        setLoading(false);
        return;
    }

    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      setLoading(true);
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (authUser) {
        setUser(authUser);
        
        const userRef = doc(db!, 'users', authUser.uid);
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

            // Skip local/optimistic snapshots to avoid unnecessary re-renders during updates
            if (docSnap.metadata.hasPendingWrites) return;

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
            
            setUserProfile(prev => {
              // Deep equality check for critical fields to avoid state flutter
              if (prev && 
                  prev.uid === profile.uid && 
                  prev.onboardingCompleted === profile.onboardingCompleted &&
                  JSON.stringify(prev.lastLocation) === JSON.stringify(profile.lastLocation) &&
                  prev.role === profile.role &&
                  prev.friends?.length === profile.friends?.length
              ) {
                return prev;
              }
              return profile;
            });
          } else {
            setUserProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("User document stream error:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  // Separate effect strictly for routing
  useEffect(() => {
    if (!isMounted || loading) return;

    const isInternalOnboarding = pathname === '/onboarding';
    const isLoginPage = pathname === '/login';

    if (user && !user.emailVerified && !isLoginPage) {
      import('@/lib/firebase/auth').then(({ signOut: authSignOut }) => {
        authSignOut().then(() => {
          router.replace('/login');
        });
      });
      return;
    }

    if (user && userProfile) {
        // Only redirect if email is verified AND onboarding is definitely not completed
        // AND we are not already on the onboarding page
        if (user.emailVerified && userProfile.onboardingCompleted === false && !isInternalOnboarding) {
            router.replace('/onboarding');
        }
    } else if (!user && !loading && !isPublicRoute && !isLoginPage) {
        router.replace('/login');
    }
  }, [user, userProfile?.onboardingCompleted, loading, isMounted, pathname, isPublicRoute, router]);

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

  const contextValue = useMemo(() => ({ user, userProfile, loading }), [user, userProfile, loading]);

  if (!auth && !loading) {
    return <NotConfigured />;
  }

  if (userProfile?.isBanned) {
    return <BannedScreen />;
  }

  // Hydration-Sicherheit: Auf dem Server rendern wir nichts Kritisches
  if (!isMounted) return null;

  return (
    <AuthContext.Provider value={contextValue}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-neutral-950">
          <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
