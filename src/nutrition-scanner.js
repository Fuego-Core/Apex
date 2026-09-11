import './nutrition-scanner.css'

import { nutritionTargets } from './app/config.js'
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
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char])
}

function number(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function n(value, digits = 1) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('fr-FR', { maximumFractionDigits: digits })
    : '—'
}

function uid(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

function stockBase(product) {
  if (product.remainingBase !== null && product.remainingBase !== undefined && product.remainingBase !== '') {
    const explicit = Number(product.remainingBase)
    if (Number.isFinite(explicit)) return { amount: explicit, unit: product.baseUnit || (product.unit === 'ml' ? 'ml' : 'g') }
  }
  if (product.unit === 'g' || product.unit === 'ml') return { amount: Number(product.qty) || 0, unit: product.unit }
  const packageSize = Number(product.packageSize)
  if (packageSize > 0) return { amount: (Number(product.qty) || 0) * packageSize, unit: product.baseUnit || 'g' }
  return null
}

function stockLabel(product) {
  const base = stockBase(product)
  if (base) return `${n(base.amount)} ${esc(base.unit)} restants`
  return `${n(product.qty)} ${esc(product.unit || 'unité')}`
}

function productMarkup(product) {
  return `<div class="product-result">
    <div class="product-hero">
      ${product.image ? `<img src="${esc(product.image)}" alt="">` : '<div class="product-placeholder">APEX</div>'}
      <div><h3>${esc(product.name)}</h3><p>${esc(product.brand || 'Marque non renseignée')}</p><p>${esc(product.barcode)}</p></div>
    </div>
    <div class="macro-grid scanner-macros">
      <div><span>kcal</span><strong>${n(product.kcal, 0)}</strong></div>
      <div><span>Protéines</span><strong>${n(product.protein)} g</strong></div>
      <div><span>Glucides</span><strong>${n(product.carbs)} g</strong></div>
      <div><span>Lipides</span><strong>${n(product.fat)} g</strong></div>
    </div>
    <div class="product-edit">
      <label>Quantité achetée<input id="qtyValue" inputmode="decimal" value="1"></label>
      <label>Unité<select id="qtyUnit"><option value="unité">unité</option><option value="g">g</option><option value="ml">ml</option><option value="pack">pack</option></select></label>
      <label class="package-size-field">Contenu par unité/pack<input id="packageSize" inputmode="decimal" placeholder="Ex. 500"></label>
      <label class="package-size-field">Mesuré en<select id="packageUnit"><option value="g">g</option><option value="ml">ml</option></select></label>
    </div>
    <p class="scanner-hint">Pour une bouteille ou un paquet, indique son poids/volume. APEX pourra alors retirer automatiquement ce que tu consommes du stock.</p>
    <div class="product-actions">
      <button class="scan-btn secondary" id="editMacros">Corriger les valeurs</button>
      <button class="scan-btn primary" id="saveProduct">Ajouter au stock</button>
    </div>
    <p class="scanner-status">Valeurs affichées pour 100 g/ml. Vérifie l’étiquette si le produit semble incorrect.</p>
  </div>`
}

function bindProduct(product) {
  document.querySelector('#saveProduct').onclick = () => {
    const current = ensureState()
    const qty = Math.max(0, number(document.querySelector('#qtyValue').value)) || 1
    const unit = document.querySelector('#qtyUnit').value
    const packageSize = Math.max(0, number(document.querySelector('#packageSize').value))
    const baseUnit = document.querySelector('#packageUnit').value
    const addedBase = unit === 'g' || unit === 'ml' ? qty : packageSize > 0 ? qty * packageSize : null
    const existing = current.pantry.find((item) => item.barcode === product.barcode)

    if (existing) {
      const previousBase = stockBase(existing)
      Object.assign(existing, product, { unit, packageSize: packageSize || existing.packageSize || null, baseUnit: unit === 'g' || unit === 'ml' ? unit : baseUnit })
      existing.qty = (Number(existing.qty) || 0) + qty
      if (addedBase !== null) existing.remainingBase = Math.max(0, Number(previousBase?.amount) || 0) + addedBase
    } else {
      current.pantry.push({
        ...product,
        id: uid('pantry'),
        qty,
        unit,
        packageSize: packageSize || null,
        baseUnit: unit === 'g' || unit === 'ml' ? unit : baseUnit,
        remainingBase: addedBase,
        addedAt: new Date().toISOString()
      })
    }
    persist()

    sheet('Produit ajouté', `
      <div class="scanner-empty scanner-success">
        <strong>${esc(product.name)}</strong><br>est maintenant dans ton stock.
        <div class="sheet-actions"><button class="scan-btn secondary" id="openStockAfter">Voir le stock</button><button class="scan-btn primary" id="scanAnother">Scanner le suivant</button></div>
      </div>`)
    document.querySelector('#scanAnother').onclick = openScanner
    document.querySelector('#openStockAfter').onclick = openPantry
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
      <div class="product-edit product-edit--single">
        <label>Nom<input id="mName" value="${esc(base.name || '')}"></label>
        <label>Code-barres<input id="mCode" inputmode="numeric" value="${esc(base.barcode || '')}"></label>
      </div>
      <div class="macro-grid scanner-macros scanner-macros--inputs">
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
  document.querySelector('#useManual').onclick = () => showProduct({
    barcode: document.querySelector('#mCode').value.trim() || `manual-${Date.now()}`,
    name: document.querySelector('#mName').value.trim() || 'Produit',
    brand: base.brand || '',
    image: base.image || '',
    kcal: number(document.querySelector('#mKcal').value),
    protein: number(document.querySelector('#mProtein').value),
    carbs: number(document.querySelector('#mCarbs').value),
    fat: number(document.querySelector('#mFat').value),
    source: 'Saisie manuelle'
  })
}

async function decodeWithZXing(video) {
  const module = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm')
  const reader = new module.BrowserMultiFormatReader()
  activeControls = await reader.decodeFromConstraints(
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    video,
    (result, _error, controls) => {
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
    <div class="manual-box"><label>Ou saisir le code-barres<div class="manual-row"><input id="manualBarcode" inputmode="numeric" autocomplete="off" placeholder="Ex. 3017620422003"><button class="scan-btn secondary" id="manualSearch">Chercher</button></div></label></div>
    <button class="scan-btn ghost scanner-manual-create" id="manualWithoutCode">Ajouter sans code-barres</button>`)

  document.querySelector('#manualSearch').onclick = () => handleBarcode(document.querySelector('#manualBarcode').value)
  document.querySelector('#manualWithoutCode').onclick = () => openManualProduct()
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
    if (status) status.textContent = 'Caméra indisponible ici. Utilise la saisie manuelle juste en dessous.'
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
      <div class="sheet-actions"><button class="scan-btn secondary" id="retryScan">Réessayer</button><button class="scan-btn primary" id="manualCreate">Saisir le produit</button></div>`)
    document.querySelector('#retryScan').onclick = openScanner
    document.querySelector('#manualCreate').onclick = () => openManualProduct({ barcode: String(code || '').replace(/\D/g, '') })
  }
}

function normalizeStockItem(product) {
  if (!product.id) product.id = uid('pantry')
  if (product.remainingBase === undefined) {
    const base = stockBase(product)
    if (base) {
      product.remainingBase = base.amount
      product.baseUnit = base.unit
    }
  }
  return product
}

export function openPantry() {
  const items = ensureState().pantry.map(normalizeStockItem)
  sheet('Mon stock', items.length ? `
    <div class="stock-head"><p>${items.length} produit${items.length > 1 ? 's' : ''}. Utilise “Gérer” pour corriger une quantité ou retirer un produit.</p></div>
    <div class="pantry-list">
      ${items.map((product, index) => `<article class="pantry-item">
        ${product.image ? `<img src="${esc(product.image)}" alt="">` : '<div class="product-placeholder">A</div>'}
        <div><h4>${esc(product.name)}</h4><p>${stockLabel(product)} · ${n(product.kcal, 0)} kcal / 100 g</p></div>
        <div class="pantry-item__actions"><button data-use="${index}">Utiliser</button><button data-manage="${index}">Gérer</button></div>
      </article>`).join('')}
    </div>` : '<div class="scanner-empty">Ton stock est vide. Scanne tes courses pour le remplir.</div>')

  document.querySelectorAll('[data-use]').forEach((button) => {
    button.onclick = () => openConsume(Number(button.dataset.use))
  })
  document.querySelectorAll('[data-manage]').forEach((button) => {
    button.onclick = () => openManageStock(Number(button.dataset.manage))
  })
}

function openManageStock(index) {
  const product = ensureState().pantry[index]
  if (!product) return
  const base = stockBase(product)

  sheet('Gérer le stock', `
    <div class="consume-box">
      <div class="product-hero">
        ${product.image ? `<img src="${esc(product.image)}" alt="">` : '<div class="product-placeholder">A</div>'}
        <div><h3>${esc(product.name)}</h3><p>${stockLabel(product)}</p></div>
      </div>
      <div class="product-edit">
        <label>Stock restant<input id="stockQty" inputmode="decimal" value="${esc(base ? base.amount : product.qty || 0)}"></label>
        <label>Unité<select id="stockUnit"><option value="g" ${base?.unit === 'g' ? 'selected' : ''}>g</option><option value="ml" ${base?.unit === 'ml' ? 'selected' : ''}>ml</option><option value="unité" ${!base && product.unit === 'unité' ? 'selected' : ''}>unité</option><option value="pack" ${!base && product.unit === 'pack' ? 'selected' : ''}>pack</option></select></label>
      </div>
      <div class="product-actions">
        <button class="scan-btn danger" id="deleteStock">Supprimer</button>
        <button class="scan-btn primary" id="saveStock">Enregistrer</button>
      </div>
    </div>`)

  document.querySelector('#saveStock').onclick = () => {
    const qty = Math.max(0, number(document.querySelector('#stockQty').value))
    const unit = document.querySelector('#stockUnit').value
    if (unit === 'g' || unit === 'ml') {
      product.remainingBase = qty
      product.baseUnit = unit
      product.qty = qty
      product.unit = unit
    } else {
      product.remainingBase = null
      product.baseUnit = null
      product.qty = qty
      product.unit = unit
      product.packageSize = null
    }
    persist()
    openPantry()
  }

  document.querySelector('#deleteStock').onclick = () => {
    state.pantry.splice(index, 1)
    persist()
    openPantry()
  }
}

function rowPer100(row) {
  if (row.per100) return row.per100
  const factor = (Number(row.amount) || 0) / 100
  if (!factor) return { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  return {
    kcal: (Number(row.kcal) || 0) / factor,
    protein: (Number(row.protein) || 0) / factor,
    carbs: (Number(row.carbs) || 0) / factor,
    fat: (Number(row.fat) || 0) / factor
  }
}

function macros(per100, amount) {
  const factor = amount / 100
  return {
    kcal: (Number(per100.kcal) || 0) * factor,
    protein: (Number(per100.protein) || 0) * factor,
    carbs: (Number(per100.carbs) || 0) * factor,
    fat: (Number(per100.fat) || 0) * factor
  }
}

function pantryForRow(row) {
  return ensureState().pantry.find((item) => item.barcode === row.barcode || (row.pantryId && item.id === row.pantryId))
}

function restoreStock(row) {
  if (!row.stockTracked) return
  const product = pantryForRow(row)
  if (!product) return
  const base = stockBase(product)
  if (!base || base.unit !== row.stockUnit) return
  product.remainingBase = Math.max(0, base.amount + (Number(row.amount) || 0))
}

function consumeStock(product, amount) {
  const base = stockBase(product)
  if (!base) return { tracked: false, unit: null }
  if (amount > base.amount + 0.0001) return { tracked: true, unit: base.unit, insufficient: true, available: base.amount }
  product.remainingBase = Math.max(0, base.amount - amount)
  return { tracked: true, unit: base.unit }
}

function openConsume(index) {
  const product = ensureState().pantry[index]
  if (!product) return
  normalizeStockItem(product)
  const base = stockBase(product)

  sheet('Ajouter à aujourd’hui', `
    <div class="consume-box">
      <div class="product-hero">
        ${product.image ? `<img src="${esc(product.image)}" alt="">` : '<div class="product-placeholder">A</div>'}
        <div><h3>${esc(product.name)}</h3><p>${n(product.kcal, 0)} kcal · ${n(product.protein)} g prot. / 100 g</p>${base ? `<p class="stock-available">Stock : ${n(base.amount)} ${esc(base.unit)}</p>` : '<p class="stock-available">Stock non mesuré en g/ml</p>'}</div>
      </div>
      <label>Quantité consommée (g/ml)<input id="consumeAmount" inputmode="decimal" value="100"></label>
      <div class="consume-summary" id="consumeSummary"></div>
      <p class="scanner-error consume-error" id="consumeError" hidden></p>
      <button class="scan-btn primary" id="saveConsume">Ajouter à ma journée</button>
    </div>`)

  const input = document.querySelector('#consumeAmount')
  const summary = document.querySelector('#consumeSummary')
  const error = document.querySelector('#consumeError')
  const update = () => {
    const amount = Math.max(0, number(input.value))
    const calculated = macros(product, amount)
    const over = base && amount > base.amount
    summary.innerHTML = `<strong>${n(calculated.kcal, 0)} kcal</strong> · ${n(calculated.protein)} g protéines · ${n(calculated.carbs)} g glucides · ${n(calculated.fat)} g lipides`
    error.hidden = !over
    error.textContent = over ? `Il reste seulement ${n(base.amount)} ${base.unit} en stock.` : ''
  }
  input.oninput = update
  update()

  document.querySelector('#saveConsume').onclick = () => {
    const current = ensureState()
    const amount = Math.max(0, number(input.value))
    if (amount <= 0) return
    const stock = consumeStock(product, amount)
    if (stock.insufficient) {
      error.hidden = false
      error.textContent = `Il reste seulement ${n(stock.available)} ${stock.unit} en stock.`
      return
    }

    const per100 = { kcal: product.kcal, protein: product.protein, carbs: product.carbs, fat: product.fat }
    const calculated = macros(per100, amount)
    current.foodLog[TODAY()] = Array.isArray(current.foodLog[TODAY()]) ? current.foodLog[TODAY()] : []
    current.foodLog[TODAY()].push({
      id: uid('food'),
      pantryId: product.id,
      barcode: product.barcode,
      name: product.name,
      amount,
      ...calculated,
      per100,
      stockTracked: stock.tracked,
      stockUnit: stock.unit,
      at: new Date().toISOString()
    })
    persist()
    closeSheet()
  }
}

function openEditFood(index) {
  const rows = ensureState().foodLog[TODAY()] || []
  const row = rows[index]
  if (!row) return
  const per100 = rowPer100(row)

  sheet('Modifier l’aliment', `
    <div class="consume-box">
      <div><h3 class="sheet-product-title">${esc(row.name)}</h3><p class="scanner-status scanner-status--left">Les macros sont recalculées à partir des valeurs enregistrées au moment de l’ajout.</p></div>
      <label>Quantité consommée (g/ml)<input id="editFoodAmount" inputmode="decimal" value="${esc(row.amount)}"></label>
      <div class="consume-summary" id="editFoodSummary"></div>
      <div class="product-actions">
        <button class="scan-btn danger" id="deleteFood">Supprimer</button>
        <button class="scan-btn primary" id="saveFoodEdit">Enregistrer</button>
      </div>
    </div>`)

  const input = document.querySelector('#editFoodAmount')
  const summary = document.querySelector('#editFoodSummary')
  const update = () => {
    const amount = Math.max(0, number(input.value))
    const calculated = macros(per100, amount)
    summary.innerHTML = `<strong>${n(calculated.kcal, 0)} kcal</strong> · ${n(calculated.protein)} g prot. · ${n(calculated.carbs)} g gluc. · ${n(calculated.fat)} g lip.`
  }
  input.oninput = update
  update()

  document.querySelector('#saveFoodEdit').onclick = () => {
    const amount = Math.max(0, number(input.value))
    if (amount <= 0) return
    const product = pantryForRow(row)
    if (row.stockTracked && product) {
      const base = stockBase(product)
      const difference = amount - (Number(row.amount) || 0)
      if (difference > 0 && base && difference > base.amount) return
      if (base) product.remainingBase = Math.max(0, base.amount - difference)
    }
    Object.assign(row, macros(per100, amount), { amount, per100, at: new Date().toISOString() })
    persist()
    closeSheet()
  }

  document.querySelector('#deleteFood').onclick = () => {
    restoreStock(row)
    rows.splice(index, 1)
    persist()
    closeSheet()
  }
}

function targetPercent(value, target) {
  if (!target) return 0
  return Math.max(0, Math.min(100, Math.round((Number(value) || 0) / target * 100)))
}

function renderNutritionEntry() {
  if ((location.hash || '#home') !== '#nutrition') return
  const slot = document.querySelector('#nutrition-tools-slot')
  if (!slot) return

  const current = ensureState()
  const totals = nutritionLogTotals(TODAY())
  const rows = Array.isArray(current.foodLog[TODAY()]) ? current.foodLog[TODAY()] : []
  const progress = [
    ['Calories', totals.kcal, nutritionTargets.kcal, 'kcal'],
    ['Protéines', totals.protein, nutritionTargets.protein, 'g'],
    ['Glucides', totals.carbs, nutritionTargets.carbs, 'g'],
    ['Lipides', totals.fat, nutritionTargets.fat, 'g']
  ]

  slot.innerHTML = `<section class="scanner-entry nutrition-command">
    <div class="scanner-entry__top">
      <div><span class="command-kicker">SUIVI AUTOMATIQUE</span><h3>Mes aliments</h3><p>Scanne tes courses, garde ton stock à jour puis ajoute ce que tu manges. APEX calcule la journée automatiquement.</p></div>
    </div>
    <div class="scanner-entry__actions">
      <button class="scan-btn primary" id="openScanner">Scanner un produit</button>
      <button class="scan-btn secondary" id="openPantry">Mon stock · ${current.pantry.length}</button>
    </div>
    <div class="nutrition-progress-grid">
      ${progress.map(([label, value, target, unit]) => `<div class="nutrition-progress"><div><span>${label}</span><strong>${n(value, 0)} / ${n(target, 0)} ${unit}</strong></div><i><b style="width:${targetPercent(value, target)}%"></b></i></div>`).join('')}
    </div>
    <div class="food-journal-head"><div><strong>Journal du jour</strong><span>${rows.length} entrée${rows.length > 1 ? 's' : ''}</span></div>${rows.length ? '<small>Touche un aliment pour le corriger</small>' : ''}</div>
    <div class="food-journal">
      ${rows.length ? rows.map((row, index) => `<button class="food-row" data-food="${index}"><span><strong>${esc(row.name)}</strong><small>${n(row.amount)} g/ml · ${n(row.protein)} g prot.</small></span><b>${n(row.kcal, 0)} kcal</b></button>`).join('') : '<div class="food-journal-empty">Aucun aliment enregistré aujourd’hui.</div>'}
    </div>
  </section>`

  document.querySelector('#openScanner').onclick = openScanner
  document.querySelector('#openPantry').onclick = openPantry
  document.querySelectorAll('[data-food]').forEach((button) => {
    button.onclick = () => openEditFood(Number(button.dataset.food))
  })
}

window.addEventListener('apex:rendered', renderNutritionEntry)
renderNutritionEntry()
