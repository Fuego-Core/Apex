/* APEX — service worker
   Stratégie :
   - app shell (index.html) : network-first, fallback cache => on récupère les MAJ,
     mais l'app démarre même sans réseau (salle de sport = 0 barre).
   - assets même origine (JS/CSS/SVG hashés par Vite) : cache-first.
   - Google Fonts : cache-first (réponses opaques acceptées).
*/
const VERSION = 'apex-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`
const FONTS = `${VERSION}-fonts`

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/apex-icon.svg',
  './icons/apex-maskable.svg',
  './icons/apex-logo.svg'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

const isFont = (url) =>
  url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Polices Google : cache-first, on garde ce qu'on a vu une fois.
  if (isFont(url)) {
    event.respondWith(
      caches.open(FONTS).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        try {
          const res = await fetch(req)
          cache.put(req, res.clone())
          return res
        } catch {
          return hit || Response.error()
        }
      })
    )
    return
  }

  if (url.origin !== self.location.origin) return

  // Navigation : network-first pour attraper les nouvelles versions.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('./index.html', copy))
          return res
        })
        .catch(async () => {
          const cache = await caches.open(SHELL)
          return (
            (await cache.match('./index.html')) ||
            (await cache.match('./')) ||
            Response.error()
          )
        })
    )
    return
  }

  // Assets : cache-first + remplissage à la volée.
  event.respondWith(
    caches.open(ASSETS).then(async (cache) => {
      const hit = await cache.match(req)
      if (hit) return hit
      try {
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      } catch {
        return Response.error()
      }
    })
  )
})
