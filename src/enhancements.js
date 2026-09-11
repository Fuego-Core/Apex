import './enhancements.css'

import { nutritionLogTotals, state } from './app/store.js'

const avg = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
const n = (value, digits = 1) => Number.isFinite(Number(value))
  ? Number(value).toLocaleString('fr-FR', { maximumFractionDigits: digits })
  : '—'

function noPain(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return !normalized || ['aucune', 'aucun', 'non', 'ras', 'r.a.s', 'aucune douleur', 'pas de douleur', '0'].includes(normalized)
}

function recovery() {
  const checkins = state.checkins.slice(-3)
  if (!checkins.length) {
    return {
      level: 'orange',
      label: 'À mesurer',
      text: 'Fais ton premier check-in pour obtenir un indicateur de récupération.'
    }
  }

  const sleep = avg(checkins.map((item) => Number(item.sleep)).filter(Number.isFinite))
  const feeling = avg(checkins.map((item) => Number(item.feeling)).filter(Number.isFinite))
  const pain = checkins.some((item) => !noPain(item.pain))

  if (pain || sleep < 5.5 || feeling < 5) {
    return {
      level: 'red',
      label: 'Récupération basse',
      text: 'Douleur, sommeil ou sensations insuffisants : garde de la marge et signale ce qui ne va pas.'
    }
  }
  if (sleep < 6.5 || feeling < 7) {
    return {
      level: 'orange',
      label: 'À surveiller',
      text: 'Tu peux suivre le plan, mais conserve le RIR prévu et surveille la fatigue.'
    }
  }
  return {
    level: 'green',
    label: 'Bonne récupération',
    text: 'Les derniers check-ins sont compatibles avec la progression prévue.'
  }
}

function addRecovery() {
  if (location.hash !== '#home' && location.hash !== '') return
  const host = document.querySelector('.metric-grid')
  if (!host || document.querySelector('.recovery-card')) return

  const current = recovery()
  host.insertAdjacentHTML('afterend', `
    <article class="recovery-card" data-level="${current.level}">
      <div class="recovery-dot">${current.level === 'green' ? '✓' : current.level === 'red' ? '!' : '·'}</div>
      <div><strong>${current.label}</strong><p>${current.text}</p></div>
    </article>`)
}

function lastPerformance(sessionId, exerciseIndex) {
  const history = state.history.filter((entry) => entry.sessionId === sessionId).reverse()
  const sets = history[0]?.exercises?.[exerciseIndex]?.sets || []
  if (!sets.length) return null

  const weights = sets.map((item) => item.weight).filter(Boolean)
  const reps = sets.map((item) => item.reps).filter(Boolean)
  const rirs = sets.map((item) => item.rir).filter(Boolean)
  return {
    weight: weights[0] || '—',
    reps: reps.join(' / ') || '—',
    rir: rirs.join(' / ') || '—'
  }
}

