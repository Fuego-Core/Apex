/* OPEN FOOD FACTS — la seule porte vers une source alimentaire extérieure.

   Trois règles qui gouvernent tout ce fichier :

   1. Une valeur absente reste absente. Jamais 0, jamais devinée, jamais
      « raisonnablement estimée ». Un produit dont il manque une macro n'est pas
      un aliment OFF exploitable : APEX le refuse et propose la saisie manuelle.
   2. Les kcal fournies par la source sont la référence. On ne convertit depuis
      les kilojoules QUE lorsque les kcal sont réellement absentes, et cette
      dérivation est signalée (`derived: 'from-kj'`) — elle ne se cache pas.
   3. Ce module ne parle ni au stockage, ni à l'écran. Il transforme une réponse
      HTTP en aliment APEX, ou en refus expliqué. Il est donc testable
      intégralement à partir de réponses figées, sans réseau.

   Données produits © Open Food Facts, sous licence ODbL. L'attribution
   accompagne l'aliment (`license`) et voyage donc jusque dans les exports. */

const BASE = 'https://world.openfoodfacts.org'

/** Identification demandée par OFF : qui appelle, et pour quoi. */
const IDENT = 'app_name=APEX&app_version=2.0&app_uuid=apex-pwa'

/** On ne rapatrie que ce qu'on utilise : moins d'octets, moins de vie privée engagée. */
const FIELDS = [
  'code',
  'product_name',
  'product_name_fr',
  'generic_name',
  'generic_name_fr',
  'brands',
  'quantity',
  'serving_size',
  'nutrition_data_per',
  'nutriments'
].join(',')

const SEARCH_FIELDS = ['code', 'product_name', 'product_name_fr', 'brands', 'nutriments'].join(',')

export const ATTRIBUTION = 'Données © Open Food Facts — ODbL'
export const LICENSE = 'ODbL 1.0'
export const SOURCE = 'open-food-facts'

/** Un refus, toujours porteur d'un message affichable tel quel. */
export class OffError extends Error {
  constructor(code, userMessage, cause = null) {
    super(userMessage)
    this.name = 'OffError'
    this.code = code
    this.userMessage = userMessage
    this.cause = cause
  }
}

const MESSAGES = {
  offline: 'Pas de connexion. La recherche en ligne a besoin du réseau — tes aliments enregistrés, eux, restent accessibles.',
  timeout: 'Open Food Facts met trop de temps à répondre. Réessaie, ou crée l’aliment à la main.',
  network: 'Impossible de joindre Open Food Facts. Réessaie, ou crée l’aliment à la main.',
  http: 'Open Food Facts a refusé la demande. Réessaie plus tard, ou crée l’aliment à la main.',
  'bad-response': 'Réponse illisible d’Open Food Facts. Crée l’aliment à la main si ça persiste.',
  'not-found': 'Ce produit n’est pas dans Open Food Facts. Tu peux le créer à la main : APEX s’en souviendra ensuite.',
  incomplete: 'Cette fiche Open Food Facts est incomplète. APEX ne comble pas les trous : crée l’aliment à la main avec l’emballage sous les yeux.',
  'bad-barcode': 'Ce code-barres n’a pas un format valide.'
}

const fail = (code, cause = null, message = null) => new OffError(code, message || MESSAGES[code] || MESSAGES.network, cause)

/* ---------- lecture des nutriments ---------- */

const has = (n, key) => {
  const v = n?.[key]
  return v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))
}
const value = (n, key) => (has(n, key) ? Number(n[key]) : null)

/**
 * Énergie pour 100 g, en kcal.
 * Les kcal fournies gagnent toujours. La conversion depuis les kJ n'intervient
 * qu'en leur absence réelle, et se déclare.
 * @returns {{kcal: number|null, derived: string|null}}
 */
export function energyKcal(nutriments) {
  const n = nutriments || {}
  if (has(n, 'energy-kcal_100g')) return { kcal: value(n, 'energy-kcal_100g'), derived: null }

  const unit = String(n.energy_unit || '').toLowerCase()
  if (has(n, 'energy-kj_100g')) return { kcal: round1(value(n, 'energy-kj_100g') / 4.184), derived: 'from-kj' }
  if (has(n, 'energy_100g')) {
    // `energy_100g` est en kJ sauf mention contraire explicite.
    if (unit === 'kcal') return { kcal: value(n, 'energy_100g'), derived: null }
    return { kcal: round1(value(n, 'energy_100g') / 4.184), derived: 'from-kj' }
  }
  return { kcal: null, derived: null }
}

const round1 = (v) => Math.round(v * 10) / 10

/** Le nom le plus utile pour un francophone, sans jamais fabriquer un nom. */
function bestName(product) {
  const candidates = [product.product_name_fr, product.product_name, product.generic_name_fr, product.generic_name]
  const found = candidates.map((c) => String(c ?? '').trim()).find((c) => c.length > 0)
  return found || null
}

/**
 * Transforme une fiche OFF en aliment APEX — ou explique pourquoi c'est
 * impossible. Fonction pure : c'est elle que les tests martèlent.
 * @returns {{ok: true, food: object} | {ok: false, code: string, missing: string[], message: string}}
 */
