'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function AppSplashScreen() {
  const { loading: authLoading } = useAuth();
  const [isVisible, setIsVisible] = useState<boolean | null>(null);
  const [isFading, setIsFading] = useState(false);
  const [minTimerDone, setMinTimerDone] = useState(false);

  useEffect(() => {
    // Check if splash was already shown in this session
    if (typeof window !== 'undefined') {
      const alreadyShown = sessionStorage.getItem('activa_app_splash_shown');
      if (alreadyShown === 'true') {
        setIsVisible(false);
        return;
      }
      setIsVisible(true);
    }
  }, []);

  useEffect(() => {
    if (isVisible !== true) return;

    // Minimum display time for a smooth startup experience (~1.8 seconds)
    const minTimer = setTimeout(() => {
      setMinTimerDone(true);
    }, 1800);

    return () => clearTimeout(minTimer);
  }, [isVisible]);

  useEffect(() => {
    if (isVisible === true && minTimerDone && !authLoading && !isFading) {
      setIsFading(true);
      const fadeTimer = setTimeout(() => {
        setIsVisible(false);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('activa_app_splash_shown', 'true');
        }
      }, 500);

      return () => clearTimeout(fadeTimer);
    }
  }, [isVisible, minTimerDone, authLoading, isFading]);

  if (isVisible !== true) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white dark:bg-neutral-950 transition-opacity duration-500 ease-out select-none pointer-events-auto",
        isFading ? "opacity-0" : "opacity-100"
      )}
    >
      {/* Background Subtle Gradient Glow */}
      <div className="absolute w-72 h-72 rounded-full bg-rose-500/10 dark:bg-rose-500/20 blur-3xl animate-pulse pointer-events-none" />

      {/* Main Logo & Brand Box */}
      <div className="relative z-10 flex flex-col items-center text-center p-6 space-y-6 animate-in fade-in zoom-in-95 duration-700">
        {/* Heart Logo Image */}
        <div className="relative w-28 h-28 md:w-36 md:h-36 drop-shadow-2xl hover:scale-105 transition-transform">
          <Image
            src="/assets/logo-heart.png"
            alt="Activa Logo"
            fill
            sizes="(max-width: 768px) 112px, 144px"
            className="object-contain"
            priority
          />
        </div>

        {/* Brand Name */}
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            activa<span className="text-rose-500">.</span>
          </h1>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-slate-400 dark:text-neutral-500">
            Connect • Explore • Live
          </p>
        </div>

        {/* Smooth Loading Indicator Line */}
        <div className="w-24 h-1 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden relative mt-4">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 to-pink-500 w-1/2 rounded-full animate-[shimmer_1.2s_infinite_linear]" />
        </div>
      </div>
    </div>
  );
}
