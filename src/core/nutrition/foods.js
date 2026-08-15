/* ALIMENTS — identité, recherche, et la mémoire de ce que tu manges vraiment.

   L'idée directrice de la Phase 2 : tu renseignes une chose une fois, APEX s'en
   souvient. Cette mémoire vit dans `usage`, et elle est VOLONTAIREMENT
   autosuffisante : chaque entrée garde un instantané des valeurs de l'aliment.

   Conséquence recherchée : les récents et les favoris s'affichent et se
   ré-ajoutent même si le cache externe a été vidé, même hors ligne, même pour
   un produit scanné il y a six mois. Le cache n'est jamais nécessaire pour
   comprendre — ni pour refaire — ce qu'on a déjà fait. */

import { nameKey, slug } from '../catalog.js'

export const SOURCES = ['open-food-facts', 'user-created', 'imported']

const num = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Id stable et parlant : le préfixe EST la provenance, elle ne peut pas se perdre. */
export function foodId(source, key) {
  if (source === 'open-food-facts') return `off:${key}`
  if (source === 'imported') return `imported:${key}`
  return `user:${key}`
}

export function sourceOf(id) {
  if (typeof id !== 'string') return null
  if (id.startsWith('off:')) return 'open-food-facts'
  if (id.startsWith('imported:')) return 'imported'
  if (id.startsWith('user:')) return 'user-created'
  return null
}

/** Découpe commune : minuscules, sans accents, sans doublons. */
function split(parts, minLength) {
  const words = parts
    .filter(Boolean)
    .join(' ')
    .split(/[\s,()/-]+/)
    .map((w) => nameKey(w))
    .filter((w) => w.length >= minLength)
  return [...new Set(words)]
}

/** Jetons d'un aliment : on n'indexe pas les mots d'une seule lettre. */
export function tokensOf(...parts) {
  return split(parts, 2)
}

/** Jetons d'une recherche : une seule lettre doit déjà filtrer — on cherche
 *  au fil de la frappe, pas une fois le mot entier tapé. */
export function queryTokens(query) {
  return split([query], 1)
}

/** L'instantané embarqué dans une ligne de journal ou dans la mémoire d'usage.
 *  Il contient tout ce qu'il faut pour afficher et recalculer sans le catalogue. */
export function snapshotOf(food) {
  if (!food) return null
  return {
    name: food.name,
    brand: food.brand ?? null,
    source: food.source ?? sourceOf(food.id),
    per: num(food.per) ?? 100,
    unit: food.unit || 'g',
    servingSize: num(food.servingSize),
    kcal: num(food.kcal),
    protein: num(food.protein),
    carbs: num(food.carbs),
    fat: num(food.fat),
    fiber: num(food.fiber)
  }
}

/**
 * Contrôle d'un aliment saisi à la main.
 * @returns {{ok: boolean, errors: {champ: message}}}
 */
export function validateFoodInput(input) {
  const errors = {}
  const name = String(input?.name ?? '').trim()
  if (!name) errors.name = 'Donne-lui un nom.'
  else if (name.length > 80) errors.name = '80 caractères maximum.'

  const per = num(input?.per)
  if (per === null || per <= 0) errors.per = 'La base de référence doit être un nombre positif (100 g par exemple).'

  const kcal = num(input?.kcal)
  if (kcal === null || kcal < 0) errors.kcal = 'Indique les calories pour cette base.'
  else if (per && kcal / per > 9.5) errors.kcal = 'Plus de 950 kcal pour 100 g : vérifie la valeur.'

  for (const [key, label] of [['protein', 'Protéines'], ['carbs', 'Glucides'], ['fat', 'Lipides']]) {
    const v = num(input?.[key])
    if (v === null || v < 0) errors[key] = `${label} : indique une valeur (0 si l'aliment n'en contient pas).`
    else if (per && v > per) errors[key] = `${label} : impossible d'en avoir plus que le poids total.`
  }

  const fiber = num(input?.fiber)
  if (input?.fiber !== '' && input?.fiber !== null && input?.fiber !== undefined) {
    if (fiber === null || fiber < 0) errors.fiber = 'Fibres : un nombre, ou laisse vide si tu ne sais pas.'
  }

  // Un contrôle de bon sens, pas une correction : on n'ajuste jamais la saisie.
  const p = num(input?.protein)
  const c = num(input?.carbs)
  const f = num(input?.fat)
  if (per && p !== null && c !== null && f !== null && p + c + f > per * 1.05) {
    errors.protein = 'Protéines + glucides + lipides dépassent le poids total.'
  }

  return { ok: Object.keys(errors).length === 0, errors }
}

