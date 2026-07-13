/* Increm — service worker
   Strategie "reseau d'abord" pour le HTML : l'app charge toujours la derniere version
   quand il y a du reseau, et bascule sur le cache si hors-ligne. Ce fichier n'a pas
   besoin d'etre modifie a chaque deploiement (les mises a jour du HTML passent par le reseau). */
var CACHE = 'increm-app-v1';

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil((async function(){
    try { var c = await caches.open(CACHE); await c.add('./suivi-musculation.html'); } catch (_) {}
  })());
});

self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return k === CACHE ? Promise.resolve() : caches.delete(k); }));
    } catch (_) {}
    try { await self.clients.claim(); } catch (_) {}
  })());
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;   // ne pas intercepter l'externe (sync GitHub, etc.)

  var accept = req.headers.get('accept') || '';
  var isHTML = req.mode === 'navigate' || accept.indexOf('text/html') !== -1;

  if (isHTML) {
    // reseau d'abord : derniere version en ligne, mise en cache, secours cache si hors-ligne
    e.respondWith((async function(){
      try {
        var net = await fetch(req, { cache: 'reload' });   // contourne le cache HTTP (~10 min de GitHub Pages) -> toujours la derniere version
        try { var c = await caches.open(CACHE); await c.put(req, net.clone()); } catch (_) {}
        return net;
      } catch (err) {
        var cached = await caches.match(req, { ignoreSearch: true });
        if (!cached) cached = await caches.match('./suivi-musculation.html', { ignoreSearch: true });
        return cached || new Response('Hors-ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // autres GET meme origine : cache d'abord (appli mono-fichier, quasi aucun autre asset)
  e.respondWith((async function(){
    var cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try { return await fetch(req); } catch (err) { return cached || Response.error(); }
  })());
});
