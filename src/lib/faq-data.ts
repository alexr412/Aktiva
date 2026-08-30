export interface FAQItem {
  id: string;
  category: 'general' | 'location' | 'activities' | 'radar' | 'creator';
  question: { de: string; en: string };
  answer: { de: string; en: string };
}

export const FAQ_DATA: FAQItem[] = [
  {
    id: 'faq-profile-edit',
    category: 'general',
    question: {
      de: 'Wie kann ich mein Profil und meine Interessen bearbeiten?',
      en: 'How can I edit my profile and interests?'
    },
    answer: {
      de: 'Gehe in deinen Einstellungen auf "Profil bearbeiten". Dort kannst du deinen Namen, Bio, Interessen und Hobbys jederzeit anpassen.',
      en: 'Go to "Edit Profile" in your settings. There you can update your name, bio, interests, and hobbies at any time.'
    }
  },
  {
    id: 'faq-password-reset',
    category: 'general',
    question: {
      de: 'Wie kann ich mein Passwort ändern oder zurücksetzen?',
      en: 'How can I change or reset my password?'
    },
    answer: {
      de: 'Unter Einstellungen -> Konto kannst du eine E-Mail zum Zurücksetzen deines Passworts anfordern.',
      en: 'Under Settings -> Account you can request a password reset email.'
    }
  },
  {
    id: 'faq-location-usage',
    category: 'location',
    question: {
      de: 'Warum benötigt Activa meinen Standort?',
      en: 'Why does Activa need my location?'
    },
    answer: {
      de: 'Activa nutzt deinen GPS-Standort, um dir passende Aktivitäten, Events und Orte in deiner direkten Umgebung auf der Karte und im Feed anzuzeigen.',
      en: 'Activa uses your GPS location to display relevant activities, events, and places nearby on the map and feed.'
    }
  },
  {
    id: 'faq-location-privacy',
    category: 'location',
    question: {
      de: 'Wird mein exakter Standort für andere Nutzer sichtbar gespeichert?',
      en: 'Is my exact location publicly visible to other users?'
    },
    answer: {
      de: 'Nein. Dein exakter Standort wird niemals öffentlich angezeigt. Wenn du das Freunde-Radar nutzt, sehen nur bestätigte Freunde grobe Entfernungs-Kategorien.',
      en: 'No. Your exact location is never publicly displayed. When using Friends Radar, only confirmed friends see approximate distance buckets.'
    }
  },
  {
    id: 'faq-create-activity',
    category: 'activities',
    question: {
      de: 'Wie erstelle ich eine eigene Aktivität?',
      en: 'How do I create my own activity?'
    },
    answer: {
      de: 'Tippe unten in der Navigationsleiste auf das "+"-Icon. Wähle Ort, Titel, Kategorie und Zeit aus und erstelle dein Treffen.',
      en: 'Tap the "+" icon in the bottom navigation bar. Select location, title, category, and time to host your meetup.'
    }
  },
  {
    id: 'faq-join-activity',
    category: 'activities',
    question: {
      de: 'Wie trete ich einer Aktivität bei?',
      en: 'How do I join an activity?'
    },
    answer: {
      de: 'Öffne eine Aktivität auf der Karte oder im Feed und tippe auf "Teilnehmen" bzw. "Anfrage senden". Nach der Bestätigung erhältst du Zugriff auf den Gruppen-Chat.',
      en: 'Open an activity on the map or feed and tap "Join" or "Send Request". Once accepted, you get access to the group chat.'
    }
  },
  {
    id: 'faq-radar-visibility',
    category: 'radar',
    question: {
      de: 'Wer kann mich im Freunde-Radar sehen?',
      en: 'Who can see me on the Friends Radar?'
    },
    answer: {
      de: 'Nur bestätigte Kontakte, die ebenfalls den Freunde-Radar aktiviert haben (Opt-in). Du kannst den Radar in den Einstellungen jederzeit deaktivieren.',
      en: 'Only confirmed contacts who have also enabled Friends Radar (opt-in). You can disable the radar at any time in Settings.'
    }
  },
  {
    id: 'faq-creator-program',
    category: 'creator',
    question: {
      de: 'Was ist das Creator-Programm und wie kann ich mitmachen?',
      en: 'What is the Creator Program and how do I join?'
    },
    answer: {
      de: 'Als aktiver Host (mind. 20 durchgeführte Aktivitäten & positive Bewertungen) kannst du dich unter Einstellungen -> Creator Programm bewerben, um erweiterte Features freizuschalten.',
      en: 'As an active host (min 20 completed activities & positive ratings) you can apply under Settings -> Creator Program to unlock advanced features.'
    }
  }
];
