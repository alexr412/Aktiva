'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { storePendingReferralCode } from '@/lib/referral';
import { Sparkles, Users, MapPin, ArrowRight, Gift, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InviteLandingClientProps {
  code: string;
}

export default function InviteLandingClient({ code }: InviteLandingClientProps) {
  useEffect(() => {
    if (code) {
      storePendingReferralCode(code);
    }
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-emerald-500 selection:text-white">
      {/* Dynamic Background Glow Effect */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/20 rounded-full blur-[120px] pointer-events-none" />

      <main className="w-full max-w-md relative z-10 space-y-6">
        {/* Header / Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2 shadow-inner">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Activa
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <Gift className="w-3.5 h-3.5" />
            <span>Persönliche Einladung</span>
          </div>
        </div>

        {/* Hero Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-100">
              Du wurdest zu Activa eingeladen!
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Entdecke Aktivitäten, tolle Orte und neue Leute in deiner Nähe.
            </p>
          </div>

          {/* Discreet Code Badge */}
          {code && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-300 text-xs font-mono">
              <span className="text-slate-500">Einladungscode:</span>
              <span className="font-bold text-emerald-400 tracking-wider">{code}</span>
            </div>
          )}

          {/* Feature Highlights */}
          <div className="grid grid-cols-1 gap-3 pt-2 text-left text-xs font-medium text-slate-300">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/50">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <span>Spannende Orte in deiner Umgebung finden</span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/50">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <span>An spontanen Gruppen-Aktivitäten teilnehmen</span>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/50">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <span>Neue Leute & Gleichgesinnte treffen</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-3 pt-2">
            <Link href="/signup" className="block w-full">
              <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer">
                <span>Jetzt registrieren</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            <Link href="/login" className="block w-full">
              <Button variant="ghost" className="w-full h-11 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 font-semibold text-xs rounded-2xl transition-all">
                Bereits ein Konto? Anmelden
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-slate-600">
          Activa App &copy; {new Date().getFullYear()} &middot; Einladungscode automatisch im Onboarding hinterlegt.
        </p>
      </main>
    </div>
  );
}
