export interface DeviceInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  isMobile: boolean;
  isInAppBrowser: boolean;
  inAppBrowserName?: string;
}

export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChrome: false,
      isMobile: false,
      isInAppBrowser: false,
    };
  }

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi|Tablet|Android/i.test(ua);

  // In-App Browser detection (WhatsApp, Instagram, Facebook, LinkedIn, LINE, Telegram, etc.)
  const isWhatsApp = /WhatsApp/i.test(ua);
  const isInstagram = /Instagram/i.test(ua);
  const isFacebook = /FBAN|FBAV/i.test(ua);
  const isLinkedIn = /LinkedInApp/i.test(ua);
  const isTelegram = /Telegram/i.test(ua);
  const isLine = /Line\//i.test(ua);
  
  const isInAppBrowser = isWhatsApp || isInstagram || isFacebook || isLinkedIn || isTelegram || isLine || /MicroMessenger|Snapchat|Twitter/i.test(ua);

  let inAppBrowserName = undefined;
  if (isWhatsApp) inAppBrowserName = 'WhatsApp';
  else if (isInstagram) inAppBrowserName = 'Instagram';
  else if (isFacebook) inAppBrowserName = 'Facebook';
  else if (isLinkedIn) inAppBrowserName = 'LinkedIn';
  else if (isTelegram) inAppBrowserName = 'Telegram';
  else if (isLine) inAppBrowserName = 'LINE';

  // Safari detection (Safari UA contains Safari, but Chrome/CriOS also contains Safari)
  const isChrome = /CriOS|Chrome|HeadlessChrome/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !isChrome && !/Edg|OPR|Firefox/i.test(ua);

  return {
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    isMobile,
    isInAppBrowser,
    inAppBrowserName,
  };
}

export function openInExternalBrowser(): void {
  if (typeof window === 'undefined') return;
  const device = detectDevice();
  const currentUrl = window.location.href;

  if (device.isAndroid) {
    // Android Intent to force open in Google Chrome
    const cleanUrl = currentUrl.replace(/^https?:\/\//, '');
    const intentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end;`;
    window.location.href = intentUrl;
  } else {
    // iOS Safari or default fallback
    window.open(currentUrl, '_system');
  }
}

export interface PermissionInstructions {
  platformTitle: string;
  steps: string[];
  quickTip?: string;
  inAppWarning?: string;
}

export function getLocationPermissionInstructions(lang: 'de' | 'en' = 'de'): PermissionInstructions {
  const device = detectDevice();

  let inAppWarning: string | undefined = undefined;
  if (device.isInAppBrowser) {
    const appName = device.inAppBrowserName || (lang === 'de' ? 'dieser App' : 'this app');
    inAppWarning = lang === 'de'
      ? `Du nutzt Aktiva innerhalb von ${appName}. Die Standortfreigabe funktioniert in externen Browsern (Safari / Chrome) am zuverlässigsten.`
      : `You are using Aktiva inside ${appName}. Location access works best in native browsers (Safari / Chrome).`;
  }

  if (device.isIOS) {
    return {
      platformTitle: lang === 'de' ? 'Anleitung für iPhone / iPad (iOS):' : 'Instructions for iPhone / iPad (iOS):',
      steps: lang === 'de' ? [
        'Öffne die iPhone-Einstellungen.',
        'Tippe auf "Datenschutz & Sicherheit" → "Ortungsdienste".',
        'Stelle sicher, dass "Ortungsdienste" eingeschaltet sind.',
        `Wähle ${device.isChrome ? 'Chrome' : 'Safari Websites'} aus.`,
        'Stelle den Zugriff auf "Beim Verwenden der App" ein.',
        'Kehre anschließend zu Aktiva zurück und tippe erneut auf "Standort freigeben".'
      ] : [
        'Open iPhone Settings.',
        'Tap "Privacy & Security" → "Location Services".',
        'Ensure "Location Services" is turned ON.',
        `Select ${device.isChrome ? 'Chrome' : 'Safari Websites'}.`,
        'Set access to "While Using the App".',
        'Return to Aktiva and tap "Share location" again.'
      ],
      quickTip: device.isSafari
        ? (lang === 'de'
            ? 'Tipp: Du kannst in Safari auch links in der Adressleiste auf das Symbol (AA / ⚙️) → "Website-Einstellungen" → "Standort: Erlauben" tippen.'
            : 'Tip: In Safari, you can also tap the AA / ⚙️ icon in the address bar → "Page Settings" → "Location: Allow".')
        : undefined,
      inAppWarning,
    };
  }

  if (device.isAndroid) {
    return {
      platformTitle: lang === 'de' ? 'Anleitung für Android:' : 'Instructions for Android:',
      steps: lang === 'de' ? [
        'Öffne die Website-Einstellungen deines Browsers (z. B. Chrome ⁝ → Einstellungen → Website-Einstellungen → Standort).',
        'Stelle den Standortzugriff für diese Website auf "Zulassen".',
        'Prüfe außerdem in den Android-Einstellungen ("Standort"), ob die Standortdienste deines Geräts aktiviert sind.',
        'Kehre zu Aktiva zurück und tippe erneut auf "Standort freigeben".'
      ] : [
        'Open your browser site settings (e.g. Chrome ⁝ → Settings → Site settings → Location).',
        'Set Location permission for this site to "Allow".',
        'Also check Android Settings ("Location") to ensure device Location Services are enabled.',
        'Return to Aktiva and tap "Share location" again.'
      ],
      quickTip: lang === 'de'
        ? 'Tipp: In Chrome kannst du auf die 3 Punkte ⁝ → "Einstellungen" → "Website-Einstellungen" → "Standort" tippen.'
        : 'Tip: In Chrome, tap ⁝ → "Settings" → "Site settings" → "Location".',
      inAppWarning,
    };
  }

  // Desktop / Default Fallback
  return {
    platformTitle: lang === 'de' ? 'Anleitung für Browser am Computer:' : 'Instructions for Desktop Browser:',
    steps: lang === 'de' ? [
      'Klicke auf das Schloss-Symbol 🔒 oder Symbol links in der Adressleiste.',
      'Wähle "Website-Einstellungen" oder "Standort".',
      'Ändere die Berechtigung für Standort auf "Zulassen".',
      'Klicke unten auf "Standort freigeben".'
    ] : [
      'Click the lock icon 🔒 or site info icon in the address bar.',
      'Select "Site settings" or "Location".',
      'Change Location permission to "Allow".',
      'Click "Share location" below.'
    ],
    inAppWarning,
  };
}
