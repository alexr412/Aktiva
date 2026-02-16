import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { BottomNav } from '@/components/bottom-nav';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/contexts/auth-context';

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
      <body className={cn("font-body antialiased bg-secondary")}>
        <AuthProvider>
          <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col bg-background shadow-lg">
            <main className="flex-1 pb-[72px]">
              {children}
            </main>
            <BottomNav />
          </div>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
