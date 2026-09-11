import './styles.css'
import './finish.css'
import './enhancements.css'
import './basicfit-media.js'
import './nutrition-scanner.js'
import './smart-actions.js'
import './apex-v2.css'

import { checkinPage } from './app/checkin-view.js'
import { nutritionPage } from './app/nutrition-view.js'
import { progressPage } from './app/progress-view.js'
import { trackingPage } from './app/tracking-view.js'
import { home, program, workoutView } from './app/training.js'

function render() {
  const route = (location.hash || '#home').slice(1)
  if (route.startsWith('workout/')) {
    workoutView(route.split('/')[1])
    return
  }

  const routes = {
    home,
    tracking: trackingPage,
    program,
    nutrition: nutritionPage,
    progress: progressPage,
    checkin: checkinPage
  }
  ;(routes[route] || home)()
}

window.addEventListener('hashchange', render)
window.addEventListener('apex:state-changed', (event) => {
  if (event.detail?.scope === 'nutrition' && (location.hash || '#home') === '#nutrition') nutritionPage()
})

render()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
