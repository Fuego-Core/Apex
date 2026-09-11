import { buildCoachReport, weeklySummary } from './coach-engine.js'
import { nutritionDay, save, state, TODAY } from './store.js'
import { esc, go, shell, top } from './ui.js'

function format(value, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('fr-FR', { maximumFractionDigits: digits })
}

function slider(name, label, value, hint, reverse = false) {
  const initial = Number(value) || 5
  return `<label class="v3-check-slider">
    <div><span>${label}</span><small>${hint}</small><output data-output="${name}">${initial}</output></div>
    <input type="range" min="1" max="10" step="1" name="${name}" value="${initial}" data-slider="${name}" class="${reverse ? 'reverse' : ''}">
    <div class="v3-check-scale"><span>1</span><span>10</span></div>
  </label>`
}

export function checkinPage() {
  const today = TODAY()
  const nutrition = nutritionDay(today)
  const existing = state.checkins.find((item) => item.date === today) || {}
  const week = weeklySummary()
  const done = !!existing.date

  shell(`
    ${top('Check-in', 'Au réveil · quelques secondes pour guider la journée')}

    <section class="v3-checkin-hero ${done ? 'done' : ''}">
      <div><span>${done ? 'CHECK-IN DU JOUR' : 'AVANT DE COMMENCER'}</span><h2>${done ? 'Données enregistrées' : 'Comment tu récupères ?'}</h2><p>APEX utilise ces signaux pour te conseiller sans modifier agressivement ton programme.</p></div>
      <b>${done ? '✓' : '30 s'}</b>
    </section>

    <form class="v3-checkin-form" id="cf">
      <section class="v3-sleep-card">
        <div><span>SOMMEIL</span><strong>Combien d’heures ?</strong><small>Ta nuit réelle, pas l’heure passée au lit.</small></div>
        <label><input name="sleep" type="number" min="0" max="14" step="0.1" inputmode="decimal" required value="${esc(existing.sleep || '')}" placeholder="7.0"><span>h</span></label>
      </section>

      <section class="v3-checkin-sliders">
        ${slider('feeling', 'Forme générale', existing.feeling, '1 = très mauvaise · 10 = excellente')}
        ${slider('fatigue', 'Fatigue', existing.fatigue, '1 = fraîcheur · 10 = épuisé', true)}
        ${slider('motivation', 'Motivation', existing.motivation, '1 = aucune · 10 = très motivé')}
        ${slider('soreness', 'Courbatures', existing.soreness, '1 = aucune · 10 = très fortes', true)}
        ${slider('stress', 'Stress', existing.stress, '1 = calme · 10 = très élevé', true)}
      </section>

      <section class="v3-pain-card">
        <div><span>DOULEUR / GÊNE</span><strong>Quelque chose à signaler ?</strong></div>
        <textarea name="pain" rows="3" placeholder="Aucune, ou précise la zone et le mouvement concerné">${esc(existing.pain || '')}</textarea>
      </section>

      <details class="v3-advanced-tools v3-checkin-nutrition">
        <summary><span>OPTIONNEL</span><strong>Nutrition du jour</strong><b>›</b></summary>
        <div class="v3-advanced-body">
          <div class="form-grid">
            <label>Calories<input name="kcal" inputmode="numeric" value="${esc(nutrition.kcal || existing.kcal || '')}"></label>
            <label>Protéines (g)<input name="protein" inputmode="numeric" value="${esc(nutrition.protein || existing.protein || '')}"></label>
          </div>
        </div>
      </details>

      <button class="v3-checkin-save">${done ? 'Mettre à jour mon check-in' : 'Enregistrer mon check-in'}</button>
    </form>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>COACH APEX</span><h2>Rapport 7 jours</h2></div><small>À copier dans notre conversation</small></div>
      <article class="v3-report-card">
        <div class="v3-report-grid">
          <div><span>POIDS MOYEN</span><strong>${format(week.weightAvg)} kg</strong></div>
          <div><span>NOMBRIL</span><strong>${format(week.latestNavel)} cm</strong></div>
          <div><span>SOMMEIL</span><strong>${format(week.sleepAvg)} h</strong></div>
          <div><span>PROTÉINES</span><strong>${format(week.proteinAvg, 0)} g</strong></div>
        </div>
        <p>Le rapport rassemble entraînement, nutrition, récupération et tendances corporelles pour décider avec du contexte, pas sur une journée isolée.</p>
        <button type="button" id="report">Copier le rapport Coach</button>
      </article>
    </section>
  `, 'checkin')

  document.querySelectorAll('[data-slider]').forEach((input) => {
    input.oninput = () => {
      const output = document.querySelector(`[data-output="${input.dataset.slider}"]`)
      if (output) output.textContent = input.value
    }
  })

  document.querySelector('#cf').onsubmit = (event) => {
    event.preventDefault()
    const form = new FormData(event.target)
    const entry = {
      ...existing,
      date: today,
      sleep: form.get('sleep'),
      feeling: form.get('feeling'),
      fatigue: form.get('fatigue'),
      motivation: form.get('motivation'),
      soreness: form.get('soreness'),
      stress: form.get('stress'),
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
