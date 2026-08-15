/* HISTORIQUE ALIMENTAIRE — la suite des jours, pas la photo du jour.

   Ce que cet écran doit répondre : « est-ce que je tiens sur la durée ? ».
   Donc une courbe, une moyenne, et la liste des journées — chacune ouvrable
   telle qu'elle a été enregistrée.

   Une journée sans rien de noté n'apparaît pas et ne vaut pas zéro : ne pas
   avoir mangé et ne pas avoir noté sont deux choses différentes, et APEX ne
   sait pas laquelle s'est produite. */

import { getState } from '../state.js'
import { loggedDays } from '../core/nutrition/journal.js'
import { dailySeries, dayTotals, display } from '../core/nutrition/calculations.js'
import { movingAverage, series as windowed, today } from '../core/body.js'
import { esc, header, formatDate, relativeDays } from '../ui.js'
import { tile, blank, plot } from '../ui/components.js'

const RANGE = 30

export default function nutritionHistoryView(root) {
  function render() {
    const state = getState()
    const days = state.nutrition.days
    const points = dailySeries(days, 'kcal')
    const target = state.nutrition.targets.kcal

    // Moyenne mobile calendaire, comme pour le poids : noter deux fois ou tous
    // les jours ne doit pas changer la lecture.
    const withAverage = windowed(movingAverage(points, 7), { days: RANGE })
    const recent = points.filter((p) => p.date > shift(today(), -RANGE))
    const average = recent.length ? recent.reduce((a, p) => a + p.value, 0) / recent.length : null

    const rows = loggedDays(days)
      .map((day) => {
        const { total, entryCount } = dayTotals(day)
        const gap = target && total.kcal != null ? total.kcal - target : null
        return `
          <a class="hrow" href="#/nutrition/${esc(day.date)}">
            <div>
              <span class="hrow__name">${esc(formatDate(`${day.date}T12:00:00`))}</span>
              <p class="hrow__sets">
                ${esc(relativeDays(`${day.date}T12:00:00`))} · ${entryCount} aliment${entryCount > 1 ? 's' : ''}
                ${total.protein != null ? ` · ${display(total.protein)} g prot.` : ''}
              </p>
            </div>
            <span class="row__meta">
              ${total.kcal != null ? `${display(total.kcal, 'kcal')} kcal` : '—'}
              ${gap !== null ? `<br><span class="hrow__sets">${gap >= 0 ? '+' : ''}${display(gap, 'kcal')}</span>` : ''}
            </span>
          </a>`
      })
      .join('')

    root.innerHTML = `
      <div class="page">
        ${header({ back: '#/nutrition', title: 'Historique', sub: 'Journal alimentaire' })}

        ${
          points.length
            ? `
              <div class="grid-2">
                ${tile({
                  label: `Moyenne ${RANGE} jours`,
                  value: average === null ? null : display(average, 'kcal'),
                  unit: 'kcal',
                  hint: `${recent.length} journée${recent.length > 1 ? 's' : ''} enregistrée${recent.length > 1 ? 's' : ''}`,
                  empty: '—'
                })}
                ${tile({
                  label: 'Objectif',
                  value: target ?? null,
                  unit: 'kcal',
                  hint:
                    target && average !== null
                      ? `${average >= target ? '+' : ''}${display(average - target, 'kcal')} kcal en moyenne`
                      : 'non défini',
                  empty: '—'
                })}
              </div>

              ${
                withAverage.length >= 2
                  ? `<div class="card" style="margin-top:var(--sp-3)">
                       ${plot(withAverage, { unit: 'kcal', formatDate: (d) => formatDate(`${d}T12:00:00`) })}
                       <p class="note">Points : le total du jour. Ligne : moyenne mobile sur 7 jours.</p>
                     </div>`
                  : ''
              }

              <div class="section-head" style="margin-top:var(--sp-5)">
                <h3 class="section-title">Journées</h3>
                <span class="section-link">${points.length} enregistrée${points.length > 1 ? 's' : ''}</span>
              </div>
              <div class="card hlist">${rows}</div>`
            : blank({
                title: 'Aucune journée enregistrée',
                text: 'Dès que tu notes un aliment, la journée apparaît ici — avec son total et son écart à ton objectif.'
              })
        }
      </div>`
  }

  render()
  return () => {}
}

/** Décalage de date en jours, sans dépendre du fuseau. */
function shift(date, days) {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
