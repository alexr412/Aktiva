'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Navigation } from 'lucide-react';
import { MapLayerToggle } from './map-layer-toggle';
import type { MapLayerVisibility } from './map-types';
import { cn } from '@/lib/utils';

interface MapControlsProps {
  layers: MapLayerVisibility;
  onToggleLayer: (layerKey: keyof MapLayerVisibility) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  language?: 'de' | 'en';
  hasLocationPermission?: boolean;
  hasRadarAccess: boolean;
  className?: string;
}

export function MapControls({
  layers,
  onToggleLayer,
  onZoomIn,
  onZoomOut,
  onRecenter,
  language = 'de',
  hasLocationPermission = true,
  hasRadarAccess,
  className,
}: MapControlsProps) {
  return (
    <div className={cn('absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4', className)}>
      {/* Top Controls: Layer Visibility Toggles */}
      <div className="flex justify-center pointer-events-auto">
        <MapLayerToggle layers={layers} onToggleLayer={onToggleLayer} language={language} hasRadarAccess={hasRadarAccess} />
      </div>

      {/* Right Controls: Zoom & Location Recenter */}
      <div className="flex flex-col items-end gap-2 pointer-events-auto self-end mt-auto mb-16 md:mb-4">
        {/* Recenter button */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={onRecenter}
          aria-label={
            language === 'de'
              ? 'Auf aktuellen Standort / Zielort zentrieren'
              : 'Recenter map on user location'
          }
          className="h-10 w-10 rounded-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md shadow-lg border border-slate-200/80 dark:border-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-800 transition-transform active:scale-95"
        >
          <Navigation className={cn("h-4 w-4", hasLocationPermission ? "text-emerald-500 fill-emerald-500/20" : "text-slate-400")} />
        </Button>

        {/* Zoom controls cluster */}
        <div className="flex flex-col rounded-2xl bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md shadow-lg border border-slate-200/80 dark:border-neutral-800 overflow-hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onZoomIn}
            aria-label={language === 'de' ? 'Karte vergrößern' : 'Zoom in'}
            className="h-10 w-10 rounded-none text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 border-b border-slate-100 dark:border-neutral-800"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onZoomOut}
            aria-label={language === 'de' ? 'Karte verkleinern' : 'Zoom out'}
            className="h-10 w-10 rounded-none text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
