/* APEX — service worker
   Stratégie :
   - app shell (index.html) : network-first, fallback cache => on récupère les MAJ,
     mais l'app démarre même sans réseau (salle de sport = 0 barre).
   - assets même origine (JS/CSS/SVG/polices hashés par Vite) : cache-first.
   Plus aucune origine externe : les polices sont auto-hébergées.
*/
// Remplacés au build par vite.config.js. En dev, ils restent tels quels et
// sont ignorés : le service worker ne sert à rien avec le serveur de dev.
const BUILD = '__APEX_BUILD__'
const BUILD_ASSETS = '__APEX_ASSETS__'

const VERSION = BUILD.startsWith('__') ? 'apex-dev' : BUILD
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/apex-icon.svg',
  './icons/apex-maskable.svg',
  './icons/apex-logo.svg',
  // Sous-ensemble latin : ce que le français utilise au quotidien. Le latin-ext
  // est mis en cache à la volée le jour où un caractère l'exige.
  './fonts/inter-400-latin.woff2',
  './fonts/inter-500-latin.woff2',
  './fonts/inter-600-latin.woff2',
  './fonts/inter-700-latin.woff2',
  './fonts/space-grotesk-500-latin.woff2',
  './fonts/space-grotesk-700-latin.woff2',
  // Le JS et le CSS du build, injectés à la compilation : sans eux, une app
  // installée mais jamais rouverte en ligne ne démarrerait pas hors réseau.
  ...(Array.isArray(BUILD_ASSETS) ? BUILD_ASSETS : [])
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

/** La coquille de l'app : la racine du scope ou son index.html, rien d'autre. */
const isAppShell = (url) => url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  if (url.origin !== self.location.origin) return

  // Navigation : network-first pour attraper les nouvelles versions.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // La coquille ne se met à jour QUE depuis la coquille, et seulement
          // si la réponse est saine. Sans cette garde, un 404 transitoire ou
          // une autre page du domaine devenait l'application hors ligne.
          const html = (res.headers.get('content-type') || '').includes('text/html')
          if (res.ok && html && isAppShell(url)) {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put('./index.html', copy))
          }
          return res
        })
        .catch(async () => {
          // Hors ligne, on ne sert en repli que l'app elle-même : une autre
          // page doit échouer franchement plutôt que d'afficher APEX à sa place.
          if (!isAppShell(url)) return Response.error()
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
  // On cherche dans TOUS les caches : les fichiers précachés à l'installation
  // vivent dans le cache shell, pas dans le cache assets.
  event.respondWith(
    (async () => {
      const hit = await caches.match(req)
      if (hit) return hit
      try {
        const res = await fetch(req)
        if (res.ok) {
          const cache = await caches.open(ASSETS)
          cache.put(req, res.clone())
        }
        return res
      } catch {
        return Response.error()
      }
    })()
  )
})
