'use client';

import React, { ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader2 } from 'lucide-react';

export function AppBootstrapGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth();

  return (
    <>
      {children}
      {loading && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-slate-200 dark:border-neutral-800 shadow-lg text-xs font-bold text-slate-600 dark:text-neutral-300">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Synchronisiere…</span>
        </div>
      )}
    </>
  );
}
