// ═══════════════════════════════════════════════════════════════
// AKTIVA SERVICE WORKER v1.0
// Caching-Strategie: Stale-While-Revalidate + Cache-First für Assets
// ═══════════════════════════════════════════════════════════════

const CACHE_VERSION = 'aktiva-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// Maximale Anzahl an Einträgen pro Cache (verhindert unkontrolliertes Wachstum)
const MAX_DYNAMIC_CACHE = 50;
const MAX_IMAGE_CACHE = 80;

// Statische Assets, die beim Install sofort gecacht werden (App-Shell)
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ─── INSTALL ───────────────────────────────────────────────────
// Beim ersten Laden: App-Shell in den Cache schreiben
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker v1...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching App Shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting()) // Sofort aktivieren, nicht auf Tab-Schließung warten
  );
});

// ─── ACTIVATE ──────────────────────────────────────────────────
// Alte Caches aufräumen, wenn eine neue Version deployed wird
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker v1...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE && name !== IMAGE_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // Kontrolle über alle offenen Tabs übernehmen
  );
});

// ─── FETCH ─────────────────────────────────────────────────────
// Intelligente Routing-Strategie basierend auf Request-Typ
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nur GET-Requests cachen (POST, PUT etc. nicht)
  if (request.method !== 'GET') return;

  // Nur http oder https Requests cachen (chrome-extension:// etc. ignorieren)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Firebase/Firestore Requests NICHT cachen (Echtzeit-Daten)
  if (url.hostname.includes('firestore') || 
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com')) {
    return;
  }

  // Auth-bezogene Requests NICHT cachen
  if (url.pathname.includes('/api/') || url.pathname.includes('/__/')) {
    return;
  }

  // ── STRATEGIE 0: Kurzzeit-Cache für Geoapify API (5 Minuten) ──
  // Beim Zurück-Navigieren sofort Ergebnisse aus Cache zeigen
  if (url.hostname.includes('geoapify.com')) {
    event.respondWith(timedCache(request, DYNAMIC_CACHE, 5 * 60 * 1000));
    return;
  }

  // ── STRATEGIE 1: Cache-First für statische Assets ──
  // Bilder, Fonts, Icons → aus dem Cache, Netzwerk nur als Fallback
  if (isStaticAsset(request)) {
    // Entwicklungsmodus-Schutz: Next.js-Chunks und Hot-Reloads auf localhost niemals cachen
    if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && url.pathname.startsWith('/_next/')) {
      return;
    }
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_CACHE));
    return;
  }

  // ── STRATEGIE 2: Stale-While-Revalidate für Navigation & Seiten ──
  // Sofort aus Cache antworten, im Hintergrund aktualisieren
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE, MAX_DYNAMIC_CACHE));
});

// ═══════════════════════════════════════════════════════════════
// CACHING STRATEGIEN
// ═══════════════════════════════════════════════════════════════

/**
 * Cache-First: Perfekt für Assets die sich selten ändern (Bilder, Fonts).
 * Antwortet sofort aus dem Cache. Nur bei Cache-Miss wird das Netzwerk gefragt.
 */
async function cacheFirst(request, cacheName, maxEntries) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      trimCache(cacheName, maxEntries);
    }
    return networkResponse;
  } catch (error) {
    // Offline und nicht im Cache → generische Antwort
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Stale-While-Revalidate: Perfekt für HTML-Seiten und dynamische Inhalte.
 * Antwortet sofort aus dem Cache (wenn vorhanden), aktualisiert aber
 * im Hintergrund den Cache mit der neuesten Version vom Server.
 */
async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
        trimCache(cacheName, maxEntries);
      }
      return networkResponse;
    })
    .catch(() => {
      // Netzwerk nicht verfügbar → ignorieren (Cache wird benutzt)
      return cachedResponse || new Response('Offline', { status: 503 });
    });

  // Sofort aus Cache antworten, oder auf Netzwerk warten
  return cachedResponse || fetchPromise;
}

// ═══════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ═══════════════════════════════════════════════════════════════

/**
 * Prüft ob ein Request ein statisches Asset ist (Bild, Font, Icon etc.)
 */
function isStaticAsset(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  return (
    path.match(/\.(png|jpg|jpeg|webp|svg|gif|ico|woff|woff2|ttf|eot)$/i) ||
    path.startsWith('/assets/') ||
    path.startsWith('/_next/static/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  );
}

/**
 * Begrenzt die Cache-Größe, indem die ältesten Einträge entfernt werden.
 * Verhindert, dass der Cache das Gerät zumüllt.
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    trimCache(cacheName, maxItems); // Rekursiv bis unter dem Limit
  }
}

/**
 * Timed Cache: Antwortet aus dem Cache wenn nicht älter als maxAge (ms).
 * Ansonsten frisch vom Netzwerk holen und cachen.
 * Perfekt für API-Daten die sich nicht jede Sekunde ändern (z.B. Geoapify POIs).
 */
async function timedCache(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const cachedDate = cachedResponse.headers.get('sw-cached-at');
    if (cachedDate && (Date.now() - parseInt(cachedDate)) < maxAge) {
      return cachedResponse;
    }
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Timestamp als Header mitspeichern für Ablaufprüfung
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cached-at', Date.now().toString());
      const timedResponse = new Response(await networkResponse.clone().blob(), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: headers
      });
      cache.put(request, timedResponse);
      trimCache(cacheName, MAX_DYNAMIC_CACHE);
    }
    return networkResponse;
  } catch (error) {
    // Offline → Cache benutzen (auch wenn abgelaufen, besser als nichts)
    if (cachedResponse) return cachedResponse;
    return new Response('Offline', { status: 503 });
  }
}

// ─── PUSH NOTIFICATIONS (Vorbereitung) ─────────────────────────
// Wird aktiv, sobald Push-Benachrichtigungen implementiert werden
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/',
      },
      actions: data.actions || [],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Aktiva', options)
    );
  } catch (e) {
    console.error('[SW] Push parse error:', e);
  }
});

// Klick auf Push-Benachrichtigung → App öffnen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Wenn die App schon offen ist, dorthin navigieren
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Sonst neues Fenster öffnen
        return self.clients.openWindow(url);
      })
  );
});
