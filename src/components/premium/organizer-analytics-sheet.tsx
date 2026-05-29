'use client';

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { BarChart3, Eye, Bookmark, Share2, Navigation, Loader2, Lock, Sparkles } from 'lucide-react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { hasPremiumFeature } from '@/lib/types';
import { PremiumUpgradeModal } from './PremiumUpgradeModal';
import { cn } from '@/lib/utils';

interface OrganizerAnalyticsSheetProps {
  placeId: string;
  placeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrganizerAnalyticsSheet({ placeId, placeName, open, onOpenChange }: OrganizerAnalyticsSheetProps) {
  const language = useLanguage();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isUpsellOpen, setIsUpsellOpen] = useState(false);
  const [stats, setStats] = useState({
    opens: 0,
    saves: 0,
    shares: 0,
    directions: 0,
  });

  const hasAccess = hasPremiumFeature(userProfile, 'organizer_analytics');

  useEffect(() => {
    if (!open || !placeId || !hasAccess || !db) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const colRef = collection(db!, 'telemetry_interactions');
        const q = query(colRef, where('placeId', '==', placeId));
        const snap = await getDocs(q);

        let opens = 0;
        let saves = 0;
        let shares = 0;
        let directions = 0;

        snap.forEach((doc) => {
          const data = doc.data();
          const type = data.interactionType;
          if (type === 'card_open') opens++;
          else if (type === 'favorite') saves++;
          else if (type === 'share') shares++;
          else if (type === 'directions') directions++;
        });

        setStats({ opens, saves, shares, directions });
      } catch (err) {
        console.error('Error fetching telemetry stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [open, placeId, hasAccess]);

  const StatCard = ({ icon: Icon, title, value, colorClass }: { icon: any; title: string; value: number; colorClass: string }) => (
    <div className="bg-slate-50 dark:bg-neutral-800 p-5 rounded-3xl border border-slate-100 dark:border-neutral-700/50 flex flex-col justify-between h-32">
      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-2", colorClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-black text-slate-800 dark:text-neutral-200">{value}</p>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-neutral-500 mt-0.5">{title}</p>
      </div>
    </div>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[75vh] sm:h-[60vh] rounded-t-[2.5rem] border-none p-6 dark:bg-neutral-900 shadow-2xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-black text-xl flex items-center gap-2 text-slate-800 dark:text-neutral-200">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
              {language === 'de' ? 'Organizer Performance' : 'Organizer Performance'}
            </SheetTitle>
            <SheetDescription className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {placeName}
            </SheetDescription>
          </SheetHeader>

          {!hasAccess ? (
            <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto space-y-6">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-5 rounded-full relative">
                <Lock className="h-12 w-12 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-black uppercase tracking-tight text-slate-800 dark:text-neutral-200">
                  {language === 'de' ? 'Organizer-Statistiken gesperrt' : 'Organizer Stats Locked'}
                </h3>
                <p className="text-xs font-semibold text-slate-400 leading-relaxed">
                  {language === 'de' 
                    ? 'Hol dir Aktiva Premium, um Klicks, Aufrufe, geteilte Links und Routenanfragen für deine Spots zu analysieren.' 
                    : 'Unlock Aktiva Premium to analyze opens, favorites, shares, and navigation clicks for your spots.'}
                </p>
              </div>
              <button
                onClick={() => setIsUpsellOpen(true)}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl text-left text-white shadow-xl shadow-amber-500/20 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-xl text-white">
                    <Sparkles className="h-4 w-4 fill-white/10" />
                  </div>
                  <div>
                    <p className="font-black text-xs uppercase tracking-tight">Aktiva Premium aktivieren</p>
                    <p className="text-[10px] text-white/80 font-bold">Jetzt freischalten und sofort wachsen</p>
                  </div>
                </div>
                <Lock className="h-4 w-4 text-white shrink-0" />
              </button>
            </div>
          ) : loading ? (
            <div className="flex h-48 w-full items-center justify-center">
              <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <StatCard
                icon={Eye}
                title={language === 'de' ? 'Aufrufe' : 'Opens'}
                value={stats.opens}
                colorClass="bg-blue-500/10 text-blue-500"
              />
              <StatCard
                icon={Bookmark}
                title={language === 'de' ? 'Gespeichert' : 'Saves'}
                value={stats.saves}
                colorClass="bg-rose-500/10 text-rose-500"
              />
              <StatCard
                icon={Share2}
                title={language === 'de' ? 'Geteilt' : 'Shares'}
                value={stats.shares}
                colorClass="bg-purple-500/10 text-purple-500"
              />
              <StatCard
                icon={Navigation}
                title={language === 'de' ? 'Routen' : 'Directions'}
                value={stats.directions}
                colorClass="bg-emerald-500/10 text-emerald-500"
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <PremiumUpgradeModal
        isOpen={isUpsellOpen}
        onClose={() => setIsUpsellOpen(false)}
      />
    </>
  );
}
