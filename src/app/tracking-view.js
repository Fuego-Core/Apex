import { J0, nutritionTargets } from './config.js'
import { recoveryAssessment, weeklySummary } from './coach-engine.js'
import { TODAY, nutritionDay, state } from './store.js'
import { esc, go, num, shell, top } from './ui.js'

function currentBody() {
  return [...(state.body || [])]
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .reduce((body, row) => ({ ...body, ...row }), { ...J0 })
}

function latestCheckin() {
  return [...(state.checkins || [])]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null
}

function delta(current, start, unit) {
  const value = Number(current) - Number(start)
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) return `stable`
  return `${value > 0 ? '+' : '−'}${num(Math.abs(value))} ${unit}`
}

export function trackingPage() {
  const today = TODAY()
  const nutrition = nutritionDay(today)
  const body = currentBody()
  const checkin = latestCheckin()
  const summary = weeklySummary()
  const recovery = recoveryAssessment()
  const nutritionTracked = nutrition.source !== 'empty'
  const checkedToday = checkin?.date === today
  const score = summary.adherence === null ? null : summary.adherence
  const weightDelta = delta(body.weight, J0.weight, 'kg')
  const navelDelta = delta(body.navel, J0.navel, 'cm')

  shell(`
    ${top('Progrès', 'Ta recomposition en un coup d’œil')}

    <section class="v3-progress-hero">
      <div class="v3-progress-copy">
        <span>OBJECTIF ACTUEL</span>
        <h2>Plus athlétique.<br>Plus fort. Plus sec.</h2>
        <p>APEX regarde ensemble ton nombril, ton poids moyen, tes performances, ta récupération et ta régularité.</p>
      </div>
      <div class="v3-progress-goal">
        <span>ADHÉRENCE 7 J</span>
        <strong>${score === null ? '—' : `${score}%`}</strong>
        <small>${score === null ? 'Pas encore assez de données' : score >= 80 ? 'Très bonne régularité' : score >= 60 ? 'Base correcte' : 'À consolider'}</small>
      </div>
    </section>

    <section class="v3-kpi-row">
      <article><span>POIDS</span><strong>${num(body.weight)} kg</strong><small>${weightDelta} depuis J0</small></article>
      <article><span>NOMBRIL</span><strong>${num(body.navel)} cm</strong><small>${navelDelta} depuis J0</small></article>
      <article><span>SÉANCES 7 J</span><strong>${summary.sessions || 0}</strong><small>sur 4 prévues</small></article>
    </section>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>TES PILIERS</span><h2>Ce qui fait bouger le physique</h2></div><small>Pas un seul chiffre isolé</small></div>
      <div class="v3-progress-modules">
        <button data-go="progress" class="v3-progress-module v3-progress-module--body">
          <div><span>CORPS</span><strong>Mensurations & photos</strong><p>${num(body.weight)} kg · ${num(body.navel)} cm nombril</p></div><b>›</b>
        </button>
        <button data-go="checkin" class="v3-progress-module v3-progress-module--recovery">
          <div><span>RÉCUPÉRATION</span><strong>${esc(recovery.title)}</strong><p>${checkedToday ? `${esc(checkin.sleep || '—')} h de sommeil · check-in fait` : 'Sommeil, fatigue, stress, courbatures et douleurs'}</p></div><b>›</b>
        </button>
        <button data-go="program" class="v3-progress-module v3-progress-module--training">
          <div><span>PERFORMANCE</span><strong>${summary.sessions || 0} séance${summary.sessions > 1 ? 's' : ''} sur 7 jours</strong><p>Charges, reps, RIR et assistance tractions/dips</p></div><b>›</b>
        </button>
      </div>
    </section>

    <section class="v3-weekly-review">
      <div class="v3-section-title"><div><span>BILAN 7 JOURS</span><h2>Ta régularité</h2></div><small>Comprendre avant d’ajuster</small></div>
      <div class="v3-review-grid">
        <div><strong>${summary.sessions || 0}/4</strong><span>séances</span></div>
        <div><strong>${summary.nutritionDays || 0}/7</strong><span>jours nutrition</span></div>
        <div><strong>${summary.checkinDays || 0}/7</strong><span>check-ins</span></div>
        <div><strong>${summary.sleepAvg === null ? '—' : `${num(summary.sleepAvg)} h`}</strong><span>sommeil moyen</span></div>
      </div>
      <p>${score === null ? 'Ajoute quelques jours de données avant d’interpréter les tendances.' : score >= 80 ? 'Tes données sont assez régulières pour commencer à interpréter les tendances sérieusement.' : 'Avant de modifier calories ou entraînement, améliore d’abord la régularité des données et de l’exécution.'}</p>
    </section>

    <section class="v3-progress-today">
      <div><span>AUJOURD’HUI</span><strong>${nutritionTracked ? `${Math.round(Number(nutrition.kcal) || 0)} / ${nutritionTargets.kcal} kcal` : 'Nutrition non commencée'}</strong><small>${nutritionTracked ? `${Math.round(Number(nutrition.protein) || 0)} / ${nutritionTargets.protein} g protéines` : 'Scanne ou ajoute ton premier repas'}</small></div>
      <button data-go="nutrition">Nutrition <b>›</b></button>
    </section>

    <section class="v3-coach-report-card">
      <span>COACH APEX</span>
      <strong>Transforme tes données en décision.</strong>
      <p>Le rapport rassemble poids moyen, nombril, entraînements, nutrition, sommeil, fatigue et douleurs pour que ChatGPT puisse ajuster le plan avec du contexte.</p>
      <button data-go="checkin">Check-in & rapport Coach</button>
    </section>
  `, 'tracking')

  document.querySelectorAll('[data-go]').forEach((button) => {
    button.onclick = () => go(button.dataset.go)
  })
}
