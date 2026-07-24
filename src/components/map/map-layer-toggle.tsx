'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Calendar, Lock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapLayerVisibility } from './map-types';

interface MapLayerToggleProps {
  layers: MapLayerVisibility;
  onToggleLayer: (layerKey: keyof MapLayerVisibility) => void;
  language?: 'de' | 'en';
  className?: string;
  hasRadarAccess: boolean;
}

export function MapLayerToggle({
  layers,
  onToggleLayer,
  language = 'de',
  className,
  hasRadarAccess,
}: MapLayerToggleProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 p-1 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-slate-200/80 dark:border-neutral-800 rounded-full shadow-lg transition-all',
        className
      )}
    >
      {/* Places Layer Toggle */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onToggleLayer('places')}
        aria-pressed={layers.places}
        aria-label={language === 'de' ? 'Orte auf der Karte anzeigen/ausblenden' : 'Toggle places layer'}
        className={cn(
          'h-8 px-3 rounded-full text-xs font-black transition-all flex items-center gap-1.5',
          layers.places
            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600'
            : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800'
        )}
      >
        <MapPin className="h-3.5 w-3.5" />
        <span>{language === 'de' ? 'Orte' : 'Places'}</span>
      </Button>

      {/* Activities Layer Toggle */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onToggleLayer('activities')}
        aria-pressed={layers.activities}
        aria-label={language === 'de' ? 'Aktivitäten auf der Karte anzeigen/ausblenden' : 'Toggle activities layer'}
        className={cn(
          'h-8 px-3 rounded-full text-xs font-black transition-all flex items-center gap-1.5',
          layers.activities
            ? 'bg-violet-600 text-white shadow-md shadow-violet-600/20 hover:bg-violet-700'
            : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800'
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        <span>{language === 'de' ? 'Aktivitäten' : 'Activities'}</span>
      </Button>

      {/* Friends Layer Toggle */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onToggleLayer('friends')}
        aria-pressed={layers.friends}
        aria-label={language === 'de' ? 'Freunde auf der Karte anzeigen/ausblenden' : 'Toggle friends layer'}
        className={cn(
          'h-8 px-3 rounded-full text-xs font-black transition-all flex items-center gap-1.5',
          layers.friends
            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700'
            : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800'
        )}
      >
        {hasRadarAccess ? (
          <Users className="h-3.5 w-3.5" />
        ) : (
          <Lock className="h-3.5 w-3.5 text-amber-500" />
        )}
        <span>{language === 'de' ? 'Freunde' : 'Friends'}</span>
      </Button>
    </div>
  );
}
