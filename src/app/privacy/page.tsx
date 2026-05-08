'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

export default function PrivacyPage() {
  const router = useRouter();
  const language = useLanguage();

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-y-auto pb-32">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background px-4 shrink-0">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Shield className="h-6 w-6 text-primary shrink-0" />
          <span className="truncate">{language === 'de' ? 'Datenschutzerklärung' : 'Privacy Policy'}</span>
        </h1>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="p-8 bg-slate-50 dark:bg-neutral-900 rounded-[2.5rem] border-none">
            <div className="flex gap-4 mb-6">
               <div className="w-12 h-12 rounded-2xl bg-[#10b981]/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-[#10b981]" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Datenschutzerklärung</h2>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Global Safety Standard • Stand 05.05.2026</p>
               </div>
            </div>
            
            <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              <p>Deine Privatsphäre ist unser höchstes Gut. Diese Erklärung informiert über die Verarbeitung personenbezogener Daten in der App Aktvia.</p>
              
              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">1. Verantwortlicher</h3>
                <p>Alexander Rötz, E-Mail: roetzbusiness@gmail.com (vollständige Anschrift siehe Impressum).</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">2. Erfasste Datenpunkte & Zweck</h3>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong>Identitätsdaten:</strong> Name, E-Mail-Adresse, Profilfoto (Zweck: Authentifizierung via Firebase).</li>
                  <li><strong>Profildaten:</strong> Benutzername, Bio, Alter, Geschlecht, Interessen, "Social Battery" (Zweck: Personalisierung).</li>
                  <li><strong>Standortdaten:</strong> Präzise GPS-Koordinaten (Zweck: Ermittlung lokaler Aktivitäten via Geoapify).</li>
                  <li><strong>Soziale Daten:</strong> Chat-Nachrichten, Freundesliste, Aktivitätsteilnahmen (Zweck: In-App-Interaktion).</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">3. Drittanbieter-Technologien</h3>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li><strong>Google Firebase:</strong> Hosting der Datenbanken (Firestore) und Authentifizierung. Datenstandort: Primär EU (Frankfurt).</li>
                  <li><strong>Geoapify:</strong> Kartenmaterial und Geokodierung.</li>
                  <li><strong>Vercel Inc.:</strong> Hosting der API und Web-Komponenten.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">4. Rechtsgrundlage</h3>
                <p>Die Verarbeitung erfolgt auf Basis von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. a DSGVO (Einwilligung bei Standortdaten).</p>
              </div>

              <div className="pt-8 border-t border-slate-200 dark:border-neutral-800 flex items-center justify-between">
                 <div className="flex items-center gap-3 text-[#10b981] font-black text-[10px] uppercase tracking-widest">
                  <Lock className="w-4 h-4" />
                  <span>Version 2.2 • Stand 08.05.2026</span>
                </div>
              </div>
            </div>
          </div>

          <footer className="text-center pb-12">
            <Button 
              onClick={() => router.back()}
              className="h-14 px-12 rounded-full bg-[#10b981] hover:bg-emerald-600 text-white font-black uppercase tracking-widest transition-all active:scale-[0.98]"
            >
              Akzeptieren
            </Button>
          </footer>
        </div>
      </div>
    </div>
  );
}
