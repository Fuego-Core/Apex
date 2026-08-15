/* JOURNAL ALIMENTAIRE — la journée.

   Ce que l'écran doit permettre en trois secondes : voir où j'en suis, ajouter
   ce que je viens de manger. Le reste descend d'un cran.

   Sans cibles définies, APEX compte mais ne juge pas : pas de barres vides ni
   de pourcentages inventés, juste les totaux. */

import {
  getState,
  logFood,
  updateLogEntry,
  removeLogEntry,
  repeatMeal,
  lastMealBefore,
  applyEstimatedTargets,
  setManualTargets
} from '../state.js'
import { dayOf, MEALS, MEAL_LABELS, usedMeals, entriesOfMeal, shiftDate, suggestedMeal } from '../core/nutrition/journal.js'
import { dayTotals, remaining, display, entryMacros } from '../core/nutrition/calculations.js'
import { estimateTargets, explain } from '../core/nutrition/targets.js'
import { today, currentAverage } from '../core/body.js'
import { esc, header, num, formatDate, toast, confirmDialog } from '../ui.js'
import { meter, blank, openSheet, parseNumber } from '../ui/components.js'
import { pickFood } from '../ui/food-flow.js'

const MACRO_LABELS = { kcal: 'Calories', protein: 'Protéines', carbs: 'Glucides', fat: 'Lipides' }
const MACRO_UNITS = { kcal: 'kcal', protein: 'g', carbs: 'g', fat: 'g' }

