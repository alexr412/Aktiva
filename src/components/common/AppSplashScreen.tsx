'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppSplashVisual } from './AppSplashVisual';

export function AppSplashScreen() {
  const { loading: authLoading } = useAuth();

  // Deterministic initial state for SSR & Frame 0 hydration (zero mismatch)
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Progressive progress bar animation (0% -> 90% while loading)
  useEffect(() => {
    let active = true;

    const interval = setInterval(() => {
      if (!active) return;
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const step = Math.max(1, Math.floor((90 - prev) / 5));
        return prev + step;
      });
    }, 60);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // When authLoading finishes, rapidly complete progress to 100% and fade out
  useEffect(() => {
    if (!authLoading && isVisible && !isFading) {
      setProgress(100);
      const finishTimer = setTimeout(() => {
        setIsFading(true);
        const fadeTimer = setTimeout(() => {
          setIsVisible(false);
        }, 450);
        return () => clearTimeout(fadeTimer);
      }, 300);

      return () => clearTimeout(finishTimer);
    }
  }, [authLoading, isVisible, isFading]);

  if (!isVisible) {
    return null;
  }

  return <AppSplashVisual progress={progress} isFading={isFading} fixed={true} />;
}
