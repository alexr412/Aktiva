'use client';

import React from 'react';

// Helper components for Legal Dialogs
interface LegalSectionProps {
  title: string;
  children: React.ReactNode;
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
        {title}
      </h3>
      <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function LegalPlaceholderNotice() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
      Hinweis: Betreiber- und Kontaktdaten müssen vor Veröffentlichung ergänzt und rechtlich geprüft werden.
      <br />
      <span className="opacity-75">Notice: Operator and contact details must be completed and legally reviewed before publication.</span>
    </div>
  );
}

interface LegalAlertProps {
  children: React.ReactNode;
}

export function LegalAlert({ children }: LegalAlertProps) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[11px] font-bold text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
      {children}
    </div>
  );
}

interface TextProps {
  language: 'de' | 'en';
}

export function AGBText({ language }: TextProps) {
  return language === 'de' ? (
    <>
      <LegalSection title="1. Geltungsbereich">
        <p>Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung der Aktiva-App und aller damit verbundenen Dienste. Mit der Registrierung akzeptiert der Nutzer diese Bedingungen.</p>
      </LegalSection>
      <LegalSection title="2. Anbieter / Vertragspartner">
        <p>Der Dienst wird bereitgestellt von: [Betreiber einfügen], [Adresse einfügen], E-Mail: [E-Mail einfügen].</p>
      </LegalSection>
      <LegalSection title="3. Leistungsbeschreibung von Aktiva">
        <p>Aktiva ist eine Plattform zur Organisation von Freizeitaktivitäten, Entdeckung von Veranstaltungsorten, Erstellung von Profilen sowie zum Austausch innerhalb der Community.</p>
      </LegalSection>
      <LegalSection title="4. Registrierung und Nutzerkonto">
        <p>Die Erstellung eines Nutzerkontos erfordert wahrheitsgemäße Angaben. Die Nutzung ist ab einem Mindestalter von 12 Jahren gestattet. Jeder Nutzer darf nur ein einziges aktives Profil führen.</p>
      </LegalSection>
      <LegalSection title="5. Verifizierung und Sicherheit">
        <p>Aktiva bietet Verifizierungsprozesse an, um die Sicherheit zu erhöhen. Die Weitergabe von Zugangsdaten an Dritte ist untersagt. Der Nutzer haftet für Aktivitäten über sein Konto.</p>
      </LegalSection>
      <LegalSection title="6. Nutzerpflichten">
        <p>Nutzer verpflichten sich zur respektvollen Interaktion. Belästigungen, Spam, automatisierte Datenabfragen (Scraping) sowie missbräuchliche Nutzung sind streng untersagt.</p>
      </LegalSection>
      <LegalSection title="7. Inhalte, Bewertungen, Fotos und Profilangaben">
        <p>Nutzer tragen die alleinige Verantwortung für hochgeladene Inhalte. Das Veröffentlichen von illegalen, pornografischen oder Rechte Dritter verletzenden Inhalten ist untersagt und wird moderiert.</p>
      </LegalSection>
      <LegalSection title="8. Verfügbarkeit und technische Änderungen">
        <p>Aktiva übernimmt keine Garantie für eine dauerhafte, unterbrechungsfreie Verfügbarkeit des Dienstes. Technische Anpassungen und Wartungen können jederzeit durchgeführt werden.</p>
      </LegalSection>
      <LegalSection title="9. Kostenpflichtige Funktionen">
        <p>Die Grundnutzung der App ist kostenlos. Sollten zukünftig kostenpflichtige Funktionen oder Premium-Mitgliedschaften eingeführt werden, werden diese gesondert gekennzeichnet.</p>
      </LegalSection>
      <LegalSection title="10. Haftung">
        <p>Aktiva haftet nur für eigene Systemfehler im Rahmen der gesetzlichen Bestimmungen, nicht jedoch für Vorfälle, Verletzungen oder Schäden, die bei physischen Treffen oder Freizeitaktivitäten der Nutzer entstehen. Die Teilnahme erfolgt auf eigene Gefahr.</p>
      </LegalSection>
      <LegalSection title="11. Sperrung und Kündigung">
        <p>Bei Verstößen gegen diese AGB behält sich Aktiva das Recht vor, Konten temporär zu sperren oder dauerhaft zu löschen. Die Kündigung des Kontos durch den Nutzer ist jederzeit in den Einstellungen möglich.</p>
      </LegalSection>
      <LegalSection title="12. Änderungen der AGB">
        <p>Aktiva behält sich vor, diese AGB mit angemessener Ankündigungsfrist zu ändern. Die geänderten Bedingungen werden dem Nutzer in der App zur Zustimmung vorgelegt.</p>
      </LegalSection>
      <LegalSection title="13. Schlussbestimmungen">
        <p>Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>
      </LegalSection>
      <LegalSection title="14. Kontakt">
        <p>Für Fragen zu diesen AGB wenden Sie sich bitte an: [E-Mail einfügen].</p>
      </LegalSection>
      <LegalSection title="Stand">
        <p>Stand: [Stand einfügen] • Version 2.2</p>
      </LegalSection>
    </>
  ) : (
    <>
      <LegalSection title="1. Scope">
        <p>These Terms of Service (ToS) govern the use of the Aktiva app and all associated services. By registering, the user accepts these terms.</p>
      </LegalSection>
      <LegalSection title="2. Provider / Contracting Party">
        <p>The service is provided by: [Insert Operator], [Insert Address], Email: [Insert Email].</p>
      </LegalSection>
      <LegalSection title="3. Description of Aktiva">
        <p>Aktiva is a platform for organizing leisure activities, discovering event venues, creating user profiles, and communicating within the community.</p>
      </LegalSection>
      <LegalSection title="4. Registration and User Account">
        <p>Registering an account requires accurate information. The service is permitted for users aged 12 and above. Each user may hold only one active profile.</p>
      </LegalSection>
      <LegalSection title="5. Verification and Security">
        <p>Aktiva provides verification features to enhance community safety. Sharing account credentials with third parties is prohibited. The user is responsible for activities on their account.</p>
      </LegalSection>
      <LegalSection title="6. User Obligations">
        <p>Users agree to interact respectfully. Harassment, spam, automated data extraction (scraping), and misuse of the platform are strictly prohibited.</p>
      </LegalSection>
      <LegalSection title="7. Content, Ratings, Photos and Profile Information">
        <p>Users are solely responsible for their uploaded content. Illegal, pornographic, or copyright-infringing material is prohibited and will be moderated.</p>
      </LegalSection>
      <LegalSection title="8. Availability and Technical Changes">
        <p>Aktiva does not guarantee permanent, uninterrupted availability of the service. Technical maintenance and updates may occur at any time.</p>
      </LegalSection>
      <LegalSection title="9. Paid Features">
        <p>The basic use of the app is free of charge. If paid features or premium plans are introduced in the future, they will be explicitly labeled.</p>
      </LegalSection>
      <LegalSection title="10. Liability">
        <p>Aktiva is liable only for its own system failures as required by law, not for any incidents, injuries, or damages arising during physical meetings or activities organized via the platform. Participation is at your own risk.</p>
      </LegalSection>
      <LegalSection title="11. Suspension and Termination">
        <p>In case of violations of these ToS, Aktiva reserves the right to temporarily suspend or permanently delete user accounts. Users may delete their account at any time in the settings.</p>
      </LegalSection>
      <LegalSection title="12. Changes to these Terms">
        <p>Aktiva reserves the right to modify these ToS. Users will be prompted to accept updated terms inside the app.</p>
      </LegalSection>
      <LegalSection title="13. Final Provisions">
        <p>These terms are governed by the laws of the Federal Republic of Germany. If any provision is found invalid, the remaining provisions shall remain in full force.</p>
      </LegalSection>
      <LegalSection title="14. Contact">
        <p>For questions regarding these Terms, contact: [Insert Email].</p>
      </LegalSection>
      <LegalSection title="Last Updated">
        <p>Last Updated: [Insert Date] • Version 2.2</p>
      </LegalSection>
    </>
  );
}

