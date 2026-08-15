/* OPEN FOOD FACTS — la frontière avec l'extérieur.

   Ce que ces tests protègent, et qui compte plus que le reste : APEX ne comble
   jamais un trou. Une fiche à laquelle il manque une macro est refusée, pas
   complétée par un 0 qui aurait l'air d'une mesure. Et les kcal fournies par la
   source restent la référence : la conversion depuis les kilojoules n'arrive
   qu'en leur absence réelle, et se déclare.

   Aucune requête réelle ici : les réponses sont figées. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryStorage } from './helpers/storage.js'
import {
  toFood,
  energyKcal,
  parseServing,
  isBarcode,
  fetchProduct,
  searchOnline,
  OffError,
  ATTRIBUTION
} from '../src/data/openFoodFacts.js'
import { purgeOrder, purgeCount, rankCacheHits, createFoodCache, MAX_ENTRIES } from '../src/data/foodCache.js'

/* ---------- réponses figées ---------- */

const nutella = {
  code: '3017620422003',
  product_name: 'Nutella',
  product_name_fr: 'Nutella pâte à tartiner',
  brands: 'Ferrero,Nutella',
  serving_size: '15 g',
  nutrition_data_per: '100g',
  nutriments: {
    'energy-kcal_100g': 539,
    energy_100g: 2255,
    energy_unit: 'kJ',
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9,
    fiber_100g: 0
  }
}

const kjOnly = {
  code: '3229820129488',
  product_name: 'Galettes de riz',
  brands: 'Bjorg',
  nutriments: {
    energy_100g: 1500,
    energy_unit: 'kJ',
    proteins_100g: 8,
    carbohydrates_100g: 78,
    fat_100g: 3
  }
}

const incomplete = {
  code: '1234567890123',
  product_name: 'Produit sans macros',
  nutriments: { 'energy-kcal_100g': 250, proteins_100g: 5 }
}

const jsonResponse = (body, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body
})

describe('lecture de l’énergie', () => {
  it('garde les kcal fournies même quand les kJ sont là aussi', () => {
    expect(energyKcal(nutella.nutriments)).toEqual({ kcal: 539, derived: null })
  })

  it('ne convertit depuis les kJ que si les kcal manquent vraiment', () => {
    expect(energyKcal(kjOnly.nutriments)).toEqual({ kcal: 358.5, derived: 'from-kj' })
  })

  it('respecte une énergie déjà exprimée en kcal', () => {
    expect(energyKcal({ energy_100g: 240, energy_unit: 'kcal' })).toEqual({ kcal: 240, derived: null })
  })

  it('rend null plutôt qu’un zéro quand il n’y a aucune énergie', () => {
    expect(energyKcal({ proteins_100g: 10 })).toEqual({ kcal: null, derived: null })
    expect(energyKcal(null)).toEqual({ kcal: null, derived: null })
  })

  it('ignore une valeur vide au lieu de la lire comme 0', () => {
    expect(energyKcal({ 'energy-kcal_100g': '', energy_100g: 1500 }).derived).toBe('from-kj')
  })
})

