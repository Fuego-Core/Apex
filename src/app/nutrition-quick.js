import '../smart-actions.css'
import { TODAY, save, state } from './store.js'

function number(value) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char])
}

function uid(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function ensureFoodLog() {
  state.foodLog = state.foodLog && typeof state.foodLog === 'object' ? state.foodLog : {}
  state.foodLog[TODAY()] = Array.isArray(state.foodLog[TODAY()]) ? state.foodLog[TODAY()] : []
  return state.foodLog[TODAY()]
}

function recentFoods() {
  const all = Object.entries(state.foodLog || {}).flatMap(([date, rows]) =>
    (Array.isArray(rows) ? rows : []).map((row) => ({ ...row, date }))
  )
  all.sort((a, b) => String(b.at || b.date || '').localeCompare(String(a.at || a.date || '')))
  const seen = new Set()
  return all.filter((row) => {
    const key = row.barcode || row.pantryId || row.name
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 8)
}

function foodKey(row) {
  return String(row.barcode || row.pantryId || row.name)
}

function favorites() {
  const keys = new Set(state.foodFavorites || [])
  return recentFoods().filter((row) => keys.has(foodKey(row)))
}

function stockFor(row) {
  return (state.pantry || []).find((item) => item.id === row.pantryId || (row.barcode && item.barcode === row.barcode)) || null
}

function stockAmount(product) {
  if (!product) return null
  if (product.remainingBase !== null && product.remainingBase !== undefined && product.remainingBase !== '') return number(product.remainingBase)
  if (product.unit === 'g' || product.unit === 'ml') return number(product.qty)
  if (number(product.packageSize) > 0) return number(product.qty) * number(product.packageSize)
  return null
}

function addRecent(row) {
  const amount = number(row.amount) || 100
  const product = stockFor(row)
  const available = stockAmount(product)
  if (available !== null && available + 0.0001 < amount) return { ok: false, reason: 'Stock insuffisant' }

  if (product && available !== null) product.remainingBase = Math.max(0, available - amount)
  const per100 = row.per100 || (() => {
    const factor = amount / 100 || 1
    return {
      kcal: number(row.kcal) / factor,
      protein: number(row.protein) / factor,
      carbs: number(row.carbs) / factor,
      fat: number(row.fat) / factor
    }
  })()
  const factor = amount / 100
  ensureFoodLog().push({
    id: uid('food'),
    pantryId: product?.id || row.pantryId,
    barcode: row.barcode,
    name: row.name,
    mealName: row.mealName || 'Repas',
    amount,
    kcal: number(per100.kcal) * factor,
    protein: number(per100.protein) * factor,
    carbs: number(per100.carbs) * factor,
    fat: number(per100.fat) * factor,
    per100,
    stockTracked: !!product && available !== null,
    stockUnit: product?.baseUnit || product?.unit || row.stockUnit || 'g',
    at: new Date().toISOString()
  })
  save({ scope: 'nutrition' })
  return { ok: true }
}

function manualComposerMarkup() {
  return `
    <section class="meal-composer">
      <div class="meal-composer__head">
        <div><span>AJOUT DIRECT</span><strong>Ajouter ce que je mange</strong></div>
        <small>Le quota se met à jour immédiatement.</small>
      </div>
      <div class="meal-composer__meal">
        <label>Repas
          <select id="manualMealName">
            <option>Petit-déjeuner</option>
            <option selected>Déjeuner</option>
            <option>Dîner</option>
            <option>Collation</option>
          </select>
        </label>
        <label>Aliment
          <input id="manualFoodName" autocomplete="off" placeholder="Ex. œufs, riz, poulet…">
        </label>
      </div>
      <div class="meal-composer__amount">
        <label>Quantité mangée
          <div><input id="manualFoodAmount" inputmode="decimal" placeholder="Ex. 150"><span>g / ml</span></div>
        </label>
      </div>
      <div class="meal-composer__label"><span>Valeurs pour 100 g / ml</span><small>Recopie simplement l’étiquette</small></div>
      <div class="meal-composer__macros">
        <label>kcal<input id="manualFoodKcal" inputmode="decimal" placeholder="0"></label>
        <label>Protéines<input id="manualFoodProtein" inputmode="decimal" placeholder="0"></label>
        <label>Glucides<input id="manualFoodCarbs" inputmode="decimal" placeholder="0"></label>
        <label>Lipides<input id="manualFoodFat" inputmode="decimal" placeholder="0"></label>
      </div>
      <div class="meal-composer__preview" id="manualFoodPreview">Entre une quantité et les valeurs nutritionnelles.</div>
      <button class="meal-composer__save" id="manualFoodSave">Ajouter à ma journée</button>
      <p class="meal-composer__status" id="manualFoodStatus" hidden></p>
    </section>`
}

function bindManualComposer(target) {
  const amount = target.querySelector('#manualFoodAmount')
  const kcal = target.querySelector('#manualFoodKcal')
  const protein = target.querySelector('#manualFoodProtein')
  const carbs = target.querySelector('#manualFoodCarbs')
  const fat = target.querySelector('#manualFoodFat')
  const preview = target.querySelector('#manualFoodPreview')
  const status = target.querySelector('#manualFoodStatus')

  const updatePreview = () => {
    const factor = Math.max(0, number(amount?.value)) / 100
    if (!factor) {
      preview.textContent = 'Entre une quantité et les valeurs nutritionnelles.'
      return
    }
    preview.innerHTML = `<strong>${Math.round(number(kcal?.value) * factor)} kcal</strong><span>${(number(protein?.value) * factor).toFixed(1)} g prot.</span><span>${(number(carbs?.value) * factor).toFixed(1)} g gluc.</span><span>${(number(fat?.value) * factor).toFixed(1)} g lip.</span>`
  }

  ;[amount, kcal, protein, carbs, fat].forEach((field) => { if (field) field.oninput = updatePreview })

  target.querySelector('#manualFoodSave').onclick = () => {
    const name = target.querySelector('#manualFoodName').value.trim()
    const mealName = target.querySelector('#manualMealName').value
    const qty = Math.max(0, number(amount.value))
    const per100 = {
      kcal: Math.max(0, number(kcal.value)),
      protein: Math.max(0, number(protein.value)),
      carbs: Math.max(0, number(carbs.value)),
      fat: Math.max(0, number(fat.value))
    }

    if (!name || qty <= 0) {
      status.hidden = false
      status.textContent = 'Indique au minimum le nom de l’aliment et la quantité mangée.'
      return
    }

    const factor = qty / 100
    ensureFoodLog().push({
      id: uid('food'),
      name,
      mealName,
      amount: qty,
      kcal: per100.kcal * factor,
      protein: per100.protein * factor,
      carbs: per100.carbs * factor,
      fat: per100.fat * factor,
      per100,
      stockTracked: false,
      source: 'manual-meal',
      at: new Date().toISOString()
    })
    save({ scope: 'nutrition' })
  }
}

export function renderQuickFoods(target) {
  if (!target) return
  const recents = recentFoods()
  const favoriteRows = favorites()
  const shown = [...favoriteRows, ...recents.filter((row) => !favoriteRows.some((fav) => foodKey(fav) === foodKey(row)))].slice(0, 6)
  const favoriteKeys = new Set(state.foodFavorites || [])

  target.innerHTML = `${manualComposerMarkup()}
    ${shown.length ? `<section class="quick-foods">
      <div class="quick-foods__head"><strong>Ajouter à nouveau</strong><span>Récents & favoris</span></div>
      <div class="quick-foods__list">
        ${shown.map((row, index) => {
          const key = foodKey(row)
          const product = stockFor(row)
          const available = stockAmount(product)
          const amount = number(row.amount) || 100
          const insufficient = available !== null && available + 0.0001 < amount
          return `<article class="quick-food" data-quick-index="${index}">
            <button class="quick-food__fav ${favoriteKeys.has(key) ? 'active' : ''}" data-fav="${index}" aria-label="Favori">★</button>
            <div><strong>${esc(row.name)}</strong><small>${Math.round(number(row.kcal))} kcal · ${amount} g/ml</small></div>
            <button class="quick-food__add" data-add="${index}" ${insufficient ? 'disabled' : ''}>${insufficient ? 'Stock bas' : 'Ajouter'}</button>
          </article>`
        }).join('')}
      </div>
    </section>` : ''}`

  bindManualComposer(target)

  target.querySelectorAll('[data-fav]').forEach((button) => {
    button.onclick = () => {
      const row = shown[Number(button.dataset.fav)]
      const key = foodKey(row)
      state.foodFavorites = Array.isArray(state.foodFavorites) ? state.foodFavorites : []
      state.foodFavorites = state.foodFavorites.includes(key)
        ? state.foodFavorites.filter((item) => item !== key)
        : [...state.foodFavorites, key]
      save()
      renderQuickFoods(target)
    }
  })

  target.querySelectorAll('[data-add]').forEach((button) => {
    button.onclick = () => {
      const row = shown[Number(button.dataset.add)]
      const result = addRecent(row)
      button.textContent = result.ok ? 'Ajouté' : result.reason
    }
  })
}
