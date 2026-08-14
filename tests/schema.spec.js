import { describe, it, expect } from 'vitest'
import { freshState, hydrate, dehydrate, validateState } from '../src/core/schema.js'
import { buildCatalog, resolveOrCreate, nameKey } from '../src/core/catalog.js'
import { buildProgram, seedExerciseIds } from '../src/core/program.js'

describe('catalogue', () => {
  it('a des ids uniques', () => {
    const catalog = buildCatalog()
    expect(Object.keys(catalog)).toHaveLength(new Set(Object.keys(catalog)).size)
  })

  it('couvre tous les mouvements référencés par le programme d’origine', () => {
    const catalog = buildCatalog()
    for (const id of seedExerciseIds()) expect(catalog[id], `mouvement manquant : ${id}`).toBeTruthy()
  })

  it('fait pointer Push et Upper sur le même mouvement pour les élévations latérales', () => {
    const program = buildProgram()
    const push = program.find((s) => s.id === 'push').exercises.map((e) => e.exerciseId)
    const upper = program.find((s) => s.id === 'upper').exercises.map((e) => e.exerciseId)
    expect(push).toContain('lateral-raise')
    expect(upper).toContain('lateral-raise')
  })

  it('normalise les noms sans tenir compte des accents ni de la casse', () => {
    expect(nameKey('Élévations latérales')).toBe(nameKey('elevations LATERALES'))
  })

  it('réutilise un mouvement existant plutôt que d’en créer un doublon', () => {
    const catalog = buildCatalog()
    const before = Object.keys(catalog).length
    const id = resolveOrCreate(catalog, { name: 'élévations latérales' })
    expect(id).toBe('lateral-raise')
    expect(Object.keys(catalog)).toHaveLength(before)
  })

  it('crée un id dérivé du nom et évite les collisions', () => {
    const catalog = buildCatalog()
    const a = resolveOrCreate(catalog, { name: 'Tirage maison' })
    expect(a).toBe('tirage-maison')
    catalog['tirage-maison'].name = 'Autre chose' // on casse le rapprochement par nom
    const b = resolveOrCreate(catalog, { name: 'Tirage maison' })
    expect(b).toBe('tirage-maison-2')
  })
})

describe('hydratation', () => {
  it('expose le nom, le mode et la nature assistée depuis le catalogue', () => {
    const state = hydrate(freshState())
    const ex = state.program[0].exercises[0]
    expect(ex.name).toBe('Supine Press machine')
    expect(ex.mode).toBe('reps')
    expect(ex.assisted).toBe(false)
  })

  it('écrit dans le catalogue quand une vue modifie la nature assistée', () => {
    const state = hydrate(freshState())
    const dips = state.program.find((s) => s.id === 'push').exercises.find((e) => e.exerciseId === 'assisted-dips')
    dips.assisted = false
    expect(state.catalog['assisted-dips'].assisted).toBe(false)
  })

  it('partage un renommage entre toutes les séances qui utilisent le mouvement', () => {
    const state = hydrate(freshState())
    const push = state.program.find((s) => s.id === 'push').exercises.find((e) => e.exerciseId === 'lateral-raise')
    const upper = state.program.find((s) => s.id === 'upper').exercises.find((e) => e.exerciseId === 'lateral-raise')
    push.name = 'Élévation latérale à la machine'
    expect(upper.name).toBe('Élévation latérale à la machine')
  })

  it('ne persiste aucune donnée dérivée', () => {
    const state = hydrate(freshState())
    const stored = dehydrate(state)
    const ex = stored.program[0].exercises[0]
    expect(ex.exerciseId).toBe('supine-press-machine')
    expect(ex.name).toBeUndefined()
    expect(ex.mode).toBeUndefined()
    expect(ex.assisted).toBeUndefined()
  })

  it('survit à un aller-retour hydrate → dehydrate sans rien perdre', () => {
    const state = hydrate(freshState())
    state.program[0].exercises[0].weight = 62.5
    const again = hydrate(dehydrate(state))
    expect(again.program[0].exercises[0].weight).toBe(62.5)
    expect(again.program[0].exercises[0].name).toBe('Supine Press machine')
  })
})

describe('validation', () => {
  it('accepte un état neuf', () => {
    expect(validateState(freshState())).toEqual({ ok: true, errors: [] })
  })

  it('refuse ce qui n’est pas un objet', () => {
    expect(validateState(null).ok).toBe(false)
    expect(validateState('{}').ok).toBe(false)
  })

  it('refuse une mauvaise version', () => {
    const s = freshState()
    s.version = 1
    expect(validateState(s).ok).toBe(false)
  })

  it('refuse un exercice qui pointe un mouvement absent du catalogue', () => {
    const s = freshState()
    s.program[0].exercises[0].exerciseId = 'mouvement-fantome'
    const r = validateState(s)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('mouvement-fantome')
  })

  it('refuse une fourchette de reps inversée', () => {
    const s = freshState()
    s.program[0].exercises[0].repMin = 12
    s.program[0].exercises[0].repMax = 8
    expect(validateState(s).ok).toBe(false)
  })

  it('refuse un poids négatif', () => {
    const s = freshState()
    s.program[0].exercises[0].weight = -10
    expect(validateState(s).ok).toBe(false)
  })

  it('refuse un historique qui n’est pas une liste', () => {
    const s = freshState()
    s.history = { nope: true }
    expect(validateState(s).ok).toBe(false)
  })

  it('refuse une séance archivée sans date', () => {
    const s = freshState()
    s.history = [{ id: 'h_1', entries: [] }]
    expect(validateState(s).ok).toBe(false)
  })

  it('donne des messages lisibles', () => {
    const s = freshState()
    s.program = []
    const r = validateState(s)
    expect(r.errors[0]).toMatch(/Programme vide/)
  })
})