describe('conversion en aliment APEX', () => {
  it('accepte une fiche complète et conserve la provenance', () => {
    const res = toFood(nutella)
    expect(res.ok).toBe(true)
    expect(res.food).toMatchObject({
      id: 'off:3017620422003',
      source: 'open-food-facts',
      name: 'Nutella pâte à tartiner',
      brand: 'Ferrero',
      barcode: '3017620422003',
      per: 100,
      unit: 'g',
      kcal: 539,
      protein: 6.3,
      carbs: 57.5,
      fat: 30.9,
      fiber: 0,
      servingSize: 15
    })
    expect(res.food.attribution).toBe(ATTRIBUTION)
    expect(res.food.license).toBe('ODbL 1.0')
    expect(res.food.derived).toBeNull()
  })

  it('signale une valeur reconstituée depuis les kilojoules', () => {
    const res = toFood(kjOnly)
    expect(res.ok).toBe(true)
    expect(res.food.kcal).toBe(358.5)
    expect(res.food.derived).toEqual({ kcal: 'from-kj' })
  })

  it('refuse une fiche incomplète et dit ce qui manque', () => {
    const res = toFood(incomplete)
    expect(res.ok).toBe(false)
    expect(res.code).toBe('incomplete')
    expect(res.missing).toEqual(['les glucides', 'les lipides'])
    expect(res.message).toMatch(/à la main/)
  })

  it('refuse une fiche sans nom', () => {
    const res = toFood({ ...nutella, product_name: '', product_name_fr: '  ', generic_name: null })
    expect(res.ok).toBe(false)
    expect(res.missing).toContain('le nom')
  })

  it('ne transforme jamais une macro absente en 0', () => {
    const res = toFood({ ...nutella, nutriments: { ...nutella.nutriments, carbohydrates_100g: null } })
    expect(res.ok).toBe(false)
  })

  it('garde les fibres à null quand elles ne sont pas renseignées', () => {
    const { fiber_100g, ...withoutFiber } = nutella.nutriments
    expect(toFood({ ...nutella, nutriments: withoutFiber }).food.fiber).toBeNull()
  })

  it('refuse des valeurs absurdes plutôt que de les enregistrer', () => {
    const tooRich = toFood({ ...nutella, nutriments: { ...nutella.nutriments, 'energy-kcal_100g': 1400 } })
    expect(tooRich.ok).toBe(false)
    expect(tooRich.message).toMatch(/incohérentes/)

    const tooHeavy = toFood({ ...nutella, nutriments: { ...nutella.nutriments, proteins_100g: 60, carbohydrates_100g: 60 } })
    expect(tooHeavy.ok).toBe(false)
  })

  it('traite l’absence de produit comme un produit introuvable', () => {
    expect(toFood(null)).toMatchObject({ ok: false, code: 'not-found' })
  })
})

describe('détails de lecture', () => {
  it('lit une portion écrite de plusieurs façons', () => {
    expect(parseServing('30 g')).toBe(30)
    expect(parseServing('1 portion (25g)')).toBe(25)
    expect(parseServing('33 cl')).toBeNull()
    expect(parseServing(null)).toBeNull()
  })

  it('reconnaît un code-barres plausible', () => {
    expect(isBarcode('3017620422003')).toBe(true)
    expect(isBarcode('20724696')).toBe(true)
    expect(isBarcode('skyr')).toBe(false)
    expect(isBarcode('123')).toBe(false)
  })
})

