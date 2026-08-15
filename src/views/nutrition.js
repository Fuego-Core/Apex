/* JOURNAL ALIMENTAIRE — la journée.

   Ce que l'écran doit permettre en trois secondes : voir où j'en suis, ajouter
   ce que je viens de manger. Le reste descend d'un cran.

   Sans cibles définies, APEX compte mais ne juge pas : pas de barres vides ni
   de pourcentages inventés, juste les totaux. */

import { getState, logFood, removeLogEntry, createFood, applyEstimatedTargets, setManualTargets } from '../state.js'
import { dayOf, MEAL_LABELS, usedMeals, entriesOfMeal, shiftDate, suggestedMeal } from '../core/nutrition/journal.js'
import { dayTotals, remaining, display, entryMacros } from '../core/nutrition/calculations.js'
import { recents, favorites, searchLocal, snapshotOf } from '../core/nutrition/foods.js'
import { estimateTargets, explain } from '../core/nutrition/targets.js'
import { today, currentAverage } from '../core/body.js'
import { esc, header, num, formatDate, toast, confirmDialog } from '../ui.js'
import { tile, meter, blank, openSheet, parseNumber } from '../ui/components.js'
import { openFoodPicker } from '../ui/food-picker.js'

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

  async function openCreateFoodSheet() {
    const values = await openSheet({
      title: 'Nouvel aliment',
      subtitle: 'Les valeurs telles qu’elles figurent sur l’emballage.',
      submitLabel: 'Créer',
      fields: [
        { name: 'name', label: 'Nom', type: 'text', placeholder: 'Skyr maison' },
        { name: 'brand', label: 'Marque (facultatif)', type: 'text' },
        { name: 'per', label: 'Valeurs pour (g)', type: 'number', hint: 'En général 100' },
        { name: 'kcal', label: 'Calories (kcal)', type: 'number' },
        { name: 'protein', label: 'Protéines (g)', type: 'number' },
        { name: 'carbs', label: 'Glucides (g)', type: 'number' },
        { name: 'fat', label: 'Lipides (g)', type: 'number' },
        { name: 'fiber', label: 'Fibres (g, facultatif)', type: 'number' }
      ],
      values: { per: '100' },
      validate: () => ({})
    })
    if (!values) return null

    const res = await createFood({
      name: values.name,
      brand: values.brand,
      per: parseNumber(values.per),
      kcal: parseNumber(values.kcal),
      protein: parseNumber(values.protein),
      carbs: parseNumber(values.carbs),
      fat: parseNumber(values.fat),
      fiber: values.fiber === '' ? null : parseNumber(values.fiber)
    })

    if (!res.ok) {
      toast(Object.values(res.errors)[0], 'warn')
      return null
    }
    toast('Aliment créé', 'gold')
    return { id: res.food.id, name: res.food.name, brand: res.food.brand, snapshot: snapshotOf(res.food), unit: res.food.unit, lastQty: null }
  }

  async function addFood(meal = null) {
    const state = getState()
    const chosen = await openFoodPicker({
      recents: () => recents(state.nutrition.usage),
      favorites: () => favorites(state.nutrition.usage),
      search: (query) => searchLocal(state.nutrition, query),
      onCreate: openCreateFoodSheet
    })
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

  function targetsBlock(totals) {
    const state = getState()
    const t = state.nutrition.targets
    const left = remaining(t, totals)

    if (!left) {
      return `
        <div class="card">
          <p class="tile__label">Objectifs</p>
          <p class="note" style="margin-top:var(--sp-2)">
            Pas encore configurés. APEX compte tes apports sans les juger tant que tu n'as pas fixé de cap.
          </p>
          <button class="btn btn--ghost btn--block" data-act="targets" style="margin-top:var(--sp-3)">
            Définir mes objectifs
          </button>
        </div>`
    }

    const rows = ['kcal', 'protein', 'carbs', 'fat']
      .filter((macro) => left[macro])
      .map((macro) => {
        const r = left[macro]
        return `
          <div class="goal">
            <div class="goal__head">
              <span class="goal__title">${esc(MACRO_LABELS[macro])}</span>
              <span class="goal__values">
                <strong>${esc(String(display(r.eaten, macro)))}</strong> / ${esc(String(r.target))} ${esc(MACRO_UNITS[macro])}
              </span>
            </div>
            ${meter(r.pct)}
            <div class="goal__foot">
              <span>${r.left >= 0 ? `reste ${display(r.left, macro)} ${MACRO_UNITS[macro]}` : `dépassement de ${display(-r.left, macro)} ${MACRO_UNITS[macro]}`}</span>
              <span>${r.pct} %</span>
            </div>
          </div>`
      })
      .join('')

    const basis = t.mode === 'estimated' ? explain(t.basis) : null
    return `
      <div class="card">${rows}
        <p class="goal__source">
          ${t.mode === 'estimated' ? 'Estimation' : 'Objectifs saisis à la main'}${basis ? ` — ${esc(basis)}` : ''}
        </p>
        <button class="btn btn--ghost btn--sm" data-act="targets" style="margin-top:var(--sp-3)">Modifier</button>
      </div>`
  }

  function mealBlock(day, meal) {
    const entries = entriesOfMeal(day, meal)
    const totals = dayTotals({ entries }).total
    const lines = entries
      .map((entry) => {
        const values = entryMacros(entry)
        return `
          <li class="hrow measure">
            <div>
              <span class="hrow__name">${esc(entry.snapshot?.name || 'Aliment')}</span>
              <p class="hrow__sets">
                ${esc(num(entry.qty))} ${esc(entry.unit)}
                ${values?.kcal != null ? ` · ${display(values.kcal, 'kcal')} kcal` : ''}
                ${values?.protein != null ? ` · ${display(values.protein)} g prot.` : ''}
              </p>
            </div>
            <button class="icon-btn" data-act="remove-entry" data-entry="${esc(entry.id)}"
                    aria-label="Retirer ${esc(entry.snapshot?.name || 'cet aliment')}">×</button>
          </li>`
      })
      .join('')

    return `
      <div class="section-head" style="margin-top:var(--sp-5)">
        <h3 class="section-title">${esc(MEAL_LABELS[meal])}</h3>
        <span class="section-link">${totals.kcal != null ? `${display(totals.kcal, 'kcal')} kcal` : ''}</span>
      </div>
      <ul class="card hlist">${lines}</ul>
      <button class="btn btn--ghost btn--block btn--sm" data-act="add" data-meal="${esc(meal)}"
              style="margin-top:var(--sp-2)">+ Ajouter à ${esc(MEAL_LABELS[meal].toLowerCase())}</button>`
  }

  function render() {
    const state = getState()
    const day = dayOf(state.nutrition.days, date)
    const { total } = dayTotals(day)
    const isToday = date === today()
    const meals = usedMeals(day)

    root.innerHTML = `
      <div class="page">
        ${header({ back: '#/', title: 'Nutrition', sub: 'Journal alimentaire' })}

        <div class="daynav">
          <button class="btn btn--ghost btn--sm" data-act="prev-day" aria-label="Jour précédent">‹</button>
          <span class="daynav__label">${esc(isToday ? "Aujourd'hui" : formatDate(`${date}T12:00:00`))}</span>
          <button class="btn btn--ghost btn--sm" data-act="next-day" aria-label="Jour suivant" ${isToday ? 'disabled' : ''}>›</button>
        </div>

        <div class="grid-2" style="margin-top:var(--sp-4)">
          ${tile({
            label: 'Calories',
            value: total.kcal === null ? null : display(total.kcal, 'kcal'),
            unit: 'kcal',
            hint: `${day.entries.length} aliment${day.entries.length > 1 ? 's' : ''}`,
            empty: '—'
          })}
          ${tile({
            label: 'Protéines',
            value: total.protein === null ? null : display(total.protein),
            unit: 'g',
            hint:
              total.carbs !== null || total.fat !== null
                ? `G ${total.carbs === null ? '—' : display(total.carbs)} · L ${total.fat === null ? '—' : display(total.fat)}`
                : '',
            empty: '—'
          })}
        </div>

        <div style="margin-top:var(--sp-3)">${targetsBlock(total)}</div>

        ${
          meals.length
            ? meals.map((meal) => mealBlock(day, meal)).join('')
            : blank({
                title: isToday ? 'Rien enregistré aujourd’hui' : 'Rien enregistré ce jour-là',
                text: 'Ajoute ce que tu viens de manger. APEX retiendra l’aliment et sa quantité pour la prochaine fois.'
              })
        }

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
    }
  }

  root.addEventListener('click', onClick)
  render()

  return () => root.removeEventListener('click', onClick)
}