export function TermsOfUseText({ language }: TextProps) {
  return language === 'de' ? (
    <>
      <LegalSection title="1. Zweck der Nutzungsbedingungen">
        <p>Diese Richtlinien beschreiben die Verhaltensregeln, um die Sicherheit und Integrität unserer aktiven Freizeit-Community zu gewährleisten.</p>
      </LegalSection>
      <LegalSection title="2. Zulässige Nutzung">
        <p>Die Plattform darf ausschließlich zur Planung und Teilnahme an Freizeitaktivitäten und zum Knüpfen sozialer Kontakte im privaten Rahmen genutzt werden.</p>
      </LegalSection>
      <LegalSection title="3. Verbotene Nutzung">
        <p>Untersagt sind Spamming, Belästigungen aller Art, Diskriminierung, Betrug, das Erstellen gefälschter Profile, das Ausspionieren von Nutzerdaten (Scraping), automatisierte oder Roboter-Nutzung sowie jede gewerbliche Nutzung ohne vorherige schriftliche Zustimmung.</p>
      </LegalSection>
      <LegalSection title="4. Community-Regeln">
        <p>Respekt, Höflichkeit und Toleranz sind die Grundpfeiler von Aktiva. Wir tolerieren keinerlei Gewaltverherrlichung, Hassrede, Belästigung oder Mobbing.</p>
      </LegalSection>
      <LegalSection title="5. Profilangaben und Echtheit">
        <p>Nutzer sind angehalten, echte Namen und zutreffende persönliche Angaben zu machen. Die Nutzung von Pseudonymen ist gestattet, darf aber nicht zur Täuschung oder Täuschungsabsicht dienen.</p>
      </LegalSection>
      <LegalSection title="6. Fotos, Avatare und hochgeladene Inhalte">
        <p>Profilbilder und Aktivitätsfotos dürfen keine Rechte Dritter verletzen. Insbesondere dürfen keine Urheberrechte verletzt, obszöne oder unangemessene Darstellungen verwendet werden.</p>
      </LegalSection>
      <LegalSection title="7. Bewertungen, Empfehlungen und Ortsinformationen">
        <p>Bewertungen von Locations und Aktivitäten müssen sachlich, konstruktiv und wahrheitsgemäß sein. Gezielte Manipulationen (z.B. Fake-Bewertungen) sind untersagt.</p>
      </LegalSection>
      <LegalSection title="8. Umgang mit anderen Nutzern">
        <LegalAlert>
          Treffen im realen Leben sollten stets an öffentlichen Orten stattfinden. Aktiva empfiehlt, bei ersten Begegnungen Vorsicht walten zu lassen.
        </LegalAlert>
      </LegalSection>
      <LegalSection title="9. Sicherheit, Missbrauch und Meldefunktionen">
        <p>Nutzer können Verstöße, verdächtige Konten oder unangemessene Inhalte jederzeit über die In-App-Meldefunktion melden. Aktiva prüft Meldungen zügig und ergreift entsprechende Maßnahmen.</p>
      </LegalSection>
      <LegalSection title="10. Konsequenzen bei Verstößen">
        <p>Bei Missachtung der Regeln können Inhalte entfernt, Warnungen ausgesprochen oder temporäre und permanente Kontosperrungen verhängt werden.</p>
      </LegalSection>
      <LegalSection title="11. Keine Beratung">
        <p>Informationen zu Orten, Wegbeschreibungen, Aktivitäten oder gesundheitlichen Empfehlungen auf Aktiva stellen keine medizinische, rechtliche oder sicherheitsbezogene Beratung dar. Ortsangaben können fehlerhaft oder veraltet sein und müssen eigenverantwortlich geprüft werden. Aktiva übernimmt keine Garantie für die Qualität, Sicherheit oder Verfügbarkeit eines Ortes.</p>
      </LegalSection>
      <LegalSection title="12. Änderungen der Nutzungsregeln">
        <p>Aktiva behält sich vor, diese Bedingungen anzupassen. Die Nutzer werden über Änderungen in Kenntnis gesetzt.</p>
      </LegalSection>
      <LegalSection title="13. Kontakt">
        <p>Bei Fragen oder Missbrauchsmeldungen kontaktieren Sie uns unter [E-Mail einfügen].</p>
      </LegalSection>
      <LegalSection title="Stand">
        <p>Stand: [Stand einfügen] • Version 2.2</p>
      </LegalSection>
    </>
  ) : (
    <>
      <LegalSection title="1. Purpose of Terms of Use">
        <p>These guidelines describe the code of conduct required to ensure the safety and integrity of our active leisure community.</p>
      </LegalSection>
      <LegalSection title="2. Permitted Use">
        <p>The platform may only be used to plan and participate in leisure activities and to build social connections in a private context.</p>
      </LegalSection>
      <LegalSection title="3. Prohibited Use">
        <p>Spamming, any form of harassment, discrimination, fraud, creating fake profiles, data mining/scraping, automated/bot usage, and unauthorized commercial use are strictly prohibited.</p>
      </LegalSection>
      <LegalSection title="4. Community Rules">
        <p>Respect, politeness, and tolerance are the core values of Aktiva. We do not tolerate any form of hate speech, violence, harassment, or bullying.</p>
      </LegalSection>
      <LegalSection title="5. Profile Details and Authenticity">
        <p>Users are encouraged to provide accurate names and details. Pseudonyms are permitted but must not be used to deceive others.</p>
      </LegalSection>
      <LegalSection title="6. Photos, Avatars, and Uploaded Content">
        <p>Profile photos and activity images must not infringe on third-party rights, copyrights, or contain inappropriate or obscene depictions.</p>
      </LegalSection>
      <LegalSection title="7. Ratings, Recommendations, and Venue Info">
        <p>Ratings for locations and activities must be objective, constructive, and truthful. Manipulative practices (e.g., fake reviews) are prohibited.</p>
      </LegalSection>
      <LegalSection title="8. Interaction with Other Users">
        <LegalAlert>
          Real-life meetups should always take place in public areas. Aktiva recommends exercising caution during initial meetings.
        </LegalAlert>
      </LegalSection>
      <LegalSection title="9. Safety, Abuse, and Reporting">
        <p>Users can report violations, suspicious accounts, or inappropriate content at any time using the in-app report tools. Aktiva reviews reports promptly.</p>
      </LegalSection>
      <LegalSection title="10. Consequences of Violations">
        <p>Violations may result in content removal, warnings, or temporary/permanent account suspension.</p>
      </LegalSection>
      <LegalSection title="11. No Advice">
        <p>Information about locations, routes, or activities does not constitute medical, legal, or safety advice. Location data might be incorrect or outdated and must be verified independently. Aktiva does not guarantee safety, quality, or availability of any venue.</p>
      </LegalSection>
      <LegalSection title="12. Changes to these Rules">
        <p>Aktiva reserves the right to modify these guidelines. Users will be informed of updates.</p>
      </LegalSection>
      <LegalSection title="13. Contact">
        <p>For questions or abuse reports, please contact: [Insert Email].</p>
      </LegalSection>
      <LegalSection title="Last Updated">
        <p>Last Updated: [Insert Date] • Version 2.2</p>
      </LegalSection>
    </>
  );
}

