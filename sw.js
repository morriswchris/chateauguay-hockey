/* CAHL service worker — network-first so the installed app always shows the
   latest data/pages when online, and falls back to a cached copy offline.
   Because it prefers the network, publishing new data (or a new app version)
   shows up on the next open without any manual cache-busting. */
var CACHE = 'cahl-cache-v1';
var SHELL = [
  './', 'index.html',
  'assets/app.css', 'assets/data.js', 'assets/site.js',
  'assets/logo.png', 'assets/icon-192.png', 'assets/icon-512.png',
  'manifest.webmanifest', 'data/season.json'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return c.add(u).catch(function () {});   // don't fail install on one miss
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // let cross-origin pass through

  // The season data is versionless in the cache (query strings stripped), so an
  // offline open can still find the last-synced copy.
  var isData = url.pathname.replace(/\/+$/, '').endsWith('/data/season.json') ||
               url.pathname.endsWith('data/season.json');
  var dataKey = 'data/season.json';

  e.respondWith((async function () {
    try {
      var fresh = await fetch(req);
      if (fresh && fresh.ok) {
        var copy = fresh.clone();
        caches.open(CACHE).then(function (c) { c.put(isData ? dataKey : req, copy); });
      }
      return fresh;
    } catch (err) {
      var cached = await caches.match(isData ? dataKey : req);
      if (cached) return cached;
      if (req.mode === 'navigate') {
        var idx = await caches.match('index.html') || await caches.match('./');
        if (idx) return idx;
      }
      throw err;
    }
  })());
});
