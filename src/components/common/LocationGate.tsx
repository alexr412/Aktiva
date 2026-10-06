'use client';

import React, { ReactNode, useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePlanningMode } from '@/contexts/planning-mode-context';
import { LocationSearchDialog } from './LocationSearchDialog';
import { needsLocationForRoute } from '@/lib/location-gate-routes';
import { usePathname } from 'next/navigation';
import { MapPin, Lock, Loader2, RefreshCw, Navigation, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from '@/contexts/location-context';
import { getLocationPermissionInstructions } from '@/lib/device-detection';
import { debugLog } from '@/lib/debug';

export function LocationGate({ children }: { children?: ReactNode }) {
  const instanceIdRef = useRef<string | null>(null);
  if (!instanceIdRef.current) {
    instanceIdRef.current = 'LG-' + Math.random().toString(36).substring(2, 6);
  }

  const renderCountRef = useRef(0);
  renderCountRef.current++;

  const pathname = usePathname();
  const { planningState } = usePlanningMode();
  const [manualSearchOpen, setManualSearchOpen] = useState(false);
  const { gateState, needsLocationGate, errorMessage, requestLocation } = useLocation();

  debugLog(
    'location',
    `LOCATION TRACE gate=${instanceIdRef.current} render=${renderCountRef.current} state=${gateState} path=${pathname}`
  );

  useEffect(() => {
    debugLog('location', `ROUTE TRACE initial path=${typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname}`);
    debugLog('location', `LOCATION TRACE gate=${instanceIdRef.current} event=MOUNT`);
    return () => {
      debugLog('location', `LOCATION TRACE gate=${instanceIdRef.current} event=UNMOUNT`);
    };
  }, []);

  const publicRoutes = ['/login', '/signup', '/terms', '/privacy', '/imprint', '/licenses', '/accessibility', '/cancellation'];
  const isPublicInviteRoute = pathname ? (
    /^\/activities\/[^/]+\/invite$/.test(pathname) ||
    /^\/activity\/[^/]+\/invite$/.test(pathname)
  ) : false;
  const isPublicRoute = publicRoutes.includes(pathname) || isPublicInviteRoute;

  const instructions = getLocationPermissionInstructions();
  const isDenied = gateState === 'denied';
  const isError = gateState === 'error';
  const isRequesting = gateState === 'requesting';

  const handleLocationRetry = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    requestLocation({ interactive: true });
  };

  const destination = planningState.isPlanning ? planningState.destination : null;
  const hasManualLocation = !!destination && Number.isFinite(destination.lat) && Number.isFinite(destination.lng);
  const shouldShowGate = !isPublicRoute && needsLocationForRoute(pathname) && needsLocationGate && !hasManualLocation;

  return (
    <>
      {/* App content is rendered permanently underneath */}
      {children}

      {/* Root Fixed Overlay: rendered purely based on gateState without Remount or CSS entry animations */}
      {shouldShowGate && !manualSearchOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-md overflow-hidden bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-neutral-800 my-auto">
            {/* Header Header */}
            <div className={`relative h-44 flex items-center justify-center overflow-hidden ${
              isDenied
                ? 'bg-gradient-to-br from-amber-500 to-red-600'
                : 'bg-gradient-to-br from-emerald-400 to-blue-500'
            }`}>
              <div className="bg-white/20 backdrop-blur-xl p-5 rounded-full border border-white/30 shadow-2xl relative">
                {isDenied ? (
                  <Lock className="h-14 w-14 text-white drop-shadow-lg" />
                ) : (
                  <MapPin className="h-14 w-14 text-white drop-shadow-lg" />
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6 md:p-8 text-center space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-neutral-100 tracking-tight leading-tight">
                  {isDenied ? 'Wähle deinen Standort' : isError ? 'Standort momentan nicht verfügbar' : 'Wo möchtest du etwas entdecken?'}
                </h1>
                <p className="text-slate-500 dark:text-neutral-400 font-medium text-sm leading-relaxed">
                  {isDenied
                    ? 'Wähle eine Stadt manuell oder aktiviere den Standortzugriff in deinen Browser- oder Geräteeinstellungen.'
                    : isError
                      ? 'Der Standort konnte nicht ermittelt werden. Prüfe die Standortdienste deines Geräts und versuche es erneut.'
                      : 'Nutze deinen aktuellen Standort oder wähle eine Stadt. Chats und dein Profil kannst du auch ohne Standort nutzen.'}
                </p>
              </div>

              {/* Static Instructions on Denied */}
              {isDenied && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-left text-xs font-semibold text-amber-900 dark:text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-300">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    {instructions.platformTitle}
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-700 dark:text-amber-100 text-[11px] leading-relaxed">
                    {instructions.steps.slice(0, -1).map(step => <li key={step}>{step}</li>)}
                    <li>Kehre zu Activa zurück und tippe auf „Standort prüfen“.</li>
                  </ol>
                </div>
              )}

              {/* Error Message Box */}
              {gateState === 'error' && errorMessage && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-left text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Button */}
              <div>
                <Button
                  type="button"
                  onClick={handleLocationRetry}
                  disabled={isRequesting}
                  className="w-full h-14 rounded-2xl bg-primary hover:opacity-90 text-white font-black text-base shadow-xl shadow-emerald-200/50 flex items-center justify-center gap-3 border-none disabled:opacity-80 cursor-pointer"
                >
                  {isRequesting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Standort wird geprüft …</span>
                    </>
                  ) : isDenied ? (
                    <>
                      <RefreshCw className="h-5 w-5" />
                      <span>Standort prüfen</span>
                    </>
                  ) : gateState === 'error' ? (
                    <>
                      <RefreshCw className="h-5 w-5" />
                      <span>Erneut versuchen</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="h-5 w-5 fill-current" />
                      <span>Standort verwenden</span>
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" className="w-full mt-3 h-12 rounded-2xl" onClick={() => setManualSearchOpen(true)}>
                  <MapPin className="h-4 w-4 mr-2" /> Stadt manuell wählen
                </Button>
                <div className="mt-4 flex justify-center gap-6 text-sm text-primary">
                  <Link href="/chat">Zu den Chats</Link>
                  <Link href="/profile">Zum Profil</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <LocationSearchDialog open={manualSearchOpen} onOpenChange={setManualSearchOpen} />
    </>
  );
}
