/* Mini-Titan — service worker (appli installable, jouable hors ligne).
   Changer VERSION à chaque publication : l'ancien cache est supprimé à l'activation. */
var VERSION = '2.4.0';
var PREFIX = 'mini-titan-';
var CACHE = PREFIX + VERSION;

var PRECACHE = [
  './',
  'index.html',
  'app.css',
  'js/skins.js',
  'js/core.js',
  'js/art.js',
  'js/scenes.js',
  'js/sfx.js',
  'js/games.js',
  'js/ui.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/icon-maskable-512.png',
  'sons/rugir-1.wav',
  'sons/rugir-2.wav',
  'sons/rugir-3.wav',
  'sons/rugir-4.wav',
  'icons/icon.svg',
  'classique.html'
];

var NETWORK_TIMEOUT = 3500;   // ms : au-delà, on sert le cache s'il existe (le réseau continue en fond)

/* Installation : précache tolérant — chaque fichier est ajouté séparément,
   un fichier manquant ou un réseau capricieux n'annule pas l'installation. */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(PRECACHE.map(function (url) {
        return fetch(new Request(url, { cache: 'reload' })).then(function (res) {
          if (res && res.ok) return cache.put(url, res);
        }).catch(function () { /* tant pis pour celui-ci */ });
      }));
    }).catch(function () {}).then(function () {
      return self.skipWaiting();
    })
  );
});

/* Activation : on jette les anciens caches de Mini-Titan (et seulement ceux-là), puis on prend la main. */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf(PREFIX) === 0 && key !== CACHE) return caches.delete(key);
      }));
    }).catch(function () {}).then(function () {
      return self.clients.claim();
    })
  );
});

function isIcon(url) {
  return url.pathname.indexOf('/icons/') >= 0 || /\.(png|svg|ico|webp|jpg|jpeg|gif)$/i.test(url.pathname);
}

function store(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return Promise.resolve();
  var copy = response.clone();
  return caches.open(CACHE).then(function (cache) { return cache.put(request, copy); }).catch(function () {});
}

function fromCache(request, isPage) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(request).then(function (hit) {
      return hit || cache.match(request, { ignoreSearch: true });
    }).then(function (hit) {
      if (hit || !isPage) return hit;
      // une page inconnue hors ligne : on retombe sur l'appli
      return cache.match('index.html').then(function (h) { return h || cache.match('./'); });
    });
  });
}

/* Réseau d'abord (pages, .js, .css…) : toujours la dernière version quand on est en ligne,
   le cache en secours hors ligne ou si le réseau traîne. */
function networkFirst(event, isPage) {
  var request = event.request;
  var network = fetch(request);
  // la mise à jour du cache est rattachée tout de suite à l'évènement : elle aboutit même si
  // c'est finalement le cache qui a répondu (réseau lent)
  event.waitUntil(network.then(function (res) { return store(request, res); }).catch(function () {}));
  var late = new Promise(function (resolve) {
    setTimeout(function () {
      fromCache(request, isPage).then(function (hit) { if (hit) resolve(hit); }).catch(function () {});
    }, NETWORK_TIMEOUT);
  });
  var safe = network.then(function (res) {
    if (res && (res.ok || res.type === 'opaqueredirect' || res.status === 304)) return res;
    // erreur serveur (404, 500…) : le cache si on l'a, sinon la réponse telle quelle
    return fromCache(request, isPage).then(function (hit) { return hit || res; });
  }, function () {
    return fromCache(request, isPage).then(function (hit) {
      if (hit) return hit;
      return new Response('Hors ligne', { status: 503, statusText: 'Hors ligne',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    });
  });
  return Promise.race([safe, late]);
}

/* Cache d'abord (icônes) : elles ne changent qu'avec VERSION. */
function cacheFirst(event) {
  var request = event.request;
  return fromCache(request, false).then(function (hit) {
    if (hit) return hit;
    return fetch(request).then(function (res) {
      var saved = store(request, res);
      try { event.waitUntil(saved); } catch (e) {}
      return res;
    });
  }).catch(function () {
    // hors ligne et pas en cache : une réponse vide plutôt qu'une promesse rejetée (erreur réseau en console)
    return new Response('', { status: 504, statusText: 'Hors ligne' });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;                       // uniquement les lectures
  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;            // uniquement notre origine
  if (request.headers.has('range')) return;                   // les lectures partielles restent au navigateur

  var isPage = request.mode === 'navigate' || request.destination === 'document';
  if (!isPage && isIcon(url)) event.respondWith(cacheFirst(event));
  else event.respondWith(networkFirst(event, isPage));
});
