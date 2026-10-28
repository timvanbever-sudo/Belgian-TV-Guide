const CACHE = 'betv-shell-v3'
const SHELL = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icon-192.png']
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting() })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim() })
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return
  const fresh = e.request.url.includes('guide.js') || e.request.url.includes('app.js') || e.request.mode === 'navigate'
  e.respondWith(fresh
    ? fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r }).catch(() => caches.match(e.request))
    : caches.match(e.request).then(r => r || fetch(e.request)))
})
