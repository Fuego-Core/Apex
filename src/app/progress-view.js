import { J0 } from './config.js'
import { TODAY, save, state } from './store.js'
import { coach, esc, num, section, shell, top } from './ui.js'

const TRACKED = [
  ['weight', 'Poids', 'kg'],
  ['neck', 'Cou', 'cm'],
  ['chest', 'Poitrine', 'cm'],
  ['waist', 'Taille', 'cm'],
  ['navel', 'Nombril', 'cm'],
  ['hips', 'Hanches', 'cm'],
  ['armL', 'Bras G', 'cm'],
  ['armR', 'Bras D', 'cm'],
  ['thighL', 'Cuisse G', 'cm'],
  ['thighR', 'Cuisse D', 'cm'],
  ['calfL', 'Mollet G', 'cm'],
  ['calfR', 'Mollet D', 'cm']
]

function dateLabel(date) {
  const parsed = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('fr-BE', { day: '2-digit', month: 'short' })
}

function timeline() {
  const byDate = new Map([[J0.date, { ...J0 }]])
  for (const row of Array.isArray(state.body) ? state.body : []) {
    if (!row?.date) continue
    byDate.set(row.date, { ...(byDate.get(row.date) || {}), ...row })
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

function currentBody(rows) {
  return rows.reduce((current, row) => ({ ...current, ...row }), { ...J0 })
}

function series(rows, key) {
  return rows
    .filter((row) => Number.isFinite(Number(row[key])))
    .map((row) => ({ date: row.date, value: Number(row[key]) }))
}

function delta(value, start, unit) {
  const change = Number(value) - Number(start)
  if (!Number.isFinite(change) || Math.abs(change) < 0.05) return `Stable depuis J0`
  return `${change > 0 ? '+' : '−'}${num(Math.abs(change))} ${unit} depuis J0`
}

function sparkline(points, label, unit) {
  if (!points.length) return '<div class="chart-empty">Pas encore de données.</div>'
  const width = 320
  const height = 116
  const padX = 10
  const padY = 14
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const coords = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? width / 2 : padX + index * ((width - padX * 2) / (points.length - 1)),
    y: padY + (max - point.value) / range * (height - padY * 2)
  }))
  const path = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const first = points[0]
  const last = points.at(-1)

  return `<div class="progress-chart" role="img" aria-label="Évolution ${esc(label)}">
    <div class="progress-chart__meta"><span>${dateLabel(first.date)} · ${num(first.value)} ${unit}</span><strong>${num(last.value)} ${unit}</strong><span>${dateLabel(last.date)}</span></div>
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="${height - 1}" x2="${width}" y2="${height - 1}" class="chart-axis" />
      ${coords.length > 1 ? `<polyline points="${path}" class="chart-line" />` : ''}
      ${coords.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" class="chart-dot" />`).join('')}
    </svg>
  </div>`
}

function latestValue(body, key) {
  const value = Number(body[key])
  return Number.isFinite(value) ? value : Number(J0[key])
}

function measurementCard(body, key, label, unit) {
  const current = latestValue(body, key)
  const start = Number(J0[key])
  return `<article class="measurement-card">
    <span>${label}</span>
    <strong>${num(current)} ${unit}</strong>
    <small>${delta(current, start, unit)}</small>
  </article>`
}

export function progressPage() {
  const rows = timeline()
  const body = currentBody(rows)
  const weightSeries = series(rows, 'weight')
  const navelSeries = series(rows, 'navel')
  const weightChange = latestValue(body, 'weight') - J0.weight
  const navelChange = latestValue(body, 'navel') - J0.navel

  shell(`
    ${top('Progrès', 'Mensurations, tendances et recomposition')}

    <section class="progress-hero">
      <div><p class="kicker">OBJECTIF ACTUEL</p><h2>Recomposition</h2><p>Nombril ↓ · performances ↑ · muscle préservé ou construit.</p></div>
      <div class="progress-score"><span>J0</span><strong>${dateLabel(J0.date)}</strong></div>
    </section>

    <div class="metric-grid progress-metrics">
      <article class="metric"><span>Poids actuel</span><strong>${num(latestValue(body, 'weight'))} kg</strong><small class="${weightChange < 0 ? 'trend-good' : ''}">${delta(latestValue(body, 'weight'), J0.weight, 'kg')}</small></article>
      <article class="metric"><span>Nombril actuel</span><strong>${num(latestValue(body, 'navel'))} cm</strong><small class="${navelChange < 0 ? 'trend-good' : ''}">${delta(latestValue(body, 'navel'), J0.navel, 'cm')}</small></article>
    </div>

    ${section('Tendances')}
    <div class="chart-stack">
      <article class="plain-card chart-card"><header><div><span>Poids</span><strong>${weightSeries.length} relevé${weightSeries.length > 1 ? 's' : ''}</strong></div></header>${sparkline(weightSeries, 'du poids', 'kg')}</article>
      <article class="plain-card chart-card"><header><div><span>Tour de nombril</span><strong>${navelSeries.length} relevé${navelSeries.length > 1 ? 's' : ''}</strong></div></header>${sparkline(navelSeries, 'du tour de nombril', 'cm')}</article>
    </div>

    ${section('Nouveau relevé')}
    <article class="plain-card measurement-form-card">
      <div class="measurement-primary">
        <label>Poids <small>kg</small><input id="weight" inputmode="decimal" placeholder="${num(latestValue(body, 'weight'))}"></label>
        <label>Nombril <small>cm</small><input id="navel" inputmode="decimal" placeholder="${num(latestValue(body, 'navel'))}"></label>
      </div>
      <details class="measurement-details">
        <summary>Ajouter les mensurations complètes <span>optionnel</span></summary>
        <div class="measurement-form-grid">
          ${TRACKED.filter(([key]) => !['weight', 'navel'].includes(key)).map(([key, label, unit]) => `<label>${label} <small>${unit}</small><input id="${key}" inputmode="decimal" placeholder="${num(latestValue(body, key))}"></label>`).join('')}
        </div>
      </details>
      <p class="form-help">Mesure-toi dans des conditions similaires. Tu peux remplir seulement les valeurs prises aujourd’hui.</p>
      <button class="btn btn-primary btn-block" id="saveBody">Enregistrer le relevé</button>
    </article>

    ${section('Mensurations actuelles')}
    <div class="measurement-grid">
      ${TRACKED.filter(([key]) => !['weight'].includes(key)).map(([key, label, unit]) => measurementCard(body, key, label, unit)).join('')}
    </div>

    ${section('Historique')}
    <div class="body-history">
      ${rows.slice().reverse().map((row) => `<article class="body-history-row">
        <div><strong>${dateLabel(row.date)}</strong><small>${row.date === J0.date ? 'Point zéro' : 'Relevé enregistré'}</small></div>
        <div class="body-history-values"><span>${Number.isFinite(Number(row.weight)) ? `${num(row.weight)} kg` : '—'}</span><span>${Number.isFinite(Number(row.navel)) ? `${num(row.navel)} cm nombril` : '—'}</span></div>
        ${row.date !== J0.date ? `<button class="history-delete" data-delete-body="${esc(row.date)}" aria-label="Supprimer le relevé">×</button>` : ''}
      </article>`).join('')}
    </div>

    ${coach('Lecture du progrès', 'Le signal prioritaire est la tendance : tour de nombril qui baisse progressivement, performances qui remontent et récupération correcte. Une variation isolée du poids ne décide jamais du plan.')}
  `, 'progress')

  document.querySelector('#saveBody').onclick = () => {
    const entry = { date: TODAY() }
    let hasValue = false

    for (const [key] of TRACKED) {
      const input = document.querySelector(`#${key}`)
      if (!input || !input.value.trim()) continue
      const value = Number(input.value.replace(',', '.'))
      if (!Number.isFinite(value) || value <= 0) continue
      entry[key] = value
      hasValue = true
    }

    if (!hasValue) return
    const existing = state.body.find((row) => row.date === entry.date)
    if (existing) Object.assign(existing, entry)
    else state.body.push(entry)
    state.body.sort((a, b) => String(a.date).localeCompare(String(b.date)))
    save()
    progressPage()
  }

  document.querySelectorAll('[data-delete-body]').forEach((button) => {
    button.onclick = () => {
      const date = button.dataset.deleteBody
      state.body = state.body.filter((row) => row.date !== date)
      save()
      progressPage()
    }
  })
}
