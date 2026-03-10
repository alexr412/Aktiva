'use client';

import { createContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { updateUserLocation } from '@/lib/firebase/firestore';

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
                <CardTitle className="text-destructive">Firebase Not Configured</CardTitle>
            </CardHeader>
            <CardContent className='text-center'>
                <p className='text-muted-foreground'>
                    Your Firebase environment variables are not set. Please add your Firebase project configuration to the <code className='p-1 bg-muted rounded-sm text-sm'>.env</code> file to enable authentication and connect to the database.
                </p>
            </CardContent>
        </Card>
    </div>
);


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Whitelist für öffentliche Routen
  const publicRoutes = ['/login', '/signup', '/onboarding'];
  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    if (!auth || !db) {
        setLoading(false);
        return;
    }

    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }

      if (authUser) {
        setUser(authUser);
        
        // Etabliere Echtzeit-Stream zum Nutzerdokument
        const userRef = doc(db, 'users', authUser.uid);
        unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            setUserProfile(profile);

            // Onboarding-Check
            if (!profile.onboardingCompleted && pathname !== '/onboarding') {
              router.replace('/onboarding');
            }
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
        
        // Zwingt Gäste auf die Login-Seite, wenn sie versuchen eine geschützte URL aufzurufen
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

  // Proximity Radar: Standort-Update bei App-Nutzung (Vordergrund)
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

    // Update sofort beim Mount
    updateLocation();

    // Update alle 15 Minuten, solange die App offen ist
    const interval = setInterval(updateLocation, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, userProfile?.proximitySettings?.enabled]);

  if (!auth && !loading) {
    return <NotConfigured />;
  }
  
  // Standard-Ladezustand während der Initialisierung
  if (loading) {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      )
  }

  // Render Lock: Blockiert das Rendern geschützter Seiten für Gäste, bis der Redirect greift
  if (!user && !isPublicRoute) {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }

  // Zusätzliche Sperre für Onboarding-Pflicht
  if (user && userProfile && !userProfile.onboardingCompleted && pathname !== '/onboarding') {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      )
  }

  return (
    <AuthContext.Provider value={{ user, userProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};