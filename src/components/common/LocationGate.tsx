'use client';

import React, { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MapPin, Lock, Loader2, RefreshCw, Navigation, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from '@/contexts/location-context';
import { detectDevice } from '@/lib/device-detection';

export function LocationGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { gateState, errorMessage, requestLocation } = useLocation();

  const publicRoutes = ['/login', '/signup', '/terms', '/privacy', '/imprint', '/licenses', '/accessibility', '/cancellation'];
  const isPublicInviteRoute = pathname ? (
    /^\/activities\/[^/]+\/invite$/.test(pathname) ||
    /^\/activity\/[^/]+\/invite$/.test(pathname)
  ) : false;
  const isPublicRoute = publicRoutes.includes(pathname) || isPublicInviteRoute;

  // On public routes or when permission is granted, unlock the gate and render children
  if (isPublicRoute || gateState === 'granted') {
    return <>{children}</>;
  }

  const device = detectDevice();
  const isDenied = gateState === 'denied';
  const isRequesting = gateState === 'requesting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-md overflow-hidden bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-neutral-800 animate-in zoom-in-95 duration-200 my-auto">
        {/* Visual Header */}
        <div className={`relative h-44 flex items-center justify-center overflow-hidden transition-colors ${
          isDenied
            ? 'bg-gradient-to-br from-amber-500 to-red-600'
            : 'bg-gradient-to-br from-emerald-400 to-blue-500'
        }`}>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-10 right-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse delay-700" />
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-white rounded-full blur-2xl opacity-40 scale-150 animate-pulse" />
            <div className="bg-white/20 backdrop-blur-xl p-5 rounded-full border border-white/30 shadow-2xl relative">
              {isDenied ? (
                <Lock className="h-14 w-14 text-white drop-shadow-lg" />
              ) : (
                <MapPin className="h-14 w-14 text-white drop-shadow-lg" />
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 md:p-8 text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-neutral-100 tracking-tight leading-tight">
              {isDenied ? 'Standortzugriff erforderlich' : 'Aktiva benötigt deinen Standort'}
            </h1>
            <p className="text-slate-500 dark:text-neutral-400 font-medium text-sm leading-relaxed">
              {isDenied
                ? 'Der Standortzugriff ist deaktiviert. Aktiviere ihn in den Browser- oder Geräteeinstellungen und prüfe den Standort anschließend erneut.'
                : 'Aktiva zeigt dir Aktivitäten, Orte und Menschen in deiner Nähe. Dafür benötigen wir deinen aktuellen Standort.'}
            </p>
          </div>

          {/* Static Instructions on Denied */}
          {isDenied && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-left text-xs font-semibold text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                {device.isIOS ? 'Anleitung für iPhone (Safari / Chrome):' : 'Anleitung für Android:'}
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-700 dark:text-amber-100 text-[11px] leading-relaxed">
                {device.isIOS ? (
                  <>
                    <li>Öffne die iPhone-Einstellungen.</li>
                    <li>Öffne Datenschutz & Sicherheit.</li>
                    <li>Öffne Ortungsdienste.</li>
                    <li>Wähle Safari Websites oder Chrome.</li>
                    <li>Stelle den Zugriff auf „Beim Verwenden der App“.</li>
                    <li>Kehre zu Aktiva zurück.</li>
                    <li>Tippe auf „Standort prüfen“.</li>
                  </>
                ) : (
                  <>
                    <li>Aktiviere die Standortdienste des Geräts.</li>
                    <li>Öffne die Website-Einstellungen des Browsers.</li>
                    <li>Stelle den Standortzugriff für Aktiva auf „Zulassen“.</li>
                    <li>Kehre zu Aktiva zurück.</li>
                    <li>Tippe auf „Standort prüfen“.</li>
                  </>
                )}
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
              onClick={requestLocation}
              disabled={isRequesting}
              className="w-full h-14 rounded-2xl bg-primary hover:opacity-90 text-white font-black text-base shadow-xl shadow-emerald-200/50 flex items-center justify-center gap-3 border-none transition-all active:scale-95 disabled:opacity-80 cursor-pointer"
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
          </div>
        </div>
      </div>
    </div>
  );
}
