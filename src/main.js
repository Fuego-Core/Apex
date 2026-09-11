import './styles.css'
import './finish.css'
import './enhancements.css'
import './nutrition-scanner.js'
import './apex-v2.css'
import './coach-ui.css'
import './apex-club.css'
import './photo-progress.css'
import './apex-fit.css'
import './apex-fit-route.css'
import './apex-pwa-fix.css'
import './apex-product-v3.css'

import { checkinPage } from './app/checkin-view.js'
import { homePage } from './app/home-view.js'
import { nutritionPage } from './app/nutrition-view.js'
import { progressPage } from './app/progress-view.js'
import { trackingPage } from './app/tracking-view.js'
import { program, workoutView } from './app/training.js'

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
document.body.classList.toggle('apex-standalone', standalone)

function resetRouteScroll() {
  requestAnimationFrame(() => window.scrollTo(0, 0))
}

function render({ resetScroll = false } = {}) {
  const route = (location.hash || '#home').slice(1)
  if (route.startsWith('workout/')) {
    workoutView(route.split('/')[1])
  } else {
    const routes = {
      home: homePage,
      tracking: trackingPage,
      program,
      nutrition: nutritionPage,
      progress: progressPage,
      checkin: checkinPage
    }
    ;(routes[route] || homePage)()
  }

  if (resetScroll) resetRouteScroll()
}

window.addEventListener('hashchange', () => render({ resetScroll: true }))
window.addEventListener('apex:state-changed', (event) => {
  if (event.detail?.scope === 'nutrition' && (location.hash || '#home') === '#nutrition') nutritionPage()
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
