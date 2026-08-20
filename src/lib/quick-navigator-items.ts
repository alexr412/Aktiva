import {
  Home,
  Compass,
  MapPinned,
  MessageSquare,
  Users,
  Wallet,
  User,
  Settings,
  Shield,
  FileText,
  Sparkles,
  Info,
  Terminal,
  Code,
  AlertTriangle,
  ExternalLink,
  Lock,
  UserCheck,
  KeyRound,
  FileCode,
  Globe,
  Grid,
  Calendar,
  QrCode,
  BarChart3,
  Heart,
  UserX,
  Scale
} from 'lucide-react';

export interface QuickNavItem {
  label: string;
  path: string;
  description?: string;
  icon: any;
  category: 'core' | 'activities' | 'admin' | 'auth' | 'legal';
  requiresAdmin?: boolean;
  isMock?: boolean;
}

export const ALL_QUICK_NAV_ITEMS: QuickNavItem[] = [
  // --- Core App ---
  { label: 'Startseite (Feed)', path: '/', description: 'Haupt-Feed mit Aktivitäten & Spots', icon: Home, category: 'core' },
  { label: 'Entdecken', path: '/explore', description: 'Empfehlungen & Kategorien', icon: Compass, category: 'core' },
  { label: 'Karte', path: '/map', description: 'Interaktive Spot- & Event-Karte', icon: MapPinned, category: 'core' },
  { label: 'Chats & Räume', path: '/chat', description: 'Übersicht aktiver Chatgruppen', icon: MessageSquare, category: 'core' },
  { label: 'Favoriten & Sammlungen', path: '/favorites', description: 'Gespeicherte Lieblingsorte', icon: Heart, category: 'core' },
  { label: 'Wallet & Token-Shop', path: '/wallet', description: 'Guthaben & Transaktionen', icon: Wallet, category: 'core' },
  { label: 'Mein Profil', path: '/profile', description: 'Nutzerprofil & eigene Events', icon: User, category: 'core' },
  { label: 'Profil bearbeiten', path: '/profile/edit', description: 'Stammdaten & Foto anpassen', icon: UserCheck, category: 'core' },
  { label: 'Einstellungen', path: '/settings', description: 'App- & Konto-Einstellungen', icon: Settings, category: 'core' },
  { label: 'Gesperrte Nutzer', path: '/settings/blocked', description: 'Blacklist & Stummschaltungen', icon: UserX, category: 'core' },
  { label: 'Spracheinstellungen', path: '/settings/language', description: 'Sprachauswahl (DE/EN)', icon: Globe, category: 'core' },
  { label: 'Rechtliche Infos', path: '/settings/legal', description: 'Rechtliches in Einstellungen', icon: Info, category: 'core' },

  // --- Aktivitäten & Mocks ---
  { label: 'Aktivität Detail (Mock)', path: '/activities/mock-activity-id', description: 'Detailansicht eines Treffens', icon: Calendar, category: 'activities', isMock: true },
  { label: 'Aktivität Einladung (Mock)', path: '/activities/mock-activity-id/invite', description: 'Einladungslink zur Aktivität', icon: ExternalLink, category: 'activities', isMock: true },
  { label: 'Check-In Scanner (Mock)', path: '/activities/mock-activity-id/scanner', description: 'QR-Scanner für Verifizierung', icon: QrCode, category: 'activities', isMock: true },
  { label: 'Host Statistiken (Mock)', path: '/activities/mock-activity-id/stats', description: 'Event-Analytics & Teilnehmer', icon: BarChart3, category: 'activities', isMock: true },
  { label: 'Einladung Landing (Mock)', path: '/activity/mock-activity-id/invite', description: 'Landingpage für Event-Invites', icon: ExternalLink, category: 'activities', isMock: true },
  { label: 'Buchungs-Checkout (Mock)', path: '/checkout/mock-activity-id', description: 'Bezahlabwicklung für Paid Events', icon: Wallet, category: 'activities', isMock: true },
  { label: 'Chatraum Unterhaltung (Mock)', path: '/chat/mock-chat-room', description: 'Gruppenchat-Ansicht', icon: MessageSquare, category: 'activities', isMock: true },
  { label: 'Öffentliches Profil (Mock)', path: '/users/mock-user-id', description: 'Profilansicht anderer Nutzer', icon: User, category: 'activities', isMock: true },

  // --- Admin & Dev ---
  { label: 'Quick Navigator (Vollbild)', path: '/quick-navigator', description: 'Gesamtübersicht aller Seiten als eigene Seite', icon: Grid, category: 'admin' },
  { label: 'Admin Dashboard', path: '/admin', description: 'Zentrale Admin-Steuerung', icon: Shield, category: 'admin', requiresAdmin: true },
  { label: 'Nutzerverwaltung', path: '/admin/users', description: 'User-Moderation & Konten', icon: Users, category: 'admin', requiresAdmin: true },
  { label: 'Meldungen & Berichte', path: '/admin/reports', description: 'Gemeldete Inhalte & Konflikte', icon: FileText, category: 'admin', requiresAdmin: true },
  { label: 'Auszahlungen', path: '/admin/payouts', description: 'Host-Auszahlungsanträge', icon: Wallet, category: 'admin', requiresAdmin: true },
  { label: 'Rückerstattungen', path: '/admin/refunds', description: 'Refunds & Stornierungen', icon: AlertTriangle, category: 'admin', requiresAdmin: true },
  { label: 'Developer Debug Panel', path: '/debug', description: 'System-Diagnostics & Flags', icon: Terminal, category: 'admin' },
  { label: 'Testumgebung (Sandbox)', path: '/test', description: 'Komponenten-Testlabor', icon: Code, category: 'admin' },

  // --- Auth & Flow ---
  { label: 'Login / Anmeldung', path: '/login', description: 'Konto-Anmeldeseite', icon: Lock, category: 'auth' },
  { label: 'Registrieren', path: '/signup', description: 'Neues Konto erstellen', icon: UserCheck, category: 'auth' },
  { label: 'Onboarding (Profilsetup)', path: '/onboarding', description: 'Ersteinrichtung nach Reg.', icon: Sparkles, category: 'auth' },
  { label: 'Passwort zurücksetzen', path: '/reset-password', description: 'Passwort-Wiederherstellung', icon: KeyRound, category: 'auth' },
  { label: 'Auth Actions', path: '/auth/action', description: 'Firebase Verifizierungs-Handler', icon: Lock, category: 'auth' },
  { label: 'Einladungscode Landing (Mock)', path: '/invite/mock-code', description: 'Einladungslink Landingpage', icon: ExternalLink, category: 'auth', isMock: true },

  // --- Rechtliches ---
  { label: 'Datenschutzerklärung', path: '/privacy', description: 'Datenschutz & DS-GVO Infos', icon: FileCode, category: 'legal' },
  { label: 'Allgemeine Geschäftsbedingungen', path: '/terms', description: 'Nutzungsbedingungen & AGB', icon: Scale, category: 'legal' },
  { label: 'Impressum', path: '/imprint', description: 'Anbieterkennzeichnung', icon: Info, category: 'legal' },
  { label: 'Kündigungs-Informationen', path: '/cancellation', description: 'Widerrufs- & Kündigungsrecht', icon: FileText, category: 'legal' },
  { label: 'Barrierefreiheit', path: '/accessibility', description: 'Erklärung zur Barrierefreiheit', icon: Globe, category: 'legal' },
  { label: 'Lizenzen & Open Source', path: '/licenses', description: 'Drittanbieter-Softwarelizenzen', icon: Code, category: 'legal' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  all: 'Alle',
  core: 'Core App',
  activities: 'Aktivitäten & Mocks',
  admin: 'Admin & Dev',
  auth: 'Auth',
  legal: 'Rechtliches',
};

export const GROUP_TITLES: Record<string, string> = {
  core: 'Hauptanwendung',
  activities: 'Aktivitäten & Dynamic Mocks',
  admin: 'Administration & Debug',
  auth: 'Login & Registrierung',
  legal: 'Rechtliches & Information',
};
