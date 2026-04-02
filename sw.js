var CACHE = "newslens-v4";
var NEWS_CACHE = "newslens-news-v2";

self.addEventListener("install", function(e) {
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE && n !== NEWS_CACHE; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(e) {
  var url = e.request.url;

  /* API calls: network-first, cache fallback for /news and /digest */
  if (url.indexOf("workers.dev") !== -1) {
    if (url.indexOf("/news") !== -1 || url.indexOf("/digest") !== -1 || url.indexOf("/broadcast") !== -1) {
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

  /* Skip external APIs entirely */
  if (url.indexOf("supabase") !== -1 || url.indexOf("anthropic") !== -1 ||
      url.indexOf("googleapis") !== -1 || url.indexOf("cdn.") !== -1 ||
      url.indexOf("fonts.") !== -1) return;

  /* HTML pages: ALWAYS network-first so updates are immediate */
  if (e.request.mode === "navigate" || url.indexOf(".html") !== -1) {
    e.respondWith(
      fetch(e.request).then(function(res) {
        caches.open(CACHE).then(function(c) { c.put(e.request, res.clone()); });
        return res;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  /* Other assets: cache-first */
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(res) {
        caches.open(CACHE).then(function(c) { c.put(e.request, res.clone()); });
        return res;
      });
    })
  );
});

self.addEventListener("notificationclick", function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type: "window"}).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf("NewsLens") !== -1) return list[i].focus();
      }
      return clients.openWindow("./");
    })
  );
});
