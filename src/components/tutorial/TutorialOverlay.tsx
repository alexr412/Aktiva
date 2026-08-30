'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TUTORIAL_STEPS } from '@/lib/tutorial/tutorial-config';
import { useTargetRect } from './TutorialSpotlight';
import { TutorialTooltipCard } from './TutorialTooltipCard';
import { useAppTutorial } from '@/lib/tutorial/tutorial-context';

export function TutorialOverlay() {
  const {
    isActive,
    currentStepIndex,
    isReplay,
    nextStep,
    prevStep,
    skipTutorial,
  } = useAppTutorial();

  const currentStep = TUTORIAL_STEPS[currentStepIndex - 1];
  const targetId = currentStep?.targetId || '';
  const targetRect = useTargetRect(targetId);
  const isStep6 = currentStepIndex === 6;

  // Keyboard navigation and Focus Trap handler
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skipTutorial();
      } else if (e.key === 'ArrowRight' && currentStepIndex < TUTORIAL_STEPS.length) {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 1) {
        e.preventDefault();
        prevStep();
      } else if (e.key === 'Tab') {
        // Custom focus trap for Tooltip + Step 6 target
        const cardElement = document.querySelector('[data-tutorial-tooltip-card]');
        const targetElement = isStep6 ? document.querySelector(`[data-tutorial-id="nav-create"]`) : null;

        const focusables: HTMLElement[] = [];
        if (cardElement) {
          const els = cardElement.querySelectorAll<HTMLElement>('button, [tabindex="0"]');
          els.forEach((el) => focusables.push(el));
        }
        if (targetElement) {
          focusables.push(targetElement as HTMLElement);
        }

        if (focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const activeEl = document.activeElement as HTMLElement;

          if (e.shiftKey) {
            if (!activeEl || activeEl === first || !focusables.includes(activeEl)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (!activeEl || activeEl === last || !focusables.includes(activeEl)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStepIndex, isStep6, nextStep, prevStep, skipTutorial]);

  if (!isActive || !currentStep) {
    return null;
  }

  // Segmented Shield calculation for Step 6 vs Steps 1-5
  const renderInteractionShield = () => {
    if (!isStep6 || !targetRect) {
      // Full screen shield for Steps 1-5
      return (
        <div
          className="fixed inset-0 z-[9998] pointer-events-auto bg-transparent"
          aria-hidden="true"
        />
      );
    }

    // Segmented Shield for Step 6: 4 blocks surrounding the target bounding box
    const padding = 6;
    const tTop = Math.max(0, targetRect.top - padding);
    const tLeft = Math.max(0, targetRect.left - padding);
    const tWidth = targetRect.width + padding * 2;
    const tHeight = targetRect.height + padding * 2;
    const tBottom = tTop + tHeight;
    const tRight = tLeft + tWidth;

    return (
      <div className="fixed inset-0 z-[9998] pointer-events-none" aria-hidden="true">
        {/* Top Shield Segment */}
        <div
          className="absolute left-0 top-0 w-full pointer-events-auto"
          style={{ height: `${tTop}px` }}
        />
        {/* Bottom Shield Segment (covers other nav buttons!) */}
        <div
          className="absolute left-0 w-full pointer-events-auto"
          style={{ top: `${tBottom}px`, bottom: 0 }}
        />
        {/* Left Shield Segment */}
        <div
          className="absolute left-0 pointer-events-auto"
          style={{ top: `${tTop}px`, height: `${tHeight}px`, width: `${tLeft}px` }}
        />
        {/* Right Shield Segment */}
        <div
          className="absolute right-0 pointer-events-auto"
          style={{ top: `${tTop}px`, height: `${tHeight}px`, left: `${tRight}px` }}
        />
      </div>
    );
  };

  // SVG Spotlight Mask Path
  const renderSvgSpotlight = () => {
    if (!targetRect) {
      return <div className="fixed inset-0 z-[9997] bg-black/60 pointer-events-none transition-opacity duration-300" />;
    }

    const padding = 6;
    const rx = 12;
    const x = Math.max(0, targetRect.left - padding);
    const y = Math.max(0, targetRect.top - padding);
    const w = targetRect.width + padding * 2;
    const h = targetRect.height + padding * 2;

    const path = `M 0,0 L ${window.innerWidth},0 L ${window.innerWidth},${window.innerHeight} L 0,${window.innerHeight} Z M ${x + rx},${y} h ${w - rx * 2} a ${rx},${rx} 0 0 1 ${rx},${rx} v ${h - rx * 2} a ${rx},${rx} 0 0 1 -${rx},${rx} h -${w - rx * 2} a ${rx},${rx} 0 0 1 -${rx},-${rx} v -${h - rx * 2} a ${rx},${rx} 0 0 1 ${rx},-${rx} Z`;

    return (
      <svg
        className="fixed inset-0 w-full h-full z-[9997] pointer-events-none transition-all duration-200 motion-reduce:transition-none"
        aria-hidden="true"
      >
        <path d={path} fill="rgba(0, 0, 0, 0.65)" fillRule="evenodd" />
        {/* Highlight ring around active target */}
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={rx}
          ry={rx}
          fill="none"
          stroke="rgba(16, 185, 129, 0.8)"
          strokeWidth="2.5"
          className="motion-reduce:animate-none animate-pulse"
        />
      </svg>
    );
  };

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={currentStep.titleKey}
      tabIndex={-1}
      className="tutorial-overlay-root"
    >
      {renderSvgSpotlight()}
      {renderInteractionShield()}
      <TutorialTooltipCard
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={TUTORIAL_STEPS.length}
        targetRect={targetRect}
        onNext={nextStep}
        onPrev={prevStep}
        onSkip={skipTutorial}
      />
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
