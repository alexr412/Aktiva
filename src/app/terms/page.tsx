import { Metadata } from 'next';
import { Gavel } from 'lucide-react';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Nutzungsbedingungen - Aktiva',
  description: 'Nutzungsbedingungen und AGB für die Aktiva App.',
};

export default function TermsPage() {
  return (
    <LegalLayout
      title="Nutzungsbedingungen"
      versionText="Version 2.2 • Stand 08.05.2026"
      icon={Gavel}
    >
      <div className="space-y-4">
        <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">§ 1 Gegenstand</h3>
        <p>Aktiva vernetzt Nutzer für reale Freizeitaktivitäten. Die App bietet Funktionen zur Ortssuche, Aktivitätserstellung und Kommunikation.</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">§ 2 Zulassung</h3>
        <p>Das Mindestalter für die Nutzung beträgt 12 Jahre. Mit der Registrierung wird die Einhaltung des Mindestalters zugesichert.</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">§ 3 Nutzergenerierte Inhalte (UGC)</h3>
        <p>Hassrede, Gewalt, Pornografie und illegale Inhalte sind untersagt. Aktiva moderiert Inhalte; Verstöße führen zur Entfernung innerhalb von 24 Stunden und zur Accountsperrung.</p>
      </div>

      <div className="space-y-4">
        <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">§ 4 Haftung</h3>
        <p>Aktiva haftet nicht für Vorfälle bei physischen Treffen. Die Teilnahme an Aktivitäten erfolgt auf eigene Gefahr.</p>
      </div>
    </LegalLayout>
  );
}
