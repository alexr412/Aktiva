import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { BottomNav } from '@/components/bottom-nav';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { PlanningModeProvider } from '@/contexts/planning-mode-context';
import { LocationProvider } from '@/contexts/location-context';
import { AppBootstrapGate } from '@/components/common/AppBootstrapGate';
import { LocationGate } from '@/components/common/LocationGate';
import { PlanningModeBanner } from '@/components/common/PlanningModeBanner';
import { FavoritesProvider } from '@/contexts/favorites-context';
import { AppInit } from '@/components/common/AppInit';
import { StatusBorder } from '@/components/common/StatusBorder';
import { AdminQuickNavigator } from '@/components/admin/AdminQuickNavigator';
import { ChatSyncProvider } from '@/contexts/chat-sync-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { InAppNotificationContainer } from '@/components/notifications/InAppNotificationContainer';
import { FriendRadarProvider } from '@/hooks/use-friend-radar';

export const metadata: Metadata = {
  title: 'Activa',
  description: 'Find interesting places near you.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Activa',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const storedMode = localStorage.getItem('app-mode');
                  if (storedMode === 'dark' || (!storedMode && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  const storedTheme = localStorage.getItem('app-theme');
                  if (storedTheme) {
                    document.documentElement.classList.add('theme-' + storedTheme);
                  }
                  const ignoreAttrs = ['bis_skin_checked', 'bis-skin-checked'];
                  const orgSet = Element.prototype.setAttribute;
                  Element.prototype.setAttribute = function(name, value) {
                    if (ignoreAttrs.includes(name)) return;
                    orgSet.call(this, name, value);
                  };
                  ignoreAttrs.forEach(attr => {
                    Object.defineProperty(Element.prototype, attr, {
                      get() { return undefined; },
                      set() {}
                    });
                  });
                } catch (e) {}
              })();
            `
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={cn("font-body antialiased bg-secondary")} suppressHydrationWarning>
        <AppInit />
        <ThemeProvider>
          <AuthProvider>
            <LocationProvider>
              <AppBootstrapGate>
                <PlanningModeProvider>
                  <FriendRadarProvider>
                    <FavoritesProvider>
                      <ChatSyncProvider>
                        <NotificationProvider>
                          <InAppNotificationContainer />
                          <div className="relative flex h-dvh w-full flex-col bg-background overflow-hidden">
                            <PlanningModeBanner />
                            <main className="flex-1 min-h-0 w-full relative flex flex-col overflow-hidden">
                              {children}
                            </main>
                            <BottomNav />
                            <AdminQuickNavigator />
                          </div>
                          <Toaster />
                          <StatusBorder />
                        </NotificationProvider>
                      </ChatSyncProvider>
                    </FavoritesProvider>
                  </FriendRadarProvider>
                </PlanningModeProvider>
              </AppBootstrapGate>
              <LocationGate />
            </LocationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
