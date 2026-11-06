// Offline support: precache the app shell and libraries, then serve from cache.
// Local files are stale-while-revalidate, so updates show up on the next launch.
// Bump VERSION when the file list changes.
const VERSION = 'ironlog-v1';
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  'https://unpkg.com/htm@3.1.1/dist/htm.umd.js',
];
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/db.js', 'js/seed.js', 'js/store.js', 'js/stats.js', 'js/ui.js', 'js/charts.js', 'js/app.js',
  'js/screens/dashboard.js', 'js/screens/planner.js', 'js/screens/library.js', 'js/screens/workout.js',
  'js/screens/history.js', 'js/screens/analytics.js', 'js/screens/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll([...SHELL, ...LIBS])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (LIBS.includes(req.url)) {
    // Pinned library versions never change: cache first.
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
