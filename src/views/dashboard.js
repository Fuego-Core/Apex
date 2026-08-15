/* TABLEAU DE BORD — le premier écran répond à trois questions, dans cet ordre :
     1. qu'est-ce que je fais aujourd'hui ?
     2. où en est mon corps ?
     3. est-ce que j'avance vers mes objectifs ?

   Tout le reste descend d'un cran. Pas de mur de cartes : quatre blocs, et
   chacun peut être lu en une seconde. */

import { getState, getLive } from '../state.js'
import { nextSession, sessionsThisWeek, estimateDuration, pendingCount } from '../core/today.js'
import { currentAverage, latest, trend, latestChange, series } from '../core/body.js'
import { evaluateGoal } from '../core/goals.js'
import { dayOf, loggedCount } from '../core/nutrition/journal.js'
import { dayTotals, remaining, display } from '../core/nutrition/calculations.js'
import { today } from '../core/body.js'
import { esc, logoMark, num, duration } from '../ui.js'
import { tile, meter, blank, sectionTitle, sparkline } from '../ui/components.js'

/** Le corps bouge-t-il dans le sens voulu ? Sans objectif déclaré, on ne juge pas. */
function toneForTrend(direction, profileGoal) {
  if (!profileGoal || direction === 'stable') return ''
  if (profileGoal === 'seche') return direction === 'baisse' ? 'down' : 'up'
  if (profileGoal === 'prise') return direction === 'hausse' ? 'down' : 'up'
  return ''
}

function trendLabel(t, unit) {
  if (!t || t.status !== 'ok') return 'tendance : pas encore assez de mesures'
  if (t.direction === 'stable') return `stable sur ${t.days} jours`
  const arrow = t.perWeek < 0 ? '↓' : '↑'
  return `${arrow} ${num(Math.abs(t.perWeek))} ${unit}/semaine`
}

function todayBlock(state, live) {
  const pick = nextSession(state.program, { live })
  if (!pick) return ''

  const { session, reason, daysSince } = pick
  const resuming = reason === 'reprise'
  const pending = pendingCount(session)
  const est = estimateDuration(session)

  const why =
    reason === 'jamais-faite'
      ? 'Jamais faite'
      : reason === 'la-plus-ancienne'
        ? `Pas faite depuis ${daysSince} jour${daysSince > 1 ? 's' : ''}`
        : 'Séance en cours'

  return `
    <section class="card today reveal">
      <p class="today__kicker">${resuming ? 'Séance en cours' : "Aujourd'hui"}</p>
      <h2 class="today__name">${esc(session.name)}</h2>
      <p class="today__sub">${esc(session.subtitle || '')}</p>
      <div class="today__meta">
        <span>${session.exercises.length} exercice${session.exercises.length > 1 ? 's' : ''}</span>
        ${est ? `<span>~ ${esc(duration(est))}</span>` : ''}
        <span>${esc(why)}</span>
      </div>
      <a class="btn btn--gold btn--block btn--lg"
         href="#/seance/${esc(session.id)}${resuming ? '/workout' : ''}">
        ${resuming ? 'Reprendre la séance' : 'Commencer la séance'}
      </a>
      ${pending ? `<p class="today__why">🎯 ${pending} ajustement${pending > 1 ? 's' : ''} proposé${pending > 1 ? 's' : ''}</p>` : ''}
    </section>`
}

function bodyBlock(state) {
  const weight = state.body.weight
  const waist = state.body.waist

  if (!weight.length && !waist.length) {
    return `
      ${sectionTitle('Corps')}
      <div class="reveal">
        ${blank({
          title: 'Commence par te peser',
          text: 'Une pesée par jour, toujours au même moment. APEX lissera les variations et te dira où tu vas vraiment.',
          actionLabel: 'Ajouter mon poids',
          act: 'add-weight'
        })}
      </div>`
  }

  const wAvg = currentAverage(weight)
  const wTrend = trend(weight)
  const waistLast = latest(waist)
  const waistChange = latestChange(waist)
  const points = series(weight, { days: 90 })

  return `
    ${sectionTitle('Corps', { href: '#/corps', linkLabel: 'Suivi' })}
    <div class="reveal">
      <div class="grid-2">
        ${tile({
          label: 'Poids · moy. 7 j',
          value: wAvg === null ? null : num(wAvg),
          unit: 'kg',
          hint: trendLabel(wTrend, 'kg'),
          tone: wTrend.status === 'ok' ? toneForTrend(wTrend.direction, state.profile.goal) : '',
          empty: '—'
        })}
        ${tile({
          label: 'Tour de taille',
          value: waistLast ? num(waistLast.value) : null,
          unit: 'cm',
          hint: waistChange
            ? `${waistChange.delta > 0 ? '↑' : '↓'} ${num(Math.abs(waistChange.delta))} cm en ${waistChange.days} j`
            : waist.length > 1
              ? 'pas assez de recul'
              : 'une seule mesure',
          empty: '—'
        })}
      </div>
      ${points.length > 1 ? `<div class="card" style="margin-top:var(--sp-3)">${sparkline(points)}</div>` : ''}
    </div>`
}

