import { Metadata } from 'next';
import { RotateCcw } from 'lucide-react';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Widerrufsbelehrung - Aktiva',
  description: 'Widerrufsrecht und Widerrufsbelehrung für digitale Inhalte der Aktiva App.',
};

export default function CancellationPage() {
  return (
    <LegalLayout
      title="Widerrufsbelehrung"
      versionText="Stand 08.05.2026"
      icon={RotateCcw}
    >
      <section className="space-y-4">
        <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">Widerrufsrecht</h3>
        <p>Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>
      </section>

      <section className="space-y-4">
        <h3 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-wider">Erlöschen des Widerrufsrechts</h3>
        <p>Bei digitalen Inhalten erlischt das Widerrufsrecht vorzeitig, sobald mit der Ausführung des Vertrags (z. B. Bereitstellung von Premium-Features) begonnen wurde und du deine ausdrückliche Zustimmung sowie Kenntnisnahme vom Verlust des Widerrufsrechts bestätigt hast.</p>
      </section>
    </LegalLayout>
  );
}
