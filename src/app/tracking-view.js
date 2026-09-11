import { J0, nutritionTargets } from './config.js'
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
  const nutritionTracked = nutrition.source !== 'empty'
  const checkedToday = checkin?.date === today

  shell(`
    ${top('Suivi', 'Nutrition · corps · récupération')}

    <section class="tracking-overview">
      <div class="tracking-overview__copy">
        <p class="kicker">TON ÉTAT</p>
        <h2>${checkedToday ? 'Données du jour à jour' : 'Complète ton suivi du jour'}</h2>
        <p>APEX regroupe ici ce qui influence directement tes décisions : alimentation, évolution du corps et récupération.</p>
      </div>
      <div class="tracking-score ${checkedToday ? 'is-ready' : ''}">
        <strong>${checkedToday ? '✓' : '3'}</strong>
        <span>${checkedToday ? 'check-in' : 'piliers'}</span>
      </div>
    </section>

    <div class="tracking-stack">
      <button class="tracking-card tracking-card--nutrition" data-track="nutrition">
        <div class="tracking-card__icon">N</div>
        <div class="tracking-card__body">
          <span>Nutrition</span>
          <strong>${nutritionTracked ? `${Math.round(Number(nutrition.kcal) || 0)} / ${nutritionTargets.kcal} kcal` : 'Commencer la journée'}</strong>
          <small>${nutritionTracked ? `${Math.round(Number(nutrition.protein) || 0)} / ${nutritionTargets.protein} g protéines` : 'Scanner · stock · recettes · journal'}</small>
          <i><b style="width:${pct(nutrition.kcal, nutritionTargets.kcal)}%"></b></i>
        </div>
        <div class="tracking-card__arrow">›</div>
      </button>

      <button class="tracking-card tracking-card--body" data-track="progress">
        <div class="tracking-card__icon">C</div>
        <div class="tracking-card__body">
          <span>Corps & progression</span>
          <strong>${num(body.weight)} kg · ${num(body.navel)} cm</strong>
          <small>Poids · nombril · mensurations · tendances</small>
        </div>
        <div class="tracking-card__arrow">›</div>
      </button>

      <button class="tracking-card tracking-card--recovery ${checkedToday ? 'is-done' : ''}" data-track="checkin">
        <div class="tracking-card__icon">R</div>
        <div class="tracking-card__body">
          <span>Récupération</span>
          <strong>${checkedToday ? `${esc(checkin.sleep || '—')} h · ${esc(checkin.feeling || '—')}/10` : 'Check-in à faire'}</strong>
          <small>${checkedToday ? (checkin.pain ? `Gêne : ${esc(checkin.pain)}` : 'Aucune gêne signalée') : 'Sommeil · sensations · douleurs · rapport coach'}</small>
        </div>
        <div class="tracking-card__arrow">›</div>
      </button>
    </div>

    <section class="tracking-tip">
      <span>APEX</span>
      <p>Tu n’as pas besoin de tout remplir tout le temps. Enregistre seulement ce qui est utile aujourd’hui ; le coach s’appuie ensuite sur les tendances.</p>
    </section>
  `, 'tracking')

  document.querySelectorAll('[data-track]').forEach((button) => {
    button.onclick = () => go(button.dataset.track)
  })
}
