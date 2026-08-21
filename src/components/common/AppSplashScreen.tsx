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
  const [minTimerDone, setMinTimerDone] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const alreadyShown = sessionStorage.getItem('activa_app_splash_shown');
      if (alreadyShown === 'true') {
        setIsVisible(false);
        return;
      }
    }

    // Display duration for initial load (~2.2 seconds)
    const minTimer = setTimeout(() => {
      setMinTimerDone(true);
    }, 2200);

    return () => clearTimeout(minTimer);
  }, []);

  useEffect(() => {
    if (isVisible && minTimerDone && !authLoading && !isFading) {
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
        @keyframes splashBar {
          0% { left: -40%; width: 35%; }
          50% { left: 30%; width: 50%; }
          100% { left: 105%; width: 35%; }
        }
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

        {/* Animated Fluid Loading Bar */}
        <div className="w-36 h-1.5 bg-neutral-900 rounded-full overflow-hidden relative mt-4 border border-white/10 shadow-inner">
          <div
            className="absolute inset-y-0 bg-gradient-to-r from-rose-600 via-red-500 to-pink-500 rounded-full"
            style={{ animation: 'splashBar 1.3s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
          />
        </div>
      </div>
    </div>
  );
}