/** Une seule ligne : où j'en suis aujourd'hui côté nutrition. Le détail est
 *  dans l'écran Nutrition — le tableau de bord n'est pas un tableur. */
function nutritionBlock(state) {
  const day = dayOf(state.nutrition.days, today())
  const { total } = dayTotals(day)
  const left = remaining(state.nutrition.targets, total)

  if (!day.entries.length && !left) {
    return `
      ${sectionTitle('Nutrition', { href: '#/nutrition', linkLabel: 'Ouvrir' })}
      <a class="row reveal" href="#/nutrition">
        <div class="row__main">
          <p class="row__title">Rien enregistré aujourd'hui</p>
          <p class="row__meta">Ajoute ton premier aliment, APEX retiendra la quantité</p>
        </div>
        <span class="row__go">›</span>
      </a>`
  }

  const logged = loggedCount(state.nutrition.days, 7)
  const kcal = left?.kcal
  const line = kcal
    ? `${display(kcal.eaten, 'kcal')} / ${kcal.target} kcal`
    : `${total.kcal === null ? '—' : display(total.kcal, 'kcal')} kcal`
  const protein = total.protein === null ? null : `${display(total.protein)} g protéines`

  return `
    ${sectionTitle('Nutrition', { href: '#/nutrition', linkLabel: 'Voir' })}
    <a class="card reveal" href="#/nutrition">
      <div class="goal">
        <div class="goal__head">
          <span class="goal__title">${esc(line)}</span>
          <span class="goal__values">${esc(protein || '')}</span>
        </div>
        ${kcal ? meter(kcal.pct) : ''}
        <div class="goal__foot">
          <span>${day.entries.length} aliment${day.entries.length > 1 ? 's' : ''} aujourd'hui${
            logged > 1 ? ` · ${logged} jours notés sur 7` : ''
          }</span>
          ${kcal ? `<span>${kcal.left >= 0 ? `reste ${display(kcal.left, 'kcal')} kcal` : `+${display(-kcal.left, 'kcal')} kcal`}</span>` : '<span>sans objectif défini</span>'}
        </div>
      </div>
    </a>`
}

function goalsBlock(state) {
  if (!state.goals.length) {
    return `
      ${sectionTitle('Objectifs')}
      <div class="reveal">
        ${blank({
          title: 'Fixe un cap',
          text: 'Un poids, un développé couché, un nombre de séances par semaine. APEX suit la valeur réelle, pas une intention.',
          actionLabel: 'Créer un objectif',
          act: 'add-goal'
        })}
      </div>`
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
          <div class="goal__foot">
            <span>${r.hasData ? (r.done ? 'Atteint 🎯' : r.pct === null ? 'en cours' : `${r.pct} %`) : 'pas encore de données'}</span>
            ${r.hasData && !r.done ? `<span>reste ${esc(num(r.remaining))} ${esc(goal.unit)}</span>` : ''}
          </div>
        </div>`
    })
    .join('')

  return `
    ${sectionTitle('Objectifs', { href: '#/objectifs', linkLabel: state.goals.length > 3 ? `Les ${state.goals.length}` : 'Gérer' })}
    <div class="card reveal">${rows}</div>`
}

export default function dashboardView(root) {
  const state = getState()
  const live = getLive()
  const week = sessionsThisWeek(state.history)

  root.innerHTML = `
    <div class="page page--home">
      <header class="brand">
        <span class="brand__mark">${logoMark(30)}</span>
        <span class="brand__word">APEX</span>
      </header>

      ${todayBlock(state, live)}

      <p class="week-line">${
        week ? `${week} séance${week > 1 ? 's' : ''} cette semaine` : 'Aucune séance cette semaine'
      }${state.history.length ? ` · ${state.history.length} au total` : ''}</p>

      ${bodyBlock(state)}
      ${nutritionBlock(state)}
      ${goalsBlock(state)}

      <nav class="dash-links">
        <a class="card nav-card" href="#/seances">
          <span class="nav-card__label">Séances</span>
          <span class="nav-card__meta">${state.program.length} au programme</span>
        </a>
        <a class="card nav-card" href="#/historique">
          <span class="nav-card__label">Historique</span>
          <span class="nav-card__meta">${state.history.length} séance${state.history.length > 1 ? 's' : ''}</span>
        </a>
        <a class="card nav-card" href="#/profil">
          <span class="nav-card__label">Profil</span>
          <span class="nav-card__meta">${state.profile.updatedAt ? 'Renseigné' : 'À compléter'}</span>
        </a>
        <a class="card nav-card" href="#/reglages">
          <span class="nav-card__label">Réglages</span>
          <span class="nav-card__meta">Sauvegarde &amp; données</span>
        </a>
      </nav>

      <p class="footnote">Données stockées sur cet appareil uniquement.</p>
    </div>`

  // Les états vides du tableau de bord envoient là où l'action se fait.
  root.querySelector('[data-act="add-weight"]')?.addEventListener('click', () => {
    location.hash = '#/corps/ajouter/poids'
  })
  root.querySelector('[data-act="add-goal"]')?.addEventListener('click', () => {
    location.hash = '#/objectifs/nouveau'
  })
}
