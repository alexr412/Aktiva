import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { BottomNav } from '@/components/bottom-nav';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { PlanningModeProvider } from '@/contexts/planning-mode-context';
import { PlanningModeBanner } from '@/components/common/PlanningModeBanner';
import { FavoritesProvider } from '@/contexts/favorites-context';
import { AppInit } from '@/components/common/AppInit';
import { StatusBorder } from '@/components/common/StatusBorder';

export const metadata: Metadata = {
  title: 'Aktvia',
  description: 'Find interesting places near you.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Aktvia',
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
                  if (typeof window !== 'undefined') {
                    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || { isDisabled: true };
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
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={cn("font-body antialiased bg-secondary")} suppressHydrationWarning>
        <AppInit />
        <ThemeProvider>
          <AuthProvider>
            <FavoritesProvider>
              <PlanningModeProvider>
                <div className="relative flex h-[100dvh] w-full flex-col bg-background overflow-hidden">
                  <PlanningModeBanner />
                  <main className="flex-1 relative flex flex-col overflow-hidden">
                    {children}
                  </main>
                  <BottomNav />
                </div>
                <Toaster />
              </PlanningModeProvider>
            </FavoritesProvider>
            <StatusBorder />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
