import { nutritionDay, save, state, TODAY } from './store.js'
import { home, mandatoryDone, phase } from './training.js'
import { esc, section, shell, top } from './ui.js'

export function checkinPage() {
  const nutrition = nutritionDay(TODAY())

  shell(`
    ${top('Check-in', '30 secondes après la journée ou la séance')}
    <form class="check-form" id="cf">
      <label>Sommeil (h)<input name="sleep" inputmode="decimal" required></label>
      <label>Sensations /10<input name="feeling" inputmode="numeric" required></label>
      <label>Calories<input name="kcal" value="${esc(nutrition.kcal)}"></label>
      <label>Protéines (g)<input name="protein" value="${esc(nutrition.protein)}"></label>
      <label>Douleur ou gêne<textarea name="pain" rows="3" placeholder="Aucune, ou précise la zone"></textarea></label>
      <button class="btn btn-primary btn-block">Enregistrer le check-in</button>
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
    state.checkins.push({
      date: TODAY(),
      sleep: form.get('sleep'),
      feeling: form.get('feeling'),
      kcal: form.get('kcal'),
      protein: form.get('protein'),
      pain: form.get('pain')
    })
    save()
    home()
  }

  document.querySelector('#report').onclick = async () => {
    const body = state.body.at(-1)
    const last = state.checkins.at(-1)
    const text = `APEX — Rapport coach\nSemaine ${state.currentWeek}/6 (${phase().label})\nSéances semaine: ${mandatoryDone()}/4\nPoids: ${body?.weight ?? '—'} kg | Nombril: ${body?.navel ?? '—'} cm\nSommeil: ${last?.sleep ?? '—'} h | Sensations: ${last?.feeling ?? '—'}/10\nCalories: ${last?.kcal ?? '—'} | Protéines: ${last?.protein ?? '—'} g\nDouleur/gêne: ${last?.pain || 'Aucune'}\nHistorique total: ${state.history.length} séances`
    try {
      await navigator.clipboard.writeText(text)
      document.querySelector('#report').textContent = 'Rapport copié'
    } catch {
      prompt('Copie le rapport :', text)
    }
  }
}
