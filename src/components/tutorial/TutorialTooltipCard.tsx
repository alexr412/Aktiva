'use client';

import React from 'react';
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
  const backLabel = translateAppString('tutorial.back', language);
  const skipLabel = translateAppString('tutorial.skip', language);

  // Position calculation relative to viewport & targetRect
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

  return (
    <div
      style={cardStyle}
      className="w-[calc(100vw-32px)] max-w-sm rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-5 shadow-2xl transition-all duration-300 motion-reduce:transition-none"
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

        {stepIndex < totalSteps && (
          <Button
            type="button"
            size="sm"
            onClick={onNext}
            className="h-9 px-4 text-xs font-bold rounded-xl shadow-sm"
          >
            {nextLabel}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
