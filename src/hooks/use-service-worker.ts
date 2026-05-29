'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration Hook
 * Registriert den SW automatisch im Browser und kümmert sich um Updates.
 */
export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        // Auf Updates prüfen
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              // Neuer SW ist aktiv → ggf. Seite neu laden für frische Assets
              if (navigator.serviceWorker.controller) {
                // New version available
              }
            }
          });
        });

        // Regelmäßig auf Updates prüfen (alle 60 Minuten)
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

      } catch (error) {
        console.error('[SW] Registration failed:', error);
      }
    };

    // SW erst registrieren, nachdem die Seite geladen ist (Performance)
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
      return () => window.removeEventListener('load', registerSW);
    }
  }, []);
}
