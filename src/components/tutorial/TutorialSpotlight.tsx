'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialSpotlightProps {
  targetId: string;
  onRectChange?: (rect: TargetRect | null) => void;
}

export function useTargetRect(targetId: string): TargetRect | null {
  const [rect, setRect] = useState<TargetRect | null>(null);

  const updateRect = useCallback(() => {
    const element = document.querySelector(`[data-tutorial-id="${targetId}"]`);
    if (!element) {
      setRect(null);
      return;
    }

    const r = element.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) {
      setRect(null);
      return;
    }

    setRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [targetId]);

  useEffect(() => {
    updateRect();

    const element = document.querySelector(`[data-tutorial-id="${targetId}"]`);
    let resizeObserver: ResizeObserver | null = null;

    if (element && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateRect();
      });
      resizeObserver.observe(element);
    }

    const handleWindowEvents = () => {
      updateRect();
    };

    window.addEventListener('resize', handleWindowEvents, { passive: true });
    window.addEventListener('orientationchange', handleWindowEvents, { passive: true });
    window.addEventListener('scroll', handleWindowEvents, { passive: true });

    return () => {
      if (resizeObserver && element) {
        resizeObserver.unobserve(element);
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleWindowEvents);
      window.removeEventListener('orientationchange', handleWindowEvents);
      window.removeEventListener('scroll', handleWindowEvents);
    };
  }, [targetId, updateRect]);

  return rect;
}
