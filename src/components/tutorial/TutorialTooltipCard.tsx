'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import { translateAppString } from '@/lib/tag-config';
import type { TutorialStepConfig } from '@/lib/tutorial/tutorial-config';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { TargetRect } from './TutorialSpotlight';

interface TutorialTooltipCardProps {
  step: TutorialStepConfig;
  stepIndex: number;
  totalSteps: number;
  targetRect: TargetRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

function getCardStyle(targetRect: TargetRect | null): React.CSSProperties {
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  if (!isDesktop) {
    let cardStyle: React.CSSProperties = {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
    };

    if (targetRect) {
      const isTopHalf = targetRect.top < window.innerHeight / 2;
      if (isTopHalf) {
        cardStyle.top = Math.min(targetRect.top + targetRect.height + 16, window.innerHeight - 220);
      } else {
        cardStyle.bottom = Math.max(window.innerHeight - targetRect.top + 16, 80);
      }
    } else {
      cardStyle.top = '50%';
      cardStyle.transform = 'translate(-50%, -50%)';
    }

    return cardStyle;
  }

  // Desktop contextual positioning
  const cardWidth = 380;
  const cardHeight = 210;
  const padding = 20;
  const gap = 16;

  if (!targetRect) {
    return {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 99999,
    };
  }

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetBottom = targetRect.top + targetRect.height;
  const targetTop = targetRect.top;
  const targetRight = targetRect.left + targetRect.width;

  // Priority 1: Below target
  if (targetBottom + gap + cardHeight <= window.innerHeight - padding) {
    const left = Math.max(padding, Math.min(targetCenterX - cardWidth / 2, window.innerWidth - cardWidth - padding));
    return {
      position: 'fixed',
      top: targetBottom + gap,
      left,
      zIndex: 99999,
    };
  }

  // Priority 2: Above target
  if (targetTop - gap - cardHeight >= padding) {
    const left = Math.max(padding, Math.min(targetCenterX - cardWidth / 2, window.innerWidth - cardWidth - padding));
    return {
      position: 'fixed',
      top: targetTop - gap - cardHeight,
      left,
      zIndex: 99999,
    };
  }

  // Priority 3: Right of target
  if (targetRight + gap + cardWidth <= window.innerWidth - padding) {
    const top = Math.max(padding, Math.min(targetRect.top, window.innerHeight - cardHeight - padding));
    return {
      position: 'fixed',
      top,
      left: targetRight + gap,
      zIndex: 99999,
    };
  }

  // Priority 4: Left of target
  if (targetRect.left - gap - cardWidth >= padding) {
    const top = Math.max(padding, Math.min(targetRect.top, window.innerHeight - cardHeight - padding));
    return {
      position: 'fixed',
      top,
      left: targetRect.left - gap - cardWidth,
      zIndex: 99999,
    };
  }

  // Fallback: Clamp within viewport
  const top = Math.max(padding, Math.min(targetBottom + gap, window.innerHeight - cardHeight - padding));
  const left = Math.max(padding, Math.min(targetCenterX - cardWidth / 2, window.innerWidth - cardWidth - padding));
  return {
    position: 'fixed',
    top,
    left,
    zIndex: 99999,
  };
}

export function TutorialTooltipCard({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: TutorialTooltipCardProps) {
  const language = useLanguage();

  const title = translateAppString(step.titleKey, language);
  const description = translateAppString(step.descriptionKey, language);
  const progressText = translateAppString('tutorial.progress', language, stepIndex, totalSteps);
  const nextLabel = translateAppString('tutorial.next', language);
  const finishLabel = translateAppString('tutorial.finish', language);
  const backLabel = translateAppString('tutorial.back', language);
  const skipLabel = translateAppString('tutorial.skip', language);

  const [cardStyle, setCardStyle] = useState<React.CSSProperties>(() => getCardStyle(targetRect));

  useEffect(() => {
    const updateStyle = () => {
      setCardStyle(getCardStyle(targetRect));
    };

    updateStyle();
    window.addEventListener('resize', updateStyle, { passive: true });
    return () => window.removeEventListener('resize', updateStyle);
  }, [targetRect]);

  return (
    <div
      style={cardStyle}
      className="w-[calc(100vw-32px)] md:w-[380px] max-w-sm md:max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-5 shadow-2xl transition-all duration-300 motion-reduce:transition-none"
      data-tutorial-tooltip-card
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
          {progressText}
        </span>
        <button
          type="button"
          onClick={onSkip}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 transition-colors p-1 rounded-lg"
          aria-label={skipLabel}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5 mb-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
          {title}
        </h3>
        <p className="text-xs text-slate-600 dark:text-neutral-300 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-neutral-800">
        {stepIndex > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPrev}
            className="h-9 px-3 text-xs font-bold rounded-xl text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {backLabel}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="h-9 px-3 text-xs font-semibold rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
          >
            {skipLabel}
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          onClick={onNext}
          className="h-9 px-4 text-xs font-bold rounded-xl shadow-sm"
        >
          {stepIndex === totalSteps ? finishLabel : nextLabel}
          {stepIndex < totalSteps && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>
    </div>
  );
}
