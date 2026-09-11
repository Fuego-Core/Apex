import { J0 } from './config.js'
import { TODAY, save, state } from './store.js'
import { coach, num, section, shell, top } from './ui.js'

export function progressPage() {
  const body = state.body.at(-1) || J0

  shell(`
    ${top('Progrès', 'Poids, tour de nombril et performances')}
    <div class="metric-grid">
      <article class="metric"><span>Poids actuel</span><strong>${num(body.weight)} kg</strong><small>J0 75 kg</small></article>
      <article class="metric"><span>Nombril actuel</span><strong>${num(body.navel)} cm</strong><small>J0 96 cm</small></article>
    </div>

    ${section('Nouveau relevé')}
    <article class="plain-card food-log">
      <div class="form-grid">
        <label>Poids<input id="weight" inputmode="decimal"></label>
        <label>Nombril<input id="navel" inputmode="decimal"></label>
      </div>
      <button class="btn btn-primary btn-block" id="saveBody">Enregistrer</button>
    </article>

    ${section('Point zéro')}
    <div class="macro-grid">
      ${[
        ['Poitrine', J0.chest],
        ['Taille', J0.waist],
        ['Hanches', J0.hips],
        ['Bras', J0.armL],
        ['Cuisses', J0.thighL],
        ['Mollets', J0.calfL]
      ].map(([label, value]) => `<article><span>${label}</span><strong>${value} cm</strong></article>`).join('')}
    </div>
    ${coach('Lecture du progrès', 'On cherche une baisse graduelle du tour de nombril avec des performances qui remontent. Le poids seul ne décide pas.')}
  `, 'progress')

  document.querySelector('#saveBody').onclick = () => {
    const weight = parseFloat(document.querySelector('#weight').value.replace(',', '.'))
    const navel = parseFloat(document.querySelector('#navel').value.replace(',', '.'))
    if (!weight && !navel) return

    state.body.push({
      date: TODAY(),
      weight: weight || body.weight,
      navel: navel || body.navel
    })
    save()
    progressPage()
  }
}
