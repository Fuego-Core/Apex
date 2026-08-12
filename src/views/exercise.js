import { getState } from '../state.js'
import { navigate } from '../main.js'
import { esc, header, kg, num, formatDate } from '../ui.js'
import { PROGRESSION, TROP_LOURD, LOG, STATUS_LABEL } from '../engine.js'

const W = 320
const H = 130
const PAD = { l: 8, r: 8, t: 12, b: 22 }

/** Mini-courbe : poids (or) + volume de reps (barres grises) dans le temps. */
function chart(points) {
  if (points.length < 2) {
    return `<p class="chart__empty">Deux séances minimum pour tracer la courbe.</p>`
  }
  const weights = points.map((p) => p.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const span = max - min || 1
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const x = (i) => PAD.l + (innerW * i) / (points.length - 1)
  const y = (w) => PAD.t + innerH - ((w - min) / span) * innerH

  const maxReps = Math.max(...points.map((p) => p.reps), 1)
  const barW = Math.max(3, Math.min(14, innerW / points.length / 2))
  const bars = points
    .map((p, i) => {
      const h = (p.reps / maxReps) * innerH * 0.7
      return `<rect x="${(x(i) - barW / 2).toFixed(1)}" y="${(PAD.t + innerH - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="chart__bar"/>`
    })
    .join('')

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(p.weight).toFixed(1)}`).join(' ')
  const dots = points
    .map(
      (p, i) =>
        `<circle cx="${x(i).toFixed(1)}" cy="${y(p.weight).toFixed(1)}" r="${p.record ? 4.5 : 3}" class="chart__dot ${p.record ? 'is-record' : ''}"/>`
    )
    .join('')

  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
         aria-label="Évolution du poids et du volume de reps">
      ${bars}
      <path d="${path}" class="chart__line"/>
      ${dots}
      <text x="${PAD.l}" y="${H - 6}" class="chart__axis">${esc(formatDate(points[0].date))}</text>
      <text x="${W - PAD.r}" y="${H - 6}" text-anchor="end" class="chart__axis">${esc(formatDate(points[points.length - 1].date))}</text>
    </svg>
    <div class="chart__legend">
      <span><i class="dot dot--gold"></i> poids (${esc(kg(min))} → ${esc(kg(max))})</span>
      <span><i class="dot dot--grey"></i> reps totales</span>
    </div>`
}

export default function exerciseView(root, { name }) {
  const state = getState()

  const rows = []
  ;[...state.history]
    .slice()
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))
    .forEach((h) => {
      h.entries.forEach((e) => {
        if (e.name !== name || e.mode !== 'reps') return
        const done = e.sets.filter((s) => s.done && !s.warmup)
        if (!done.length) return
        rows.push({
          date: h.startedAt,
          sessionName: h.sessionName,
          weight: Number(e.weightUsed) || 0,
          reps: done.reduce((a, s) => a + (Number(s.reps) || 0), 0),
          detail: done.map((s) => s.reps).join(' · '),
          status: e.status,
          record: !!e.record
        })
      })
    })

  if (!rows.length) {
    navigate('#/historique')
    return
  }

  const best = Math.max(...rows.map((r) => r.weight))
  const last = rows[rows.length - 1]
  // L'or récompense une vraie progression, pas le simple fait d'avoir un chiffre.
  const progressed = rows.length > 1 && best > rows[0].weight

  const list = [...rows]
    .reverse()
    .map(
      (r) => `
      <li class="hrow">
        <div class="hrow__top">
          <span class="hrow__name">${esc(formatDate(r.date))} · ${esc(r.sessionName)}</span>
          ${r.record ? '<span class="badge badge--gold">Record 🏆</span>' : ''}
        </div>
        <p class="hrow__sets">${esc(r.detail)} reps · <strong>${esc(kg(r.weight))}</strong>
          ${
            r.status && r.status !== LOG
              ? `<span class="badge badge--${r.status === PROGRESSION ? 'gold' : r.status === TROP_LOURD ? 'warn' : 'flat'}">${esc(STATUS_LABEL[r.status])}</span>`
              : ''
          }
        </p>
      </li>`
    )
    .join('')

  root.innerHTML = `
    <div class="page">
      ${header({ back: '#/historique', title: name, sub: `${rows.length} séance${rows.length > 1 ? 's' : ''} enregistrée${rows.length > 1 ? 's' : ''}` })}

      <section class="stats">
        <div class="stat"><p class="stat__value">${esc(num(last.weight))}</p><p class="stat__label">Poids actuel (kg)</p></div>
        <div class="stat ${progressed ? 'stat--gold' : ''}"><p class="stat__value">${esc(num(best))}</p><p class="stat__label">Meilleur (kg)</p></div>
        <div class="stat"><p class="stat__value">${last.reps}</p><p class="stat__label">Reps dernière séance</p></div>
      </section>

      <div class="card chart-card">${chart(rows)}</div>

      <h3 class="section-title">Détail</h3>
      <ul class="card hlist">${list}</ul>
    </div>`
}
