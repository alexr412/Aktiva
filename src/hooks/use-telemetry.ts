import { useEffect, useRef } from 'react';
import { telemetry } from '../lib/telemetry';

/**
 * Hook zur Messung der "Impression"
 * Registriert das Event, sobald die referenzierte DOM-Node zu spezifiziertem Prozentteil im Viewport ist.
 */
export function useImpressionTracker<T extends HTMLElement>(
  entityId: string, 
  userId: string | null = null,
  threshold: number = 0.5
) {
  const ref = useRef<T | null>(null);
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!ref.current || hasTracked.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasTracked.current) {
        telemetry.track('impression', entityId, 0, userId);
        hasTracked.current = true;
        observer.disconnect();
      }
    }, { threshold });

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [entityId, userId, threshold]);

  return ref;
}

/**
 * Hook zur Messung der "Dwell Time" (Verweildauer)
 * Startet einen Timer bei Komponent-Mount und feuert beim Unmount die Dauer in ms.
 */
export function useDwellTracker(entityId: string, userId: string | null = null) {
  useEffect(() => {
    const startTime = Date.now();

    // Cleanup-Funktion triggert, sobald die Detailansicht verlassen/unmounted wird
    return () => {
      const dwellTimeMs = Date.now() - startTime;
      telemetry.track('dwell', entityId, dwellTimeMs, userId);
    };
  }, [entityId, userId]);
}
