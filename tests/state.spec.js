/* La migration doit être non destructive. Ces tests sont là pour ça :
   ils vérifient qu'aucun chemin d'échec ne touche à `apex.v1`. */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryStorage, FailingStorage } from './helpers/storage.js'
import { v1State, v1Live } from './helpers/v1-fixture.js'
import { STATE_VERSION } from '../src/core/schema.js'
import { migrateV1toV2, migrateV2toV3, MIGRATIONS } from '../src/core/migrate.js'

/** Clé de l'état courant : les tests suivent la version, pas un nom figé. */
const CURRENT = `apex.v${STATE_VERSION}`

let mod
let storage

async function load(store = storage) {
  vi.resetModules()
  mod = await import('../src/state.js')
  const { createDataStore } = await import('../src/data/dataStore.js')
  const { createLocalAdapter } = await import('../src/data/adapters/local.js')
  return mod.initState(createDataStore(createLocalAdapter(store)))
}

/** Installe un état v1 tel qu'il existerait sur le téléphone de l'utilisateur. */
function seedV1(withLive = false) {
  storage.setItem('apex.v1', JSON.stringify(v1State()))
  if (withLive) storage.setItem('apex.live.v1', JSON.stringify(v1Live()))
}

/** Installe un état v2, tel que laissé par la Phase 0. */
function seedV2() {
  storage.setItem('apex.v2', JSON.stringify(migrateV1toV2(v1State()).state))
}

/** Installe un état v3, tel que laissé par la Phase 1. */
function seedV3() {
  const v3 = migrateV2toV3(migrateV1toV2(v1State()).state).state
  v3.body.weight = [{ date: '2026-08-14', value: 79.4 }]
  v3.profile = { ...v3.profile, height: 178, goal: 'seche', updatedAt: '2026-08-14T00:00:00.000Z' }
  v3.goals = [
    { id: 'g1', kind: 'weight', title: 'Descendre à 75 kg', unit: 'kg', target: 75, start: 81, direction: 'down', deadline: null, exerciseId: null, value: null, createdAt: '2026-08-14T00:00:00.000Z', history: [] }
  ]
  storage.setItem('apex.v3', JSON.stringify(v3))
}

beforeEach(() => {
  storage = new MemoryStorage()
})

describe('premier démarrage', () => {
  it('crée un état neuf quand il n’y a rien', async () => {
    const boot = await load()
    expect(boot.source).toBe('fresh')
    expect(mod.getState().program).toHaveLength(5)
    expect(storage.getItem(CURRENT)).toBeTruthy()
  })

  it('hydrate l’état neuf : la première séance a des noms et des modes', async () => {
    // Régression réelle : sans hydratation, name/mode restaient indéfinis
    // jusqu'au premier rechargement, et la première séance affichait des
    // chronos vides à la place des répétitions.
    await load()
    const first = mod.getState().program[0].exercises[0]
    expect(first.name).toBe('Supine Press machine')
    expect(first.mode).toBe('reps')
  })
})

describe('migration au démarrage', () => {
  it('migre depuis apex.v1 et le rapporte', async () => {
    seedV1()
    const boot = await load()
    expect(boot.source).toBe('migrated')
    expect(boot.migrated).toBe(true)
    expect(boot.from).toBe(1)
    expect(boot.reports[0].historyEntries).toBe(2)
  })

  it('ne touche JAMAIS à apex.v1', async () => {
    seedV1()
    const before = storage.getItem('apex.v1')
    await load()
    expect(storage.getItem('apex.v1')).toBe(before)
  })

  it('écrit une sauvegarde de l’état v1 avant de migrer', async () => {
    seedV1()
    await load()
    expect(storage.getItem('apex.backup.v1')).toBe(JSON.stringify(v1State()))
    expect(storage.getItem('apex.backup.v1.at')).toBeTruthy()
  })

  it('conserve l’intégralité de l’historique', async () => {
    seedV1()
    await load()
    expect(mod.getState().history).toHaveLength(2)
    expect(mod.getState().history.flatMap((h) => h.entries)).toHaveLength(3)
  })

  it('conserve les poids courants modifiés par l’utilisateur', async () => {
    seedV1()
    await load()
    const push = mod.findSession('push')
    expect(push.exercises.find((e) => e.id === 'push-01-supine-press-machine').weight).toBe(55)
    expect(push.exercises.find((e) => e.id === 'push-05-dips-assistes').weight).toBe(21)
  })

  it('garde une séance en cours reprenable', async () => {
    seedV1(true)
    await load()
    const live = mod.getLive()
    expect(live.sessionId).toBe('push')
    expect(live.entries[0].instanceId).toBe('push-01-supine-press-machine')
  })

  it('ne remigre pas au démarrage suivant', async () => {
    seedV1()
    await load()
    const stamp = storage.getItem('apex.backup.v1.at')
    const boot = await load()
    expect(boot.source).toBe('current')
    expect(boot.migrated).toBe(false)
    expect(storage.getItem('apex.backup.v1.at')).toBe(stamp)
    expect(storage.getItem('apex.v1')).toBeTruthy()
  })
})

