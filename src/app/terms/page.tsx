'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

export default function TermsPage() {
  const router = useRouter();
  const language = useLanguage();

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-y-auto pb-32">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background px-4 shrink-0">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <FileText className="h-6 w-6 text-primary shrink-0" />
          <span className="truncate">{language === 'de' ? 'Nutzungsbedingungen' : 'Terms of Service'}</span>
        </h1>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="p-8 bg-slate-50 dark:bg-neutral-900 rounded-[2.5rem] border-none">
            <div className="flex gap-4 mb-6">
               <div className="w-12 h-12 rounded-2xl bg-[#10b981]/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-[#10b981]" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Allgemeine Geschäftsbedingungen</h2>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Version 2.0 • Stand 05.05.2026</p>
               </div>
            </div>
            
            <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">§ 1 Gegenstand</h3>
                <p>Aktvia vernetzt Nutzer für reale Freizeitaktivitäten. Die App bietet Funktionen zur Ortssuche, Aktivitätserstellung und Kommunikation.</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">§ 2 Zulassung</h3>
                <p>Das Mindestalter für die Nutzung beträgt 12 Jahre. Mit der Registrierung wird die Einhaltung des Mindestalters zugesichert.</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">§ 3 Nutzergenerierte Inhalte (UGC)</h3>
                <p>Hassrede, Gewalt, Pornografie und illegale Inhalte sind untersagt. Aktvia moderiert Inhalte; Verstöße führen zur Entfernung innerhalb von 24 Stunden und zur Accountsperrung.</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">§ 4 Haftung</h3>
                <p>Aktvia haftet nicht für Vorfälle bei physischen Treffen. Die Teilnahme an Aktivitäten erfolgt auf eigene Gefahr.</p>
              </div>

              <div className="pt-8 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Version 2.2 • Stand 08.05.2026</p>
                <div className="flex gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-50" />
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-20" />
                </div>
              </div>
            </div>
          </div>

          <footer className="text-center pb-12">
            <Button 
              onClick={() => router.back()}
              className="h-14 px-12 rounded-full bg-[#10b981] hover:bg-emerald-600 text-white font-black uppercase tracking-widest transition-all active:scale-[0.98]"
            >
              Verstanden
            </Button>
          </footer>
        </div>
      </div>
    </div>
  );
}
