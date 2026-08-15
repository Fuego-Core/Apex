/* JAUGE DE STOCKAGE — prévenir avant, pas constater après.

   Ce qui est protégé ici : le seuil d'alerte arrive largement avant la limite,
   la mesure porte sur ce qui compte vraiment (localStorage, où vivent toutes
   les données), et un stockage illisible ne se transforme pas en « 0 % ». */

import { describe, it, expect } from 'vitest'
import {
  measureLocal,
  levelFor,
  formatBytes,
  labelFor,
  storageAdvice,
  LOCAL_LIMIT,
  WARN_AT,
  CRITICAL_AT
} from '../src/data/storageInfo.js'
import { MemoryStorage } from './helpers/storage.js'

const fill = (storage, key, chars) => storage.setItem(key, 'x'.repeat(chars))

describe('mesure', () => {
  it('ne compte que les données APEX', () => {
    const storage = new MemoryStorage()
    fill(storage, 'apex.v4', 1000)
    fill(storage, 'autre-app', 100000)
    const local = measureLocal(storage)
    expect(local.byKey).toHaveLength(1)
    expect(local.total).toBe((1000 + 'apex.v4'.length) * 2)
  })

  it('compte en UTF-16, comme le navigateur', () => {
    const storage = new MemoryStorage()
    fill(storage, 'apex.v4', 10)
    expect(measureLocal(storage).total).toBe((10 + 7) * 2)
  })

  it('classe les clés de la plus lourde à la plus légère', () => {
    const storage = new MemoryStorage()
    fill(storage, 'apex.v4', 5000)
    fill(storage, 'apex.backup.v1', 20000)
    fill(storage, 'apex.live.v4', 100)
    expect(measureLocal(storage).byKey.map((k) => k.key)).toEqual(['apex.backup.v1', 'apex.v4', 'apex.live.v4'])
  })

  it('nomme les clés en français plutôt qu’en jargon', () => {
    expect(labelFor('apex.backup.v1')).toBe('Sauvegarde v1')
    expect(labelFor('apex.live.v4')).toBe('Séance en cours')
    expect(labelFor('apex.v4')).toBe('Données APEX (v4)')
    // Un horodatage n'est pas une sauvegarde : il pèse 80 octets, pas 3 ko.
    expect(labelFor('apex.backup.v1.at')).toBe('Horodatage')
  })

  it('n’invente pas une mesure quand le stockage est inaccessible', () => {
    const broken = {
      getItem() {
        throw new Error('SecurityError')
      }
    }
    Object.defineProperty(broken, 'apex.v4', { enumerable: true, get: () => '' })
    const local = measureLocal(broken)
    expect(local.total).toBeNull()
    expect(local.ratio).toBeNull()
    expect(local.level).toBe('unknown')
  })

  it('rend un rapport vide sans rien casser', () => {
    const local = measureLocal(new MemoryStorage())
    expect(local.total).toBe(0)
    expect(local.level).toBe('ok')
  })
})

describe('seuils', () => {
  it('prévient bien avant la limite', () => {
    expect(WARN_AT).toBeLessThan(CRITICAL_AT)
    expect(CRITICAL_AT).toBeLessThan(1)
    expect(levelFor(0.5)).toBe('ok')
    expect(levelFor(0.7)).toBe('warn')
    expect(levelFor(0.85)).toBe('critical')
    expect(levelFor(0.99)).toBe('critical')
  })

  it('ne conclut rien sans mesure', () => {
    expect(levelFor(null)).toBe('unknown')
  })

  it('déclenche l’alerte sur un stockage réellement rempli', () => {
    const storage = new MemoryStorage()
    // 90 % du budget, en caractères UTF-16.
    fill(storage, 'apex.v4', Math.round((LOCAL_LIMIT * 0.9) / 2))
    const local = measureLocal(storage)
    expect(local.level).toBe('critical')
    expect(storageAdvice(local).tone).toBe('danger')
    expect(storageAdvice(local).text).toMatch(/Exporte/)
  })

  it('conseille sans affoler à mi-chemin de l’alerte', () => {
    const storage = new MemoryStorage()
    fill(storage, 'apex.v4', Math.round((LOCAL_LIMIT * 0.75) / 2))
    const advice = storageAdvice(measureLocal(storage))
    expect(advice.tone).toBe('warn')
    expect(advice.text).toMatch(/exporter/)
  })

  it('se tait quand tout va bien', () => {
    expect(storageAdvice(measureLocal(new MemoryStorage()))).toBeNull()
  })
})

describe('affichage', () => {
  it('donne des tailles lisibles', () => {
    expect(formatBytes(512)).toBe('512 o')
    expect(formatBytes(2048)).toBe('2 ko')
    expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 Mo')
    expect(formatBytes(null)).toBe('—')
  })
})
