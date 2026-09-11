import { J0 } from './config.js'
import { deleteProgressPhotos, listProgressPhotos, saveProgressPhotos } from './photo-store.js'
import { exportState, restoreState, TODAY, save, state } from './store.js'
import { esc, go, num, shell, top } from './ui.js'

const TRACKED = [
  ['weight', 'Poids', 'kg'],
  ['neck', 'Cou', 'cm'],
  ['chest', 'Poitrine', 'cm'],
  ['waist', 'Taille', 'cm'],
  ['navel', 'Nombril', 'cm'],
  ['hips', 'Hanches', 'cm'],
  ['armL', 'Bras gauche', 'cm'],
  ['armR', 'Bras droit', 'cm'],
  ['thighL', 'Cuisse gauche', 'cm'],
  ['thighR', 'Cuisse droite', 'cm'],
  ['calfL', 'Mollet gauche', 'cm'],
  ['calfR', 'Mollet droit', 'cm']
]

let photoUrls = []

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

function latestValue(body, key) {
  const value = Number(body[key])
  return Number.isFinite(value) ? value : Number(J0[key])
}

function change(current, start, unit) {
  const delta = Number(current) - Number(start)
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.05) return `Stable depuis J0`
  return `${delta > 0 ? '+' : '−'}${num(Math.abs(delta))} ${unit} depuis J0`
}

function points(rows, key) {
  return rows.filter((row) => Number.isFinite(Number(row[key]))).map((row) => ({ date: row.date, value: Number(row[key]) }))
}