export default function nutritionView(root, { date: initialDate } = {}) {
  let date = initialDate || today()

  /* ---------- cibles ---------- */

  async function openTargetsSheet() {
    const state = getState()
    const estimate = estimateTargets({ profile: state.profile, weightKg: currentAverage(state.body.weight) })
    const t = state.nutrition.targets

    const values = await openSheet({
      title: 'Objectifs nutritionnels',
      subtitle:
        estimate.status === 'ok'
          ? 'Laisse vide pour utiliser l’estimation, ou impose tes propres chiffres.'
          : `Estimation impossible : il manque ${estimate.missing.join(', ')}. Tu peux saisir tes chiffres à la main.`,
      submitLabel: 'Enregistrer',
      fields: [
        { name: 'kcal', label: 'Calories (kcal)', type: 'number', hint: estimate.status === 'ok' ? `estimation : ${estimate.kcal}` : '' },
        { name: 'protein', label: 'Protéines (g)', type: 'number', hint: estimate.status === 'ok' ? `estimation : ${estimate.protein}` : '' },
        { name: 'carbs', label: 'Glucides (g)', type: 'number', hint: estimate.status === 'ok' ? `estimation : ${estimate.carbs}` : '' },
        { name: 'fat', label: 'Lipides (g)', type: 'number', hint: estimate.status === 'ok' ? `estimation : ${estimate.fat}` : '' }
      ],
      values: {
        kcal: t.kcal ?? '',
        protein: t.protein ?? '',
        carbs: t.carbs ?? '',
        fat: t.fat ?? ''
      },
      validate: (data) => {
        const errors = {}
        for (const key of ['kcal', 'protein', 'carbs', 'fat']) {
          if (data[key] === '') continue
          const v = parseNumber(data[key])
          if (v === null || v < 0) errors[key] = 'Un nombre, ou laisse vide.'
        }
        return errors
      }
    })
    if (!values) return

    const filled = ['kcal', 'protein', 'carbs', 'fat'].filter((k) => values[k] !== '')
    if (!filled.length) {
      const res = await applyEstimatedTargets()
      toast(res.applied ? 'Cibles estimées appliquées' : `Estimation impossible : il manque ${res.missing.join(', ')}`, res.applied ? 'gold' : 'warn')
    } else {
      await setManualTargets({
        kcal: parseNumber(values.kcal),
        protein: parseNumber(values.protein),
        carbs: parseNumber(values.carbs),
        fat: parseNumber(values.fat)
      })
      toast('Objectifs enregistrés', 'gold')
    }
    render()
  }

  /* ---------- ajout ---------- */

  async function addFood(meal = null) {
    const chosen = await pickFood()
    if (!chosen) return

    await logFood({
      foodId: chosen.id,
      snapshot: chosen.snapshot,
      qty: chosen.qty,
      unit: chosen.unit,
      meal: meal || suggestedMeal(),
      date
    })
    toast(`${chosen.snapshot?.name || 'Aliment'} ajouté`, 'gold')
    render()
  }

  /** Corriger une ligne : la quantité, ou le repas où elle est rangée.
   *  L'instantané, lui, ne change jamais — c'est ce qu'on a mangé. */
  async function editEntry(entry) {
    const values = await openSheet({
      title: entry.snapshot?.name || 'Ligne',
      subtitle: `Enregistré dans ${MEAL_LABELS[entry.meal]?.toLowerCase() || 'ce repas'}`,
      submitLabel: 'Enregistrer',
      fields: [
        { name: 'qty', label: `Quantité (${entry.unit})`, type: 'number' },
        {
          name: 'meal',
          label: 'Repas',
          type: 'segmented',
          options: MEALS.map((m) => ({ value: m, label: MEAL_LABELS[m] }))
        }
      ],
      values: { qty: num(entry.qty), meal: entry.meal },
      validate: (data) => {
        const qty = parseNumber(data.qty)
        if (qty === null || qty <= 0) return { qty: 'Indique une quantité.' }
        if (qty > 5000) return { qty: 'Au-delà de 5 000, c’est probablement une faute de frappe.' }
        return {}
      }
    })
    if (!values) return

    await updateLogEntry(date, entry.id, { qty: parseNumber(values.qty), meal: values.meal })
    toast('Ligne modifiée')
    render()
  }

  /** Refaire un repas : les lignes sont recopiées telles quelles, pas recalculées. */
  async function onRepeatMeal(meal) {
    const res = await repeatMeal({ meal, date })
    toast(
      res.ok ? `${res.added} ligne${res.added > 1 ? 's' : ''} reprise${res.added > 1 ? 's' : ''} du ${formatDate(`${res.from}T12:00:00`)}` : res.reason,
      res.ok ? 'gold' : 'warn'
    )
    if (res.ok) render()
  }

  async function confirmRemove(entry) {
    const ok = await confirmDialog({
      title: 'Retirer cet aliment ?',
      message: `${entry.snapshot?.name || 'Cette ligne'} · ${num(entry.qty)} ${entry.unit}`,
      confirmLabel: 'Retirer',
      danger: true
    })
    if (!ok) return
    await removeLogEntry(date, entry.id)
    toast('Ligne retirée')
    render()
  }

  /* ---------- rendu ---------- */

  /** Le héros : LE chiffre du jour. Avec un objectif, il devient « mangé / cap » ;
   *  sans objectif, il compte sans juger — et propose d'en fixer un. */
  function heroBlock(totals, entryCount) {
    const state = getState()
    const t = state.nutrition.targets
    const left = remaining(t, totals)
    const eaten = totals.kcal === null ? null : display(totals.kcal, 'kcal')

    if (!left) {
      return `
        <div class="card hero">
          <p class="tile__label">Calories</p>
          <p class="tile__value hero__value">${eaten === null ? '—' : eaten}<span class="tile__unit">kcal</span></p>
          <p class="hero__hint">${entryCount} aliment${entryCount > 1 ? 's' : ''} aujourd'hui</p>
          <p class="note" style="margin-top:var(--sp-3)">
            Pas encore configurés : APEX compte tes apports sans les juger tant que tu n'as pas fixé de cap.
          </p>
          <button class="btn btn--ghost btn--block btn--sm" data-act="targets" style="margin-top:var(--sp-3)">
            Définir mes objectifs
          </button>
        </div>`
    }

    const kcal = left.kcal
    const basis = t.mode === 'estimated' ? explain(t.basis) : null
    return `
      <div class="card hero">
        <p class="tile__label">Calories</p>
        <p class="tile__value hero__value">
          ${eaten === null ? '0' : eaten}<span class="hero__target"> / ${esc(String(kcal ? kcal.target : ''))} kcal</span>
        </p>
        ${kcal ? meter(kcal.pct) : ''}
        <div class="hero__foot">
          <span>${
            kcal
              ? kcal.left >= 0
                ? `reste ${display(kcal.left, 'kcal')} kcal`
                : `dépassement de ${display(-kcal.left, 'kcal')} kcal`
              : `${entryCount} aliment${entryCount > 1 ? 's' : ''}`
          }</span>
          <button class="linklike" data-act="targets">${t.mode === 'estimated' ? 'Estimation' : 'Objectifs'} · modifier</button>
        </div>
        ${basis ? `<p class="goal__source">${esc(basis)}</p>` : ''}
      </div>`
  }

  /** Protéines / glucides / lipides : trois petites jauges, une ligne. */
  function macroRow(totals) {
    const t = getState().nutrition.targets
    const left = remaining(t, totals)

    const cell = (macro) => {
      const eaten = totals[macro]
      const goal = left?.[macro]
      return `
        <div class="macro">
          <p class="macro__label">${esc(MACRO_LABELS[macro])}</p>
          <p class="macro__value">${eaten === null ? '—' : display(eaten, macro)}<span class="macro__unit">${goal ? `/${goal.target}` : ''} g</span></p>
          ${goal ? meter(goal.pct) : ''}
        </div>`
    }

    return `<div class="macros">${cell('protein')}${cell('carbs')}${cell('fat')}</div>`
  }

  function mealBlock(day, meal) {
    const entries = entriesOfMeal(day, meal)
    const totals = dayTotals({ entries }).total
    const lines = entries
      .map((entry) => {
        const values = entryMacros(entry)
        // Une recette dit ce qu'il y avait dedans, depuis son propre instantané.
        const composition = entry.snapshot?.ingredients?.length
          ? `<p class="hrow__sets">${esc(entry.snapshot.ingredients.map((i) => i.name).join(' · '))}</p>`
          : ''
        return `
          <li class="hrow measure">
            <button class="hrow__main" data-act="edit-entry" data-entry="${esc(entry.id)}">
              <span class="hrow__name">${esc(entry.snapshot?.name || 'Aliment')}</span>
              <p class="hrow__sets">
                ${esc(num(entry.qty))} ${esc(entry.unit)}${entry.unit === 'portion' && entry.qty > 1 ? 's' : ''}
                ${values?.kcal != null ? ` · ${display(values.kcal, 'kcal')} kcal` : ''}
                ${values?.protein != null ? ` · ${display(values.protein)} g prot.` : ''}
              </p>
              ${composition}
            </button>
            <button class="icon-btn" data-act="remove-entry" data-entry="${esc(entry.id)}"
                    aria-label="Retirer ${esc(entry.snapshot?.name || 'cet aliment')}">×</button>
          </li>`
      })
      .join('')

    const canRepeat = !entries.length && !!lastMealBefore(meal, date)
    return `
      <div class="section-head" style="margin-top:var(--sp-5)">
        <h3 class="section-title">${esc(MEAL_LABELS[meal])}</h3>
        <span class="section-link">
          ${totals.kcal != null ? `${display(totals.kcal, 'kcal')} kcal` : ''}${totals.protein != null ? ` · ${display(totals.protein)} g prot.` : ''}
        </span>
      </div>
      ${entries.length ? `<ul class="card hlist">${lines}</ul>` : ''}
      <div class="mealbar">
        <button class="btn btn--ghost btn--block btn--sm" data-act="add" data-meal="${esc(meal)}">
          + Ajouter à ${esc(MEAL_LABELS[meal].toLowerCase())}
        </button>
        ${
          entries.length || canRepeat
            ? `<button class="btn btn--ghost btn--sm" data-act="repeat-meal" data-meal="${esc(meal)}">Refaire</button>`
            : ''
        }
      </div>`
  }

  /** Les repas à afficher : ceux du jour, plus ceux qu'on peut refaire. */
  function mealsToShow(day) {
    const used = usedMeals(day)
    if (!used.length) return []
    const repeatable = MEALS.filter((m) => !used.includes(m) && lastMealBefore(m, date))
    return MEALS.filter((m) => used.includes(m) || repeatable.includes(m))
  }

  function render() {
    const state = getState()
    const day = dayOf(state.nutrition.days, date)
    const { total } = dayTotals(day)
    const isToday = date === today()
    const meals = mealsToShow(day)

    root.innerHTML = `
      <div class="page">
        ${header({ title: 'Nutrition', sub: 'Journal alimentaire' })}

        <div class="daynav">
          <button class="btn btn--ghost btn--sm" data-act="prev-day" aria-label="Jour précédent">‹</button>
          <span class="daynav__label">${esc(isToday ? "Aujourd'hui" : formatDate(`${date}T12:00:00`))}</span>
          <button class="btn btn--ghost btn--sm" data-act="next-day" aria-label="Jour suivant" ${isToday ? 'disabled' : ''}>›</button>
        </div>

        <div style="margin-top:var(--sp-3)">${heroBlock(total, day.entries.length)}</div>
        <div style="margin-top:var(--sp-3)">${macroRow(total)}</div>

        ${
          meals.length
            ? meals.map((meal) => mealBlock(day, meal)).join('')
            : blank({
                title: isToday ? 'Rien enregistré aujourd’hui' : 'Rien enregistré ce jour-là',
                text: 'Ajoute ce que tu viens de manger. APEX retiendra l’aliment et sa quantité pour la prochaine fois.'
              })
        }

        <div class="row-links">
          <a class="btn btn--ghost btn--sm" href="#/recettes">Mes recettes</a>
          <a class="btn btn--ghost btn--sm" href="#/nutrition/historique">Historique</a>
        </div>

        <div class="sticky-actions">
          <button class="btn btn--gold btn--block btn--lg" data-act="add">Ajouter un aliment</button>
        </div>
      </div>`
  }

  async function onClick(e) {
    const btn = e.target.closest('[data-act]')
    if (!btn) return
    const act = btn.dataset.act

    if (act === 'add') await addFood(btn.dataset.meal || null)
    else if (act === 'targets') await openTargetsSheet()
    else if (act === 'prev-day') {
      date = shiftDate(date, -1)
      render()
    } else if (act === 'next-day') {
      if (date >= today()) return
      date = shiftDate(date, 1)
      render()
    } else if (act === 'remove-entry') {
      const entry = dayOf(getState().nutrition.days, date).entries.find((x) => x.id === btn.dataset.entry)
      if (entry) await confirmRemove(entry)
    } else if (act === 'edit-entry') {
      const entry = dayOf(getState().nutrition.days, date).entries.find((x) => x.id === btn.dataset.entry)
      if (entry) await editEntry(entry)
    } else if (act === 'repeat-meal') {
      await onRepeatMeal(btn.dataset.meal)
    }
  }

  root.addEventListener('click', onClick)
  render()

  return () => root.removeEventListener('click', onClick)
}
