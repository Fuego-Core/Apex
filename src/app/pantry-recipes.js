import { TODAY, save, state } from './store.js'
import { nutritionTargets } from './config.js'
import './pantry-recipes.css'

const RECIPES = [
  {
    id: 'chicken-rice',
    name: 'Bowl poulet riz',
    emoji: '🍚',
    time: '15 min',
    ingredients: [
      { role: 'protein', qty: 180, aliases: ['poulet', 'chicken', 'blanc de poulet', 'escalope de poulet'] },
      { role: 'carb', qty: 180, aliases: ['riz', 'rice'] },
      { role: 'veg', qty: 150, aliases: ['brocoli', 'broccoli', 'haricot', 'courgette', 'legume', 'légume'], optional: true }
    ]
  },
  {
    id: 'tuna-pasta',
    name: 'Pâtes au thon',
    emoji: '🍝',
    time: '12 min',
    ingredients: [
      { role: 'protein', qty: 140, aliases: ['thon', 'tuna'] },
      { role: 'carb', qty: 200, aliases: ['pate', 'pâtes', 'pasta', 'spaghetti', 'penne'] },
      { role: 'sauce', qty: 100, aliases: ['tomate', 'tomato', 'sauce tomate', 'passata'], optional: true }
    ]
  },
  {
    id: 'eggs-toast',
    name: 'Œufs & tartines protéinées',
    emoji: '🍳',
    time: '10 min',
    ingredients: [
      { role: 'protein', qty: 150, aliases: ['oeuf', 'œuf', 'egg'] },
      { role: 'carb', qty: 100, aliases: ['pain', 'bread', 'toast'] },
      { role: 'extra', qty: 100, aliases: ['skyr', 'fromage blanc', 'yaourt grec', 'greek yogurt'], optional: true }
    ]
  },
  {
    id: 'skyr-bowl',
    name: 'Bowl skyr avoine',
    emoji: '🥣',
    time: '3 min',
    ingredients: [
      { role: 'protein', qty: 250, aliases: ['skyr', 'fromage blanc', 'yaourt grec', 'greek yogurt'] },
      { role: 'carb', qty: 60, aliases: ['avoine', 'oat', 'flocon'] },
      { role: 'fruit', qty: 120, aliases: ['banane', 'banana', 'fraise', 'strawberry', 'myrtille', 'blueberry', 'fruit'], optional: true }
    ]
  },
  {
    id: 'beef-potato',
    name: 'Bœuf pommes de terre',
    emoji: '🥔',
    time: '20 min',
    ingredients: [
      { role: 'protein', qty: 170, aliases: ['boeuf', 'bœuf', 'beef', 'steak', 'haché', 'hache'] },
      { role: 'carb', qty: 280, aliases: ['pomme de terre', 'potato', 'grenaille'] },
      { role: 'veg', qty: 150, aliases: ['brocoli', 'broccoli', 'haricot', 'courgette', 'legume', 'légume'], optional: true }
    ]
  },
  {
    id: 'wrap-chicken',
    name: 'Wrap poulet',
    emoji: '🌯',
    time: '10 min',
    ingredients: [
      { role: 'protein', qty: 160, aliases: ['poulet', 'chicken'] },
      { role: 'carb', qty: 120, aliases: ['wrap', 'tortilla'] },
      { role: 'veg', qty: 100, aliases: ['salade', 'lettuce', 'tomate', 'tomato', 'crudité', 'crudite'], optional: true }
    ]
  }
]

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char])
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalize(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function stockBase(product) {
  if (product.remainingBase !== null && product.remainingBase !== undefined && product.remainingBase !== '') {
    const amount = Number(product.remainingBase)
    if (Number.isFinite(amount)) return { amount, unit: product.baseUnit || (product.unit === 'ml' ? 'ml' : 'g') }
  }
  if (product.unit === 'g' || product.unit === 'ml') return { amount: number(product.qty), unit: product.unit }
  const packageSize = number(product.packageSize)
  if (packageSize > 0) return { amount: number(product.qty) * packageSize, unit: product.baseUnit || 'g' }
  return null
}

function matches(product, aliases) {
  const haystack = normalize(`${product.name || ''} ${product.brand || ''}`)
  return aliases.some((alias) => haystack.includes(normalize(alias)))
}

function findProduct(ingredient, pantry) {
  return pantry.find((product) => {
    const base = stockBase(product)
    return base && base.amount > 0 && matches(product, ingredient.aliases)
  }) || null
}

function macroFor(product, qty) {
  const factor = qty / 100
  return {
    kcal: number(product.kcal) * factor,
    protein: number(product.protein) * factor,
    carbs: number(product.carbs) * factor,
    fat: number(product.fat) * factor
  }
}

export function stockRecipeSuggestions(pantry = []) {
  return RECIPES.map((recipe) => {
    const matched = recipe.ingredients.map((ingredient) => ({ ...ingredient, product: findProduct(ingredient, pantry) }))
    const missingRequired = matched.filter((item) => !item.optional && !item.product)
    if (missingRequired.length) return null

    const required = matched.filter((item) => item.product)
    const scale = Math.min(1, ...required.map((item) => {
      const base = stockBase(item.product)
      return base ? base.amount / item.qty : 0
    }))
    if (!Number.isFinite(scale) || scale < 0.5) return null

    const items = required.map((item) => ({
      ...item,
      qty: Math.max(1, Math.round(item.qty * scale))
    }))
    const macros = items.reduce((sum, item) => {
      const value = macroFor(item.product, item.qty)
      sum.kcal += value.kcal
      sum.protein += value.protein
      sum.carbs += value.carbs
      sum.fat += value.fat
      return sum
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })

    return { ...recipe, items, macros, scale }
  }).filter(Boolean).sort((a, b) => b.macros.protein - a.macros.protein)
}

function fallbackSuggestion(pantry = []) {
  const measurable = pantry.filter((p) => stockBase(p)?.amount > 0)
  if (!measurable.length) return null
  const protein = [...measurable].sort((a, b) => number(b.protein) - number(a.protein))[0]
  const carb = [...measurable].filter((p) => p.id !== protein?.id).sort((a, b) => number(b.carbs) - number(a.carbs))[0]
  if (!protein || number(protein.protein) < 8) return null
  const specs = [{ product: protein, role: 'protein', qty: Math.min(200, Math.floor(stockBase(protein).amount)) }]
  if (carb && number(carb.carbs) >= 10) specs.push({ product: carb, role: 'carb', qty: Math.min(180, Math.floor(stockBase(carb).amount)) })
  const items = specs.filter((x) => x.qty >= 40)
  if (!items.length) return null
  const macros = items.reduce((sum, item) => {
    const value = macroFor(item.product, item.qty)
    Object.keys(sum).forEach((key) => { sum[key] += value[key] })
    return sum
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  return { id: 'smart-bowl', name: 'Assiette rapide avec ton stock', emoji: '✨', time: 'Rapide', items, macros, scale: 1 }
}

function addMealToLog(recipe) {
  const date = TODAY()
  state.foodLog = state.foodLog && typeof state.foodLog === 'object' ? state.foodLog : {}
  state.foodLog[date] = Array.isArray(state.foodLog[date]) ? state.foodLog[date] : []
  const at = new Date().toISOString()

  for (const item of recipe.items) {
    const product = item.product
    const base = stockBase(product)
    if (!base || base.amount < item.qty) throw new Error(`Stock insuffisant pour ${product.name}.`)
  }

  for (const item of recipe.items) {
    const product = item.product
    const values = macroFor(product, item.qty)
    product.remainingBase = Math.max(0, stockBase(product).amount - item.qty)
    product.baseUnit = stockBase(product).unit
    state.foodLog[date].push({
      id: `food-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pantryId: product.id,
      barcode: product.barcode,
      name: product.name,
      amount: item.qty,
      unit: product.baseUnit || 'g',
      kcal: values.kcal,
      protein: values.protein,
      carbs: values.carbs,
      fat: values.fat,
      per100: { kcal: number(product.kcal), protein: number(product.protein), carbs: number(product.carbs), fat: number(product.fat) },
      stockTracked: true,
      mealName: recipe.name,
      source: 'stock-recipe',
      at
    })
  }

  save({ scope: 'nutrition' })
}

function format(value, digits = 0) {
  return Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: digits })
}

function renderCard(recipe, index) {
  return `<article class="stock-recipe-card">
    <header><span class="stock-recipe-emoji">${recipe.emoji}</span><div><h3>${esc(recipe.name)}</h3><p>${esc(recipe.time)} · ${format(recipe.macros.kcal)} kcal · ${format(recipe.macros.protein)} g prot.</p></div></header>
    <div class="stock-recipe-items">${recipe.items.map((item) => `<div><span>${esc(item.product.name)}</span><strong>${format(item.qty)} ${esc(stockBase(item.product)?.unit || 'g')}</strong></div>`).join('')}</div>
    ${recipe.scale < 0.99 ? '<p class="stock-recipe-note">Portion adaptée automatiquement au stock disponible.</p>' : ''}
    <button class="btn btn-primary btn-block" data-eat-stock-recipe="${index}">Je mange ce plat</button>
  </article>`
}

export function renderStockRecipes(target) {
  if (!target) return
  const pantry = Array.isArray(state.pantry) ? state.pantry : []
  let suggestions = stockRecipeSuggestions(pantry)
  if (!suggestions.length) {
    const fallback = fallbackSuggestion(pantry)
    if (fallback) suggestions = [fallback]
  }

  target.innerHTML = `<section class="stock-kitchen">
    <div class="stock-kitchen-head">
      <div><p class="kicker">CUISINER AVEC MON STOCK</p><h2>Des idées avec ce que tu as déjà</h2><p>APEX calcule les quantités avec ton stock actuel. Quand tu valides un plat, les aliments sont ajoutés au journal et retirés du stock automatiquement.</p></div>
      <div class="stock-kitchen-target"><strong>${nutritionTargets.protein} g</strong><span>protéines / jour</span></div>
    </div>
    ${suggestions.length
      ? `<div class="stock-recipe-grid">${suggestions.slice(0, 4).map(renderCard).join('')}</div>`
      : `<div class="stock-kitchen-empty"><strong>Pas encore assez d’ingrédients mesurables.</strong><p>Scanne tes courses et renseigne le poids/volume des paquets. APEX pourra ensuite construire des plats fiables avec les quantités disponibles.</p></div>`}
  </section>`

  target.querySelectorAll('[data-eat-stock-recipe]').forEach((button) => {
    button.addEventListener('click', () => {
      const recipe = suggestions[Number(button.dataset.eatStockRecipe)]
      if (!recipe) return
      try {
        addMealToLog(recipe)
        renderStockRecipes(target)
        target.insertAdjacentHTML('afterbegin', '<div class="stock-meal-success">✓ Repas ajouté au journal et stock mis à jour.</div>')
      } catch (error) {
        target.insertAdjacentHTML('afterbegin', `<div class="stock-meal-error">${esc(error.message)}</div>`)
      }
    })
  })
}
