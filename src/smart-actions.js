import './smart-actions.css'

import { nutritionTargets, sessions } from './app/config.js'
import { TODAY, nutritionDay, save, state } from './app/store.js'

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

function latestCheckins(limit = 3) {
  return [...(state.checkins || [])]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, limit)
}

function painIsMeaningful(value) {
  const clean = String(value || '').trim().toLowerCase()
  return !!clean && !['aucune', 'aucun', 'non', 'rien', 'ras'].includes(clean)
}

function average(rows, key) {
  const values = rows.map((row) => number(row[key])).filter((value) => value > 0)
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function bodyTrend(key) {
  const rows = (state.body || [])
    .filter((row) => Number.isFinite(Number(row[key])))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
  if (rows.length < 2) return null
  const previous = Number(rows.at(-2)[key])
  const current = Number(rows.at(-1)[key])
  return current - previous
}

function coachDecision() {
  const today = TODAY()
  const recent = latestCheckins(3)
  const last = recent[0] || null
  const sleep = average(recent, 'sleep')
  const feeling = average(recent, 'feeling')
  const pain = painIsMeaningful(last?.pain)
  const nutrition = nutritionDay(today)
  const kcal = number(nutrition.kcal)
  const protein = number(nutrition.protein)
  const navelDelta = bodyTrend('navel')

  let level = 'good'
  let title = 'Feu vert'
  let message = 'Récupération correcte : suis la séance prévue et respecte le RIR cible.'

  if (pain || (sleep !== null && sleep < 5.5) || (feeling !== null && feeling < 5)) {
    level = 'alert'
    title = 'Journée prudente'
    message = pain
      ? 'Une gêne a été signalée : évite de forcer sur la zone concernée et garde une marge supplémentaire aujourd’hui.'
      : 'Récupération basse : baisse l’ambition du jour, garde 1 à 2 RIR de plus et privilégie une exécution propre.'
  } else if ((sleep !== null && sleep < 6.5) || (feeling !== null && feeling < 6.5)) {
    level = 'watch'
    title = 'À surveiller'
    message = 'Récupération moyenne : séance normale possible, mais ne cherche pas un record si les premières séries sont lourdes.'
  }

  const notes = []
  if (nutrition.source !== 'empty') {
    if (protein < nutritionTargets.protein * 0.75) notes.push(`Protéines encore basses aujourd’hui (${Math.round(protein)} g).`)
    if (kcal > nutritionTargets.kcal * 1.15) notes.push('Calories déjà nettement au-dessus de la cible du jour.')
  }
  if (navelDelta !== null && navelDelta < -0.2) notes.push('Le nombril baisse : inutile de réduire davantage les calories pour l’instant.')
  if (navelDelta !== null && navelDelta > 0.8) notes.push('Le nombril a monté sur le dernier relevé : observe la tendance avant de modifier le plan.')

  return { level, title, message, notes, sleep, feeling }
}

function injectDailyCoach() {
  if ((location.hash || '#home') !== '#home') return
  const todayCard = document.querySelector('.today-card')
  if (!todayCard || document.querySelector('.smart-coach')) return

  const decision = coachDecision()
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
  state.foodFavorites = Array.isArray(state.foodFavorites) ? state.foodFavorites : []
  const keys = new Set(state.foodFavorites)
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
      state.foodFavorites = Array.isArray(state.foodFavorites) ? state.foodFavorites : []
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