describe('lecture réseau d’un produit', () => {
  it('demande les seuls champs utiles et s’identifie', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ status: 1, product: nutella }))
    await fetchProduct('3017620422003', { fetchImpl })
    const url = fetchImpl.mock.calls[0][0]
    expect(url).toContain('/api/v2/product/3017620422003.json')
    expect(url).toContain('app_name=APEX')
    expect(url).toContain('fields=')
    expect(url).not.toContain('fields=all')
  })

  it('rend l’aliment et l’horodate', async () => {
    const fetchImpl = async () => jsonResponse({ status: 1, product: nutella })
    const res = await fetchProduct('3017620422003', { fetchImpl })
    expect(res.ok).toBe(true)
    expect(res.food.fetchedAt).toBeTruthy()
  })

  it('traite un status 0 comme un produit inconnu, pas comme une panne', async () => {
    const fetchImpl = async () => jsonResponse({ status: 0, status_verbose: 'product not found' })
    const res = await fetchProduct('0000000000000', { fetchImpl })
    expect(res).toMatchObject({ ok: false, code: 'not-found' })
    expect(res.message).toMatch(/créer à la main/)
  })

  it('refuse un code-barres qui n’en est pas un, sans appeler le réseau', async () => {
    const fetchImpl = vi.fn()
    await expect(fetchProduct('abc', { fetchImpl })).rejects.toMatchObject({ code: 'bad-barcode' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('distingue hors ligne, délai dépassé et refus du serveur', async () => {
    await expect(fetchProduct('3017620422003', { online: false, fetchImpl: vi.fn() })).rejects.toMatchObject({
      code: 'offline'
    })

    const aborted = async () => {
      const e = new Error('aborted')
      e.name = 'AbortError'
      throw e
    }
    await expect(fetchProduct('3017620422003', { fetchImpl: aborted })).rejects.toMatchObject({ code: 'timeout' })

    await expect(
      fetchProduct('3017620422003', { fetchImpl: async () => jsonResponse({}, { status: 503 }) })
    ).rejects.toMatchObject({ code: 'http' })

    await expect(
      fetchProduct('3017620422003', { fetchImpl: async () => jsonResponse({}, { status: 404 }) })
    ).rejects.toMatchObject({ code: 'not-found' })
  })

  it('donne un message affichable pour chaque panne', async () => {
    const error = await fetchProduct('3017620422003', { online: false, fetchImpl: vi.fn() }).catch((e) => e)
    expect(error).toBeInstanceOf(OffError)
    expect(error.userMessage).toMatch(/connexion/i)
  })

  it('survit à une réponse qui n’est pas du JSON', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Unexpected token <')
      }
    })
    await expect(fetchProduct('3017620422003', { fetchImpl })).rejects.toMatchObject({ code: 'bad-response' })
  })

  it('n’appelle jamais le réseau quand on est hors ligne', async () => {
    const fetchImpl = vi.fn()
    await fetchProduct('3017620422003', { online: false, fetchImpl }).catch(() => null)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('recherche en ligne', () => {
  const results = { count: 4075, products: [nutella, incomplete, kjOnly] }

  it('écarte les fiches inexploitables et le dit', async () => {
    const fetchImpl = async () => jsonResponse(results)
    const res = await searchOnline('skyr', { fetchImpl })
    expect(res.foods.map((f) => f.id)).toEqual(['off:3017620422003', 'off:3229820129488'])
    expect(res.skipped).toBe(1)
    expect(res.total).toBe(4075)
  })

  it('ne part pas sur une frappe trop courte', async () => {
    const fetchImpl = vi.fn()
    expect(await searchOnline('s', { fetchImpl })).toEqual({ foods: [], total: 0, skipped: 0 })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('échappe la requête et limite la page', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ count: 0, products: [] }))
    await searchOnline('pâte à tartiner', { fetchImpl, pageSize: 10 })
    const url = fetchImpl.mock.calls[0][0]
    expect(url).toContain('search_terms=p%C3%A2te%20%C3%A0%20tartiner')
    expect(url).toContain('page_size=10')
  })

  it('remonte une panne réseau au lieu de rendre une liste vide trompeuse', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(searchOnline('skyr', { fetchImpl })).rejects.toMatchObject({ code: 'network' })
  })
})

/* ---------- cache ---------- */

describe('cache alimentaire — règles de purge', () => {
  const records = [
    { id: 'off:1', usedCount: 0, lastSeenAt: '2026-01-01T00:00:00.000Z' },
    { id: 'off:2', usedCount: 5, lastSeenAt: '2026-02-01T00:00:00.000Z' },
    { id: 'off:3', usedCount: 0, lastSeenAt: '2026-03-01T00:00:00.000Z' }
  ]

  it('sacrifie d’abord ce qui n’a jamais servi, et le plus ancien', () => {
    expect(purgeOrder(records).map((r) => r.id)).toEqual(['off:1', 'off:3', 'off:2'])
  })

  it('n’efface jamais une fiche que la mémoire d’usage connaît', () => {
    const kept = purgeOrder(records, { pinned: new Set(['off:1']) }).map((r) => r.id)
    expect(kept).not.toContain('off:1')
  })

  it('ne purge rien tant qu’on est sous la limite', () => {
    expect(purgeCount(1500)).toBe(0)
    expect(purgeCount(MAX_ENTRIES)).toBe(0)
  })

  it('purge par paquets pour ne pas recommencer à chaque ajout', () => {
    expect(purgeCount(MAX_ENTRIES + 1)).toBe(201)
  })

  it('classe les trouvailles du cache par utilité', () => {
    expect(rankCacheHits(records).map((r) => r.id)).toEqual(['off:2', 'off:3', 'off:1'])
  })
})

