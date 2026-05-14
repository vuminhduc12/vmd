const CACHE_NAME = 'boxer-pro-v16';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/app.js',
  './js/core/helpers.js',
  './js/core/navigation.js',
  './js/core/init.js',
  './js/services/storage.js',
  './js/pages/weight.js',
  './js/pages/fight.js',
  './manifest.webmanifest',
  './icons/app-icon.svg',
  './data/weight-cut-plan.csv',
];

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)),
      self.skipWaiting(),
    ])
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

function shouldFetchNetworkFirst(url, request) {
  if (request.mode === 'navigate') return true;
  try {
    const p = new URL(url).pathname;
    return p.endsWith('/js/config.js')
      || p.endsWith('/js/app.js')
      || p.endsWith('/js/core/helpers.js')
      || p.endsWith('/js/core/navigation.js')
      || p.endsWith('/js/core/init.js')
      || p.endsWith('/js/services/storage.js')
      || p.endsWith('/js/pages/weight.js')
      || p.endsWith('/js/pages/fight.js')
      || p.endsWith('/css/style.css')
      || p.endsWith('/index.html');
  } catch (e) {
    return false;
  }
}

function isCacheableRequest(request) {
  try {
    const url = new URL(request.url);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!isCacheableRequest(event.request)) return;

  if (shouldFetchNetworkFirst(event.request.url, event.request)) {
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
