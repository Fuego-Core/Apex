import { J0 } from './config.js'
import { deleteProgressPhotos, listProgressPhotos, saveProgressPhotos } from './photo-store.js'
import { exportState, restoreState, TODAY, save, state } from './store.js'
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

let activePhotoUrls = []

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
  if (!Number.isFinite(change) || Math.abs(change) < 0.05) return 'Stable depuis J0'
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

function downloadBackup() {
  const blob = new Blob([JSON.stringify(exportState(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `APEX-backup-${TODAY()}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function compressPhoto(file) {
  if (!file?.type?.startsWith('image/')) return file
  try {
    const bitmap = await createImageBitmap(file)
    const max = 1600
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
    return blob || file
  } catch {
    return file
  }
}

function photoUrl(blob) {
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  activePhotoUrls.push(url)
  return url
}

function clearPhotoUrls() {
  activePhotoUrls.forEach((url) => URL.revokeObjectURL(url))
  activePhotoUrls = []
}

async function renderPhotoProgress() {
  const slot = document.querySelector('#photo-progress-slot')
  if (!slot) return
  clearPhotoUrls()
  try {
    const rows = await listProgressPhotos()
    const latest = rows[0]
    slot.innerHTML = `
      <article class="photo-progress-intro">
        <div><span>PRIVÉ SUR CET APPAREIL</span><strong>Face · profil · dos</strong><p>Mêmes conditions, même distance, même lumière. Idéalement toutes les 2 à 4 semaines.</p></div>
        <b>${rows.length ? `${rows.length} série${rows.length > 1 ? 's' : ''}` : 'J0 à créer'}</b>
      </article>

      <article class="photo-capture-card">
        <div class="photo-capture-head"><div><span>NOUVELLE SÉRIE</span><strong>${dateLabel(TODAY())}</strong></div><small>Photos conservées uniquement dans le stockage privé du navigateur.</small></div>
        <div class="photo-input-grid">
          ${['front:Face', 'side:Profil', 'back:Dos'].map((item) => {
            const [key, label] = item.split(':')
            return `<label class="photo-input"><span>${label}</span><input type="file" id="photo-${key}" accept="image/*" capture="environment"><b>Choisir une photo</b></label>`
          }).join('')}
        </div>
        <button class="btn btn-primary btn-block" id="savePhotos">Enregistrer les photos</button>
        <p class="data-status" id="photoStatus"></p>
      </article>

      ${latest ? `<article class="photo-latest-card">
        <header><div><span>DERNIÈRE COMPARAISON</span><strong>${dateLabel(latest.date)}</strong></div><small>Ne juge pas une seule photo : compare avec le nombril, le poids moyen et les performances.</small></header>
        <div class="photo-preview-grid">
          ${[['front', 'Face'], ['side', 'Profil'], ['back', 'Dos']].map(([key, label]) => {
            const url = photoUrl(latest[key])
            return `<figure>${url ? `<img src="${url}" alt="Photo progression ${label}">` : '<div class="photo-missing">Manquante</div>'}<figcaption>${label}</figcaption></figure>`
          }).join('')}
        </div>
      </article>` : ''}

      ${rows.length ? `<div class="photo-history">
        ${rows.map((row) => `<article><div><strong>${dateLabel(row.date)}</strong><small>${[row.front, row.side, row.back].filter(Boolean).length}/3 vues enregistrées</small></div><button data-delete-photos="${esc(row.date)}">Supprimer</button></article>`).join('')}
      </div>` : ''}
    `

    document.querySelector('#savePhotos')?.addEventListener('click', async () => {
      const status = document.querySelector('#photoStatus')
      const front = document.querySelector('#photo-front')?.files?.[0]
      const side = document.querySelector('#photo-side')?.files?.[0]
      const back = document.querySelector('#photo-back')?.files?.[0]
      if (!front && !side && !back) {
        status.textContent = 'Ajoute au moins une photo.'
        return
      }
      status.textContent = 'Préparation des photos…'
      try {
        await saveProgressPhotos(TODAY(), {
          front: front ? await compressPhoto(front) : null,
          side: side ? await compressPhoto(side) : null,
          back: back ? await compressPhoto(back) : null
        })
        status.textContent = 'Photos enregistrées en privé sur cet appareil.'
        await renderPhotoProgress()
      } catch {
        status.textContent = 'Impossible d’enregistrer les photos sur ce navigateur.'
      }
    })

    document.querySelectorAll('[data-delete-photos]').forEach((button) => {
      button.onclick = async () => {
        if (!confirm('Supprimer cette série de photos de cet appareil ?')) return
        await deleteProgressPhotos(button.dataset.deletePhotos)
        await renderPhotoProgress()
      }
    })
  } catch {
    slot.innerHTML = '<article class="plain-card"><strong>Photos privées indisponibles</strong><p class="nutrition-note">Le stockage photo local n’est pas disponible sur ce navigateur. Les autres données APEX restent utilisables.</p></article>'
  }
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

    ${section('Photos progression')}
    <div id="photo-progress-slot"></div>

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
      ${TRACKED.filter(([key]) => key !== 'weight').map(([key, label, unit]) => measurementCard(body, key, label, unit)).join('')}
    </div>

    ${section('Historique')}
    <div class="body-history">
      ${rows.slice().reverse().map((row) => `<article class="body-history-row">
        <div><strong>${dateLabel(row.date)}</strong><small>${row.date === J0.date ? 'Point zéro' : 'Relevé enregistré'}</small></div>
        <div class="body-history-values"><span>${Number.isFinite(Number(row.weight)) ? `${num(row.weight)} kg` : '—'}</span><span>${Number.isFinite(Number(row.navel)) ? `${num(row.navel)} cm nombril` : '—'}</span></div>
        ${row.date !== J0.date ? `<button class="history-delete" data-delete-body="${esc(row.date)}" aria-label="Supprimer le relevé">×</button>` : ''}
      </article>`).join('')}
    </div>

    ${section('Mes données APEX')}
    <article class="plain-card data-card">
      <div><strong>Sauvegarde personnelle</strong><p>Exporte séances, mesures, check-ins, nutrition et stock. Les photos restent volontairement privées sur cet appareil et ne sont pas incluses dans le fichier JSON.</p></div>
      <div class="data-actions"><button class="btn btn-secondary" id="exportData">Exporter</button><button class="btn btn-secondary" id="importData">Restaurer</button></div>
      <input id="backupFile" type="file" accept="application/json,.json" hidden>
      <p class="data-status" id="dataStatus"></p>
    </article>

    ${coach('Lecture du progrès', 'Le signal prioritaire est la tendance : tour de nombril qui baisse progressivement, performances qui remontent et récupération correcte. Une variation isolée du poids ne décide jamais du plan.')}
  `, 'progress')

  renderPhotoProgress()

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

  document.querySelector('#exportData').onclick = () => {
    downloadBackup()
    document.querySelector('#dataStatus').textContent = 'Sauvegarde exportée.'
  }

  const fileInput = document.querySelector('#backupFile')
  document.querySelector('#importData').onclick = () => fileInput.click()
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0]
    const status = document.querySelector('#dataStatus')
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      if (!confirm('Restaurer cette sauvegarde remplacera les données APEX actuellement enregistrées sur cet appareil. Continuer ?')) return
      restoreState(payload)
      progressPage()
    } catch {
      status.textContent = 'Ce fichier n’est pas une sauvegarde APEX valide.'
    }
  }
}
