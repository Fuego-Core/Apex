import './fonts.css'
import './ui/tokens.css'
import './styles.css'
import './ui/components.css'
import { primeAudio } from './timer.js'
import { initState, onStorageError, getBootInfo } from './state.js'
import { downloadEmergencyExport } from './data/rescue.js'
import { banner, fatalScreen, toast } from './ui.js'
import { measureLocal, storageAdvice } from './data/storageInfo.js'
import dashboardView from './views/dashboard.js'
import sessionsView from './views/sessions.js'
import bodyView from './views/body.js'
import goalsView from './views/goals.js'
import profileView from './views/profile.js'
import nutritionView from './views/nutrition.js'
import nutritionHistoryView from './views/nutrition-history.js'
import recipesView from './views/recipes.js'
import prepView from './views/prep.js'
import workoutView from './views/workout.js'
import summaryView from './views/summary.js'
import historyView from './views/history.js'
import exerciseView from './views/exercise.js'
import settingsView from './views/settings.js'

const app = document.getElementById('app')

/* Routeur hash minimal : '/seance/push/workout' -> view + params */
const ROUTES = [
  { re: /^\/?$/, view: dashboardView },
  { re: /^\/seances$/, view: sessionsView },
  { re: /^\/corps$/, view: bodyView },
  { re: /^\/corps\/ajouter\/(poids|taille)$/, view: bodyView, keys: ['add'] },
  { re: /^\/objectifs$/, view: goalsView },
  { re: /^\/objectifs\/nouveau$/, view: goalsView, keys: [], create: true },
  { re: /^\/profil$/, view: profileView },
  { re: /^\/nutrition$/, view: nutritionView },
  { re: /^\/nutrition\/historique$/, view: nutritionHistoryView },
  { re: /^\/nutrition\/(\d{4}-\d{2}-\d{2})$/, view: nutritionView, keys: ['date'] },
  { re: /^\/recettes$/, view: recipesView },
  { re: /^\/seance\/([^/]+)$/, view: prepView, keys: ['sessionId'] },
  { re: /^\/seance\/([^/]+)\/workout$/, view: workoutView, keys: ['sessionId'] },
  { re: /^\/seance\/([^/]+)\/resume$/, view: summaryView, keys: ['sessionId'] },
  { re: /^\/historique$/, view: historyView },
  { re: /^\/historique\/([^/]+)$/, view: historyView, keys: ['entryId'] },
  { re: /^\/exercice\/([^/]+)$/, view: exerciseView, keys: ['exerciseId'] },
  { re: /^\/reglages$/, view: settingsView }
]

let cleanup = null
let ready = false

export function navigate(hash) {
  if (location.hash === hash) render()
  else location.hash = hash
}

/** Un seul décodage, et jamais d'exception sur une URL bricolée. */
function decodeParam(value) {
  try {
    return decodeURIComponent(value)
  } catch (e) {
    return value
  }
}

function render() {
  if (!ready) return

  const path = location.hash.replace(/^#/, '') || '/'
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
    params[k] = decodeParam(match.m[i + 1])
  })

  app.scrollTop = 0
  window.scrollTo(0, 0)

  if (match.r.create) params.create = true
  if (params.add) params.kind = params.add === 'taille' ? 'waist' : 'weight'

  try {
    cleanup = match.r.view(app, params) || null
  } catch (error) {
    console.error('APEX: rendu impossible', error)
    cleanup = null
    fatalScreen(app, {
      title: 'Cet écran n’a pas pu s’afficher',
      message: 'Une erreur inattendue est survenue. Tes données sont enregistrées.',
      details: [String(error?.message || error)],
      onExport: () => downloadEmergencyExport(),
      onRetry: () => navigate('#/')
    })
  }
}

async function boot() {
  try {
    await initState()
  } catch (error) {
    console.error('APEX: démarrage impossible', error)
    fatalScreen(app, {
      title: 'APEX n’a pas pu démarrer',
      message: error?.message || 'Erreur inconnue au chargement des données.',
      details: error?.details || [],
      onExport: () => downloadEmergencyExport()
    })
    return
  }

  ready = true

  // Un échec d'enregistrement ne doit jamais rester invisible.
  onStorageError((error) => {
    banner(error?.userMessage || 'Modification non enregistrée.', { id: 'storage' })
  })

  window.addEventListener('hashchange', render)
  render()

  /* Le stockage se remplit sans prévenir : on prévient. Seul le niveau
     critique interrompt — l'avertissement plus doux vit dans les réglages,
     avec le détail et le bouton d'export. */
  const local = measureLocal(globalThis.localStorage)
  if (local.level === 'critical') {
    banner(storageAdvice(local).text, { tone: 'danger', id: 'storage-full' })
  }

  const info = getBootInfo()
  if (info.migrated) {
    toast('Données migrées · sauvegarde de l’ancienne version conservée', 'gold')
  }

  // L'audio du timer doit être débloqué par un geste utilisateur sur mobile.
  document.addEventListener('pointerdown', () => primeAudio(), { once: true })

  /* Service worker : l'app doit démarrer sans réseau, en salle. */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const url = new URL('./sw.js', document.baseURI)
    navigator.serviceWorker.register(url, { scope: './' }).catch((e) => {
      console.warn('APEX: service worker non enregistré', e)
    })
  }
}

/* Filet de sécurité : aucune erreur ne doit disparaître en silence. */
window.addEventListener('error', (e) => {
  console.error('APEX: erreur non gérée', e.error || e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('APEX: promesse rejetée', e.reason)
})

boot()