describe('migration depuis la v2 (Phase 0 déjà installée)', () => {
  it('porte une v2 en version courante sans la modifier', async () => {
    seedV2()
    const before = storage.getItem('apex.v2')
    const boot = await load()
    expect(boot.migrated).toBe(true)
    expect(boot.from).toBe(2)
    expect(storage.getItem('apex.v2')).toBe(before)
    expect(storage.getItem('apex.backup.v2')).toBe(before)
    expect(mod.getState().version).toBe(STATE_VERSION)
  })

  it('conserve programme et historique', async () => {
    seedV2()
    await load()
    expect(mod.getState().history).toHaveLength(2)
    expect(mod.findSession('push').exercises[0].weight).toBe(55)
  })

  it('ajoute des sections vides, sans rien inventer', async () => {
    seedV2()
    await load()
    const state = mod.getState()
    expect(state.body).toEqual({ weight: [], waist: [] })
    expect(state.goals).toEqual([])
    expect(state.profile.height).toBeNull()
  })
})

describe('migration depuis la v3 (Phase 1 déjà installée)', () => {
  it('porte une v3 en version courante sans la modifier', async () => {
    seedV3()
    const before = storage.getItem('apex.v3')
    const boot = await load()
    expect(boot.migrated).toBe(true)
    expect(boot.from).toBe(3)
    expect(storage.getItem('apex.v3')).toBe(before)
    expect(storage.getItem('apex.backup.v3')).toBe(before)
  })

  it('conserve tout ce que la Phase 1 avait enregistré', async () => {
    seedV3()
    await load()
    const state = mod.getState()
    expect(state.history).toHaveLength(2)
    expect(state.body.weight).toEqual([{ date: '2026-08-14', value: 79.4 }])
    expect(state.profile.height).toBe(178)
    expect(state.goals[0].title).toBe('Descendre à 75 kg')
    expect(mod.findSession('push').exercises[0].weight).toBe(55)
  })

  it('ajoute une section nutrition vide, sans cible inventée', async () => {
    seedV3()
    await load()
    const n = mod.getState().nutrition
    expect(n.targets.mode).toBeNull()
    expect(n.targets.kcal).toBeNull()
    expect(n.foods).toEqual({})
    expect(n.usage).toEqual({})
    expect(n.meals).toEqual([])
    expect(n.recipes).toEqual([])
    expect(n.days).toEqual({})
  })
})

describe('chaîne complète v1 → version courante', () => {
  it('traverse toutes les versions en un seul démarrage', async () => {
    seedV1()
    const boot = await load()
    expect(boot.from).toBe(1)
    // La chaîne complète, quelle que soit la version courante du jour.
    expect(boot.reports.map((r) => `${r.from}->${r.to}`)).toEqual(MIGRATIONS.map((m) => `${m.from}->${m.to}`))
    expect(mod.getState().version).toBe(STATE_VERSION)
    expect(mod.getState().history).toHaveLength(2)
    expect(mod.getState().body.weight).toEqual([])
  })

  it('laisse une sauvegarde de la version d’origine seulement', async () => {
    seedV1()
    await load()
    expect(storage.getItem('apex.backup.v1')).toBeTruthy()
    expect(storage.getItem('apex.backup.v2')).toBeNull()
    expect(storage.getItem('apex.backup.v3')).toBeNull()
  })

  it('traverse v1 → v2 → v3 → v4 sans rien perdre en route', async () => {
    seedV1()
    await load()
    const state = mod.getState()
    expect(state.version).toBe(STATE_VERSION)
    expect(state.history.flatMap((h) => h.entries)).toHaveLength(3)
    expect(state.nutrition.days).toEqual({})
    expect(mod.findSession('upper').exercises.find((e) => e.id === 'upper-02-elevations-laterales').exerciseId).toBe('lateral-raise')
  })
})

