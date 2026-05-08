'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/hooks/use-language';

export default function AccessibilityPage() {
  const router = useRouter();
  const language = useLanguage();

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-y-auto pb-32">
      <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background px-4 shrink-0">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft />
        </Button>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Eye className="h-6 w-6 text-primary shrink-0" />
          <span className="truncate">{language === 'de' ? 'Barrierefreiheit' : 'Accessibility'}</span>
        </h1>
      </header>

      <div className="p-4 md:p-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="p-8 bg-slate-50 dark:bg-neutral-900 rounded-[2rem] border-none">
            <div className="flex gap-4 mb-6">
               <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-primary" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Erklärung zur Barrierefreiheit</h2>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Gemäß BFSG / WCAG 2.1</p>
               </div>
            </div>
            
            <div className="prose prose-slate dark:prose-invert max-w-none space-y-8 text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
              <section className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">Stand der Vereinbarkeit</h3>
                <p>Teilweise vereinbar mit BFSG / WCAG 2.1 Stufe AA.</p>
              </section>

              <section className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">Bekannte Einschränkungen</h3>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li>Eingeschränkte Navigation der Karten für Screenreader.</li>
                  <li>Fokusverlust bei dynamischen Overlays.</li>
                  <li>Fehlende Echtzeit-Ansage bei Formularvalidierungen.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">Feedback</h3>
                <p>Meldung von Barrieren an: roetzbusiness@gmail.com</p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
