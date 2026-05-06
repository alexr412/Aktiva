'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Lock, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

export default function PrivacyPage() {
  const router = useRouter();
  const language = useLanguage();

  return (
    <main className="min-h-screen w-full bg-white dark:bg-neutral-950 p-6 md:p-12 antialiased">
      <div className="max-w-3xl mx-auto">
        <header className="mb-12 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()}
            className="rounded-full hover:bg-slate-100"
          >
            <ArrowLeft className="w-6 h-6 text-slate-900" />
          </Button>
          <div className="text-right">
             <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Privacy</h1>
             <p className="text-[10px] font-black text-[#10b981] uppercase tracking-widest mt-1">Aktvia Protection</p>
          </div>
        </header>

        <section className="space-y-12">
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
            
            <div className="prose prose-slate dark:prose-invert max-w-none space-y-6 text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              <p>Deine Privatsphäre ist unser höchstes Gut. Hier erfährst du, wie wir deine Daten bei Aktvia schützen.</p>
              
              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">1. Datenerhebung</h3>
                <p>Wir erheben nur Daten, die für die Funktion der App notwendig sind: E-Mail, Name, Geburtsdatum und Standort (nur bei aktiver Nutzung), um dir Aktivitäten in deiner Nähe anzuzeigen.</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">2. Standortsicherheit</h3>
                <p>Dein genauer Standort wird niemals ohne deine explizite Zustimmung mit anderen geteilt. In der App werden nur ungefähre Entfernungen angezeigt, um deine Privatsphäre zu wahren.</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">3. Datenweitergabe</h3>
                <p>Aktvia verkauft niemals deine persönlichen Daten an Dritte. Daten werden nur geteilt, wenn es für die Erbringung unserer Dienste (z.B. Hosting, Authentifizierung über Firebase) notwendig ist.</p>
              </div>

              <div className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">4. Deine Rechte</h3>
                <p>Du hast jederzeit das Recht auf Auskunft, Korrektur oder Löschung deiner Daten. In den Profileinstellungen kannst du dein gesamtes Konto inklusive aller Daten restlos löschen.</p>
              </div>

              <div className="pt-8 border-t border-slate-200 dark:border-neutral-800">
                <div className="flex items-center gap-3 text-[#10b981] font-black text-xs uppercase tracking-widest">
                  <Lock className="w-4 h-4" />
                  <span>End-to-End Encryption for Chats coming soon</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-12 text-center pb-12">
           <Button 
             onClick={() => router.back()}
             className="h-14 px-12 rounded-full bg-[#10b981] hover:bg-emerald-600 text-white font-black uppercase tracking-widest transition-all active:scale-[0.98]"
           >
              Akzeptieren
           </Button>
        </footer>
      </div>
    </main>
  );
}
