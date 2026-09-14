import './styles.css'
import './finish.css'
import './enhancements.css'
import './nutrition-scanner.js'
import './nutrition-scanner-v2.js'
import './app/nutrition-hub.js'
import './app/nutrition-library.js'
import './app/meal-flow.js'
import './apex-v2.css'
import './coach-ui.css'
import './apex-club.css'
import './apex-fit.css'
import './apex-fit-route.css'
import './apex-pwa-fix.css'
import './apex-product-v3.css'
import './apex-product-pages.css'
import './apex-nutrition-polish.css'
import './apex-nutrition-v5.css'
import './apex-nutrition-final.css'
import './apex-dark-pro.css'
import './apex-simple-nutrition.css'
import './apex-storage.css'

import { homePage } from './app/home-view.js'
import { nutritionPage } from './app/nutrition-view.js'
import { storagePage } from './app/storage-view.js'

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
document.body.classList.toggle('apex-standalone', standalone)

function resetRouteScroll() {
  requestAnimationFrame(() => window.scrollTo(0, 0))
}

function render({ resetScroll = false } = {}) {
  const route = (location.hash || '#home').slice(1)
  const routes = { home: homePage, nutrition: nutritionPage, storage: storagePage }
  ;(routes[route] || homePage)()
  if (resetScroll) resetRouteScroll()
}

window.addEventListener('hashchange', () => render({ resetScroll: true }))
window.addEventListener('apex:state-changed', (event) => {
  const route = (location.hash || '#home').slice(1)
  if (event.detail?.scope === 'nutrition' && route === 'nutrition') nutritionPage()
  if (event.detail?.scope === 'nutrition' && route === 'storage') storagePage()
})

render({ resetScroll: true })

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      await registration.update()
    } catch {
      // L'app reste utilisable même si l'enregistrement PWA échoue ponctuellement.
    }
  })
}
