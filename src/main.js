import './styles.css'
import { primeAudio } from './timer.js'
import homeView from './views/home.js'
import prepView from './views/prep.js'
import workoutView from './views/workout.js'
import summaryView from './views/summary.js'
import historyView from './views/history.js'
import exerciseView from './views/exercise.js'
import settingsView from './views/settings.js'

const app = document.getElementById('app')

/* Routeur hash minimal : ['seance','push','workout'] -> view + params */
const ROUTES = [
  { re: /^\/?$/, view: homeView },
  { re: /^\/seance\/([^/]+)$/, view: prepView, keys: ['sessionId'] },
  { re: /^\/seance\/([^/]+)\/workout$/, view: workoutView, keys: ['sessionId'] },
  { re: /^\/seance\/([^/]+)\/resume$/, view: summaryView, keys: ['sessionId'] },
  { re: /^\/historique$/, view: historyView },
  { re: /^\/historique\/([^/]+)$/, view: historyView, keys: ['entryId'] },
  { re: /^\/exercice\/([^/]+)$/, view: exerciseView, keys: ['name'] },
  { re: /^\/reglages$/, view: settingsView }
]

let cleanup = null

export function navigate(hash) {
  if (location.hash === hash) render()
  else location.hash = hash
}

function render() {
  const path = decodeURI(location.hash.replace(/^#/, '')) || '/'
  const match = ROUTES.map((r) => ({ r, m: path.match(r.re) })).find((x) => x.m)

  if (typeof cleanup === 'function') {
    cleanup()
    cleanup = null
  }

  if (!match) {
    location.hash = '#/'
    return
  }

  const params = {}
  ;(match.r.keys || []).forEach((k, i) => {
    params[k] = decodeURIComponent(match.m[i + 1])
  })

  app.scrollTop = 0
  window.scrollTo(0, 0)
  cleanup = match.r.view(app, params) || null
}

window.addEventListener('hashchange', render)
window.addEventListener('DOMContentLoaded', render)
if (document.readyState !== 'loading') render()

// L'audio du timer doit être débloqué par un geste utilisateur sur mobile.
document.addEventListener('pointerdown', () => primeAudio(), { once: true })

/* Service worker : l'app doit démarrer sans réseau, en salle. */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    const url = new URL('./sw.js', document.baseURI)
    navigator.serviceWorker.register(url, { scope: './' }).catch((e) => {
      console.warn('APEX: service worker non enregistré', e)
    })
  })
}