export function PrivacyPolicyText({ language }: TextProps) {
  return language === 'de' ? (
    <>
      <LegalSection title="1. Responsibilities">
        <p>Der Verantwortliche im Sinne der DSGVO ist: [Betreiber einfügen], [Adresse einfügen], E-Mail: [E-Mail einfügen].</p>
      </LegalSection>
      <LegalSection title="2. Datenschutzkontakt">
        <p>Für datenschutzrechtliche Anfragen wenden Sie sich bitte an: [Datenschutzkontakt einfügen].</p>
      </LegalSection>
      <LegalSection title="3. Welche Daten verarbeitet werden">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Konto- und Profildaten:</strong> E-Mail, vollständiger Name, Geburtsdatum, gewählter Username.</li>
          <li><strong>Login- und Authentifizierungsdaten:</strong> Firebase Auth-IDs, Token bei Registrierung über Google/Apple.</li>
          <li><strong>Verifizierungsstatus:</strong> Information darüber, ob ein Account verifiziert ist (ohne Ausweisdaten dauerhaft zu speichern).</li>
          <li><strong>Freiwillige Profilangaben:</strong> Profilbeschreibung, Hobbys, hochgeladene Profilfotos oder selbstgewählte Avatare.</li>
          <li><strong>Standort- oder Umkreisdaten:</strong> Sofern Sie die GPS-Funktion aktivieren, verarbeiten wir Standortdaten zur Anzeige von Aktivitäten in Ihrer Nähe.</li>
          <li><strong>Nutzungs- und Gerätedaten:</strong> IP-Adresse, Geräte-ID, Betriebssystem, App-Nutzungsprotokolle.</li>
          <li><strong>Kommunikations- und Supportdaten:</strong> Support-Anfragen, Chat-Nachrichten innerhalb der App (zur Zustellung).</li>
        </ul>
      </LegalSection>
      <LegalSection title="4. Zwecke der Verarbeitung">
        <p>Zur Bereitstellung der App-Funktionen, Nutzerauthentifizierung, Standortempfehlungen, In-App-Kommunikation (Chat), Systemsicherheit, Missbrauchserkennung und Kundensupport.</p>
      </LegalSection>
      <LegalSection title="5. Rechtsgrundlagen nach Art. 6 DSGVO">
        <ul className="list-disc space-y-1 pl-5">
          <li>Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung zur App-Nutzung).</li>
          <li>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung für Standortdaten).</li>
          <li>Art. 6 Abs. 1 lit. f DSGVO (Berechtigtes Interesse an Systemsicherheit und Missbrauchsbekämpfung).</li>
        </ul>
      </LegalSection>
      <LegalSection title="6. Registrierung über Google oder Apple">
        <p>Nutzen Sie Google/Apple Sign-In, erhalten wir Authentifizierungstoken und verknüpfte Basisdaten (wie E-Mail-Adresse). Ihr Google-Profilbild wird bei der Registrierung nicht automatisch übernommen (Sie können stattdessen Avatare wählen oder ein Bild hochladen).</p>
      </LegalSection>
      <LegalSection title="7. Speicherung in Firebase / Cloud-Diensten">
        <p>Ihre Daten werden verschlüsselt auf Google Firebase-Servern und Cloud-Diensten (z.B. Vercel) verarbeitet. Soweit möglich, werden europäische Server-Standorte bevorzugt.</p>
      </LegalSection>
      <LegalSection title="8. E-Mail-Verifizierung">
        <p>Wir nutzen Firebase Authentication, um Verifizierungs-E-Mails zu versenden, um Spam-Konten zu verhindern.</p>
      </LegalSection>
      <LegalSection title="9. Standort- und Aktivitätsempfehlungen">
        <p>Standortdaten werden nur mit Ihrer ausdrücklichen Einwilligung verarbeitet und nicht für Bewegungsprofile gespeichert.</p>
      </LegalSection>
      <LegalSection title="10. Cookies und ähnliche Technologien">
        <p>Wir nutzen technisch notwendige Cookies, Local Storage und Session-Werte zur Login-Aufrechterhaltung und Spracheinstellung (Details in der Cookie-Richtlinie).</p>
      </LegalSection>
      <LegalSection title="11. Empfänger und Auftragsverarbeiter">
        <p>Dienstleister (z.B. Google Firebase, Hosting-Anbieter) verarbeiten Ihre Daten weisungsgebunden auf Basis von Auftragsverarbeitungsverträgen (AVV).</p>
      </LegalSection>
      <LegalSection title="12. Internationale Datenübermittlung">
        <p>Sofern Daten außerhalb der EU/des EWR verarbeitet werden, stellen wir ein angemessenes Datenschutzniveau über Standardvertragsklauseln (SCC) der EU-Kommission sicher.</p>
      </LegalSection>
      <LegalSection title="13. Speicherdauer">
        <p>Daten werden gelöscht, sobald der Zweck entfällt oder Sie Ihr Konto löschen, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</p>
      </LegalSection>
      <LegalSection title="14. Rechte der betroffenen Personen">
        <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch.</p>
      </LegalSection>
      <LegalSection title="15. Widerruf von Einwilligungen">
        <p>Sie können Einwilligungen (z.B. GPS-Zugriff) jederzeit in den Geräteeinstellungen widerrufen.</p>
      </LegalSection>
      <LegalSection title="16. Beschwerderecht bei einer Aufsichtsbehörde">
        <p>Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.</p>
      </LegalSection>
      <LegalSection title="17. Pflicht zur Bereitstellung bestimmter Daten">
        <p>Die Angabe von E-Mail, Name, Geburtstag und Username ist für den Vertragsschluss zwingend erforderlich.</p>
      </LegalSection>
      <LegalSection title="18. Automatisierte Entscheidungsfindung">
        <p>Es findet keine automatisierte Entscheidungsfindung oder Profiling im Sinne des Art. 22 DSGVO statt.</p>
      </LegalSection>
      <LegalSection title="19. Minderjährige">
        <p>Der Dienst ist für Personen ab 12 Jahren freigegeben. Wir erheben nicht wissentlich Daten von jüngeren Kindern.</p>
      </LegalSection>
      <LegalSection title="20. Cookies und ähnliche Technologien">
        <p>Aktiva behält sich vor, diese Erklärung anzupassen. Der aktuelle Stand wird stets in der App angezeigt.</p>
      </LegalSection>
      <LegalSection title="21. Kontakt">
        <p>Bei datenschutzrechtlichen Fragen wenden Sie sich bitte an: [Datenschutzkontakt einfügen].</p>
      </LegalSection>
      <LegalSection title="Stand">
        <p>Stand: [Stand einfügen] • Version 2.2</p>
      </LegalSection>
    </>
  ) : (
    <>
      <LegalSection title="1. Controller">
        <p>The data controller under GDPR is: [Insert Operator], [Insert Address], Email: [Insert Email].</p>
      </LegalSection>
      <LegalSection title="2. Privacy Contact">
        <p>For privacy inquiries, please contact: [Insert Privacy Contact].</p>
      </LegalSection>
      <LegalSection title="3. Data We Process">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Account and Profile Data:</strong> Email, full name, date of birth, username.</li>
          <li><strong>Login and Authentication:</strong> Firebase Auth IDs, tokens for Google/Apple sign-in.</li>
          <li><strong>Verification Status:</strong> Information whether an account is verified.</li>
          <li><strong>Optional Profile Info:</strong> Biography, hobbies, uploaded profile photos, or selected default avatars.</li>
          <li><strong>Location and Proximity Data:</strong> If GPS is enabled, we process location coordinates to suggest nearby activities.</li>
          <li><strong>Usage and Device Data:</strong> IP address, device ID, operating system, and usage logs.</li>
          <li><strong>Communication and Support Data:</strong> Support requests, in-app chat messages.</li>
        </ul>
      </LegalSection>
      <LegalSection title="4. Purposes of Processing">
        <p>Providing app features, authentication, location recommendations, chat delivery, security, fraud prevention, and support.</p>
      </LegalSection>
      <LegalSection title="5. Legal Bases under Art. 6 GDPR">
        <ul className="list-disc space-y-1 pl-5">
          <li>Art. 6(1)(b) GDPR (performance of contract).</li>
          <li>Art. 6(1)(a) GDPR (consent for GPS tracking).</li>
          <li>Art. 6(1)(f) GDPR (legitimate interest in platform security).</li>
        </ul>
      </LegalSection>
      <LegalSection title="6. Registration via Google or Apple">
        <p>If using social sign-in, we retrieve authentication tokens and basic details. Google profile pictures are not automatically saved.</p>
      </LegalSection>
      <LegalSection title="7. Storage in Firebase / Cloud Services">
        <p>Data is securely stored using Google Firebase and cloud hosting (e.g., Vercel), preferably within EU-based datacenters.</p>
      </LegalSection>
      <LegalSection title="8. Email Verification">
        <p>We use Firebase Authentication to dispatch verification messages.</p>
      </LegalSection>
      <LegalSection title="9. Location and Activity Recommendations">
        <p>GPS data is processed only with your permission and is not used to build persistent movement profiles.</p>
      </LegalSection>
      <LegalSection title="10. Cookies and Similar Technologies">
        <p>We use necessary session cookies and Local Storage to maintain logins and save language settings.</p>
      </LegalSection>
      <LegalSection title="11. Recipients and Processors">
        <p>Service providers (e.g., Google Firebase, hosting) process data on our behalf under strict Data Processing Agreements (DPA).</p>
      </LegalSection>
      <LegalSection title="12. International Data Transfers">
        <p>For transfers outside the EU/EEA, safeguards like Standard Contractual Clauses (SCC) are applied.</p>
      </LegalSection>
      <LegalSection title="13. Retention Periods">
        <p>Data is deleted when the collection purpose is fulfilled or when the user account is deleted, subject to legal storage requirements.</p>
      </LegalSection>
      <LegalSection title="14. Data Subject Rights">
        <p>You have the right to access, correct, delete, restrict, transfer, and object to processing of your personal data.</p>
      </LegalSection>
      <LegalSection title="15. Withdrawal of Consent">
        <p>You can revoke permissions (e.g., GPS access) at any time via your device settings.</p>
      </LegalSection>
      <LegalSection title="16. Right to Lodge a Complaint">
        <p>You have the right to complain to a competent data protection authority.</p>
      </LegalSection>
      <LegalSection title="17. Requirement to Provide Certain Data">
        <p>Providing an email, name, birthday, and username is required to enter into the user contract.</p>
      </LegalSection>
      <LegalSection title="18. Automated Decision-Making">
        <p>No automated decision-making or profiling under Art. 22 GDPR is performed.</p>
      </LegalSection>
      <LegalSection title="19. Minors">
        <p>The service is permitted for users aged 12 and above. We do not knowingly collect data from younger children.</p>
      </LegalSection>
      <LegalSection title="20. Changes to this Privacy Policy">
        <p>We reserve the right to modify this policy. The current version will always be available in the app.</p>
      </LegalSection>
      <LegalSection title="21. Contact">
        <p>For any questions, contact: [Insert Privacy Contact].</p>
      </LegalSection>
      <LegalSection title="Last Updated">
        <p>Last Updated: [Insert Date] • Version 2.2</p>
      </LegalSection>
    </>
  );
}

