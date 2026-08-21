'use client';

import React, { ReactNode, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';

export function AppBootstrapGate({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const instanceIdRef = useRef<string | null>(null);
  if (!instanceIdRef.current) {
    instanceIdRef.current = 'ABG-' + Math.random().toString(36).substring(2, 6);
  }

  useEffect(() => {
    console.log(`[BOOTSTRAP TRACE] gate=${instanceIdRef.current} event=MOUNT`);
    return () => {
      console.log(`[BOOTSTRAP TRACE] gate=${instanceIdRef.current} event=UNMOUNT`);
    };
  }, []);

  console.log(`[BOOTSTRAP TRACE] gate=${instanceIdRef.current} state=loading:${loading} childrenRendered=true`);

  return (
    <>
      {children}
      {loading && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-slate-200 dark:border-neutral-800 shadow-lg text-xs font-bold text-slate-600 dark:text-neutral-300">
          <div className="relative w-4 h-4 animate-pulse">
            <Image src="/assets/logo-heart.png" alt="Activa" fill sizes="16px" className="object-contain" />
          </div>
          <span>Synchronisiere…</span>
        </div>
      )}
    </>
  );
}
