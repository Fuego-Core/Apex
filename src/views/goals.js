/* OBJECTIFS — chaque objectif lit une valeur réelle, jamais une intention.

   Le choix du type décide de la source : le poids vient de la moyenne 7 jours,
   la force du meilleur poids de travail enregistré, la régularité du nombre de
   séances archivées. Un objectif « à la main » est le seul que l'utilisateur
   met à jour lui-même, et c'est dit clairement. */

import { getState, addGoal, updateGoal, removeGoal } from '../state.js'
import { evaluateGoal, makeGoal, currentValue, recordManualValue } from '../core/goals.js'
import { esc, header, num, uid, toast, confirmDialog, formatDate } from '../ui.js'
import { meter, blank, openSheet, parseNumber } from '../ui/components.js'

const KINDS = {
  weight: { label: 'Poids', unit: 'kg', source: 'moyenne 7 jours de tes pesées' },
  waist: { label: 'Tour de taille', unit: 'cm', source: 'ta dernière mesure' },
  strength: { label: 'Force', unit: 'kg', source: 'ton meilleur poids de travail' },
  sessions: { label: 'Régularité', unit: 'séances/sem.', source: 'tes séances des 28 derniers jours' },
  manual: { label: 'À la main', unit: '', source: 'la valeur que tu saisis' }
}

