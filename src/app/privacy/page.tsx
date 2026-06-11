import { Metadata } from 'next';
import { Shield } from 'lucide-react';
import { LegalLayout } from '@/components/legal/LegalLayout';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung - Aktiva',
  description: 'Datenschutzerklärung und Informationen zur Datenverarbeitung für die Aktiva App.',
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Datenschutzerklärung"
      versionText="Global Safety Standard • Stand 08.05.2026"
      icon={Shield}
    >
      <p>Deine Privatsphäre ist unser höchstes Gut. Diese Erklärung informiert über die Verarbeitung personenbezogener Daten in der App Aktiva.</p>
      
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
    </LegalLayout>
  );
}
