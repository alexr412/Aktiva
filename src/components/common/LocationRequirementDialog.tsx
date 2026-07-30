import React, { useState } from 'react';
import { MapPin, Navigation, Loader2, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';
import { getLocationPermissionInstructions } from '@/lib/device-detection';

interface LocationRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => Promise<boolean> | void;
  permissionState?: 'granted' | 'prompt' | 'denied' | null;
  isLoading?: boolean;
  locationError?: string | null;
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
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFeedbackError, setRetryFeedbackError] = useState<string | null>(null);

  const instructions = getLocationPermissionInstructions(language === 'de' ? 'de' : 'en');
  const showLoading = externalLoading || isRetrying;

  const handleRetryClick = async () => {
    if (showLoading) return;
    setIsRetrying(true);
    setRetryFeedbackError(null);
    try {
      const res = await onRetry();
      if (res === false) {
        setRetryFeedbackError(
          locationError || (
            language === 'de'
              ? 'Der Standortzugriff ist weiterhin deaktiviert. Ändere die Berechtigung in deinen Geräte- oder Browser-Einstellungen.'
              : 'Location access remains disabled. Please update your device or browser settings.'
          )
        );
      }
    } catch (err: any) {
      setRetryFeedbackError(err.message || 'Error checking location');
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (val) onOpenChange(val); }}>
      <DialogContent 
        hideCloseButton={true}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-[440px] p-0 overflow-hidden border-none bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl"
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

          {(retryFeedbackError || locationError) && isDenied && (
            <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-left text-xs font-bold text-red-700 dark:text-red-300">
              {retryFeedbackError || locationError}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <Button 
              onClick={handleRetryClick}
              disabled={showLoading}
              className="w-full h-14 rounded-2xl bg-primary hover:opacity-90 text-white font-black text-base shadow-xl shadow-emerald-200/50 flex items-center justify-center gap-3 border-none transition-all active:scale-95 disabled:opacity-80"
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
