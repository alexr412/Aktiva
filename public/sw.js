// ═══════════════════════════════════════════════════════════════
// ACTIVA SERVICE WORKER v1.0
// Caching-Strategie: Network-First (HTML) / Cache-First (Assets)
// ═══════════════════════════════════════════════════════════════

const CACHE_VERSION = 'activa-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Maximale Cache-Größe für dynamischen Speicher
const MAX_DYNAMIC_ITEMS = 50;

// ─── INSTALL ───────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching offline fallback and app shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ──────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => (name.startsWith('aktiva-') || name.startsWith('activa-')) && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH ─────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Nur GET-Requests verarbeiten
  if (request.method !== 'GET') return;

  // 2. Nur http/https Protokolle verarbeiten
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 3. Firebase & Auth API-Bypass (Darf niemals gecacht werden)
  const isFirebaseBypass = 
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseinstallations.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebaseappcheck.googleapis.com') ||
    url.hostname.includes('cloudfunctions.net') ||
    url.hostname.includes('googleapis.com') ||
    url.pathname.includes('/__/auth') ||
    url.pathname.startsWith('/api/');

  if (isFirebaseBypass) return;

  // 4. Sensible Bezahl-, Checkout-, Admin- und private Routen blockieren
  const isExcludedRoute = 
    url.pathname.startsWith('/checkout') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/wallet') ||
    url.pathname.startsWith('/onboarding') ||
    url.pathname.includes('kyc') ||
    url.pathname.includes('refund') ||
    url.pathname.includes('payout');

  if (isExcludedRoute) return;

  // 5. STRATEGIE A: HTML-Navigation (HTML-Seiten) → Network-First mit Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Nur erfolgreiche HTML-Antworten der eigenen Domain cachen
          if (response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, copy);
              trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ITEMS);
            });
          }
          return response;
        })
        .catch(async () => {
          // Offline-Fallback
          // 1. Exakt passende Route im Cache suchen
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;

          // 2. Wenn nicht vorhanden, die offline.html Seite aus dem Precache liefern
          const offlineResponse = await caches.match('/offline.html');
          if (offlineResponse) return offlineResponse;

          // 3. Letzter Rettungsanker: minimalistisches HTML
          return new Response(
            '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Offline - Activa</title></head><body style="background:#020617;color:#f8fafc;font-family:sans-serif;text-align:center;padding:50px 20px;"><h1>Offline</h1><p>Bitte überprüfe deine Internetverbindung.</p></body></html>',
            {
              headers: { 'Content-Type': 'text/html; charset=utf-8' }
            }
          );
        })
    );
    return;
  }

  // 6. STRATEGIE B: Statische Assets → Cache-First mit Network-Fallback
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((networkResponse) => {
          // Nur same-origin Assets cachen (Ausnahme: Google Fonts)
          const isGoogleFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
          const isSameOrigin = url.origin === self.location.origin;

          if (networkResponse.ok && (isSameOrigin || isGoogleFont)) {
            const copy = networkResponse.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, copy);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Offline Fallback für Bilder/Assets
          return new Response('', { status: 404 });
        });
      })
    );
  }
});

// ─── HILFSFUNKTIONEN ───────────────────────────────────────────

function isStaticAsset(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  return (
    path.match(/\.(png|jpg|jpeg|webp|svg|gif|ico|woff|woff2|ttf|eot)$/i) ||
    path.startsWith('/_next/static/') ||
    path.startsWith('/assets/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  );
}

async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      await cache.delete(keys[0]);
      trimCache(cacheName, maxItems);
    }
  } catch (e) {
    console.error('[SW] Cache trim error:', e);
  }
}

// ─── PUSH & NOTIFICATION CLICK ─────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const rawData = event.data.json();
    const payload = rawData.data || rawData.notification || rawData;

    const notificationId = payload.notificationId || payload.eventId || 'activa_push_' + Date.now();
    const title = payload.title || 'Activa';
    const body = payload.body || payload.message || '';
    const rawTargetUrl = payload.targetUrl || payload.link || '/';
    
    // Deep Link Security Validation
    let targetUrl = '/';
    if (typeof rawTargetUrl === 'string' && rawTargetUrl.startsWith('/') && !rawTargetUrl.startsWith('//') && !rawTargetUrl.startsWith('javascript:')) {
      targetUrl = rawTargetUrl;
    }

    const options = {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: notificationId,
      data: {
        notificationId: notificationId,
        targetUrl: targetUrl
      }
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('[SW] Error parsing push notification:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  let targetUrl = '/';
  if (event.notification.data && event.notification.data.targetUrl) {
    targetUrl = event.notification.data.targetUrl;
  }

  // Deep Link Security Check: relative URLs starting with / only
  if (!targetUrl.startsWith('/') || targetUrl.startsWith('//') || targetUrl.startsWith('javascript:') || targetUrl.startsWith('data:')) {
    targetUrl = '/';
  }

  const fullUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});