export function toFood(product) {
  if (!product || typeof product !== 'object') {
    return { ok: false, code: 'not-found', missing: [], message: MESSAGES['not-found'] }
  }

  const n = product.nutriments || {}
  const missing = []

  const name = bestName(product)
  if (!name) missing.push('le nom')

  const { kcal, derived } = energyKcal(n)
  if (kcal === null) missing.push('les calories')

  const protein = value(n, 'proteins_100g')
  if (protein === null) missing.push('les protéines')
  const carbs = value(n, 'carbohydrates_100g')
  if (carbs === null) missing.push('les glucides')
  const fat = value(n, 'fat_100g')
  if (fat === null) missing.push('les lipides')

  if (missing.length) {
    return {
      ok: false,
      code: 'incomplete',
      missing,
      message: `Fiche incomplète : il manque ${missing.join(', ')}. ${MESSAGES.incomplete}`
    }
  }

  // Garde-fous d'absurdité : une fiche fausse est aussi nuisible qu'une fiche vide.
  const absurd =
    kcal < 0 ||
    kcal > 950 ||
    protein < 0 ||
    carbs < 0 ||
    fat < 0 ||
    protein > 100 ||
    carbs > 100 ||
    fat > 100 ||
    protein + carbs + fat > 105
  if (absurd) {
    return {
      ok: false,
      code: 'incomplete',
      missing: ['des valeurs cohérentes'],
      message: `Les valeurs de cette fiche sont incohérentes (${Math.round(kcal)} kcal, ${round1(protein)} g / ${round1(carbs)} g / ${round1(fat)} g pour 100 g). ${MESSAGES.incomplete}`
    }
  }

  const barcode = String(product.code ?? '').trim() || null

  return {
    ok: true,
    food: {
      id: `off:${barcode}`,
      source: SOURCE,
      name,
      brand: String(product.brands ?? '').split(',')[0].trim() || null,
      barcode,
      per: 100,
      unit: 'g',
      servingSize: parseServing(product.serving_size),
      kcal,
      protein,
      carbs,
      fat,
      fiber: value(n, 'fiber_100g'),
      // Provenance et licence collées à l'aliment : elles ne peuvent plus se perdre.
      license: LICENSE,
      attribution: ATTRIBUTION,
      derived: derived ? { kcal: derived } : null,
      fetchedAt: null
    }
  }
}

/** « 30 g », « 1 portion (25g) » → 30 / 25. Aucune valeur inventée si illisible. */
export function parseServing(raw) {
  if (raw === null || raw === undefined) return null
  const match = String(raw).match(/(\d+(?:[.,]\d+)?)\s*(g|ml)/i)
  if (!match) return null
  const n = Number(match[1].replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Un code-barres plausible : 8 à 14 chiffres. */
export function isBarcode(code) {
  return /^\d{8,14}$/.test(String(code ?? '').trim())
}

/* ---------- réseau ---------- */

async function request(url, { timeout = 10000, fetchImpl = globalThis.fetch, online = null } = {}) {
  const isOnline = online === null ? globalThis.navigator?.onLine !== false : online
  if (!isOnline) throw fail('offline')
  if (typeof fetchImpl !== 'function') throw fail('network')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  let res
  try {
    res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    // Une annulation ici ne peut venir que du minuteur.
    throw fail(e?.name === 'AbortError' ? 'timeout' : 'network', e)
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 404) throw fail('not-found')
  if (!res.ok) throw fail('http', new Error(`HTTP ${res.status}`))

  try {
    return await res.json()
  } catch (e) {
    throw fail('bad-response', e)
  }
}

/**
 * Lit un produit par son code-barres.
 * @returns {Promise<{ok: true, food}|{ok: false, code, message, missing?}>}
 * @throws {OffError} pour tout ce qui relève du réseau (hors ligne, délai, refus).
 */
export async function fetchProduct(barcode, options = {}) {
  const code = String(barcode ?? '').trim()
  if (!isBarcode(code)) throw fail('bad-barcode')

  const json = await request(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}&${IDENT}`, options)

  // OFF répond 200 avec status: 0 pour un produit inconnu.
  if (!json || json.status === 0 || !json.product) {
    return { ok: false, code: 'not-found', missing: [], message: MESSAGES['not-found'] }
  }

  const result = toFood({ ...json.product, code: json.product.code || code })
  if (result.ok) result.food.fetchedAt = new Date().toISOString()
  return result
}

/**
 * Recherche en ligne, DÉCLENCHÉE EXPLICITEMENT — jamais au fil de la frappe :
 * chaque frappe serait une requête vers un tiers, pour un résultat souvent
 * moins bon que la mémoire locale.
 *
 * Les fiches inexploitables sont écartées ici : mieux vaut cinq résultats
 * utilisables que vingt dont la moitié afficherait des trous.
 * @returns {Promise<{foods: object[], total: number, skipped: number}>}
 */
export async function searchOnline(query, { pageSize = 20, ...options } = {}) {
  const terms = String(query ?? '').trim()
  if (terms.length < 2) return { foods: [], total: 0, skipped: 0 }

  const url =
    `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(terms)}&search_simple=1&action=process&json=1` +
    `&page_size=${pageSize}&fields=${SEARCH_FIELDS}&${IDENT}`
  const json = await request(url, { timeout: 12000, ...options })

  const products = Array.isArray(json?.products) ? json.products : []
  const foods = []
  let skipped = 0
  const at = new Date().toISOString()

  for (const product of products) {
    const result = toFood(product)
    if (result.ok && result.food.barcode) {
      result.food.fetchedAt = at
      foods.push(result.food)
    } else skipped++
  }

  return { foods, total: Number(json?.count) || foods.length, skipped }
}
