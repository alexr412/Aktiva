// Scripts für Firebase Messaging im Hintergrund
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Hinweis: In Produktion müssen diese Werte durch die echten Config-Werte ersetzt werden.
// Firebase Studio injiziert diese Werte normalerweise zur Laufzeit.
firebase.initializeApp({
  apiKey: "PLACEHOLDER",
  authDomain: "PLACEHOLDER",
  projectId: "PLACEHOLDER",
  storageBucket: "PLACEHOLDER",
  messagingSenderId: "PLACEHOLDER",
  appId: "PLACEHOLDER"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/app-icon.png', // Fallback Icon
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
