/* PROGRESSION — le centre de ce qui change.

   Un seul écran répond à « est-ce que j'avance ? », domaine par domaine :
   le poids, les mesures, la force, les objectifs. Chaque section montre LE
   chiffre qui compte et où il va — le détail vit dans son écran dédié.

   Cette vue ne calcule rien de nouveau : elle compose les mêmes fonctions
   que les écrans existants. Aucun chiffre n'y a une deuxième définition. */

import { getState } from '../state.js'
import { currentAverage, latest, trend, latestChange, series, today } from '../core/body.js'
import { evaluateGoal } from '../core/goals.js'
import { esc, header, num, duration, relativeDays } from '../ui.js'
import { tile, meter, blank, sectionTitle, sparkline } from '../ui/components.js'

function trendLabel(t, unit) {
  if (!t || t.status !== 'ok') return 'pas encore assez de mesures'
  if (t.direction === 'stable') return `stable sur ${t.days} jours`
  return `${t.perWeek < 0 ? '↓' : '↑'} ${num(Math.abs(t.perWeek))} ${unit}/semaine`
}

function weightSection(state) {
  const weight = state.body.weight
  if (!weight.length) {
    return `
      ${sectionTitle('Poids')}
      ${blank({
        title: 'Commence par te peser',
        text: 'Une pesée par jour, toujours au même moment. APEX lisse les variations et te dit où tu vas vraiment.',
        actionLabel: 'Ajouter mon poids',
        act: 'add-weight'
      })}`
  }

  const avg = currentAverage(weight)
  const t = trend(weight)
  const points = series(weight, { days: 90 })

  return `
    ${sectionTitle('Poids', { href: '#/corps', linkLabel: 'Détail' })}
    <a class="strip metric reveal" href="#/corps">
      <div class="metric__main">
        <p class="metric__value">${avg === null ? '—' : num(avg)}<span class="metric__unit">kg</span></p>
        <p class="metric__hint">moyenne 7 jours · ${esc(trendLabel(t, 'kg'))}</p>
      </div>
      ${points.length > 1 ? `<div class="metric__spark">${sparkline(points)}</div>` : ''}
    </a>`
}

function waistSection(state) {
  const waist = state.body.waist
  if (!waist.length) return ''

  const last = latest(waist)
  const change = latestChange(waist)
  return `
    ${sectionTitle('Mesures', { href: '#/corps', linkLabel: 'Détail' })}
    <a class="strip metric reveal" href="#/corps">
      <div class="metric__main">
        <p class="metric__value">${num(last.value)}<span class="metric__unit">cm</span></p>
        <p class="metric__hint">tour de taille · ${
          change
            ? `${change.delta > 0 ? '↑' : '↓'} ${num(Math.abs(change.delta))} cm en ${change.days} j`
            : 'pas encore de recul'
        }</p>
      </div>
    </a>`
}

function strengthSection(state) {
  if (!state.history.length) {
    return `
      ${sectionTitle('Force')}
      ${blank({
        title: 'Aucune séance terminée',
        text: 'Termine ta première séance : chaque exercice aura sa courbe, ses records et sa progression.'
      })}`
  }

  const last = state.history[0]
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const monthCount = state.history.filter((h) => h.startedAt >= cutoff.toISOString()).length
  const records = state.history.slice(0, 5).reduce(
    (total, h) => total + h.entries.filter((e) => e.record).length,
    0
  )

  return `
    ${sectionTitle('Force', { href: '#/historique', linkLabel: 'Historique' })}
    <a class="strip metric reveal" href="#/historique">
      <div class="metric__main">
        <p class="metric__value">${monthCount}<span class="metric__unit">séance${monthCount > 1 ? 's' : ''} / 30 j</span></p>
        <p class="metric__hint">
          dernière : ${esc(last.sessionName)} · ${esc(relativeDays(last.startedAt))}${last.durationSec ? ` · ${esc(duration(last.durationSec))}` : ''}${records ? ` · ${records} record${records > 1 ? 's' : ''} récemment` : ''}
        </p>
      </div>
    </a>`
}

function goalsSection(state) {
  if (!state.goals.length) {
    return `
      ${sectionTitle('Objectifs')}
      ${blank({
        title: 'Fixe un cap',
        text: 'Un poids, un développé couché, un rythme hebdomadaire. APEX suit la valeur réelle, pas une intention.',
        actionLabel: 'Créer un objectif',
        act: 'add-goal'
      })}`
  }

  const context = { body: state.body, history: state.history }
  const rows = state.goals
    .slice(0, 3)
    .map((goal) => {
      const r = evaluateGoal(goal, context)
      return `
        <div class="goal">
          <div class="goal__head">
            <span class="goal__title">${esc(goal.title)}</span>
            <span class="goal__values">
              ${r.hasData ? `<strong>${esc(num(r.current))}</strong>` : '<strong>—</strong>'} / ${esc(num(r.target))} ${esc(goal.unit)}
            </span>
          </div>
          ${meter(r.pct, { done: r.done })}
        </div>`
    })
    .join('')

  return `
    ${sectionTitle('Objectifs', { href: '#/objectifs', linkLabel: state.goals.length > 3 ? `Les ${state.goals.length}` : 'Gérer' })}
    <a class="strip reveal" href="#/objectifs">${rows}</a>`
}

export default function progressView(root) {
  const state = getState()

  root.innerHTML = `
    <div class="page">
      ${header({ title: 'Progression', sub: 'Ce qui change, et dans quel sens' })}
      ${weightSection(state)}
      ${waistSection(state)}
      ${strengthSection(state)}
      ${goalsSection(state)}
    </div>`

  root.querySelector('[data-act="add-weight"]')?.addEventListener('click', () => {
    location.hash = '#/corps/ajouter/poids'
  })
  root.querySelector('[data-act="add-goal"]')?.addEventListener('click', () => {
    location.hash = '#/objectifs/nouveau'
  })
}
