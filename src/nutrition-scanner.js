import './nutrition-scanner.css'

import { TODAY, nutritionLogTotals, save, state } from './app/store.js'

const OPEN_FOOD_FACTS = 'https://world.openfoodfacts.org/api/v2/product/'
let activeControls = null
let activeStream = null

function ensureState() {
  state.pantry = Array.isArray(state.pantry) ? state.pantry : []
  state.foodLog = state.foodLog && typeof state.foodLog === 'object' ? state.foodLog : {}
  return state
}

function persist() {
  save({ scope: 'nutrition' })
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[char])
}

function n(value, digits = 1) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('fr-FR', { maximumFractionDigits: digits })
    : '—'
}

function stopScanner() {
  try { activeControls?.stop?.() } catch {}
  activeControls = null
  try { activeStream?.getTracks?.().forEach((track) => track.stop()) } catch {}
  activeStream = null
}

function closeSheet() {
  stopScanner()
  document.querySelector('.scanner-sheet')?.remove()
}

function sheet(title, body) {
  closeSheet()
  document.body.insertAdjacentHTML('beforeend', `
    <div class="scanner-sheet">
      <section class="scanner-panel">
        <header class="scanner-head">
          <h2>${esc(title)}</h2>
          <button class="scanner-close" aria-label="Fermer">×</button>
        </header>
        <div class="scanner-body">${body}</div>
      </section>
    </div>`)

  document.querySelector('.scanner-close').onclick = closeSheet
  document.querySelector('.scanner-sheet').addEventListener('click', (event) => {
    if (event.target.classList.contains('scanner-sheet')) closeSheet()
  })
}

function productFromOpenFoodFacts(data, barcode) {
  const product = data?.product || {}
  const nutrients = product.nutriments || {}
  return {
    barcode,
    name: product.product_name_fr || product.product_name || product.generic_name_fr || product.generic_name || `Produit ${barcode}`,
    brand: product.brands || '',
    image: product.image_front_small_url || product.image_front_url || product.image_url || '',
    kcal: Number(nutrients['energy-kcal_100g'] ?? nutrients['energy-kcal'] ?? 0) || 0,
    protein: Number(nutrients.proteins_100g ?? 0) || 0,
    carbs: Number(nutrients.carbohydrates_100g ?? 0) || 0,
    fat: Number(nutrients.fat_100g ?? 0) || 0,
    source: 'Open Food Facts'
  }
}

