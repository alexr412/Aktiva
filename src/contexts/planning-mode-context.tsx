'use client';

import React, { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import type { PlanningState, Destination } from '@/lib/types';

const PLANNING_MODE_STORAGE_KEY = 'app-planning-mode';

interface PlanningModeContextType {
  planningState: PlanningState;
  enterPlanningMode: (destination: Destination) => void;
  exitPlanningMode: () => void;
}

const PlanningModeContext = createContext<PlanningModeContextType | undefined>(undefined);

export const PlanningModeProvider = ({ children }: { children: ReactNode }) => {
  const [planningState, setPlanningState] = useState<PlanningState>({
    isPlanning: false,
    destination: null,
  });

  useEffect(() => {
    try {
      const storedState = localStorage.getItem(PLANNING_MODE_STORAGE_KEY);
      if (storedState) {
        const parsedState: PlanningState = JSON.parse(storedState);
        setPlanningState(parsedState);
      }
    } catch (e) {
      console.error("Could not read planning mode state from localStorage", e);
    }
  }, []);

  const updateState = (newState: PlanningState) => {
    setPlanningState(newState);
    try {
      localStorage.setItem(PLANNING_MODE_STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {
      console.error("Could not save planning mode state to localStorage", e);
    }
  };

  const enterPlanningMode = (destination: Destination) => {
    updateState({ isPlanning: true, destination });
  };

  const exitPlanningMode = () => {
    updateState({ isPlanning: false, destination: null });
  };

  return (
    <PlanningModeContext.Provider value={{ planningState, enterPlanningMode, exitPlanningMode }}>
      {children}
    </PlanningModeContext.Provider>
  );
};

export const usePlanningMode = (): PlanningModeContextType => {
  const context = useContext(PlanningModeContext);
  if (!context) {
    throw new Error('usePlanningMode must be used within a PlanningModeProvider');
  }
  return context;
};