describe('cache alimentaire — absence d’IndexedDB', () => {
  /* Le scénario qui compte : un navigateur sans IndexedDB, ou qui refuse de
     l'ouvrir. Rien ne doit lever, rien ne doit bloquer — le cache n'est qu'un
     accélérateur. */
  const cache = createFoodCache({ idb: undefined })

  it('se déclare indisponible sans lever', async () => {
    expect(cache.status).toBe('unavailable')
    expect(await cache.available()).toBe(false)
  })

  it('accepte toutes les opérations en silence', async () => {
    expect(await cache.put({ id: 'off:1', name: 'Test' })).toBe(false)
    expect(await cache.get('off:1')).toBeNull()
    expect(await cache.getByBarcode('3017620422003')).toBeNull()
    expect(await cache.search(['nut'])).toEqual([])
    expect(await cache.count()).toBe(0)
    expect(await cache.purge()).toBe(0)
    expect(await cache.clear()).toBe(false)
  })

  it('ne prétend pas obtenir la persistance', async () => {
    expect(await cache.requestPersistence()).toBe(false)
  })
})

/* ---------- branchement dans l'état ---------- */

describe('la source extérieure vue depuis l’état', () => {
  /* Ces tests tournent SANS IndexedDB : le cache est donc absent en permanence.
     C'est la forme la plus dure de la règle — si tout marche ici, le cache
     n'est bien qu'un accélérateur. */

  let mod
  const realFetch = globalThis.fetch

  beforeEach(async () => {
    vi.resetModules()
    mod = await import('../src/state.js')
    const { createDataStore } = await import('../src/data/dataStore.js')
    const { createLocalAdapter } = await import('../src/data/adapters/local.js')
    await mod.initState(createDataStore(createLocalAdapter(new MemoryStorage())))
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('rend des lignes prêtes à ajouter, avec la provenance', async () => {
    globalThis.fetch = async () => jsonResponse({ count: 2, products: [nutella, incomplete] })
    const res = await mod.searchFoodsOnline('nutella')

    expect(res.rows).toHaveLength(1)
    expect(res.skipped).toBe(1)
    expect(res.warning).toBeNull()
    expect(res.rows[0]).toMatchObject({ id: 'off:3017620422003', name: 'Nutella pâte à tartiner', external: true })
    expect(res.rows[0].snapshot.source).toBe('open-food-facts')
    expect(res.rows[0].snapshot.attribution).toBe(ATTRIBUTION)
  })

  it('propose la quantité habituelle d’un produit déjà mangé', async () => {
    globalThis.fetch = async () => jsonResponse({ count: 1, products: [nutella] })
    const first = await mod.searchFoodsOnline('nutella')
    await mod.logFood({ foodId: first.rows[0].id, snapshot: first.rows[0].snapshot, qty: 30, date: '2026-08-15' })

    const again = await mod.searchFoodsOnline('nutella')
    expect(again.rows[0].lastQty).toBe(30)
    expect(again.rows[0].count).toBe(1)
  })

  it('explique la panne réseau au lieu de rendre une liste vide muette', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    const res = await mod.searchFoodsOnline('nutella')
    expect(res.rows).toEqual([])
    expect(res.warning).toMatch(/Open Food Facts/)
  })

  it('lit un produit par code-barres', async () => {
    globalThis.fetch = async () => jsonResponse({ status: 1, product: nutella })
    const res = await mod.lookupBarcode('3017620422003')
    expect(res.ok).toBe(true)
    expect(res.fromCache).toBe(false)
    expect(res.row.snapshot.kcal).toBe(539)
  })

  it('renvoie vers la création manuelle quand le produit est inconnu', async () => {
    globalThis.fetch = async () => jsonResponse({ status: 0 })
    const res = await mod.lookupBarcode('0000000000000')
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/créer à la main/)
  })

  it('ne laisse pas une panne réseau remonter jusqu’à l’écran', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    const res = await mod.lookupBarcode('3017620422003')
    expect(res.ok).toBe(false)
    expect(res.code).toBe('network')
  })

  it('fige l’instantané d’un produit extérieur : le journal ne dépend plus de rien', async () => {
    globalThis.fetch = async () => jsonResponse({ status: 1, product: nutella })
    const found = await mod.lookupBarcode('3017620422003')
    await mod.logFood({ foodId: found.row.id, snapshot: found.row.snapshot, qty: 30, date: '2026-08-15' })

    // Plus de réseau du tout, et jamais de cache : la journée reste lisible.
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    const { dayTotals } = await import('../src/core/nutrition/calculations.js')
    const day = mod.getState().nutrition.days['2026-08-15']
    expect(dayTotals(day).total.kcal).toBeCloseTo(161.7, 1)

    // Et il reste ré-ajoutable d'un geste, toujours sans réseau ni cache.
    const { recents } = await import('../src/core/nutrition/foods.js')
    expect(recents(mod.getState().nutrition.usage)[0]).toMatchObject({
      name: 'Nutella pâte à tartiner',
      lastQty: 30
    })
  })

  it('n’écrit pas les produits extérieurs dans les aliments personnels', async () => {
    globalThis.fetch = async () => jsonResponse({ status: 1, product: nutella })
    const found = await mod.lookupBarcode('3017620422003')
    await mod.logFood({ foodId: found.row.id, snapshot: found.row.snapshot, qty: 30, date: '2026-08-15' })
    expect(Object.keys(mod.getState().nutrition.foods)).toHaveLength(0)
  })
})

