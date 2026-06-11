'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Palette, Radar, Star, ShieldBan } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PremiumUpgradeModal({ isOpen, onClose }: PremiumUpgradeModalProps) {
  const language = useLanguage();

  const handleUpgrade = () => {
    // TODO: Hier später die RevenueCat / Capacitor Purchase Logik aufrufen.
    alert(language === 'de' ? "PLATZHALTER: Hier öffnet sich später das native App Store / Google Play Fenster." : "PLACEHOLDER: This will open the native App Store / Google Play purchase sheet.");
    onClose();
  };

  const benefits = [
    { 
      icon: Palette, 
      text: language === 'de' ? 'Exklusive App-Farben (Themes)' : 'Exclusive App Themes',
      desc: language === 'de' ? 'Passe die App mit edlen Farbschemata an.' : 'Personalize your app with elegant color schemes.'
    },
    { 
      icon: Radar, 
      text: language === 'de' ? 'Erweiterter Freunde-Radar' : 'Extended Friends Radar',
      desc: language === 'de' ? 'Sieh Freunde in deiner Umgebung in Echtzeit.' : 'See friends in your area in real-time.'
    },
    { 
      icon: Star, 
      text: language === 'de' ? 'Auffälliges Premium-Badge' : 'Eye-catching Premium Badge',
      desc: language === 'de' ? 'Zeige der Community deinen Premium-Status.' : 'Show your premium status to the community.'
    },
    { 
      icon: ShieldBan, 
      text: language === 'de' ? '100% Werbefreies Erlebnis' : '100% Ad-Free Experience',
      desc: language === 'de' ? 'Genieße Aktiva ohne jegliche Unterbrechungen.' : 'Enjoy Aktiva without any interruptions.'
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border border-amber-500/30 dark:border-amber-500/20 shadow-2xl shadow-amber-500/5 overflow-hidden rounded-[2.25rem]">
        {/* Glow decorative elements */}
        <div className="absolute top-[-50px] left-[-50px] w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-[-50px] right-[-50px] w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <DialogHeader className="flex flex-col items-center text-center space-y-4 pt-6 pb-2 relative z-10">
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring */}
            <div className="absolute w-18 h-18 bg-amber-500/15 rounded-full animate-ping opacity-75" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/30 border border-amber-300/30">
              <Crown className="w-8 h-8 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]" />
            </div>
          </div>
          <div className="space-y-1">
            <DialogTitle className="text-3xl font-black tracking-tight text-slate-900 dark:text-neutral-100 font-heading">
              Aktiva <span className="bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-500 bg-clip-text text-transparent">Premium</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-amber-600/80 dark:text-amber-500/80 uppercase tracking-widest">
              {language === 'de' ? 'Hol das meiste aus deiner Zeit heraus' : 'Get the most out of your time'}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-4 relative z-10">
          {benefits.map((benefit, i) => (
            <div 
              key={i} 
              className="flex items-center gap-4 bg-slate-50/50 dark:bg-neutral-900/40 border border-slate-100/80 dark:border-neutral-800/80 rounded-2xl p-3.5 transition-all hover:scale-[1.02] hover:border-amber-500/20 hover:bg-amber-500/[0.02] duration-300 shadow-sm"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-950/40 dark:to-amber-900/40 flex items-center justify-center border border-amber-200/20">
                <benefit.icon className="w-5 h-5 text-amber-600 dark:text-amber-500" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-black text-slate-800 dark:text-neutral-200 uppercase tracking-tight">{benefit.text}</span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{benefit.desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 flex flex-col gap-3 relative z-10">
          <Button 
            onClick={handleUpgrade}
            className="w-full h-12 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-2xl shadow-lg shadow-amber-500/20 border-none transform transition-transform hover:scale-[1.02] active:scale-[0.98] duration-200"
          >
            {language === 'de' ? 'Jetzt Premium sichern — 2,99 €' : 'Get Premium Now — 2.99 €'}
          </Button>
          <p className="text-[9px] text-center text-muted-foreground uppercase tracking-widest font-black">
            {language === 'de' ? 'Monatlich kündbar. Keine Mindestlaufzeit.' : 'Billed monthly. Cancel anytime.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
