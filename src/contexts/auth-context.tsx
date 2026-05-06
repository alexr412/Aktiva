'use client';

import { createContext, useState, useEffect, type ReactNode } from 'react';
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

  const publicRoutes = ['/', '/login', '/signup', '/onboarding', '/terms', '/privacy'];
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
        
        const userRef = doc(db, 'users', authUser.uid);
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
              role: data.role || 'user', // Fallback-Logik
              isBanned: !!data.isBanned
            } as UserProfile;
            
            setUserProfile(profile);

            if (authUser.emailVerified && !profile.onboardingCompleted && pathname !== '/onboarding') {
              router.replace('/onboarding');
            }
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
        
        if (!isPublicRoute) {
            router.replace('/login');
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [router, pathname, isPublicRoute]);

  // FCM Integration
  useEffect(() => {
    if (!user || !userProfile?.notificationSettings?.localHighlights) return;

    const setupFCM = async () => {
      const token = await requestAndGetFCMToken();
      if (token && token !== userProfile.fcmToken) {
        await updateUserProfile(user.uid, { fcmToken: token });
      }
    };

    setupFCM();

    const unsubscribeFCM = onForegroundMessage((payload) => {
      toast({
        title: payload.notification?.title || "Benachrichtigung",
        description: payload.notification?.body,
      });
    });

    return () => unsubscribeFCM?.();
  }, [user, userProfile?.notificationSettings?.localHighlights, userProfile?.fcmToken]);

  // Proximity Radar
  useEffect(() => {
    if (!user || !userProfile?.proximitySettings?.enabled) return;

    const updateLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            updateUserLocation(user.uid, latitude, longitude);
          },
          (error) => console.warn("Location update failed:", error),
          { enableHighAccuracy: false, timeout: 15000 }
        );
      }
    };

    updateLocation();
    const interval = setInterval(updateLocation, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, userProfile?.proximitySettings?.enabled]);

  if (!auth && !loading) {
    return <NotConfigured />;
  }

  if (userProfile?.isBanned) {
    return <BannedScreen />;
  }

  // Hydration-Sicherheit: Auf dem Server rendern wir nichts Kritisches
  if (!isMounted) return null;

  const showSpinner = loading && !isPublicRoute;

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {showSpinner ? (
        <div className="flex items-center justify-center min-h-screen bg-white dark:bg-neutral-950">
          <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
