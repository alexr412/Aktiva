'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { updateUserProfile } from '@/lib/firebase/firestore';
import { CURRENT_APP_TUTORIAL_VERSION, TUTORIAL_STEPS } from './tutorial-config';

interface AppTutorialContextType {
  isActive: boolean;
  currentStepIndex: number;
  isReplay: boolean;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  onDialogOpen: (open: boolean) => void;
  startReplay: () => void;
}

const AppTutorialContext = createContext<AppTutorialContextType | null>(null);

function SearchParamReplayListener({ onReplayDetected }: { onReplayDetected: () => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams && searchParams.get('tutorial') === 'replay') {
      onReplayDetected();
    }
  }, [searchParams, onReplayDetected]);
  return null;
}

export function AppTutorialProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const language = useLanguage();

  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(1);
  const [isReplay, setIsReplay] = useState(false);

  const isWritingCompletionRef = useRef(false);
  const hasAutoStartedRef = useRef(false);

  // Helper to remove 'tutorial=replay' from URL using URLSearchParams preserving other query params and hash
  const clearReplayQueryParam = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('tutorial')) {
      url.searchParams.delete('tutorial');
      const newUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, '', newUrl);
    }
  }, []);

  const handleReplayDetected = useCallback(() => {
    setIsReplay(true);
    setCurrentStepIndex(1);
    setIsActive(true);
    isWritingCompletionRef.current = false;
    clearReplayQueryParam();
  }, [clearReplayQueryParam]);

  const isDisallowedRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/onboarding') ||
    ['/imprint', '/terms', '/privacy', '/licenses', '/cancellation', '/accessibility'].includes(pathname);

  // 2. Auto-Start Eligibility Evaluation for new onboarded users
  useEffect(() => {
    if (authLoading || !user || !userProfile || isActive || hasAutoStartedRef.current || isReplay || isDisallowedRoute) {
      return;
    }

    const isEligible =
      userProfile.onboardingCompleted === true &&
      userProfile.appTutorialEligible === true &&
      (userProfile.appTutorialVersion ?? 0) === 0;

    if (isEligible) {
      hasAutoStartedRef.current = true;
      setCurrentStepIndex(1);
      setIsActive(true);
      isWritingCompletionRef.current = false;
    }
  }, [authLoading, user, userProfile, isActive, isReplay, isDisallowedRoute]);

  // 3. Automatic Route Navigation Controller
  useEffect(() => {
    if (!isActive) return;
    const stepConfig = TUTORIAL_STEPS[currentStepIndex - 1];
    if (stepConfig?.route && pathname !== stepConfig.route) {
      router.push(stepConfig.route);
    }
  }, [isActive, currentStepIndex, pathname, router]);

  // Complete tutorial action (saves appTutorialVersion = 1 if not replay)
  const completeTutorial = useCallback(async () => {
    setIsActive(false);

    if (isReplay || !user?.uid) {
      return;
    }

    if (isWritingCompletionRef.current) return;
    isWritingCompletionRef.current = true;

    try {
      await updateUserProfile(user.uid, {
        appTutorialVersion: CURRENT_APP_TUTORIAL_VERSION,
      });
    } catch (err: any) {
      console.error('Failed to save appTutorialVersion completion:', err);
      isWritingCompletionRef.current = false;
      toast({
        variant: 'destructive',
        title: language === 'de' ? 'Fehler' : 'Error',
        description: language === 'de'
          ? 'Tutorial-Status konnte nicht gespeichert werden.'
          : 'Tutorial status could not be saved.',
      });
    }
  }, [isReplay, user, language, toast]);

  const skipTutorial = useCallback(() => {
    completeTutorial();
  }, [completeTutorial]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < TUTORIAL_STEPS.length) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      completeTutorial();
    }
  }, [currentStepIndex, completeTutorial]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 1) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const step9DialogWasOpenedRef = useRef(false);

  // Step 9 Dialog Open Event Handler (Advances tutorial to Step 10 only after dialog is closed open === false)
  const onDialogOpen = useCallback(
    (open: boolean) => {
      if (!isActive || currentStepIndex !== 9) return;

      if (open === true) {
        step9DialogWasOpenedRef.current = true;
      } else if (open === false && step9DialogWasOpenedRef.current) {
        step9DialogWasOpenedRef.current = false;
        setCurrentStepIndex(10);
        router.push('/explore');
      }
    },
    [isActive, currentStepIndex, router]
  );

  const startReplay = useCallback(() => {
    setIsReplay(true);
    setCurrentStepIndex(1);
    setIsActive(true);
    isWritingCompletionRef.current = false;
  }, []);

  return (
    <AppTutorialContext.Provider
      value={{
        isActive,
        currentStepIndex,
        isReplay,
        nextStep,
        prevStep,
        skipTutorial,
        onDialogOpen,
        startReplay,
      }}
    >
      <Suspense fallback={null}>
        <SearchParamReplayListener onReplayDetected={handleReplayDetected} />
      </Suspense>
      {children}
    </AppTutorialContext.Provider>
  );
}

export function useAppTutorial() {
  const ctx = useContext(AppTutorialContext);
  if (!ctx) {
    throw new Error('useAppTutorial must be used within an AppTutorialProvider');
  }
  return ctx;
}
