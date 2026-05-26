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
    { icon: Palette, text: language === 'de' ? 'Exklusive App-Farben (Themes)' : 'Exclusive App Themes' },
    { icon: Radar, text: language === 'de' ? 'Erweiterter Freunde-Radar' : 'Extended Friends Radar' },
    { icon: Star, text: language === 'de' ? 'Auffälliges Premium-Badge' : 'Eye-catching Premium Badge' },
    { icon: ShieldBan, text: language === 'de' ? '100% Werbefreies Erlebnis' : '100% Ad-Free Experience' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-amber-500/20 shadow-2xl shadow-amber-500/10">
        <DialogHeader className="flex flex-col items-center text-center space-y-3 pt-6 pb-2">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center shadow-inner">
            <Crown className="w-8 h-8 text-amber-500" />
          </div>
          <DialogTitle className="text-2xl font-black text-foreground">
            Aktvia <span className="text-amber-500">Premium</span>
          </DialogTitle>
          <DialogDescription className="text-sm font-medium">
            {language === 'de' ? 'Hol das meiste aus deiner Zeit heraus.' : 'Get the most out of your time.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 px-4">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <benefit.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-bold">{benefit.text}</span>
            </div>
          ))}
        </div>

        <div className="pt-4 flex flex-col gap-3">
          <Button 
            disabled
            className="w-full h-12 text-xs font-black uppercase tracking-widest bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-0 opacity-60 cursor-not-allowed"
          >
            {language === 'de' ? 'Bald verfügbar' : 'Soon available'}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold">
            {language === 'de' ? 'Abo jederzeit in den App-Einstellungen kündbar.' : 'Cancel anytime in your app settings.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
