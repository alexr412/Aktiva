import { Metadata } from 'next';
import { Eye } from 'lucide-react';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Barrierefreiheit - Aktiva',
  description: 'Erklärung zur Barrierefreiheit der Aktiva App gemäß BFSG / WCAG 2.1.',
};

export default function AccessibilityPage() {
  return (
    <LegalLayout
      title="Barrierefreiheit"
      versionText="Gemäß BFSG / WCAG 2.1"
      icon={Eye}
    >
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
    </LegalLayout>
  );
}
