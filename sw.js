// Wordbook service worker: keeps the app shell cached so it opens offline.
// Bump VERSION whenever index.html or an asset changes, so phones pick up the update.
const VERSION = 'wordbook-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
// only these navigations are the app itself; other pages (tabbar-lab.html) are not cached
const APP_PAGES = [new URL('./', self.location).href, new URL('./index.html', self.location).href];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    const isApp = APP_PAGES.includes(url.origin + url.pathname);
    if (!isApp) return; // let the browser handle other pages normally
    // App page: always ask the server first (skipping the HTTP cache) so an update shows up at once;
    // fall back to the cached shell when offline.
    event.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then(res => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else from the shell: cache first.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req))
  );
});
