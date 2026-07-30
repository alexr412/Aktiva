import React from 'react';
import { MapPin, Navigation, Loader2, Lock, RefreshCw, ShieldAlert, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import { detectDevice, getLocationPermissionInstructions, openInExternalBrowser } from '@/lib/device-detection';

interface LocationRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  permissionState?: 'granted' | 'prompt' | 'denied' | null;
  isLoading?: boolean;
  locationError?: string | null;
}

export type LocationDialogMode = 'loading' | 'denied' | 'closed' | 'prompt';

export function getDeterministicDialogMode(params: {
  locationStatus: string;
  permissionState: 'granted' | 'prompt' | 'denied' | null | undefined;
  effectiveLocation: { lat: number; lng: number } | null | undefined;
}): LocationDialogMode {
  const { locationStatus, permissionState, effectiveLocation } = params;

  // Priority 1: Active request in progress -> loading
  if (locationStatus === 'loading') {
    return 'loading';
  }

  // Priority 2: Explicitly denied permission -> denied (CACHE DOES NOT BYPASS EXPLICIT DENIAL)
  if ((permissionState as string) === 'denied' || locationStatus === 'denied') {
    return 'denied';
  }

  // Priority 3: Valid position AND permission NOT denied -> closed
  if (effectiveLocation && (locationStatus === 'ready' || locationStatus === 'resolved') && (permissionState as string) !== 'denied') {
    return 'closed';
  }

  // Priority 4: Initial/undecided state -> prompt
  return 'prompt';
}

export function LocationRequirementDialog({
  open,
  onOpenChange,
  onRetry,
  permissionState,
  isLoading: externalLoading = false,
  locationError = null,
}: LocationRequirementDialogProps) {
  const language = useLanguage();
  const isDenied = permissionState === 'denied';
  const device = detectDevice();

  const instructions = getLocationPermissionInstructions(language === 'de' ? 'de' : 'en');
  const showLoading = externalLoading;

  const handleRetryClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    console.log('[LocationDialog] location button clicked');
    console.log('[LocationDialog] permissionState', permissionState);
    console.log('[LocationDialog] locationStatus', externalLoading ? 'loading' : 'idle');

    if (showLoading) return;
    onRetry();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (val) onOpenChange(val); }}>
      <DialogContent 
        hideCloseButton={true}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-[440px] p-0 overflow-hidden border-none bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl z-50 pointer-events-auto"
      >
        <div className={`relative h-44 flex items-center justify-center overflow-hidden transition-colors ${
          isDenied 
            ? 'bg-gradient-to-br from-amber-500 to-red-600' 
            : 'bg-gradient-to-br from-emerald-400 to-blue-500'
        }`}>
          {/* Animated Background Elements */}
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

        <div className="p-6 md:p-8 text-center">
          <DialogHeader className="p-0 space-y-2">
            <DialogTitle className="text-2xl font-black text-[#0f172a] dark:text-neutral-100 tracking-tight leading-tight">
              {isDenied
                ? (language === 'de' ? 'Standortzugriff erforderlich' : 'Location Access Required')
                : (language === 'de' ? 'Wo steckst du gerade?' : 'Where are you right now?')}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-neutral-400 font-medium text-sm leading-relaxed">
              {isDenied
                ? (language === 'de'
                    ? 'Aktiva funktioniert über Aktivitäten und Menschen in deiner Nähe. Aktiviere den Standortzugriff für diese Website in deinen Browser- oder Geräteeinstellungen.'
                    : 'Aktiva relies on activities and people nearby. Enable location access for this site in your browser settings.')
                : (language === 'de'
                    ? 'Aktiva zeigt dir spannende Aktivitäten direkt in deiner Umgebung. Aktiviere deinen Standort für das volle Erlebnis!'
                    : 'Aktiva shows you exciting activities directly in your area. Enable your location for the full experience!')}
            </DialogDescription>
          </DialogHeader>

          {device.isInAppBrowser && (
            <div className="mt-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-left text-xs space-y-2">
              <p className="text-slate-700 dark:text-blue-200 text-[11px] font-medium leading-relaxed">
                {instructions.inAppWarning}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => openInExternalBrowser()}
                className="w-full h-11 rounded-xl border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-center gap-2 mt-2"
              >
                <ExternalLink className="h-4 w-4" />
                {device.isIOS
                  ? (language === 'de' ? 'In Safari öffnen' : 'Open in Safari')
                  : (language === 'de' ? 'In Chrome öffnen' : 'Open in Chrome')}
              </Button>
            </div>
          )}

          {isDenied && (
            <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-left text-xs font-semibold text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4" />
                {instructions.platformTitle}
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-700 dark:text-amber-100 text-[11px] leading-relaxed">
                {instructions.steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
              {instructions.quickTip && (
                <p className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/40 text-[10px] italic text-amber-800 dark:text-amber-300">
                  {instructions.quickTip}
                </p>
              )}
            </div>
          )}

          {locationError && isDenied && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-left text-xs font-bold text-red-700 dark:text-red-300">
              {locationError}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <Button 
              type="button"
              onClick={handleRetryClick}
              disabled={showLoading}
              className="w-full h-14 rounded-2xl bg-primary hover:opacity-90 text-white font-black text-base shadow-xl shadow-emerald-200/50 flex items-center justify-center gap-3 border-none transition-all active:scale-95 disabled:opacity-80 cursor-pointer pointer-events-auto"
            >
              {showLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{language === 'de' ? 'Standort wird geprüft …' : 'Checking location …'}</span>
                </>
              ) : isDenied ? (
                <>
                  <RefreshCw className="h-5 w-5" />
                  {language === 'de' ? 'Erneut versuchen' : 'Retry'}
                </>
              ) : (
                <>
                  <Navigation className="h-5 w-5 fill-current" />
                  {language === 'de' ? 'Standort freigeben' : 'Share location'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