describe('échecs de migration — rien ne doit être détruit', () => {
  it('annule la migration si la sauvegarde ne peut pas être écrite', async () => {
    const failing = new FailingStorage((key) => key.startsWith('apex.backup'))
    failing.setItem('apex.v1', JSON.stringify(v1State()))
    await expect(load(failing)).rejects.toThrow(/sauvegarder/i)
    expect(failing.getItem(CURRENT)).toBeNull()
    expect(failing.getItem('apex.v1')).toBeTruthy()
  })

  it('laisse apex.v1 intact si l’écriture de l’état migré échoue', async () => {
    const failing = new FailingStorage((key) => key === CURRENT)
    failing.setItem('apex.v1', JSON.stringify(v1State()))
    await expect(load(failing)).rejects.toThrow(/migrées/i)
    expect(failing.getItem(CURRENT)).toBeNull()
    expect(JSON.parse(failing.getItem('apex.v1')).history).toHaveLength(2)
  })

  it('refuse de démarrer sur un état courant invalide plutôt que de le réparer en douce', async () => {
    const bad = { version: STATE_VERSION, catalog: {}, program: [], history: [], settings: {} }
    storage.setItem(CURRENT, JSON.stringify(bad))
    storage.setItem('apex.v1', JSON.stringify(v1State()))
    await expect(load()).rejects.toMatchObject({ name: 'StateError' })
    expect(storage.getItem('apex.v1')).toBeTruthy()
    expect(storage.getItem(CURRENT)).toBeTruthy()
  })

  it('refuse de migrer une v2 invalide, et n’écrit rien', async () => {
    const bad = { version: 2, catalog: {}, program: [], history: [], settings: {} }
    storage.setItem('apex.v2', JSON.stringify(bad))
    await expect(load()).rejects.toMatchObject({ name: 'MigrationError' })
    expect(storage.getItem('apex.v2')).toBe(JSON.stringify(bad))
    expect(storage.getItem(CURRENT)).toBeNull()
  })

  it('refuse de démarrer sur un état courant illisible', async () => {
    storage.setItem(CURRENT, '{ ceci n’est pas du json')
    await expect(load()).rejects.toThrow(/illisibles/i)
  })

  it('refuse de migrer une v2 illisible', async () => {
    storage.setItem('apex.v2', '{ ceci n’est pas du json')
    await expect(load()).rejects.toThrow(/illisibles/i)
  })

  it('refuse de migrer une v1 illisible sans rien effacer', async () => {
    storage.setItem('apex.v1', '{ cassé')
    await expect(load()).rejects.toThrow(/illisibles/i)
    expect(storage.getItem('apex.v1')).toBe('{ cassé')
  })
})

describe('enregistrement', () => {
  it('persiste une modification', async () => {
    await load()
    mod.findSession('push').exercises[0].weight = 62.5
    expect(await mod.save()).toBe(true)
    await load()
    expect(mod.findSession('push').exercises[0].weight).toBe(62.5)
  })

  it('signale un échec d’écriture au lieu d’échouer en silence', async () => {
    await load()
    const seen = []
    mod.onStorageError((e) => seen.push(e))
    // Le disque se remplit après le démarrage.
    Object.defineProperty(storage, 'setItem', {
      value: () => {
        const e = new Error('plein')
        e.name = 'QuotaExceededError'
        throw e
      },
      configurable: true
    })
    const ok = await mod.save()
    expect(ok).toBe(false)
    expect(seen).toHaveLength(1)
    expect(seen[0].userMessage).toMatch(/pleine/i)
  })

  it('refuse d’écrire un état devenu invalide', async () => {
    await load()
    const seen = []
    mod.onStorageError((e) => seen.push(e))
    mod.findSession('push').exercises[0].repMax = 1 // fourchette inversée
    expect(await mod.save()).toBe(false)
    expect(seen[0].name).toBe('StateError')
  })
})

describe('export / import', () => {
  it('fait un aller-retour sans perte', async () => {
    seedV1()
    await load()
    const dump = mod.exportJSON()
    await mod.resetAll()
    expect(mod.getState().history).toHaveLength(0)
    await mod.importJSON(dump)
    expect(mod.getState().history).toHaveLength(2)
    expect(mod.findSession('push').exercises[0].weight).toBe(55)
  })

  it('accepte encore un vieux fichier v1 et le convertit', async () => {
    await load()
    await mod.importJSON(JSON.stringify(v1State()))
    expect(mod.getState().version).toBe(STATE_VERSION)
    expect(mod.getState().history).toHaveLength(2)
    const upper = mod.findSession('upper')
    expect(upper.exercises.find((e) => e.id === 'upper-02-elevations-laterales').exerciseId).toBe('lateral-raise')
  })

  it('explique pourquoi un fichier est refusé', async () => {
    await load()
    await expect(mod.importJSON('pas du json')).rejects.toThrow(/JSON valide/)
    await expect(mod.importJSON('{"hello":1}')).rejects.toThrow(/non reconnu/)
    await expect(mod.importJSON(`{"version":${STATE_VERSION},"program":[]}`)).rejects.toThrow(/invalide/)
  })

  it('efface la séance en cours à l’import', async () => {
    seedV1(true)
    await load()
    expect(mod.getLive()).toBeTruthy()
    await mod.importJSON(JSON.stringify(v1State()))
    expect(mod.getLive()).toBeNull()
  })
})

describe('réinitialisations', () => {
  it('réinitialise le programme en gardant l’historique', async () => {
    seedV1()
    await load()
    await mod.resetProgramKeepHistory()
    expect(mod.getState().history).toHaveLength(2)
    expect(mod.getState().program).toHaveLength(5)
    expect(mod.findSession('push').exercises[0].weight).toBe(50)
    expect(mod.findSession('push').exercises[0].name).toBe('Supine Press machine')
  })

  it('efface tout sans supprimer la sauvegarde v1', async () => {
    seedV1()
    await load()
    await mod.resetAll()
    expect(mod.getState().history).toHaveLength(0)
    expect(storage.getItem('apex.v1')).toBeTruthy()
    expect(storage.getItem('apex.backup.v1')).toBeTruthy()
  })
})