describe('retrouver un produit par son code, sans réseau', () => {
  /* Le scan doit fonctionner hors ligne pour ce qu'on connaît déjà. Ici encore,
     aucun IndexedDB : ce qui répond, c'est la mémoire — pas le cache. */

  let mod
  const realFetch = globalThis.fetch

  beforeEach(async () => {
    vi.resetModules()
    mod = await import('../src/state.js')
    const { createDataStore } = await import('../src/data/dataStore.js')
    const { createLocalAdapter } = await import('../src/data/adapters/local.js')
    await mod.initState(createDataStore(createLocalAdapter(new MemoryStorage())))
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  const noNetwork = () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    return globalThis.fetch
  }

  it('fait primer un aliment que tu as créé toi-même', async () => {
    await mod.createFood({ name: 'Skyr maison', barcode: '3017620422003', per: 100, kcal: 62, protein: 10, carbs: 4, fat: 0.2 })
    const fetchImpl = noNetwork()

    const res = await mod.lookupBarcode('3017620422003')
    expect(res.ok).toBe(true)
    expect(res.row.name).toBe('Skyr maison')
    expect(fetchImpl).not.toHaveBeenCalled()
    // Et on ne lui colle pas une attribution qui n'est pas la sienne.
    expect(res.row.snapshot.attribution).toBeNull()
  })

  it('retrouve un produit déjà mangé sans réseau ni cache', async () => {
    globalThis.fetch = async () => jsonResponse({ status: 1, product: nutella })
    const first = await mod.lookupBarcode('3017620422003')
    await mod.logFood({ foodId: first.row.id, snapshot: first.row.snapshot, qty: 30, date: '2026-08-15' })

    const fetchImpl = noNetwork()
    const again = await mod.lookupBarcode('3017620422003')
    expect(again.ok).toBe(true)
    expect(again.fromCache).toBe(true)
    expect(again.row.snapshot.kcal).toBe(539)
    expect(again.row.lastQty).toBe(30)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('n’invente rien pour un code jamais vu quand le réseau est absent', async () => {
    noNetwork()
    const res = await mod.lookupBarcode('5449000000996')
    expect(res.ok).toBe(false)
    expect(res.code).toBe('network')
  })
})
