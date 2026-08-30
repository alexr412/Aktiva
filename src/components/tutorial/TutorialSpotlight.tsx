'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TargetRect {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

export function useTargetRect(targetId: string): TargetRect | null {
  const rects = useTargetRects([targetId]);
  return rects[0] || null;
}

export function useTargetRects(targetIds: (string | undefined)[]): TargetRect[] {
  const validIdsKey = targetIds.filter(Boolean).join(',');
  const [rects, setRects] = useState<TargetRect[]>([]);

  const updateRects = useCallback(() => {
    const validIds = validIdsKey.split(',').filter(Boolean);
    const result: TargetRect[] = [];

    for (const id of validIds) {
      const element = document.querySelector(`[data-tutorial-id="${id}"]`);
      if (element) {
        const r = element.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          result.push({
            id,
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          });
        }
      }
    }

    setRects(result);
  }, [validIdsKey]);

  useEffect(() => {
    updateRects();

    const validIds = validIdsKey.split(',').filter(Boolean);
    const elements: Element[] = [];
    let resizeObserver: ResizeObserver | null = null;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateRects();
      });
    }

    for (const id of validIds) {
      const element = document.querySelector(`[data-tutorial-id="${id}"]`);
      if (element) {
        elements.push(element);
        resizeObserver?.observe(element);
      }
    }

    const handleWindowEvents = () => {
      updateRects();
    };

    window.addEventListener('resize', handleWindowEvents, { passive: true });
    window.addEventListener('orientationchange', handleWindowEvents, { passive: true });
    window.addEventListener('scroll', handleWindowEvents, { passive: true });

    return () => {
      if (resizeObserver) {
        elements.forEach((el) => resizeObserver?.unobserve(el));
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleWindowEvents);
      window.removeEventListener('orientationchange', handleWindowEvents);
      window.removeEventListener('scroll', handleWindowEvents);
    };
  }, [validIdsKey, updateRects]);

  return rects;
}
