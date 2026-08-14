import { describe, it, expect } from 'vitest'
import { migrateV1toV2, migrateLiveV1toV2, MigrationError } from '../src/core/migrate.js'
import { validateState } from '../src/core/schema.js'
import { v1State, v1Live } from './helpers/v1-fixture.js'

const find = (state, sessionId, instanceId) =>
  state.program.find((s) => s.id === sessionId).exercises.find((e) => e.id === instanceId)

describe('migration v1 → v2', () => {
  it('produit un état valide', () => {
    const { state } = migrateV1toV2(v1State())
    expect(validateState(state)).toEqual({ ok: true, errors: [] })
    expect(state.version).toBe(2)
    expect(state.migratedFrom).toBe(1)
  })

  it('conserve les ids d’instance, donc les repères de l’utilisateur', () => {
    const { state } = migrateV1toV2(v1State())
    expect(find(state, 'push', 'push-01-supine-press-machine')).toBeTruthy()
    expect(find(state, 'upper', 'upper-02-elevations-laterales')).toBeTruthy()
  })

  it('conserve poids, incrément, fourchette, repos et note', () => {
    const { state } = migrateV1toV2(v1State())
    const ex = find(state, 'push', 'push-01-supine-press-machine')
    expect(ex.weight).toBe(55)
    expect(ex.increment).toBe(2.5)
    expect(ex.repMin).toBe(6)
    expect(ex.repMax).toBe(8)
    expect(ex.rest).toBe(120)
    expect(ex.note).toBe('coudes serrés')
  })

  it('conserve la suggestion en attente (pense-bête)', () => {
    const { state } = migrateV1toV2(v1State())
    const ex = find(state, 'push', 'push-01-supine-press-machine')
    expect(ex.pending.suggested).toBe(57.5)
    expect(ex.pending.status).toBe('progression')
  })

  it('conserve la date de dernière séance et les réglages', () => {
    const { state } = migrateV1toV2(v1State())
    expect(state.program.find((s) => s.id === 'push').lastDoneAt).toBe('2026-08-10T18:30:00.000Z')
    expect(state.settings).toEqual({ sound: false, vibration: true })
    expect(state.createdAt).toBe('2026-06-01T08:00:00.000Z')
  })

  it('réunit le même mouvement fait dans deux séances sous un id unique', () => {
    const { state } = migrateV1toV2(v1State())
    const push = find(state, 'push', 'push-04-elevations-laterales')
    const upper = find(state, 'upper', 'upper-02-elevations-laterales')
    expect(push.exerciseId).toBe('lateral-raise')
    expect(upper.exerciseId).toBe('lateral-raise')
  })

  it('garde des poids de travail distincts par séance', () => {
    const { state } = migrateV1toV2(v1State())
    expect(find(state, 'push', 'push-04-elevations-laterales').weight).toBe(10)
    expect(find(state, 'upper', 'upper-02-elevations-laterales').weight).toBe(9)
  })

  it('rattache l’historique au mouvement, pas à la séance', () => {
    const { state } = migrateV1toV2(v1State())
    const ids = state.history.flatMap((h) => h.entries).filter((e) => e.name === 'Élévations latérales')
    expect(ids).toHaveLength(2)
    expect(new Set(ids.map((e) => e.exerciseId))).toEqual(new Set(['lateral-raise']))
  })

  it('conserve l’ancien id d’instance dans l’historique', () => {
    const { state } = migrateV1toV2(v1State())
    const entry = state.history
      .flatMap((h) => h.entries)
      .find((e) => e.instanceId === 'upper-02-elevations-laterales')
    expect(entry).toBeTruthy()
    expect(entry.exerciseId).toBe('lateral-raise')
  })

  it('ne perd aucune séance archivée ni aucune série', () => {
    const before = v1State()
    const { state } = migrateV1toV2(before)
    expect(state.history).toHaveLength(before.history.length)
    const setsBefore = before.history.flatMap((h) => h.entries).flatMap((e) => e.sets).length
    const setsAfter = state.history.flatMap((h) => h.entries).flatMap((e) => e.sets).length
    expect(setsAfter).toBe(setsBefore)
  })

  it('crée un mouvement pour un exercice inconnu du catalogue', () => {
    const { state, report } = migrateV1toV2(v1State())
    const ex = find(state, 'upper', 'upper-08-tirage-nuque-maison')
    expect(ex.exerciseId).toBe('tirage-nuque-maison')
    expect(state.catalog['tirage-nuque-maison'].name).toBe('Tirage nuque maison')
    expect(report.createdMovements).toContainEqual({ id: 'tirage-nuque-maison', name: 'Tirage nuque maison' })
  })

  it('respecte la nature assistée telle que l’utilisateur l’a réglée', () => {
    const { state } = migrateV1toV2(v1State())
    expect(state.catalog['assisted-dips'].assisted).toBe(true)
  })

  it('fait gagner le réglage de l’utilisateur sur la valeur du catalogue', () => {
    const v1 = v1State()
    v1.program[0].exercises[1].assisted = true // élévations latérales marquées assistées à la main
    const { state, report } = migrateV1toV2(v1)
    expect(state.catalog['lateral-raise'].assisted).toBe(true)
    expect(report.conflicts.some((c) => c.exerciseId === 'lateral-raise')).toBe(true)
  })

  it('refuse un état v1 sans programme au lieu d’inventer', () => {
    expect(() => migrateV1toV2({ version: 1 })).toThrow(MigrationError)
    expect(() => migrateV1toV2(null)).toThrow(MigrationError)
  })

  it('est idempotente sur le contenu : deux migrations donnent le même état', () => {
    const a = migrateV1toV2(v1State(), { now: new Date('2026-08-14T00:00:00.000Z') }).state
    const b = migrateV1toV2(v1State(), { now: new Date('2026-08-14T00:00:00.000Z') }).state
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('migration de la séance en cours', () => {
  it('renomme le champ vers instanceId sans perdre les séries', () => {
    const live = migrateLiveV1toV2(v1Live())
    expect(live.sessionId).toBe('push')
    expect(live.entries[0].instanceId).toBe('push-01-supine-press-machine')
    expect(live.entries[0].sets[0].reps).toBe(8)
  })

  it('rend null sur une séance illisible', () => {
    expect(migrateLiveV1toV2(null)).toBeNull()
    expect(migrateLiveV1toV2({ sessionId: 'push' })).toBeNull()
  })
})