async function lookup(barcode) {
  const clean = String(barcode || '').replace(/\D/g, '')
  if (clean.length < 8) throw new Error('Code-barres trop court.')

  const fields = 'code,product_name,product_name_fr,generic_name,generic_name_fr,brands,image_front_small_url,image_front_url,image_url,nutriments'
  const response = await fetch(`${OPEN_FOOD_FACTS}${clean}.json?fields=${fields}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Impossible de joindre Open Food Facts.')

  const data = await response.json()
  if (data.status !== 1 || !data.product) throw new Error('Produit introuvable. Tu peux le saisir manuellement.')
  return productFromOpenFoodFacts(data, clean)
}

function productMarkup(product) {
  return `<div class="product-result">
    <div class="product-hero">
      ${product.image ? `<img src="${esc(product.image)}" alt="">` : '<div></div>'}
      <div><h3>${esc(product.name)}</h3><p>${esc(product.brand || 'Marque non renseignée')}</p><p>${esc(product.barcode)}</p></div>
    </div>
    <div class="macro-grid">
      <div><span>kcal</span><strong>${n(product.kcal, 0)}</strong></div>
      <div><span>Protéines</span><strong>${n(product.protein)} g</strong></div>
      <div><span>Glucides</span><strong>${n(product.carbs)} g</strong></div>
      <div><span>Lipides</span><strong>${n(product.fat)} g</strong></div>
    </div>
    <div class="product-edit">
      <label>Quantité achetée<input id="qtyValue" inputmode="decimal" value="1"></label>
      <label>Unité<select id="qtyUnit"><option value="unité">unité</option><option value="g">g</option><option value="ml">ml</option><option value="pack">pack</option></select></label>
    </div>
    <div class="product-actions">
      <button class="scan-btn secondary" id="editMacros">Modifier les valeurs</button>
      <button class="scan-btn primary" id="saveProduct">Ajouter au stock</button>
    </div>
    <p class="scanner-status">Valeurs affichées pour 100 g/ml. Vérifie l’étiquette si le produit semble incorrect.</p>
  </div>`
}

function bindProduct(product) {
  document.querySelector('#saveProduct').onclick = () => {
    const current = ensureState()
    const qty = Number(String(document.querySelector('#qtyValue').value).replace(',', '.')) || 1
    const unit = document.querySelector('#qtyUnit').value
    const existing = current.pantry.find((item) => item.barcode === product.barcode)

    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + qty
      existing.unit = unit
      Object.assign(existing, product)
    } else {
      current.pantry.push({ ...product, qty, unit, addedAt: new Date().toISOString() })
    }
    persist()

    sheet('Produit ajouté', `
      <div class="scanner-empty">
        <strong>${esc(product.name)}</strong><br>est maintenant dans ton stock.
        <div style="margin-top:16px"><button class="scan-btn primary" id="scanAnother">Scanner un autre produit</button></div>
      </div>`)
    document.querySelector('#scanAnother').onclick = openScanner
  }

  document.querySelector('#editMacros').onclick = () => openManualProduct(product)
}

function showProduct(product) {
  sheet('Produit détecté', productMarkup(product))
  bindProduct(product)
}

function openManualProduct(base = {}) {
  sheet(base.barcode ? 'Corriger le produit' : 'Ajouter un produit', `
    <div class="product-result">
      <div class="product-edit" style="grid-template-columns:1fr">
        <label>Nom<input id="mName" value="${esc(base.name || '')}"></label>
        <label>Code-barres<input id="mCode" inputmode="numeric" value="${esc(base.barcode || '')}"></label>
      </div>
      <div class="macro-grid">
        <label>kcal / 100 g<input id="mKcal" inputmode="decimal" value="${base.kcal ?? ''}"></label>
        <label>Protéines<input id="mProtein" inputmode="decimal" value="${base.protein ?? ''}"></label>
        <label>Glucides<input id="mCarbs" inputmode="decimal" value="${base.carbs ?? ''}"></label>
        <label>Lipides<input id="mFat" inputmode="decimal" value="${base.fat ?? ''}"></label>
      </div>
      <div class="product-actions">
        <button class="scan-btn secondary" id="cancelManual">Retour</button>
        <button class="scan-btn primary" id="useManual">Continuer</button>
      </div>
    </div>`)

  document.querySelector('#cancelManual').onclick = () => base.barcode ? showProduct(base) : closeSheet()
  document.querySelector('#useManual').onclick = () => {
    const value = (selector) => Number(String(document.querySelector(selector).value).replace(',', '.')) || 0
    showProduct({
      barcode: document.querySelector('#mCode').value.trim() || `manual-${Date.now()}`,
      name: document.querySelector('#mName').value.trim() || 'Produit',
      brand: base.brand || '',
      image: base.image || '',
      kcal: value('#mKcal'),
      protein: value('#mProtein'),
      carbs: value('#mCarbs'),
      fat: value('#mFat'),
      source: 'Saisie manuelle'
    })
  }
}

async function decodeWithZXing(video) {
  const module = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm')
  const reader = new module.BrowserMultiFormatReader()
  activeControls = await reader.decodeFromConstraints(
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    video,
    (result, error, controls) => {
      activeControls = controls
      if (result) {
        controls.stop()
        activeControls = null
        handleBarcode(result.getText())
      }
    }
  )
}

export async function openScanner() {
  sheet('Scanner un produit', `
    <div class="scanner-camera">
      <video id="scanVideo" playsinline muted></video>
      <div class="scanner-frame"></div><div class="scanner-line"></div>
    </div>
    <p class="scanner-status" id="scanStatus">Place le code-barres dans le cadre.</p>
    <div class="manual-box"><label>Ou saisir le code-barres<div class="manual-row"><input id="manualBarcode" inputmode="numeric" autocomplete="off" placeholder="Ex. 3017620422003"><button class="scan-btn secondary" id="manualSearch">Chercher</button></div></label></div>`)

  document.querySelector('#manualSearch').onclick = () => handleBarcode(document.querySelector('#manualBarcode').value)
  const video = document.querySelector('#scanVideo')

  try {
    if ('BarcodeDetector' in window) {
      activeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      video.srcObject = activeStream
      await video.play()
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
      let running = true
      const loop = async () => {
        if (!running || !document.body.contains(video)) return
        try {
          const hits = await detector.detect(video)
          if (hits[0]?.rawValue) {
            running = false
            stopScanner()
            handleBarcode(hits[0].rawValue)
            return
          }
        } catch {}
        requestAnimationFrame(loop)
      }
      loop()
    } else {
      await decodeWithZXing(video)
    }
  } catch {
    const status = document.querySelector('#scanStatus')
    if (status) status.textContent = 'Caméra indisponible ici. Utilise le code-barres manuel juste en dessous.'
  }
}

async function handleBarcode(code) {
  stopScanner()
  sheet('Recherche produit', '<div class="scanner-empty">Recherche des informations nutritionnelles…</div>')
  try {
    showProduct(await lookup(code))
  } catch (error) {
    sheet('Produit non trouvé', `
      <div class="scanner-error">${esc(error.message)}</div>
      <div style="margin-top:14px"><button class="scan-btn primary" id="manualCreate">Saisir le produit</button></div>`)
    document.querySelector('#manualCreate').onclick = () => openManualProduct({ barcode: String(code || '').replace(/\D/g, '') })
  }
}

export function openPantry() {
  const items = ensureState().pantry
  sheet('Mon stock', items.length ? `
    <div class="pantry-list">
      ${items.map((product, index) => `<article class="pantry-item">
        ${product.image ? `<img src="${esc(product.image)}" alt="">` : '<div></div>'}
        <div><h4>${esc(product.name)}</h4><p>${n(product.qty)} ${esc(product.unit || 'unité')} · ${n(product.kcal, 0)} kcal / 100 g</p></div>
        <button data-pantry="${index}">Utiliser</button>
      </article>`).join('')}
    </div>` : '<div class="scanner-empty">Ton stock est vide. Scanne tes courses pour le remplir.</div>')

  document.querySelectorAll('[data-pantry]').forEach((button) => {
    button.onclick = () => openConsume(Number(button.dataset.pantry))
  })
}

function openConsume(index) {
  const product = ensureState().pantry[index]
  if (!product) return

  sheet('Ajouter à aujourd’hui', `
    <div class="consume-box">
      <div class="product-hero">
        ${product.image ? `<img src="${esc(product.image)}" alt="">` : '<div></div>'}
        <div><h3>${esc(product.name)}</h3><p>${n(product.kcal, 0)} kcal · ${n(product.protein)} g prot. / 100 g</p></div>
      </div>
      <label>Quantité consommée (g/ml)<input id="consumeAmount" inputmode="decimal" value="100"></label>
      <div class="consume-summary" id="consumeSummary"></div>
      <button class="scan-btn primary" id="saveConsume">Ajouter à ma journée</button>
    </div>`)

  const input = document.querySelector('#consumeAmount')
  const summary = document.querySelector('#consumeSummary')
  const update = () => {
    const amount = Number(String(input.value).replace(',', '.')) || 0
    const factor = amount / 100
    summary.innerHTML = `<strong>${n(product.kcal * factor, 0)} kcal</strong> · ${n(product.protein * factor)} g protéines · ${n(product.carbs * factor)} g glucides · ${n(product.fat * factor)} g lipides`
  }
  input.oninput = update
  update()

  document.querySelector('#saveConsume').onclick = () => {
    const current = ensureState()
    const amount = Number(String(input.value).replace(',', '.')) || 0
    if (amount <= 0) return
    const factor = amount / 100
    current.foodLog[TODAY()] = Array.isArray(current.foodLog[TODAY()]) ? current.foodLog[TODAY()] : []
    current.foodLog[TODAY()].push({
      barcode: product.barcode,
      name: product.name,
      amount,
      kcal: product.kcal * factor,
      protein: product.protein * factor,
      carbs: product.carbs * factor,
      fat: product.fat * factor,
      at: new Date().toISOString()
    })
    persist()
    closeSheet()
  }
}

function renderNutritionEntry() {
  if (location.hash !== '#nutrition') return
  const slot = document.querySelector('#nutrition-tools-slot')
  if (!slot) return

  const current = ensureState()
  const totals = nutritionLogTotals(TODAY())
  slot.innerHTML = `<section class="scanner-entry">
    <div class="scanner-entry__top">
      <div><h3>Mes aliments</h3><p>Scanne tes courses, garde ton stock à jour et ajoute ce que tu manges sans recopier les macros.</p></div>
    </div>
    <div class="scanner-entry__actions">
      <button class="scan-btn primary" id="openScanner">Scanner un produit</button>
      <button class="scan-btn secondary" id="openPantry">Voir mon stock</button>
    </div>
    <div class="pantry-summary">
      <span>${current.pantry.length} produit${current.pantry.length > 1 ? 's' : ''} en stock</span>
      <strong>Aujourd’hui · ${Math.round(totals.kcal)} kcal · ${Math.round(totals.protein)} g prot.</strong>
    </div>
  </section>`

  document.querySelector('#openScanner').onclick = openScanner
  document.querySelector('#openPantry').onclick = openPantry
}

window.addEventListener('apex:rendered', renderNutritionEntry)
renderNutritionEntry()
