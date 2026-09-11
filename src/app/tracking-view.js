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

function pct(value, target) {
  if (!target) return 0
  return Math.max(0, Math.min(100, Math.round((Number(value) || 0) / target * 100)))
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
  const hasWeeklyData = summary.sessions > 0 || summary.nutritionDays > 0 || summary.checkinDays > 0
  const score = hasWeeklyData && summary.adherence !== null ? summary.adherence : null

  shell(`
    ${top('Suivi', 'Nutrition · corps · récupération')}

    <section class="tracking-overview">
      <div class="tracking-overview__copy">
        <p class="kicker">7 DERNIERS JOURS</p>
        <h2>${esc(recovery.title)}</h2>
        <p>${summary.sessions} séance${summary.sessions > 1 ? 's' : ''} · ${summary.nutritionDays} jour${summary.nutritionDays > 1 ? 's' : ''} nutrition · ${summary.checkinDays} check-in${summary.checkinDays > 1 ? 's' : ''}.</p>
      </div>
      <div class="tracking-score ${score !== null ? 'is-ready' : ''}">
        <strong>${score === null ? '—' : score}</strong>
        <span>${score === null ? 'données' : 'adhérence'}</span>
      </div>
    </section>

    <div class="tracking-stack">
      <button class="tracking-card tracking-card--nutrition" data-track="nutrition">
        <div class="tracking-card__icon">N</div>
        <div class="tracking-card__body">
          <span>Nutrition</span>
          <strong>${nutritionTracked ? `${Math.round(Number(nutrition.kcal) || 0)} / ${nutritionTargets.kcal} kcal` : 'Aucun aliment aujourd’hui'}</strong>
          <small>${nutritionTracked ? `${Math.round(Number(nutrition.protein) || 0)} / ${nutritionTargets.protein} g protéines` : 'Scanner · stock · recettes · journal'}</small>
          <i><b style="width:${pct(nutrition.kcal, nutritionTargets.kcal)}%"></b></i>
        </div>
        <div class="tracking-card__arrow">›</div>
      </button>

      <button class="tracking-card tracking-card--body" data-track="progress">
        <div class="tracking-card__icon">C</div>
        <div class="tracking-card__body">
          <span>Corps & progression</span>
          <strong>${num(body.weight)} kg · ${num(body.navel)} cm nombril</strong>
          <small>${summary.weightAvg !== null ? `Moyenne 7 j : ${num(summary.weightAvg)} kg` : 'Poids · nombril · mensurations · tendances'}</small>
        </div>
        <div class="tracking-card__arrow">›</div>
      </button>

      <button class="tracking-card tracking-card--recovery ${checkedToday ? 'is-done' : ''}" data-track="checkin">
        <div class="tracking-card__icon">R</div>
        <div class="tracking-card__body">
          <span>Récupération</span>
          <strong>${checkedToday ? `${esc(checkin.sleep || '—')} h · ${esc(checkin.feeling || '—')}/10` : recovery.label}</strong>
          <small>${checkedToday ? (checkin.pain ? `Gêne : ${esc(checkin.pain)}` : 'Check-in du jour enregistré') : 'Sommeil · fatigue · motivation · douleurs'}</small>
        </div>
        <div class="tracking-card__arrow">›</div>
      </button>
    </div>

    <section class="tracking-tip">
      <span>APEX</span>
      <p>${score === null ? 'Enregistre quelques journées avant d’interpréter les tendances.' : 'Le score explique la régularité. Il ne juge pas une journée isolée et ne déclenche jamais seul une baisse de calories.'}</p>
    </section>
  `, 'tracking')

  document.querySelectorAll('[data-track]').forEach((button) => {
    button.onclick = () => go(button.dataset.track)
  })
}
