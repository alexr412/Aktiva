export interface DeviceInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isMobile: boolean;
}

export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChrome: false,
      isMobile: false,
    };
  }

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi|Tablet|Android/i.test(ua);

  // Safari detection (Safari UA contains Safari, but Chrome/CriOS also contains Safari)
  const isChrome = /CriOS|Chrome|HeadlessChrome/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !isChrome && !/Edg|OPR|Firefox/i.test(ua);

  return {
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isMobile,
  };
}

export interface PermissionInstructions {
  platformTitle: string;
  steps: string[];
  quickTip?: string;
}

export function getLocationPermissionInstructions(lang: 'de' | 'en' = 'de'): PermissionInstructions {
  const device = detectDevice();

  if (device.isIOS) {
    return {
      platformTitle: lang === 'de' ? 'Anleitung für iPhone / iPad (iOS):' : 'Instructions for iPhone / iPad (iOS):',
      steps: lang === 'de' ? [
        'Öffne die iPhone-Einstellungen.',
        'Tippe auf "Datenschutz & Sicherheit" → "Ortungsdienste".',
        'Stelle sicher, dass "Ortungsdienste" eingeschaltet sind.',
        `Wähle ${device.isChrome ? 'Chrome' : 'Safari Websites'} aus.`,
        'Stelle den Zugriff auf "Beim Verwenden der App" ein.',
        'Kehre zu Aktiva zurück und tippe unten auf "Erneut versuchen".'
      ] : [
        'Open iPhone Settings.',
        'Tap "Privacy & Security" → "Location Services".',
        'Ensure "Location Services" is turned ON.',
        `Select ${device.isChrome ? 'Chrome' : 'Safari Websites'}.`,
        'Set access to "While Using the App".',
        'Return to Aktiva and tap "Retry" below.'
      ],
      quickTip: device.isSafari
        ? (lang === 'de'
            ? 'Tipp: Du kannst in Safari auch links in der Adressleiste auf das Symbol (AA / ⚙️) → "Website-Einstellungen" → "Standort: Erlauben" tippen.'
            : 'Tip: In Safari, you can also tap the AA / ⚙️ icon in the address bar → "Page Settings" → "Location: Allow".')
        : undefined
    };
  }

  if (device.isAndroid) {
    return {
      platformTitle: lang === 'de' ? 'Anleitung für Android:' : 'Instructions for Android:',
      steps: lang === 'de' ? [
        'Öffne die Android-Einstellungen.',
        'Tippe auf "Standort" und vergewissere dich, dass er aktiviert ist.',
        'Tippe auf "App-Berechtigungen" → wähle deinen Browser (Chrome / Firefox).',
        'Stelle die Standortberechtigung auf "Zulassen".',
        'Kehre zu Aktiva zurück und tippe unten auf "Erneut versuchen".'
      ] : [
        'Open Android Settings.',
        'Tap "Location" and ensure it is enabled.',
        'Tap "App permissions" → select your browser (Chrome / Firefox).',
        'Set Location permission to "Allow".',
        'Return to Aktiva and tap "Retry" below.'
      ],
      quickTip: lang === 'de'
        ? 'Tipp: In Chrome kannst du auch auf die 3 Punkte ⁝ → "Einstellungen" → "Website-Einstellungen" → "Standort" tippen.'
        : 'Tip: In Chrome, tap ⁝ → "Settings" → "Site settings" → "Location".'
    };
  }

  // Desktop / Default Fallback
  return {
    platformTitle: lang === 'de' ? 'Anleitung für Browser am Computer:' : 'Instructions for Desktop Browser:',
    steps: lang === 'de' ? [
      'Klicke auf das Schloss-Symbol 🔒 oder Symbol links in der Adressleiste.',
      'Wähle "Website-Einstellungen" oder "Standort".',
      'Ändere die Berechtigung für Standort auf "Zulassen".',
      'Klicke unten auf "Erneut versuchen".'
    ] : [
      'Click the lock icon 🔒 or site info icon in the address bar.',
      'Select "Site settings" or "Location".',
      'Change Location permission to "Allow".',
      'Click "Retry" below.'
    ]
  };
}
