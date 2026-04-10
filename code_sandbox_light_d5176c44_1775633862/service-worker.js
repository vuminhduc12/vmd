const CACHE_NAME = 'boxer-pro-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/app-icon.svg',
  './data/weight-cut-plan.csv',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isAppAssetUrl(url) {
  try {
    const p = new URL(url).pathname;
    return p.endsWith('/js/app.js') || p.endsWith('/css/style.css') || p.endsWith('/index.html');
  } catch (e) {
    return false;
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (isAppAssetUrl(event.request.url)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, copy))
                .catch(err => console.error('Cache put failed:', err))
            );
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, copy))
              .catch(error => {
                console.error('Dynamic cache put failed:', error);
              })
          );
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