function chart(data, unit) {
  if (!data.length) return '<div class="v3-body-empty">Pas encore assez de données.</div>'
  const width = 340
  const height = 120
  const pad = 12
  const values = data.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const coords = data.map((point, index) => ({
    ...point,
    x: data.length === 1 ? width / 2 : pad + index * ((width - pad * 2) / (data.length - 1)),
    y: pad + (max - point.value) / range * (height - pad * 2)
  }))
  const poly = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  return `<div class="v3-body-chart">
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      ${coords.length > 1 ? `<polyline points="${poly}" />` : ''}
      ${coords.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" />`).join('')}
    </svg>
    <div><span>${dateLabel(data[0].date)} · ${num(data[0].value)} ${unit}</span><strong>${num(data.at(-1).value)} ${unit}</strong><span>${dateLabel(data.at(-1).date)}</span></div>
  </div>`
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
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', .86))
  } catch {
    return file
  }
}

function makePhotoUrl(blob) {
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  photoUrls.push(url)
  return url
}

function clearPhotoUrls() {
  photoUrls.forEach((url) => URL.revokeObjectURL(url))
  photoUrls = []
}

async function renderPhotos() {
  const slot = document.querySelector('#v3-photo-slot')
  if (!slot) return
  clearPhotoUrls()
  try {
    const rows = await listProgressPhotos()
    const latest = rows[0]
    slot.innerHTML = `
      ${latest ? `<div class="v3-photo-preview">
        ${[['front', 'Face'], ['side', 'Profil'], ['back', 'Dos']].map(([key, label]) => {
          const url = makePhotoUrl(latest[key])
          return `<figure>${url ? `<img src="${url}" alt="Photo ${label}">` : '<div>Manquante</div>'}<figcaption>${label}</figcaption></figure>`
        }).join('')}
      </div>` : '<div class="v3-body-empty"><strong>Crée ton point visuel J0.</strong><p>Face, profil et dos dans les mêmes conditions toutes les 2 à 4 semaines.</p></div>'}
      <details class="v3-photo-add">
        <summary>Ajouter une nouvelle série <b>›</b></summary>
        <div>
          ${['front:Face', 'side:Profil', 'back:Dos'].map((item) => {
            const [key, label] = item.split(':')
            return `<label><span>${label}</span><input type="file" id="photo-${key}" accept="image/*" capture="environment"><b>Choisir</b></label>`
          }).join('')}
          <button id="savePhotos">Enregistrer les photos</button><p id="photoStatus"></p>
        </div>
      </details>
      ${rows.length ? `<div class="v3-photo-history">${rows.map((row) => `<article><div><strong>${dateLabel(row.date)}</strong><small>${[row.front,row.side,row.back].filter(Boolean).length}/3 vues</small></div><button data-delete-photo="${esc(row.date)}">Supprimer</button></article>`).join('')}</div>` : ''}
    `

    document.querySelector('#savePhotos')?.addEventListener('click', async () => {
      const front = document.querySelector('#photo-front')?.files?.[0]
      const side = document.querySelector('#photo-side')?.files?.[0]
      const back = document.querySelector('#photo-back')?.files?.[0]
      const status = document.querySelector('#photoStatus')
      if (!front && !side && !back) { status.textContent = 'Ajoute au moins une photo.'; return }
      status.textContent = 'Préparation…'
      await saveProgressPhotos(TODAY(), {
        front: front ? await compressPhoto(front) : null,
        side: side ? await compressPhoto(side) : null,
        back: back ? await compressPhoto(back) : null
      })
      await renderPhotos()
    })

    document.querySelectorAll('[data-delete-photo]').forEach((button) => {
      button.onclick = async () => {
        if (!confirm('Supprimer cette série de photos de cet appareil ?')) return
        await deleteProgressPhotos(button.dataset.deletePhoto)
        await renderPhotos()
      }
    })
  } catch {
    slot.innerHTML = '<div class="v3-body-empty">Le stockage photo privé n’est pas disponible sur ce navigateur.</div>'
  }
}

export function bodyPage() {
  const rows = timeline()
  const body = currentBody(rows)
  const weight = latestValue(body, 'weight')
  const navel = latestValue(body, 'navel')
  const weightPoints = points(rows, 'weight')
  const navelPoints = points(rows, 'navel')

  shell(`
    ${top('Corps & évolution', 'Mensurations, tendances et photos privées')}

    <button class="v3-inline-back" data-go="tracking">‹ Retour au bilan</button>

    <section class="v3-body-hero">
      <div><span>RECOMPOSITION</span><h2>Le miroir, le mètre et les performances.</h2><p>Le poids seul ne décide jamais si le plan fonctionne.</p></div>
      <div class="v3-body-hero__stats">
        <article><span>POIDS</span><strong>${num(weight)} kg</strong><small>${change(weight, J0.weight, 'kg')}</small></article>
        <article><span>NOMBRIL</span><strong>${num(navel)} cm</strong><small>${change(navel, J0.navel, 'cm')}</small></article>
      </div>
    </section>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>TENDANCES</span><h2>Évolution</h2></div><small>Regarde la direction, pas une mesure isolée</small></div>
      <div class="v3-body-charts">
        <article><header><strong>Poids</strong><small>${weightPoints.length} relevé${weightPoints.length > 1 ? 's' : ''}</small></header>${chart(weightPoints, 'kg')}</article>
        <article><header><strong>Tour de nombril</strong><small>${navelPoints.length} relevé${navelPoints.length > 1 ? 's' : ''}</small></header>${chart(navelPoints, 'cm')}</article>
      </div>
    </section>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>NOUVEAU RELEVÉ</span><h2>Mesurer aujourd’hui</h2></div><small>Poids + nombril suffisent au quotidien</small></div>
      <article class="v3-body-entry">
        <div class="v3-body-entry__primary">
          <label><span>Poids</span><div><input id="weight" inputmode="decimal" placeholder="${num(weight)}"><b>kg</b></div></label>
          <label><span>Nombril</span><div><input id="navel" inputmode="decimal" placeholder="${num(navel)}"><b>cm</b></div></label>
        </div>
        <details>
          <summary>Mensurations complètes <b>›</b></summary>
          <div class="v3-body-entry__full">
            ${TRACKED.filter(([key]) => !['weight','navel'].includes(key)).map(([key,label,unit]) => `<label><span>${label}</span><div><input id="${key}" inputmode="decimal" placeholder="${num(latestValue(body,key))}"><b>${unit}</b></div></label>`).join('')}
          </div>
        </details>
        <button id="saveBody">Enregistrer le relevé</button>
      </article>
    </section>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>MENSURATIONS</span><h2>État actuel</h2></div><small>Comparé au point zéro</small></div>
      <div class="v3-measure-list">
        ${TRACKED.filter(([key]) => key !== 'weight').map(([key,label,unit]) => `<article><span>${label}</span><strong>${num(latestValue(body,key))} ${unit}</strong><small>${change(latestValue(body,key),J0[key],unit)}</small></article>`).join('')}
      </div>
    </section>

    <section class="v3-section-block">
      <div class="v3-section-title"><div><span>PHOTOS PRIVÉES</span><h2>Progression visuelle</h2></div><small>Stockées uniquement sur cet appareil</small></div>
      <div id="v3-photo-slot"></div>
    </section>

    <details class="v3-advanced-tools v3-body-history-details">
      <summary><span>HISTORIQUE</span><strong>${rows.length} relevé${rows.length > 1 ? 's' : ''}</strong><b>›</b></summary>
      <div class="v3-advanced-body">
        <div class="v3-body-history">${rows.slice().reverse().map((row) => `<article><div><strong>${dateLabel(row.date)}</strong><small>${row.date === J0.date ? 'Point zéro' : 'Relevé'}</small></div><span>${Number.isFinite(Number(row.weight)) ? `${num(row.weight)} kg` : '—'} · ${Number.isFinite(Number(row.navel)) ? `${num(row.navel)} cm` : '—'}</span>${row.date !== J0.date ? `<button data-delete-body="${esc(row.date)}">×</button>` : ''}</article>`).join('')}</div>
      </div>
    </details>

    <details class="v3-advanced-tools">
      <summary><span>DONNÉES</span><strong>Sauvegarde APEX</strong><b>›</b></summary>
      <div class="v3-advanced-body"><p>Exporte séances, mesures, check-ins, nutrition et stock. Les photos restent privées sur cet appareil.</p><div class="v3-data-buttons"><button id="exportData">Exporter</button><button id="importData">Restaurer</button></div><input id="backupFile" type="file" accept="application/json,.json" hidden><p id="dataStatus"></p></div>
    </details>
  `, 'progress')

  renderPhotos()
  document.querySelector('[data-go]')?.addEventListener('click', (event) => go(event.currentTarget.dataset.go))

  document.querySelector('#saveBody').onclick = () => {
    const entry = { date: TODAY() }
    let hasValue = false
    for (const [key] of TRACKED) {
      const input = document.querySelector(`#${key}`)
      if (!input?.value?.trim()) continue
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
    bodyPage()
  }

  document.querySelectorAll('[data-delete-body]').forEach((button) => {
    button.onclick = () => {
      state.body = state.body.filter((row) => row.date !== button.dataset.deleteBody)
      save()
      bodyPage()
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
    if (!file) return
    try {
      const payload = JSON.parse(await file.text())
      if (!confirm('Restaurer cette sauvegarde remplacera les données APEX actuelles. Continuer ?')) return
      restoreState(payload)
      bodyPage()
    } catch {
      document.querySelector('#dataStatus').textContent = 'Fichier APEX invalide.'
    }
  }
}
