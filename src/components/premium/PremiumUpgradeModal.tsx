'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Zap, Building2, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { RevenueCatService } from '@/lib/revenuecat-service';

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PremiumUpgradeModal({ isOpen, onClose }: PremiumUpgradeModalProps) {
  const language = useLanguage();
  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedTier, setSelectedTier] = useState<'tier1' | 'tier2' | 'tier3'>('tier2');

  const handleUpgrade = async () => {
    await RevenueCatService.purchaseTier(selectedTier, isAnnual);
    onClose();
  };

  const tiers = [
    {
      id: 'tier1' as const,
      name: 'Premium',
      icon: Crown,
      badgeColor: 'from-amber-400 to-amber-600',
      borderColor: 'border-amber-400/40',
      monthlyPrice: '4,99 €',
      annualPrice: '50,88 €',
      effectiveMonthly: '4,24 €',
      discountTag: '-15%',
      benefits: language === 'de' ? [
        'Bis zu 8 Personen pro Event',
        '30 km Radar-Umkreis',
        '100% Werbefrei & Premium Badge',
        '5 Favoriten-Sammlungen',
        '10 KI-Anfragen / Monat',
        'Profilbesucher & Inkognito-Modus'
      ] : [
        'Up to 8 participants per event',
        '30 km radar radius',
        '100% Ad-Free & Premium Badge',
        '5 Favorite Collections',
        '10 AI Requests / Month',
        'Profile Visitors & Incognito'
      ]
    },
    {
      id: 'tier2' as const,
      name: 'Pro',
      popular: true,
      icon: Zap,
      badgeColor: 'from-emerald-400 to-teal-600',
      borderColor: 'border-emerald-500',
      monthlyPrice: '7,99 €',
      annualPrice: '71,88 €',
      effectiveMonthly: '5,99 €',
      discountTag: '-25%',
      benefits: language === 'de' ? [
        'Bis zu 12 Personen pro Event',
        '50 km Radar-Umkreis',
        '2x Activity Boost Tokens / Monat',
        'Priority Join bei Anfragen',
        '15 Favoriten-Sammlungen',
        '30 KI-Anfragen / Monat',
        'Co-Hosts & Custom Event-Banner'
      ] : [
        'Up to 12 participants per event',
        '50 km radar radius',
        '2x Activity Boost Tokens / Month',
        'Priority Join for requests',
        '15 Favorite Collections',
        '30 AI Requests / Month',
        'Co-Hosts & Custom Banners'
      ]
    },
    {
      id: 'tier3' as const,
      name: 'Organizer',
      icon: Building2,
      badgeColor: 'from-indigo-500 to-purple-600',
      borderColor: 'border-indigo-500/40',
      monthlyPrice: '19,99 €',
      annualPrice: '160,68 €',
      effectiveMonthly: '13,39 €',
      discountTag: '-33%',
      benefits: language === 'de' ? [
        'Bis zu 50 Personen pro Event',
        '100 km Radar-Umkreis',
        '5x Activity Boost Tokens / Monat',
        'Veranstalter-Analytics & Dashboard',
        'Serien-Events & Passwort-Links',
        '60 KI-Anfragen / Monat',
        'Wartelisten-Management'
      ] : [
        'Up to 50 participants per event',
        '100 km radar radius',
        '5x Activity Boost Tokens / Month',
        'Organizer Analytics & Dashboard',
        'Recurring Events & Passcode Links',
        '60 AI Requests / Month',
        'Waitlist Management'
      ]
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border border-amber-500/30 dark:border-amber-500/20 shadow-2xl overflow-hidden rounded-[2.25rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-col items-center text-center space-y-3 pt-4 pb-1 relative z-10">
          <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-neutral-100">
            Activa <span className="bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-500 bg-clip-text text-transparent">Premium & Pro</span>
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {language === 'de' ? 'Wähle den passenden Tarif für dich' : 'Choose the perfect tier for you'}
          </DialogDescription>

          {/* Billing Switcher Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-neutral-900 p-1.5 rounded-full border border-slate-200 dark:border-neutral-800 mt-2">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-1.5 text-xs font-black rounded-full transition-all ${
                !isAnnual
                  ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 shadow-sm'
                  : 'text-neutral-500 hover:text-slate-800 dark:hover:text-neutral-300'
              }`}
            >
              {language === 'de' ? 'Monatlich' : 'Monthly'}
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-1.5 text-xs font-black rounded-full transition-all flex items-center gap-1.5 ${
                isAnnual
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-slate-800 dark:hover:text-neutral-300'
              }`}
            >
              <span>{language === 'de' ? 'Jährlich' : 'Annual'}</span>
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                {language === 'de' ? 'Bis zu -33%' : 'Up to -33%'}
              </span>
            </button>
          </div>
        </DialogHeader>

        {/* Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-3 relative z-10">
          {tiers.map((t) => {
            const isSelected = selectedTier === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTier(t.id)}
                className={`relative flex flex-col justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? `${t.borderColor} bg-amber-500/[0.04] dark:bg-amber-500/[0.08] shadow-md scale-[1.02]`
                    : 'border-slate-100 dark:border-neutral-800/80 bg-slate-50/50 dark:bg-neutral-900/30 hover:border-slate-300 dark:hover:border-neutral-700'
                }`}
              >
                {t.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-sm">
                    {language === 'de' ? 'Bestseller' : 'Popular'}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${t.badgeColor} flex items-center justify-center text-white shadow-sm`}>
                      <t.icon className="w-4 h-4" />
                    </div>
                    <span className="font-black text-sm text-slate-800 dark:text-neutral-200">{t.name}</span>
                  </div>

                  <div className="my-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-slate-900 dark:text-neutral-100">
                        {isAnnual ? t.effectiveMonthly : t.monthlyPrice}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-bold">
                        {language === 'de' ? '/Monat' : '/month'}
                      </span>
                    </div>
                    {isAnnual && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                        {t.annualPrice} {language === 'de' ? '/Jahr' : '/year'} ({t.discountTag})
                      </p>
                    )}
                  </div>

                  <ul className="space-y-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-neutral-800">
                    {t.benefits.map((b, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-neutral-300 leading-tight">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="pt-2 flex flex-col gap-2 relative z-10">
          <Button
            onClick={handleUpgrade}
            className="w-full h-12 text-xs font-black uppercase tracking-widest bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white rounded-2xl shadow-lg shadow-amber-500/20 border-none transform transition-transform hover:scale-[1.01] active:scale-[0.99] duration-200"
          >
            {language === 'de'
              ? `Jetzt ${tiers.find(t => t.id === selectedTier)?.name} sichern`
              : `Get ${tiers.find(t => t.id === selectedTier)?.name} Now`}
          </Button>
          <p className="text-[9px] text-center text-muted-foreground uppercase tracking-widest font-black">
            {language === 'de' ? 'Jederzeit kündbar. Sichere Abrechnung über App Store / Play Store / Stripe.' : 'Cancel anytime. Secure checkout via App Store / Play Store / Stripe.'}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
