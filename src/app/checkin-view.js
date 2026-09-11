import { J0 } from './config.js'
import { nutritionDay, save, state, TODAY } from './store.js'
import { mandatoryDone, phase } from './training.js'
import { esc, go, section, shell, top } from './ui.js'

function currentBody() {
  return [...(state.body || [])]
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .reduce((body, row) => ({ ...body, ...row }), { ...J0 })
}

export function checkinPage() {
  const today = TODAY()
  const nutrition = nutritionDay(today)
  const existing = state.checkins.find((item) => item.date === today) || {}

  shell(`
    ${top('Check-in', '30 secondes après la journée ou la séance')}
    <form class="check-form" id="cf">
      <label>Sommeil (h)<input name="sleep" inputmode="decimal" required value="${esc(existing.sleep || '')}"></label>
      <label>Sensations /10<input name="feeling" inputmode="numeric" required value="${esc(existing.feeling || '')}"></label>
      <label>Calories<input name="kcal" value="${esc(nutrition.kcal || existing.kcal || '')}"></label>
      <label>Protéines (g)<input name="protein" value="${esc(nutrition.protein || existing.protein || '')}"></label>
      <label>Douleur ou gêne<textarea name="pain" rows="3" placeholder="Aucune, ou précise la zone">${esc(existing.pain || '')}</textarea></label>
      <button class="btn btn-primary btn-block">${existing.date ? 'Mettre à jour le check-in' : 'Enregistrer le check-in'}</button>
    </form>

    ${section('Rapport coach')}
    <article class="plain-card">
      <p class="nutrition-note">Copie ce rapport dans notre conversation pour que j’ajuste le programme à partir de données réelles.</p>
      <button class="btn btn-secondary btn-block" id="report">Copier le rapport</button>
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
    const body = currentBody()
    const last = state.checkins.find((item) => item.date === today) || state.checkins.at(-1)
    const text = `APEX — Rapport coach\nSemaine ${state.currentWeek}/6 (${phase().label})\nSéances semaine: ${mandatoryDone()}/4\nPoids: ${body.weight ?? '—'} kg | Nombril: ${body.navel ?? '—'} cm\nSommeil: ${last?.sleep ?? '—'} h | Sensations: ${last?.feeling ?? '—'}/10\nCalories: ${nutrition.kcal || last?.kcal || '—'} | Protéines: ${nutrition.protein || last?.protein || '—'} g\nDouleur/gêne: ${last?.pain || 'Aucune'}\nHistorique total: ${state.history.length} séances`
    try {
      await navigator.clipboard.writeText(text)
      document.querySelector('#report').textContent = 'Rapport copié'
    } catch {
      prompt('Copie le rapport :', text)
    }
  }
}
