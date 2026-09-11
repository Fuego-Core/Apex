import { J0, nutritionTargets, phases, sessions } from './config.js'
import { recoveryAssessment, weeklySummary } from './coach-engine.js'
import { TODAY, nutritionDay, state } from './store.js'
import { esc, go, num, shell, top } from './ui.js'

function sessionKey(id) {
  return `${state.currentWeek}:${id}`
}

function isDone(id) {
  return !!state.sessions?.[sessionKey(id)]?.completed
}

function mandatorySessions() {
  return sessions.filter((session) => !session.optional)
}

function nextSession() {
  return mandatorySessions().find((session) => !isDone(session.id)) || mandatorySessions()[0]
}

function currentBody() {
  return [...(state.body || [])]
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .reduce((body, row) => ({ ...body, ...row }), { ...J0 })
}

function dateLabel() {
  const value = new Intl.DateTimeFormat('fr-BE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date())
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function remaining(value, target) {
  return Math.max(0, Math.round(target - (Number(value) || 0)))
}

function recoveryTone(level) {
  if (level === 'alert') return 'danger'
  if (level === 'watch') return 'warning'
  return 'success'
}

export function homePage() {
  const today = TODAY()
  const phase = phases[state.currentWeek - 1] || phases[0]
  const session = nextSession()
  const completed = mandatorySessions().filter((item) => isDone(item.id)).length
  const checkedIn = (state.checkins || []).some((item) => item.date === today)
  const nutrition = nutritionDay(today)
  const nutritionTracked = nutrition.source !== 'empty'
  const body = currentBody()
  const recovery = recoveryAssessment()
  const summary = weeklySummary()
  const kcalLeft = remaining(nutrition.kcal, nutritionTargets.kcal)
  const proteinLeft = remaining(nutrition.protein, nutritionTargets.protein)
  const weekPct = Math.round(completed / mandatorySessions().length * 100)

  shell(`
    ${top('Aujourd’hui', `${dateLabel()} · Semaine ${state.currentWeek} · ${phase.label}`)}

    <section class="v3-daily-hero">
      <div class="v3-daily-copy">
        <span class="v3-eyebrow">PROCHAINE ACTION</span>
        <h2>${checkedIn ? `Prépare ${esc(session.name)}` : 'Commence par ton check-in'}</h2>
        <p>${checkedIn ? `${esc(session.subtitle)} · RIR ${phase.rir}` : 'Quelques secondes pour adapter correctement ta journée.'}</p>
      </div>
      <button class="v3-hero-action" data-go="${checkedIn ? `workout/${session.id}` : 'checkin'}">
        <span>${checkedIn ? 'Démarrer' : 'Faire le check-in'}</span><b>›</b>
      </button>
    </section>

    <section class="v3-recovery v3-recovery--${recoveryTone(recovery.level)}">
      <div><span>RÉCUPÉRATION</span><strong>${esc(recovery.title)}</strong></div>
      <p>${esc(recovery.message)}</p>
      <button data-go="checkin">${checkedIn ? 'Voir le check-in' : 'Compléter'}</button>
    </section>

    <div class="v3-primary-actions">
      <button data-go="workout/${session.id}" class="v3-action-card v3-action-card--training">
        <span>ENTRAÎNEMENT</span><strong>${esc(session.name)}</strong><small>${completed}/4 séances cette semaine</small><i>›</i>
      </button>
      <button data-go="nutrition" class="v3-action-card">
        <span>NUTRITION</span><strong>${nutritionTracked ? `${kcalLeft} kcal restantes` : 'Commencer la journée'}</strong><small>${nutritionTracked ? `${proteinLeft} g protéines restantes` : `${nutritionTargets.kcal} kcal · ${nutritionTargets.protein} g protéines`}</small><i>›</i>
      </button>
      <button data-go="progress" class="v3-action-card">
        <span>PROGRESSION</span><strong>${num(body.weight)} kg</strong><small>${num(body.navel)} cm au nombril</small><i>›</i>
      </button>
    </div>

    <section class="v3-week-card">
      <header><div><span>TA SEMAINE</span><strong>${completed}/4 séances réalisées</strong></div><b>${weekPct}%</b></header>
      <div class="v3-week-progress"><i style="width:${weekPct}%"></i></div>
      <div class="v3-week-sessions">
        ${mandatorySessions().map((item, index) => `<button data-go="workout/${item.id}" class="${isDone(item.id) ? 'done' : item.id === session.id ? 'next' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><strong>${esc(item.name)}</strong><small>${isDone(item.id) ? 'Terminé' : item.id === session.id ? 'À faire' : 'À venir'}</small></button>`).join('')}
      </div>
    </section>

    <section class="v3-insight-card">
      <div class="v3-insight-head"><span>BILAN 7 JOURS</span><button data-go="tracking">Voir le suivi</button></div>
      <div class="v3-insight-grid">
        <div><strong>${summary.sessions || 0}</strong><span>séances</span></div>
        <div><strong>${summary.nutritionDays || 0}</strong><span>jours nutrition</span></div>
        <div><strong>${summary.checkinDays || 0}</strong><span>check-ins</span></div>
        <div><strong>${summary.adherence ?? '—'}${summary.adherence !== null ? '%' : ''}</strong><span>adhérence</span></div>
      </div>
    </section>
  `, 'home')

  document.querySelectorAll('[data-go]').forEach((button) => {
    button.onclick = () => go(button.dataset.go)
  })
}
