const CACHE = 'belovedc-biz-v16';
const FILES = [
  './church_biz_app.html',
  './church_biz_app.js',
  './비즈넷로고3.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(FILES); })
  );
});

self.addEventListener('fetch', function(e){
  e.respondWith(
    caches.match(e.request).then(function(r){
      return r || fetch(e.request);
    })
  );
});
