import { Metadata } from 'next';
import { FileText, Info } from 'lucide-react';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Impressum - Aktiva',
  description: 'Impressum und Anbieterkennzeichnung für die Aktiva App gemäß § 5 TMG.',
};

export default function ImprintPage() {
  return (
    <LegalLayout
      title="Impressum"
      versionText="Angaben gemäß § 5 TMG"
      icon={FileText}
    >
      <section className="space-y-2">
        <h3 className="text-slate-900 dark:text-white font-black uppercase text-xs tracking-widest mb-2">Diensteanbieter</h3>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
          Alexander Rötz<br />
          Prioreier Straße 4<br />
          58091 Hagen<br />
          Deutschland
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-slate-900 dark:text-white font-black uppercase text-xs tracking-widest mb-2">Kontakt</h3>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
          E-Mail: roetzbusiness@gmail.com
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-slate-900 dark:text-white font-black uppercase text-xs tracking-widest mb-2">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h3>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
          Alexander Rötz<br />
          Prioreier Straße 4<br />
          58091 Hagen
        </p>
      </section>

      <div className="pt-8 border-t border-slate-200 dark:border-neutral-800 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-[10px] leading-relaxed italic text-slate-400 dark:text-slate-500 font-bold">
          Haftungsausschluss: Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
        </p>
      </div>
    </LegalLayout>
  );
}
