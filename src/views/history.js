import { getState } from '../state.js'
import { navigate } from '../main.js'
import { esc, header, kg, num, mmss, duration, formatDate, formatDateTime } from '../ui.js'
import { PROGRESSION, TROP_LOURD, LOG, STATUS_LABEL } from '../core/engine.js'

function toneOf(status) {
  if (status === PROGRESSION) return 'gold'
  if (status === TROP_LOURD) return 'warn'
  return 'flat'
}

function detail(root, entry) {
  const rows = entry.entries
    .map((e) => {
      const done = e.sets.filter((s) => s.done && !s.warmup)
      const warm = e.sets.filter((s) => s.done && s.warmup).length
      const value =
        e.mode === 'reps'
          ? done.map((s) => `${s.reps}×${num(s.weight)}`).join(' · ') || '—'
          : done.map((s) => mmss(s.seconds)).join(' · ') || '—'
      return `
        <li class="hrow">
          <div class="hrow__top">
            <span class="hrow__name">${esc(e.name)}</span>
            ${e.status && e.status !== LOG ? `<span class="badge badge--${toneOf(e.status)}">${esc(STATUS_LABEL[e.status])}</span>` : ''}
          </div>
          <p class="hrow__sets">${esc(value)}${warm ? ` <span class="hrow__warm">+ ${warm} échauff.</span>` : ''}</p>
        </li>`
    })
    .join('')

  root.innerHTML = `
    <div class="page">
      ${header({ back: '#/historique', title: entry.sessionName, sub: formatDateTime(entry.startedAt) })}
      <section class="stats">
        <div class="stat"><p class="stat__value">${esc(duration(entry.durationSec))}</p><p class="stat__label">Durée</p></div>
        <div class="stat"><p class="stat__value">${esc(num(entry.tonnage))}</p><p class="stat__label">Tonnage (kg)</p></div>
        <div class="stat"><p class="stat__value">${entry.entries.filter((e) => e.status === PROGRESSION).length}</p><p class="stat__label">Progressions 🎯</p></div>
      </section>
      <ul class="card hlist">${rows}</ul>
    </div>`
}

export default function historyView(root, { entryId } = {}) {
  const state = getState()

  if (entryId) {
    const entry = state.history.find((h) => h.id === entryId)
    if (!entry) {
      navigate('#/historique')
      return
    }
    detail(root, entry)
    return
  }

  const sessions = state.history
    .map(
      (h) => `
      <a class="card hcard" href="#/historique/${esc(h.id)}">
        <div>
          <p class="hcard__name">${esc(h.sessionName)}</p>
          <p class="hcard__meta">${esc(formatDate(h.startedAt))} · ${esc(duration(h.durationSec))} · ${esc(num(h.tonnage))} kg</p>
        </div>
        <div class="hcard__side">
          ${
            h.entries.filter((e) => e.status === PROGRESSION).length
              ? `<span class="chip chip--gold">🎯 ${h.entries.filter((e) => e.status === PROGRESSION).length}</span>`
              : ''
          }
          <span class="session-card__go">›</span>
        </div>
      </a>`
    )
    .join('')

  // Un exercice = un MOUVEMENT du catalogue : les élévations latérales de Push
  // et celles de Upper sont le même exercice, donc le même historique. Le nom
  // affiché est le nom actuel du mouvement, pas celui figé le jour de la séance.
  const byMovement = new Map()
  state.history.forEach((h) => {
    h.entries.forEach((e) => {
      if (e.mode !== 'reps') return
      if (!e.sets.some((s) => s.done && !s.warmup)) return
      const id = e.exerciseId
      if (!id) return
      const cur = byMovement.get(id) || { id, name: null, count: 0, last: null, weight: 0 }
      cur.count++
      if (!cur.last || new Date(h.startedAt) > new Date(cur.last)) {
        cur.last = h.startedAt
        cur.weight = e.weightUsed
      }
      cur.name = state.catalog[id]?.name || e.name || id
      byMovement.set(id, cur)
    })
  })
  const exercises = [...byMovement.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(
      (e) => `
      <a class="card xrow" href="#/exercice/${esc(encodeURIComponent(e.id))}">
        <span class="xrow__name">${esc(e.name)}</span>
        <span class="xrow__meta">${esc(kg(e.weight))} · ${e.count} séance${e.count > 1 ? 's' : ''}</span>
        <span class="session-card__go">›</span>
      </a>`
    )
    .join('')

  root.innerHTML = `
    <div class="page">
      ${header({ back: '#/progression', title: 'Historique', sub: `${state.history.length} séance${state.history.length > 1 ? 's' : ''} archivée${state.history.length > 1 ? 's' : ''}` })}
      ${
        state.history.length
          ? `<h3 class="section-title">Séances</h3>
             <div class="stack">${sessions}</div>
             <h3 class="section-title">Progression par exercice</h3>
             <div class="stack">${exercises}</div>`
          : `<div class="card empty">
              <p class="empty__title">Rien à afficher</p>
              <p class="empty__text">Termine une séance et elle atterrira ici, avec les courbes par exercice.</p>
             </div>`
      }
    </div>`
}
