'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function AppSplashScreen() {
  const { loading: authLoading } = useAuth();

  // Lazy state initializer: synchronously TRUE on frame 0 (unless session flag exists)
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('activa_app_splash_shown') !== 'true';
    }
    return true;
  });

  const [isFading, setIsFading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const alreadyShown = sessionStorage.getItem('activa_app_splash_shown');
      if (alreadyShown === 'true') {
        setIsVisible(false);
        return;
      }
    }

    // Smooth progressive progress bar fill from 0% to 90%
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const step = Math.max(1, Math.floor((90 - prev) / 6));
        return prev + step;
      });
    }, 70);

    return () => clearInterval(interval);
  }, []);

  // When authLoading completes, smoothly finish progress to 100% and fade out
  useEffect(() => {
    if (!authLoading && isVisible && !isFading) {
      setProgress(100);
      const finishTimer = setTimeout(() => {
        setIsFading(true);
        const fadeTimer = setTimeout(() => {
          setIsVisible(false);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('activa_app_splash_shown', 'true');
          }
        }, 500);
        return () => clearTimeout(fadeTimer);
      }, 350);

      return () => clearTimeout(finishTimer);
    }
  }, [authLoading, isVisible, isFading]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-neutral-950 text-white transition-opacity duration-500 ease-out select-none pointer-events-auto",
        isFading ? "opacity-0" : "opacity-100"
      )}
    >
      <style>{`
        @keyframes logoPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 20px rgba(239, 68, 68, 0.35)); }
          50% { transform: scale(1.05); filter: drop-shadow(0 0 38px rgba(239, 68, 68, 0.65)); }
        }
      `}</style>

      {/* Background Glow */}
      <div className="absolute w-80 h-80 rounded-full bg-rose-500/15 blur-3xl pointer-events-none" />

      {/* Main Content Box */}
      <div className="relative z-10 flex flex-col items-center text-center p-6 space-y-6">
        {/* Animated Heart Logo */}
        <div
          className="relative w-32 h-32 md:w-40 md:h-40"
          style={{ animation: 'logoPulse 2.4s ease-in-out infinite' }}
        >
          <Image
            src="/assets/logo-heart.png"
            alt="Activa Logo"
            fill
            sizes="(max-width: 768px) 128px, 160px"
            className="object-contain"
            priority
          />
        </div>

        {/* Brand Typography */}
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            activa<span className="text-rose-500">.</span>
          </h1>
          <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-neutral-400">
            CONNECT • EXPLORE • LIVE
          </p>
        </div>

        {/* Progressive Loading Bar (Fills 0% to 100% from left to right) */}
        <div className="w-48 sm:w-56 h-2 bg-neutral-900 rounded-full overflow-hidden relative mt-4 border border-white/10 shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-rose-600 via-red-500 to-pink-500 rounded-full transition-all duration-150 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
}
