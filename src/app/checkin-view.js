import { buildCoachReport, weeklySummary } from './coach-engine.js'
import { nutritionDay, save, state, TODAY } from './store.js'
import { esc, go, section, shell, top } from './ui.js'

function format(value, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('fr-FR', { maximumFractionDigits: digits })
}

export function checkinPage() {
  const today = TODAY()
  const nutrition = nutritionDay(today)
  const existing = state.checkins.find((item) => item.date === today) || {}
  const week = weeklySummary()

  shell(`
    ${top('Check-in', '30 secondes pour enrichir ton coaching')}

    <section class="checkin-summary">
      <div><span>7 JOURS</span><strong>${week.sessions}/4 séances</strong><small>${week.checkinDays}/7 check-ins · ${week.nutritionDays}/7 jours nutrition suivis</small></div>
      <div><span>ADHÉRENCE</span><strong>${week.adherence === null ? '—' : `${week.adherence}/100`}</strong><small>Indicative, selon les données disponibles</small></div>
    </section>

    <form class="check-form" id="cf">
      <label>Sommeil (h)<input name="sleep" inputmode="decimal" required value="${esc(existing.sleep || '')}"></label>
      <label>Sensations /10<input name="feeling" inputmode="numeric" required value="${esc(existing.feeling || '')}"></label>
      <label>Calories<input name="kcal" value="${esc(nutrition.kcal || existing.kcal || '')}"></label>
      <label>Protéines (g)<input name="protein" value="${esc(nutrition.protein || existing.protein || '')}"></label>
      <label>Douleur ou gêne<textarea name="pain" rows="3" placeholder="Aucune, ou précise la zone">${esc(existing.pain || '')}</textarea></label>
      <button class="btn btn-primary btn-block">${existing.date ? 'Mettre à jour le check-in' : 'Enregistrer le check-in'}</button>
    </form>

    ${section('Rapport Coach APEX')}
    <article class="plain-card coach-export-card">
      <div class="coach-export-stats">
        <div><span>Poids moyen</span><strong>${format(week.weightAvg)} kg</strong></div>
        <div><span>Nombril</span><strong>${format(week.latestNavel)} cm</strong></div>
        <div><span>Sommeil moyen</span><strong>${format(week.sleepAvg)} h</strong></div>
        <div><span>Protéines moy.</span><strong>${format(week.proteinAvg, 0)} g</strong></div>
      </div>
      <p class="nutrition-note">Le rapport rassemble les tendances utiles pour que ChatGPT puisse décider avec de vraies données, sans modifier le plan sur une seule mauvaise journée.</p>
      <button class="btn btn-secondary btn-block" id="report">Copier le rapport complet</button>
    </article>
  `, 'checkin')

  document.querySelector('#cf').onsubmit = (event) => {
    event.preventDefault()
    const form = new FormData(event.target)
    const entry = {
      ...existing,
      date: today,
      sleep: form.get('sleep'),
      feeling: form.get('feeling'),
      kcal: form.get('kcal'),
      protein: form.get('protein'),
      pain: form.get('pain'),
      updatedAt: new Date().toISOString()
    }
    const index = state.checkins.findIndex((item) => item.date === today)
    if (index >= 0) state.checkins[index] = entry
    else state.checkins.push(entry)
    save()
    go('home')
  }

  document.querySelector('#report').onclick = async () => {
    const text = buildCoachReport()
    try {
      await navigator.clipboard.writeText(text)
      document.querySelector('#report').textContent = 'Rapport copié ✓'
    } catch {
      prompt('Copie le rapport :', text)
    }
  }
}
