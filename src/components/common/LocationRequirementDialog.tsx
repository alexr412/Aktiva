import { MapPin, Navigation, Home, Loader2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { useLanguage } from '@/hooks/use-language';

interface LocationRequirementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onUseHomeLocation: () => void;
  homeCity?: string;
  isLoading?: boolean;
  onSearchManually?: () => void;
}

export function LocationRequirementDialog({
  open,
  onOpenChange,
  onRetry,
  onUseHomeLocation,
  homeCity,
  isLoading,
  onSearchManually,
}: LocationRequirementDialogProps) {
  const language = useLanguage();
  return (
    <Dialog open={open} onOpenChange={(val) => { if (val) onOpenChange(val); }}>
      <DialogContent 
        hideCloseButton={true}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-[420px] p-0 overflow-hidden border-none bg-white dark:bg-neutral-900 rounded-[2.5rem] shadow-2xl"
      >
        <div className="relative h-48 bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-10 right-10 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse delay-700" />
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-white rounded-full blur-2xl opacity-40 scale-150 animate-pulse" />
            <div className="bg-white/20 backdrop-blur-xl p-6 rounded-full border border-white/30 shadow-2xl relative">
              <MapPin className="h-16 w-16 text-white drop-shadow-lg" />
            </div>
            {/* Radar Rings */}
            <div className="absolute inset-0 border-2 border-white/40 rounded-full animate-ping scale-150 opacity-0" />
            <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-ping delay-300 scale-[2] opacity-0" />
          </div>
        </div>

        <div className="p-8 pt-10 text-center">
          <DialogHeader className="p-0 space-y-3">
            <DialogTitle className="text-3xl font-black text-[#0f172a] dark:text-neutral-100 tracking-tight leading-tight">
              {language === 'de' ? 'Wo steckst du gerade?' : 'Where are you right now?'}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-neutral-400 font-medium text-base leading-relaxed px-2">
              {language === 'de'
                ? 'Aktiva zeigt dir spannende Aktivitäten direkt in deiner Umgebung. Aktiviere deinen Standort für das volle Erlebnis!'
                : 'Aktiva shows you exciting activities directly in your area. Enable your location for the full experience!'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-10 space-y-3">
            <Button 
              onClick={onRetry}
              disabled={isLoading}
              className="w-full h-16 rounded-[1.5rem] bg-primary hover:opacity-90 text-white font-black text-lg shadow-xl shadow-emerald-200/50 flex items-center justify-center gap-3 border-none transition-all active:scale-95 disabled:opacity-80"
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Navigation className="h-5 w-5 fill-current" />
                  {language === 'de' ? 'Standort freigeben' : 'Share location'}
                </>
              )}
            </Button>
            
            {onSearchManually && (
              <Button 
                variant="ghost"
                onClick={onSearchManually}
                disabled={isLoading}
                className="w-full h-14 rounded-2xl text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Search className="h-5 w-5" />
                {language === 'de' ? 'Ort manuell suchen' : 'Search location manually'}
              </Button>
            )}

            <Button 
              variant="ghost"
              onClick={onUseHomeLocation}
              disabled={isLoading}
              className="w-full h-14 rounded-2xl text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Home className="h-5 w-5" />
              {language === 'de' ? 'Standard-Ort nutzen' : 'Use default location'}
            </Button>
          </div>
          
          <p className="mt-6 text-[11px] font-bold text-slate-300 uppercase tracking-widest">
            {language === 'de' ? 'Du kannst deinen Standort jederzeit ändern' : 'You can change your location at any time'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
