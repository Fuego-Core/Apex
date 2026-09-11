import './smart-actions.css'

import { TODAY, save, state } from './app/store.js'

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
  state.foodLog[TODAY()] = Array.isArray(state.foodLog?.[TODAY()]) ? state.foodLog[TODAY()] : []
  state.foodLog[TODAY()].push({
    id: uid('food'),
    pantryId: product?.id || row.pantryId,
    barcode: row.barcode,
    name: row.name,
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

function renderQuickFoods() {
  if ((location.hash || '#home') !== '#nutrition') return
  const command = document.querySelector('.nutrition-command')
  if (!command || command.querySelector('.quick-foods')) return

  const recents = recentFoods()
  if (!recents.length) return
  const favoriteRows = favorites()
  const shown = [...favoriteRows, ...recents.filter((row) => !favoriteRows.some((fav) => foodKey(fav) === foodKey(row)))].slice(0, 6)
  const favoriteKeys = new Set(state.foodFavorites || [])

  command.insertAdjacentHTML('beforeend', `
    <div class="quick-foods">
      <div class="quick-foods__head"><strong>Ajout rapide</strong><span>Récents & favoris</span></div>
      <div class="quick-foods__list">
        ${shown.map((row, index) => {
          const key = foodKey(row)
          const product = stockFor(row)
          const available = stockAmount(product)
          const insufficient = available !== null && available + 0.0001 < (number(row.amount) || 100)
          return `<article class="quick-food" data-quick-index="${index}">
            <button class="quick-food__fav ${favoriteKeys.has(key) ? 'active' : ''}" data-fav="${index}" aria-label="Favori">★</button>
            <div><strong>${esc(row.name)}</strong><small>${Math.round(number(row.kcal))} kcal · ${number(row.amount) || 100} g/ml</small></div>
            <button class="quick-food__add" data-add="${index}" ${insufficient ? 'disabled' : ''}>${insufficient ? 'Stock bas' : 'Ajouter'}</button>
          </article>`
        }).join('')}
      </div>
    </div>`)

  document.querySelectorAll('[data-fav]').forEach((button) => {
    button.onclick = () => {
      const row = shown[Number(button.dataset.fav)]
      const key = foodKey(row)
      state.foodFavorites = state.foodFavorites.includes(key)
        ? state.foodFavorites.filter((item) => item !== key)
        : [...state.foodFavorites, key]
      save()
      command.querySelector('.quick-foods')?.remove()
      renderQuickFoods()
    }
  })

  document.querySelectorAll('[data-add]').forEach((button) => {
    button.onclick = () => {
      const row = shown[Number(button.dataset.add)]
      const result = addRecent(row)
      button.textContent = result.ok ? 'Ajouté ✓' : result.reason
    }
  })
}

window.addEventListener('apex:rendered', () => queueMicrotask(renderQuickFoods))
window.addEventListener('apex:state-changed', (event) => {
  if (event.detail?.scope === 'nutrition') queueMicrotask(renderQuickFoods)
})
