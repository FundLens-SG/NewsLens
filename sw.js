var CACHE = "newslens-v2";
var ASSETS = [".", "index.html", "icon-192.png", "icon-512.png", "manifest.json"];
var NEWS_CACHE = "newslens-news-v1";

self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); }));
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(names) {
    return Promise.all(names.filter(function(n) { return n !== CACHE && n !== NEWS_CACHE; }).map(function(n) { return caches.delete(n); }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function(e) {
  var url = e.request.url;

  /* API calls: network-first, cache fallback for /news and /digest */
  if (url.indexOf("workers.dev") !== -1) {
    if (url.indexOf("/news") !== -1 || url.indexOf("/digest") !== -1) {
      e.respondWith(
        fetch(e.request).then(function(res) {
          var clone = res.clone();
          caches.open(NEWS_CACHE).then(function(c) { c.put(e.request, clone); });
          return res;
        }).catch(function() {
          return caches.match(e.request);
        })
      );
      return;
    }
    return;
  }

  /* Skip external APIs */
  if (url.indexOf("supabase") !== -1 || url.indexOf("anthropic") !== -1 || url.indexOf("googleapis") !== -1) return;

  /* Static assets: stale-while-revalidate */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var fetchPromise = fetch(e.request).then(function(res) {
        caches.open(CACHE).then(function(c) { c.put(e.request, res.clone()); });
        return res;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});

/* Handle notification clicks — open the app */
self.addEventListener("notificationclick", function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type: "window"}).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf("NewsLens") !== -1 || clientList[i].url.indexOf("newslens") !== -1) {
          return clientList[i].focus();
        }
      }
      return clients.openWindow("./");
    })
  );
});
