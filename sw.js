// 항상 네트워크 우선 → 캐시 없이 최신 파일 로드
self.addEventListener('fetch', function(e){
  // html, js 파일은 항상 네트워크에서 최신 버전 가져오기
  var url = e.request.url;
  if(url.includes('church_biz_app') || url.includes('sw.js')){
    e.respondWith(
      fetch(e.request).catch(function(){
        return caches.match(e.request);
      })
    );
    return;
  }
  // 이미지 등 정적 파일만 캐시 사용
  e.respondWith(
    caches.match(e.request).then(function(r){
      return r || fetch(e.request).then(function(res){
        return caches.open('belovedc-static').then(function(c){
          c.put(e.request, res.clone());
          return res;
        });
      });
    })
  );
});

// 기존 캐시 전체 삭제
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== 'belovedc-static'; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  return self.clients.claim();
});
