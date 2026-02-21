'use client';

import { usePlanningMode } from '@/contexts/planning-mode-context';
import { Button } from '../ui/button';
import { MapPin, X } from 'lucide-react';

export function PlanningModeBanner() {
  const { planningState, exitPlanningMode } = usePlanningMode();

  if (!planningState.isPlanning) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-primary/20 border-b border-primary/30 text-primary-foreground backdrop-blur-sm">
        <div className="container mx-auto px-4 h-12 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold truncate text-primary">
                <MapPin className="h-5 w-5" />
                <span className="truncate">
                    Planning for: {planningState.destination?.name}
                </span>
            </div>
            <Button
                variant="ghost"
                size="icon"
                onClick={exitPlanningMode}
                className="h-8 w-8 text-primary hover:bg-primary/20 hover:text-primary"
            >
                <X className="h-5 w-5" />
                <span className="sr-only">Exit planning mode</span>
            </Button>
        </div>
    </div>
  );
}
