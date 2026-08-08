const CACHE_NAME = 'multi-dim-sudoku-v8';
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./js/app.js",
  "./js/game.js",
  "./js/ui.js",
  "./js/utils.js",
  "./js/generator/dlx-solver.js",
  "./js/generator/generator-worker.js",
  "./manifest.json",
  "./icon.png",
  "./puzzles/base2-3d-test.json",
  "./puzzles/base2-test.json",
  "./puzzles/base4-test.json",
  "./puzzles/easy-1.json",
  "./puzzles/puzzles.json"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
