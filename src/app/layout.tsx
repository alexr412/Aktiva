import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { BottomNav } from '@/components/bottom-nav';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { PlanningModeProvider } from '@/contexts/planning-mode-context';
import { PlanningModeBanner } from '@/components/common/PlanningModeBanner';
import { FavoritesProvider } from '@/contexts/favorites-context';

export const metadata: Metadata = {
  title: 'Aktvia',
  description: 'Find interesting places near you.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className={cn("font-body antialiased bg-secondary")} suppressHydrationWarning>
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
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
