'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

export default function CancellationPage() {
  const router = useRouter();
  const language = useLanguage();

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-y-auto pb-32">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background px-4 shrink-0">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <RotateCcw className="h-6 w-6 text-primary shrink-0" />
          <span className="truncate">{language === 'de' ? 'Widerrufsbelehrung' : 'Cancellation Policy'}</span>
        </h1>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="p-8 bg-slate-50 dark:bg-neutral-900 rounded-[2rem] border-none">
            <div className="flex gap-4 mb-6">
               <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <RotateCcw className="w-6 h-6 text-primary" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Widerrufsrecht</h2>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Stand 05.05.2026</p>
               </div>
            </div>
            
            <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              <section className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">Widerrufsrecht</h3>
                <p>Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>
              </section>

              <section className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">Erlöschen des Widerrufsrechts</h3>
                <p>Bei digitalen Inhalten erlischt das Widerrufsrecht vorzeitig, sobald mit der Ausführung des Vertrags (z. B. Bereitstellung von Premium-Features) begonnen wurde und du deine ausdrückliche Zustimmung sowie Kenntnisnahme vom Verlust des Widerrufsrechts bestätigt hast.</p>
              </section>
              
              <div className="pt-8 border-t border-slate-200 dark:border-neutral-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Version 2.2 • Stand 08.05.2026</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