function enhanceWorkout() {
  const match = location.hash.match(/^#workout\/(.+)$/)
  if (!match) return
  const sessionId = match[1]

  document.querySelectorAll('.exercise-card').forEach((card, index) => {
    card.querySelectorAll('.ex-visual').forEach((node) => node.remove())
    const cues = card.querySelector('.exercise-cues')
    if (!cues) return

    const cue = cues.querySelector('p')
    if (cue && /exécution contrôlée|amplitude confortable|technique stable/i.test(cue.textContent || '')) cue.remove()
    if (card.querySelector('.last-performance')) return

    const performance = lastPerformance(sessionId, index)
    const html = performance
      ? `<div class="last-performance">
          <div><span>Dernière séance</span><strong>${performance.weight} · ${performance.reps} reps · RIR ${performance.rir}</strong></div>
          <div class="target-now"><span>Aujourd’hui</span><strong>Fais aussi bien ou mieux sans perdre la technique</strong></div>
        </div>`
      : `<div class="last-performance">
          <div><span>Première référence</span><strong>Choisis une charge adaptée au RIR demandé</strong></div>
          <div class="target-now"><span>Aujourd’hui</span><strong>Crée une base propre pour la prochaine séance</strong></div>
        </div>`

    const anchor = card.querySelector('.bf-machine') || cues
    anchor.insertAdjacentHTML('afterend', html)
  })
}

function enhanceNutrition() {
  if (location.hash !== '#nutrition') return
  document.querySelectorAll('.meal-card').forEach((card, index) => {
    if (card.classList.contains('enhanced')) return
    card.classList.add('enhanced')
    if (index === 0) card.classList.add('open')

    const head = card.querySelector('header')
    if (!head) return
    head.insertAdjacentHTML('beforeend', `<button class="meal-toggle" aria-label="Afficher les variantes">${index === 0 ? '−' : '+'}</button>`)

    const toggle = () => {
      card.classList.toggle('open')
      head.querySelector('.meal-toggle').textContent = card.classList.contains('open') ? '−' : '+'
    }
    head.querySelector('.meal-toggle').onclick = (event) => {
      event.stopPropagation()
      toggle()
    }
    head.onclick = toggle
  })
}

function isRecent(date, weekAgo) {
  return new Date(`${date}T12:00:00`).getTime() >= weekAgo
}

function weeklyNutrition(weekAgo) {
  const dates = new Set([
    ...Object.keys(state.nutritionDays || {}),
    ...Object.keys(state.foodLog || {})
  ])

  return [...dates]
    .filter((date) => isRecent(date, weekAgo))
    .map((date) => {
      const manual = state.nutritionDays?.[date] || {}
      const scanned = nutritionLogTotals(date)
      return {
        kcal: manual.kcal || (scanned.count ? scanned.kcal : null),
        protein: manual.protein || (scanned.count ? scanned.protein : null)
      }
    })
}

function weeklyData() {
  const weekAgo = Date.now() - 7 * 864e5
  const checkins = state.checkins.filter((item) => isRecent(item.date, weekAgo))
  const body = state.body.filter((item) => isRecent(item.date, weekAgo))
  const history = state.history.filter((item) => isRecent(item.date, weekAgo))
  const nutrition = weeklyNutrition(weekAgo)
  const first = body[0]
  const last = body.at(-1)

  return {
    sessions: history.length,
    weight: avg(body.map((item) => Number(item.weight)).filter(Number.isFinite)),
    deltaNavel: first && last ? Number(last.navel) - Number(first.navel) : null,
    sleep: avg(checkins.map((item) => Number(item.sleep)).filter(Number.isFinite)),
    feeling: avg(checkins.map((item) => Number(item.feeling)).filter(Number.isFinite)),
    kcal: avg(nutrition.map((item) => Number(item.kcal)).filter(Number.isFinite)),
    protein: avg(nutrition.map((item) => Number(item.protein)).filter(Number.isFinite)),
    pain: checkins.filter((item) => !noPain(item.pain)).map((item) => item.pain)
  }
}

function enhanceCheckin() {
  if (location.hash !== '#checkin' || document.querySelector('.coach-report-card')) return
  const form = document.querySelector('.check-form')
  if (!form) return

  const week = weeklyData()
  form.insertAdjacentHTML('beforebegin', `
    <article class="plain-card coach-report-card">
      <h3>Bilan des 7 derniers jours</h3>
      <p>Les données utiles pour ajuster ton coaching.</p>
      <div class="weekly-summary">
        <div><span>Séances</span><strong>${week.sessions}</strong></div>
        <div><span>Poids moyen</span><strong>${week.weight === null ? '—' : n(week.weight)} kg</strong></div>
        <div><span>Nombril</span><strong>${week.deltaNavel === null ? '—' : `${week.deltaNavel > 0 ? '+' : ''}${n(week.deltaNavel)} cm`}</strong></div>
        <div><span>Sommeil moyen</span><strong>${week.sleep === null ? '—' : `${n(week.sleep)} h`}</strong></div>
        <div><span>Calories moy.</span><strong>${week.kcal === null ? '—' : Math.round(week.kcal)}</strong></div>
        <div><span>Protéines moy.</span><strong>${week.protein === null ? '—' : `${Math.round(week.protein)} g`}</strong></div>
        <div><span>Sensations</span><strong>${week.feeling === null ? '—' : `${n(week.feeling)}/10`}</strong></div>
        <div><span>Douleurs</span><strong>${week.pain.length}</strong></div>
      </div>
      <button class="btn btn-secondary btn-block" id="copyWeekly">Copier le bilan</button>
    </article>`)

  document.querySelector('#copyWeekly').onclick = async () => {
    const current = recovery()
    const text = `APEX — Bilan 7 jours\nSéances: ${week.sessions}\nPoids moyen: ${week.weight === null ? '—' : n(week.weight)} kg\nÉvolution nombril: ${week.deltaNavel === null ? '—' : `${week.deltaNavel > 0 ? '+' : ''}${n(week.deltaNavel)} cm`}\nSommeil moyen: ${week.sleep === null ? '—' : n(week.sleep)} h\nCalories moyennes: ${week.kcal === null ? '—' : Math.round(week.kcal)}\nProtéines moyennes: ${week.protein === null ? '—' : Math.round(week.protein)} g\nSensations moyennes: ${week.feeling === null ? '—' : n(week.feeling)}/10\nDouleurs: ${week.pain.length ? week.pain.join(' | ') : 'Aucune'}\nRécupération: ${current.label}`
    try {
      await navigator.clipboard.writeText(text)
      document.querySelector('#copyWeekly').textContent = 'Bilan copié'
    } catch {
      prompt('Copie le bilan :', text)
    }
  }
}

function apply() {
  addRecovery()
  enhanceWorkout()
  enhanceNutrition()
  enhanceCheckin()
}

window.addEventListener('apex:rendered', apply)
apply()