export function CookiePolicyText({ language }: TextProps) {
  return language === 'de' ? (
    <>
      <LegalSection title="1. Was sind Cookies und ähnliche Technologien?">
        <p>Cookies sind kleine Textdateien, die auf Ihrem Endgerät gespeichert werden. Wir nutzen auch LocalStorage und SessionStorage für eine optimale App-Performance.</p>
      </LegalSection>
      <LegalSection title="2. Welche Technologien Aktiva verwenden kann">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Technisch notwendige Cookies:</strong> Zur Authentifizierung (Firebase Auth Session) und Systemsicherheit.</li>
          <li><strong>Lokale Speicherung (LocalStorage):</strong> Speichern Ihrer Sprachauswahl (Language Preference) und Cache-Daten für schnellere Ladezeiten.</li>
          <li><strong>Session Storage:</strong> Speichern von Sitzungsparametern zur Gewährleistung der Navigation.</li>
          <li><strong>Authentifizierungs- und Sicherheitsmechanismen:</strong> Tokens zur sicheren Identifizierung von Benutzern.</li>
          <li><strong>Präferenzspeicherung:</strong> Speicherung benutzerspezifischer Einstellungen.</li>
          <li><strong>Analyse- oder Performance-Technologien:</strong> Aktiva kann künftig Analyse- oder Performance-Technologien einsetzen, sofern dies rechtlich erforderlich nur mit Einwilligung geschieht. Derzeit nicht aktiv.</li>
        </ul>
      </LegalSection>
      <LegalSection title="3. Zwecke der Verwendung">
        <p>Ausschließlich zur technischen Bereitstellung der App-Funktionalitäten (z.B. dauerhafter Login) und Sicherung des Benutzerkontos.</p>
      </LegalSection>
      <LegalSection title="4. Rechtsgrundlagen">
        <p>Die Speicherung beruht auf § 25 Abs. 2 Nr. 2 TDDDG (früher TTDSG), da diese Technologien zwingend erforderlich sind, um den vom Nutzer ausdrücklich gewünschten Telemediendienst bereitzustellen. Unter der DSGVO ist die Rechtsgrundlage unser berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) an einem sicheren und reibungslosen Betrieb.</p>
      </LegalSection>
      <LegalSection title="5. Technisch notwendige Technologien">
        <p>Diese notwendigen Technologien für Login, Sicherheit und Session-Verwaltung können nicht deaktiviert werden, da die App sonst nicht nutzbar wäre.</p>
      </LegalSection>
      <LegalSection title="6. Optionale Technologien">
        <p>Derzeit verwendet Aktiva keine optionalen Tracking- oder Werbe-Cookies von Drittanbietern. Sollten solche künftig integriert werden, geschieht dies nur nach aktiver Einwilligung.</p>
      </LegalSection>
      <LegalSection title="7. Einwilligung und Widerruf">
        <p>Da nur notwendige Cookies verwendet werden, ist kein vorgeschalteter Cookie-Banner nötig. Sie können Cookies in den Einstellungen Ihres Webbrowsers blockieren, was jedoch die Funktionalität beeinträchtigen kann.</p>
      </LegalSection>
      <LegalSection title="8. Drittanbieter-Technologien">
        <p>Für Authentifizierungszwecke verwenden wir Google Firebase Authentication. Es werden keine unautorisierten Drittanbieter-Tracker geladen.</p>
      </LegalSection>
      <LegalSection title="9. Speicherdauer">
        <p>Session-Cookies werden beim Schließen gelöscht. LocalStorage-Werte bleiben gespeichert, bis Sie den Browser-Cache leeren oder Ihr Konto löschen.</p>
      </LegalSection>
      <LegalSection title="10. Änderungen dieser Cookie-Richtlinie">
        <p>Wir passen diese Cookie-Richtlinie an, wenn sich unsere genutzten Technologien ändern.</p>
      </LegalSection>
      <LegalSection title="11. Kontakt">
        <p>Bei Fragen wenden Sie sich bitte an: [E-Mail einfügen].</p>
      </LegalSection>
      <LegalSection title="Stand">
        <p>Stand: [Stand einfügen] • Version 2.2</p>
      </LegalSection>
    </>
  ) : (
    <>
      <LegalSection title="1. What are Cookies and Similar Technologies?">
        <p>Cookies are small text files stored on your device. We also utilize LocalStorage and SessionStorage to optimize app performance.</p>
      </LegalSection>
      <LegalSection title="2. Technologies Aktiva May Use">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Strictly Necessary Cookies:</strong> Used for user authentication (Firebase Auth session) and security.</li>
          <li><strong>Local Storage (LocalStorage):</strong> Used to store language preferences and cache details for faster loading.</li>
          <li><strong>Session Storage:</strong> Storing session parameters to ensure correct navigation flow.</li>
          <li><strong>Authentication and Security:</strong> Token storage for safe user identification.</li>
          <li><strong>Preference Storage:</strong> Saving user-specific app layout preferences.</li>
          <li><strong>Analysis or Performance Technologies:</strong> Aktiva may use analytical technologies in the future, subject to consent. Currently inactive.</li>
        </ul>
      </LegalSection>
      <LegalSection title="3. Purposes of Use">
        <p>Solely to provide the core technical functionalities of the app (e.g., keeping you logged in) and secure your account.</p>
      </LegalSection>
      <LegalSection title="4. Legal Bases">
        <p>In Germany, the storage is based on Sec. 25(2) No. 2 TDDDG (formerly TTDSG), as these technologies are strictly necessary to deliver the service explicitly requested by the user. Under GDPR, the legal basis is Art. 6(1)(f) (legitimate interest) to ensure secure operation.</p>
      </LegalSection>
      <LegalSection title="5. Strictly Necessary Technologies">
        <p>These essential technologies for login, security, and session management are mandatory and cannot be disabled without breaking the app.</p>
      </LegalSection>
      <LegalSection title="6. Optionale Technologies">
        <p>Currently, Aktiva does not use any marketing or tracking cookies from third-party advertising networks. If any are added in the future, they will only be activated with your prior consent.</p>
      </LegalSection>
      <LegalSection title="7. Consent and Control">
        <p>Since only necessary cookies are used, no cookie consent banner is legally required. You can manage or disable cookies via your browser settings, though some features may fail.</p>
      </LegalSection>
      <LegalSection title="8. Third-Party Technologies">
        <p>For authentication purposes, we use Google Firebase Authentication. No unauthorized third-party trackers are loaded.</p>
      </LegalSection>
      <LegalSection title="9. Retention Periods">
        <p>Session cookies are deleted upon closing. LocalStorage values persist until you clear your browser cache or delete your account.</p>
      </LegalSection>
      <LegalSection title="10. Changes to this Cookie Policy">
        <p>We modify this policy to reflect any changes to the technologies we use.</p>
      </LegalSection>
      <LegalSection title="11. Contact">
        <p>For questions, contact: [Insert Email].</p>
      </LegalSection>
      <LegalSection title="Last Updated">
        <p>Last Updated: [Insert Date] • Version 2.2</p>
      </LegalSection>
    </>
  );
}