/** Mouvements déjà travaillés : un objectif de force doit viser du réel. */
function trainedMovements(state) {
  const ids = new Set()
  for (const session of state.history) {
    for (const entry of session.entries || []) {
      if (entry.mode === 'reps' && !entry.assisted && entry.exerciseId) ids.add(entry.exerciseId)
    }
  }
  for (const session of state.program) {
    for (const ex of session.exercises) {
      if (ex.mode === 'reps') ids.add(ex.exerciseId)
    }
  }
  return [...ids]
    .map((id) => ({ id, name: state.catalog[id]?.name || id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export default function goalsView(root, { create = false } = {}) {
  const context = () => ({ body: getState().body, history: getState().history })

  async function openGoalSheet() {
    const state = getState()
    const movements = trainedMovements(state)

    const values = await openSheet({
      title: 'Nouvel objectif',
      subtitle: 'APEX suivra la valeur réelle, sans que tu aies à la reporter.',
      submitLabel: 'Créer',
      fields: [
        {
          name: 'kind',
          label: 'Type',
          type: 'segmented',
          options: [
            { value: 'weight', label: 'Poids' },
            { value: 'waist', label: 'Taille' },
            { value: 'strength', label: 'Force' },
            { value: 'sessions', label: 'Régularité' }
          ]
        },
        {
          name: 'exerciseId',
          label: 'Mouvement (objectif de force)',
          type: 'select',
          options: [{ value: '', label: '— aucun —' }, ...movements.map((m) => ({ value: m.id, label: m.name }))]
        },
        { name: 'title', label: 'Nom de l’objectif', type: 'text', placeholder: 'Descendre à 75 kg' },
        { name: 'target', label: 'Cible', type: 'number', placeholder: '75' },
        {
          name: 'deadline',
          label: 'Échéance (facultative)',
          type: 'date'
        }
      ],
      values: { kind: 'weight' },
      validate: (data) => {
        const errors = {}
        if (!KINDS[data.kind]) errors.kind = 'Choisis un type.'
        if (!String(data.title || '').trim()) errors.title = 'Donne-lui un nom, tu le reliras dans trois mois.'
        if (parseNumber(data.target) === null) errors.target = 'Une cible chiffrée est nécessaire.'
        if (data.kind === 'strength' && !data.exerciseId) {
          errors.exerciseId = 'Un objectif de force vise un mouvement précis.'
        }
        return errors
      }
    })
    if (!values) return

    const kind = values.kind
    const exerciseId = kind === 'strength' ? values.exerciseId : null
    // Le point de départ, c'est la valeur d'aujourd'hui : sans lui, aucun
    // pourcentage d'avancement n'aurait de sens.
    const start = currentValue({ kind, exerciseId, value: null }, context())

    await addGoal(
      makeGoal({
        id: uid('goal'),
        kind,
        title: String(values.title).trim().slice(0, 60),
        unit: KINDS[kind].unit,
        target: parseNumber(values.target),
        start,
        exerciseId,
        deadline: values.deadline || null
      })
    )
    toast('Objectif créé', 'gold')
    render()
  }

  async function openManualSheet(goal) {
    const values = await openSheet({
      title: goal.title,
      subtitle: 'Valeur du jour, telle que tu la relèves.',
      submitLabel: 'Enregistrer',
      fields: [{ name: 'value', label: `Valeur (${goal.unit || 'unité'})`, type: 'number' }],
      values: { value: goal.value === null ? '' : num(goal.value) },
      validate: (data) => (parseNumber(data.value) === null ? { value: 'Entre un nombre.' } : {})
    })
    if (!values) return
    await updateGoal(goal.id, (g) => recordManualValue(g, parseNumber(values.value)))
    toast('Valeur enregistrée')
    render()
  }

  async function confirmDelete(goal) {
    const ok = await confirmDialog({
      title: 'Supprimer cet objectif ?',
      message: `« ${goal.title} » et son historique seront effacés.`,
      confirmLabel: 'Supprimer',
      danger: true
    })
    if (!ok) return
    await removeGoal(goal.id)
    toast('Objectif supprimé')
    render()
  }

  function goalCard(goal) {
    const r = evaluateGoal(goal, context())
    const kind = KINDS[goal.kind] || KINDS.manual
    const state = getState()
    const movement = goal.exerciseId ? state.catalog[goal.exerciseId]?.name : null

    return `
      <article class="card goal-card" data-goal="${esc(goal.id)}">
        <div class="goal__head">
          <span class="goal__title">${esc(goal.title)}</span>
          <span class="goal__values">
            ${r.hasData ? `<strong>${esc(num(r.current))}</strong>` : '<strong>—</strong>'} / ${esc(num(r.target))} ${esc(goal.unit)}
          </span>
        </div>
        ${meter(r.pct, { done: r.done })}
        <div class="goal__foot">
          <span>${
            r.hasData
              ? r.done
                ? 'Atteint 🎯'
                : r.pct === null
                  ? 'en cours'
                  : `${r.pct} % du chemin`
              : 'pas encore de données'
          }</span>
          ${goal.deadline ? `<span>avant le ${esc(formatDate(`${goal.deadline}T12:00:00`))}</span>` : ''}
        </div>
        <p class="goal__source">Source : ${esc(kind.source)}${movement ? ` · ${esc(movement)}` : ''}</p>
        <div class="goal-card__actions">
          ${goal.kind === 'manual' ? '<button class="btn btn--ghost btn--sm" data-act="update">Mettre à jour</button>' : ''}
          <button class="btn btn--ghost btn--sm" data-act="delete">Supprimer</button>
        </div>
      </article>`
  }

  function render() {
    const state = getState()
    root.innerHTML = `
      <div class="page">
        ${header({ back: '#/', title: 'Objectifs', sub: `${state.goals.length} en cours` })}
        ${
          state.goals.length
            ? `<div class="stack">${state.goals.map(goalCard).join('')}</div>`
            : blank({
                title: 'Aucun objectif',
                text: 'Un cap chiffré rend la progression lisible : un poids, une barre, un rythme de séances.'
              })
        }
        <div class="sticky-actions">
          <button class="btn btn--gold btn--block btn--lg" data-act="add">Nouvel objectif</button>
        </div>
      </div>`
  }

  async function onClick(e) {
    const btn = e.target.closest('[data-act]')
    if (!btn) return
    const act = btn.dataset.act
    const id = btn.closest('[data-goal]')?.dataset.goal
    const goal = id ? getState().goals.find((g) => g.id === id) : null

    if (act === 'add') await openGoalSheet()
    else if (act === 'update' && goal) await openManualSheet(goal)
    else if (act === 'delete' && goal) await confirmDelete(goal)
  }

  root.addEventListener('click', onClick)
  render()
  if (create) openGoalSheet()

  return () => root.removeEventListener('click', onClick)
}
