// IKOS service worker — offline shell + runtime caching.
//
// The app is one self-contained bundle (index.html: template + gzipped assets),
// so offline needs only: the shell, the manifest/icons, and the three.js CDN
// modules the Orbit view imports at runtime (cdnjs r128 classic · jsdelivr
// 0.171 webgpu/tsl). Navigations are network-first so new deploys land the
// moment you're online; everything cacheable falls back to the cache offline.

const CACHE = 'ikos-v1';
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // navigations: network-first (fresh deploys), cached shell when offline
  // (every route rewrites to the same bundle, so '/' stands in for them all)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // same-origin static + the three.js CDNs: stale-while-revalidate
  if (url.origin === location.origin || CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
  // everything else (YouTube, search APIs, …) passes through untouched
});
