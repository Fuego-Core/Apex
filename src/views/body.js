/* SUIVI CORPOREL — poids et tour de taille.

   Ce que l'écran doit faire comprendre en un coup d'œil : la valeur du jour ne
   veut rien dire toute seule, c'est la moyenne mobile et sa pente qui parlent.
   Tant qu'il n'y a pas assez de mesures, APEX le dit au lieu d'inventer une
   tendance. */

import { getState, setBodyEntry, removeBodyEntry } from '../state.js'
import {
  today,
  sorted,
  latest,
  currentAverage,
  trend,
  changeOver,
  latestChange,
  series
} from '../core/body.js'
import { esc, header, num, formatDate, toast, confirmDialog } from '../ui.js'
import { tile, blank, plot, openSheet, parseNumber } from '../ui/components.js'

const KINDS = {
  weight: { key: 'weight', label: 'Poids', unit: 'kg', min: 20, max: 400, step: '0,1' },
  waist: { key: 'waist', label: 'Tour de taille', unit: 'cm', min: 30, max: 250, step: '0,5' }
}

export default function bodyView(root, { kind: initialKind } = {}) {
  let kind = KINDS[initialKind] ? initialKind : 'weight'

  function config() {
    return KINDS[kind]
  }

  async function openEntrySheet(existing = null) {
    const c = config()
    const values = await openSheet({
      title: existing ? `Modifier — ${c.label.toLowerCase()}` : `Ajouter — ${c.label.toLowerCase()}`,
      subtitle: existing
        ? 'Une seule mesure par jour : celle-ci remplacera la précédente.'
        : 'Idéalement le matin, à jeun, toujours dans les mêmes conditions.',
      submitLabel: 'Enregistrer',
      fields: [
        {
          name: 'value',
          label: `${c.label} (${c.unit})`,
          type: 'number',
          placeholder: c.step,
          hint: `Entre ${c.min} et ${c.max} ${c.unit}`
        },
        { name: 'date', label: 'Date', type: 'date' }
      ],
      values: { value: existing ? num(existing.value) : '', date: existing?.date || today() },
      validate: (data) => {
        const errors = {}
        const value = parseNumber(data.value)
        if (value === null) errors.value = 'Entre un nombre, par exemple 79,4.'
        else if (value < c.min || value > c.max) {
          errors.value = `Une valeur entre ${c.min} et ${c.max} ${c.unit}, sinon c'est une faute de frappe.`
        }
        if (!data.date) errors.date = 'Choisis une date.'
        else if (data.date > today()) errors.date = 'On ne peut pas enregistrer une mesure future.'
        return errors
      }
    })
    if (!values) return

    await setBodyEntry(kind, { date: values.date, value: parseNumber(values.value) })
    toast(`${c.label} enregistré`, 'gold')
    render()
  }

  async function confirmRemove(entry) {
    const c = config()
    const ok = await confirmDialog({
      title: 'Supprimer cette mesure ?',
      message: `${formatDate(`${entry.date}T12:00:00`)} · ${num(entry.value)} ${c.unit}`,
      confirmLabel: 'Supprimer',
      danger: true
    })
    if (!ok) return
    await removeBodyEntry(kind, entry.date)
    toast('Mesure supprimée')
    render()
  }

  function trendCard(entries, c) {
    const t = trend(entries)
    if (t.status !== 'ok') {
      const missing = Math.max(0, t.needEntries - t.entries)
      return `
        <p class="note">Pas encore de tendance : ${t.entries} mesure${t.entries > 1 ? 's' : ''} sur
        ${t.spanDays} jour${t.spanDays > 1 ? 's' : ''}. Il en faut ${t.needEntries} réparties sur
        ${t.needSpanDays} jours${missing ? ` — encore ${missing}` : ''}.</p>`
    }
    const word = t.direction === 'stable' ? 'stable' : t.direction === 'baisse' ? 'en baisse' : 'en hausse'
    const rate = t.direction === 'stable' ? '' : ` de ${num(Math.abs(t.perWeek))} ${c.unit} par semaine`
    return `<p class="note">Sur ${t.days} jours : <strong>${word}</strong>${rate}, de ${num(t.from)} à ${num(t.to)} ${c.unit}.</p>`
  }

  function render() {
    const state = getState()
    const c = config()
    const entries = sorted(state.body[kind])
    const last = latest(entries)
    const avg = currentAverage(entries)
    const week = changeOver(entries, 7)
    const span = latestChange(entries)
    const points = series(entries, { days: 180 })

    const list = [...entries]
      .reverse()
      .slice(0, 30)
      .map(
        (e) => `
        <li class="hrow measure">
          <div>
            <span class="hrow__name">${esc(formatDate(`${e.date}T12:00:00`))}</span>
            <p class="hrow__sets">${esc(num(e.value))} ${esc(c.unit)}</p>
          </div>
          <button class="icon-btn" data-act="remove" data-date="${esc(e.date)}"
                  aria-label="Supprimer la mesure du ${esc(e.date)}">×</button>
        </li>`
      )
      .join('')

    root.innerHTML = `
      <div class="page">
        ${header({ back: '#/progression', title: 'Corps', sub: 'Poids et tour de taille' })}

        <div class="seg seg--page" data-kind-switch>
          ${Object.values(KINDS)
            .map(
              (k) =>
                `<button type="button" class="seg__opt ${k.key === kind ? 'is-on' : ''}" data-kind="${k.key}">${esc(
                  k.label
                )}</button>`
            )
            .join('')}
        </div>

        ${
          entries.length
            ? `
          <div class="grid-2" style="margin-top:var(--sp-4)">
            ${tile({
              label: 'Moyenne 7 jours',
              value: avg === null ? null : num(avg),
              unit: c.unit,
              hint: last ? `dernière mesure ${num(last.value)} ${c.unit}` : ''
            })}
            ${tile({
              label: span ? `${span.window} derniers jours` : 'Variation',
              value: span ? `${span.delta > 0 ? '+' : ''}${num(span.delta)}` : null,
              unit: c.unit,
              hint:
                week && span && span.window !== 7
                  ? `7 jours : ${week.delta > 0 ? '+' : ''}${num(week.delta)} ${c.unit}`
                  : 'pas assez de recul pour comparer',
              empty: '—'
            })}
          </div>

          <div class="card" style="margin-top:var(--sp-3)">
            ${
              points.length > 1
                ? plot(points, { unit: c.unit, formatDate: (d) => formatDate(`${d}T12:00:00`) })
                : '<p class="note">Deux mesures minimum pour tracer la courbe.</p>'
            }
            ${trendCard(entries, c)}
          </div>

          <h3 class="section-title">Mesures</h3>
          <ul class="card hlist">${list}</ul>`
            : blank({
                title: `Aucune mesure de ${c.label.toLowerCase()}`,
                text:
                  kind === 'weight'
                    ? 'Pèse-toi le matin, à jeun. Une seule pesée ne veut rien dire : c’est la répétition qui donne la tendance.'
                    : 'Mesure au niveau du nombril, sans serrer, une fois par semaine.'
              })
        }

        <div class="sticky-actions">
          <button class="btn btn--gold btn--block btn--lg" data-act="add">Ajouter une mesure</button>
        </div>
      </div>`
  }

  async function onClick(e) {
    const kindBtn = e.target.closest('[data-kind]')
    if (kindBtn) {
      kind = kindBtn.dataset.kind
      render()
      return
    }
    const act = e.target.closest('[data-act]')?.dataset.act
    if (act === 'add') await openEntrySheet()
    else if (act === 'remove') {
      const date = e.target.closest('[data-act="remove"]').dataset.date
      const entry = sorted(getState().body[kind]).find((x) => x.date === date)
      if (entry) await confirmRemove(entry)
    }
  }

  root.addEventListener('click', onClick)
  render()

  // Arrivée depuis un état vide du tableau de bord : la feuille s'ouvre seule.
  if (initialKind) openEntrySheet()

  return () => root.removeEventListener('click', onClick)
}