/** Fabrique un aliment personnel. Les valeurs saisies sont conservées telles quelles. */
export function makeUserFood(input, { now = new Date(), existing = {} } = {}) {
  const name = String(input.name).trim()
  const base = slug(name) || 'aliment'
  let key = base
  let n = 2
  while (existing[foodId('user-created', key)]) key = `${base}-${n++}`

  return {
    id: foodId('user-created', key),
    source: 'user-created',
    name,
    brand: String(input.brand ?? '').trim() || null,
    barcode: input.barcode ?? null,
    per: num(input.per) ?? 100,
    unit: input.unit || 'g',
    servingSize: num(input.servingSize),
    kcal: num(input.kcal),
    protein: num(input.protein),
    carbs: num(input.carbs),
    fat: num(input.fat),
    fiber: num(input.fiber),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }
}

/* ---------- mémoire d'usage ---------- */

/** Entrée de mémoire vierge. */
export function emptyUsage(snapshot = null) {
  return { count: 0, lastAt: null, lastQty: null, unit: null, favorite: false, snapshot }
}

/**
 * Enregistre qu'un aliment vient d'être utilisé : fréquence, date, et surtout
 * la QUANTITÉ — c'est elle qui permettra de le ré-ajouter d'un seul geste.
 */
export function touchUsage(usage, id, { qty, unit, snapshot, now = new Date() } = {}) {
  const previous = usage[id] || emptyUsage()
  return {
    ...usage,
    [id]: {
      ...previous,
      count: previous.count + 1,
      lastAt: now.toISOString(),
      lastQty: num(qty) ?? previous.lastQty,
      unit: unit || previous.unit,
      // L'instantané le plus récent gagne : la mémoire reste utilisable seule.
      snapshot: snapshot || previous.snapshot
    }
  }
}

export function setFavorite(usage, id, favorite, snapshot = null) {
  const previous = usage[id] || emptyUsage(snapshot)
  return { ...usage, [id]: { ...previous, favorite: !!favorite, snapshot: previous.snapshot || snapshot } }
}

/** Une entrée affichable : ce que la mémoire sait, sans rien demander à personne. */
function usageRow(id, entry) {
  return {
    id,
    snapshot: entry.snapshot,
    name: entry.snapshot?.name || id,
    brand: entry.snapshot?.brand || null,
    lastQty: entry.lastQty,
    unit: entry.unit || entry.snapshot?.unit || 'g',
    count: entry.count,
    lastAt: entry.lastAt,
    favorite: !!entry.favorite
  }
}

const byRecency = (a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || ''))

/** Les aliments récemment utilisés, du plus récent au plus ancien. */
export function recents(usage, { limit = 20 } = {}) {
  return Object.entries(usage)
    .filter(([, e]) => e.lastAt && e.snapshot)
    .map(([id, e]) => usageRow(id, e))
    .sort(byRecency)
    .slice(0, limit)
}

/** Les favoris, les plus utilisés d'abord. */
export function favorites(usage, { limit = 50 } = {}) {
  return Object.entries(usage)
    .filter(([, e]) => e.favorite && e.snapshot)
    .map(([id, e]) => usageRow(id, e))
    .sort((a, b) => b.count - a.count || byRecency(a, b))
    .slice(0, limit)
}

/**
 * Recherche locale : aliments personnels + tout ce que la mémoire connaît.
 * Correspondance par préfixe de mot, insensible aux accents et à la casse.
 */
export function searchLocal({ foods = {}, usage = {} }, query, { limit = 30 } = {}) {
  const needles = queryTokens(query)
  if (!needles.length) return []

  const rows = new Map()
  for (const food of Object.values(foods)) {
    rows.set(food.id, {
      id: food.id,
      snapshot: snapshotOf(food),
      name: food.name,
      brand: food.brand,
      lastQty: null,
      unit: food.unit || 'g',
      count: 0,
      lastAt: null,
      favorite: false
    })
  }
  for (const [id, entry] of Object.entries(usage)) {
    if (!entry.snapshot) continue
    const row = usageRow(id, entry)
    // La mémoire complète la fiche personnelle sans l'écraser.
    rows.set(id, { ...(rows.get(id) || row), ...row, snapshot: rows.get(id)?.snapshot || row.snapshot })
  }

  return [...rows.values()]
    .map((row) => {
      const haystack = tokensOf(row.name, row.brand)
      const score = needles.reduce(
        (total, needle) => total + (haystack.some((token) => token.startsWith(needle)) ? 1 : 0),
        0
      )
      return { row, score }
    })
    .filter(({ score }) => score === needles.length)
    .sort((a, b) => b.row.favorite - a.row.favorite || b.row.count - a.row.count || a.row.name.localeCompare(b.row.name, 'fr'))
    .slice(0, limit)
    .map(({ row }) => row)
}
