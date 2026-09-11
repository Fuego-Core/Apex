import './smart-actions.css'

import { sessions } from './app/config.js'
import { recoveryAssessment } from './app/coach-engine.js'
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

function injectDailyCoach() {
  if ((location.hash || '#home') !== '#home') return
  const todayCard = document.querySelector('.today-card')
  if (!todayCard || document.querySelector('.smart-coach')) return

  const decision = recoveryAssessment()
  const meta = [
    decision.sleep !== null ? `${decision.sleep.toFixed(1).replace('.', ',')} h sommeil moy.` : null,
    decision.feeling !== null ? `${decision.feeling.toFixed(1).replace('.', ',')}/10 sensations` : null
  ].filter(Boolean).join(' · ')

  todayCard.insertAdjacentHTML('afterend', `
    <section class="smart-coach smart-coach--${decision.level}">
      <div class="smart-coach__head"><span>COACH APEX</span><strong>${esc(decision.title)}</strong></div>
      <p>${esc(decision.message)}</p>
      ${meta ? `<small>${esc(meta)}</small>` : '<small>Complète ton check-in pour affiner la recommandation.</small>'}
      ${decision.notes.length ? `<div class="smart-coach__notes">${decision.notes.map((note) => `<span>${esc(note)}</span>`).join('')}</div>` : ''}
    </section>`)
}

function previousSession(sessionId) {
  return [...(state.history || [])]
    .filter((entry) => entry.sessionId === sessionId)
    .sort((a, b) => String(b.updatedAt || b.date || '').localeCompare(String(a.updatedAt || a.date || '')))[0] || null
}

function bestPreviousSet(entry, exerciseIndex) {
  const sets = entry?.exercises?.[exerciseIndex]?.sets || []
  return sets
    .filter((row) => number(row.weight) > 0 || number(row.reps) > 0)
    .sort((a, b) => (number(b.weight) * 100 + number(b.reps)) - (number(a.weight) * 100 + number(a.reps)))[0] || null
}

function enhanceWorkout() {
  const route = (location.hash || '').slice(1)
  if (!route.startsWith('workout/')) return
  const sessionId = route.split('/')[1]
  const session = sessions.find((item) => item.id === sessionId)
  const previous = previousSession(sessionId)
  if (!session || !previous) return

  queueMicrotask(() => {
    document.querySelectorAll('.exercise-card').forEach((card, exerciseIndex) => {
      if (card.querySelector('.previous-performance')) return
      const priorSets = previous.exercises?.[exerciseIndex]?.sets || []
      const best = bestPreviousSet(previous, exerciseIndex)
      if (!best) return

      const header = card.querySelector('.exercise-top')
      header?.insertAdjacentHTML('afterend', `
        <div class="previous-performance">
          <span>DERNIÈRE FOIS</span>
          <strong>${number(best.weight) ? `${esc(best.weight)} kg` : '—'} × ${number(best.reps) || '—'}</strong>
          <small>Aujourd’hui : +1 rep à charge égale, ou petite hausse de charge si le haut de fourchette et le RIR sont respectés.</small>
        </div>`)

      priorSets.forEach((prior, setIndex) => {
        ;['weight', 'reps'].forEach((field) => {
          const input = card.querySelector(`[data-field="${field}"][data-pos="${exerciseIndex}:${setIndex}"]`)
          if (!input || input.value !== '' || prior[field] === undefined || prior[field] === '') return
          input.value = prior[field]
          input.dispatchEvent(new Event('input', { bubbles: true }))
        })
      })
    })
  })
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
  const recents = recentFoods()
  return recents.filter((row) => keys.has(foodKey(row)))
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
      document.querySelector('.quick-foods')?.remove()
      renderQuickFoods()
    }
  })

  document.querySelectorAll('[data-add]').forEach((button) => {
    button.onclick = () => {
      const row = shown[Number(button.dataset.add)]
      const result = addRecent(row)
      if (!result.ok) {
        button.textContent = result.reason
        return
      }
      button.textContent = 'Ajouté ✓'
    }
  })
}

function runSmartLayer() {
  injectDailyCoach()
  enhanceWorkout()
  renderQuickFoods()
}

window.addEventListener('apex:rendered', runSmartLayer)
runSmartLayer()
