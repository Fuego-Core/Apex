/* LE SCANNER — ce qui doit rester vrai sans caméra.

   Le cœur testable du scanner est sa règle d'acceptation : il faut lire deux
   fois de suite le même code valide. Une lecture unique, une lecture qui change,
   une valeur qui n'a pas la forme d'un code-barres : rien de tout cela ne
   produit un résultat. C'est la garantie qu'il ne prétend jamais avoir détecté
   ce qu'il n'a pas détecté.

   Le reste — flux vidéo, permissions — n'est pas simulable ici honnêtement :
   il est vérifié dans Chromium (repli sans BarcodeDetector, et chaîne complète
   avec un détecteur injecté). */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { createDetectionGate, scannerSupport, FORMATS } from '../src/ui/scanner.js'

describe('règle d’acceptation d’une lecture', () => {
  it('ne retient rien sur une seule lecture', () => {
    const gate = createDetectionGate()
    expect(gate.push('3017620422003')).toBeNull()
  })

  it('retient un code lu deux fois de suite', () => {
    const gate = createDetectionGate()
    gate.push('3017620422003')
    expect(gate.push('3017620422003')).toBe('3017620422003')
  })

  it('ne retient rien quand les lectures se contredisent', () => {
    const gate = createDetectionGate()
    expect(gate.push('3017620422003')).toBeNull()
    expect(gate.push('5449000000996')).toBeNull()
    expect(gate.push('3017620422003')).toBeNull()
  })

  it('refuse ce qui n’a pas la forme d’un code-barres, même répété', () => {
    const gate = createDetectionGate()
    expect(gate.push('nutella')).toBeNull()
    expect(gate.push('nutella')).toBeNull()
    expect(gate.push('123')).toBeNull()
    expect(gate.push('')).toBeNull()
  })

  it('une lecture douteuse casse la série en cours', () => {
    const gate = createDetectionGate()
    gate.push('3017620422003')
    gate.push('!!!')
    expect(gate.push('3017620422003')).toBeNull()
    expect(gate.push('3017620422003')).toBe('3017620422003')
  })

  it('accepte un EAN-8 comme un EAN-13', () => {
    const gate = createDetectionGate()
    gate.push('20724696')
    expect(gate.push('20724696')).toBe('20724696')
  })

  it('laisse régler l’exigence, sans jamais descendre sous une confirmation', () => {
    const strict = createDetectionGate({ needed: 3 })
    strict.push('3017620422003')
    expect(strict.push('3017620422003')).toBeNull()
    expect(strict.push('3017620422003')).toBe('3017620422003')
  })

  it('rend compte de l’avancement sans l’exagérer', () => {
    const gate = createDetectionGate()
    gate.push('3017620422003')
    expect(gate.progress).toEqual({ code: '3017620422003', streak: 1, needed: 2 })
    gate.reset()
    expect(gate.progress.streak).toBe(0)
  })
})

describe('détection des capacités', () => {
  afterEach(() => vi.unstubAllGlobals())

  /** Un appareil imaginaire : ce que le navigateur expose, et rien de plus. */
  const device = ({ secure = true, formats = null, camera = true } = {}) => {
    const win = { isSecureContext: secure }
    if (formats) win.BarcodeDetector = { getSupportedFormats: async () => formats }
    vi.stubGlobal('window', win)
    vi.stubGlobal('navigator', camera ? { mediaDevices: { getUserMedia: () => {} } } : {})
    return win
  }
  const withWindow = (win) => {
    vi.stubGlobal('window', win)
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } })
  }

  it('refuse hors contexte sécurisé — la caméra n’y a pas sa place', async () => {
    withWindow({ isSecureContext: false })
    expect(await scannerSupport()).toMatchObject({ ok: false })
    expect((await scannerSupport()).reason).toMatch(/https/)
  })

  it('annonce clairement un navigateur sans BarcodeDetector', async () => {
    withWindow({ isSecureContext: true })
    const res = await scannerSupport()
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/ne sait pas lire/)
  })

  it('refuse si aucun format alimentaire n’est lisible', async () => {
    device({ formats: ['qr_code'] })
    const res = await scannerSupport()
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/format/)
  })

  it('accepte et ne garde que les formats alimentaires', async () => {
    device({ formats: ['qr_code', 'ean_13', 'ean_8'] })
    const res = await scannerSupport()
    expect(res.ok).toBe(true)
    expect(res.formats).toEqual(['ean_13', 'ean_8'])
    expect(FORMATS).toContain('upc_a')
  })

  it('ne prétend pas savoir lire quand l’interrogation échoue', async () => {
    vi.stubGlobal('window', {
      isSecureContext: true,
      BarcodeDetector: {
        getSupportedFormats: async () => {
          throw new Error('nope')
        }
      }
    })
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => {} } })
    expect((await scannerSupport()).ok).toBe(false)
  })

  it('refuse un appareil sans accès caméra', async () => {
    device({ formats: ['ean_13'], camera: false })
    const res = await scannerSupport()
    expect(res.ok).toBe(false)
    expect(res.reason).toMatch(/caméra/)
  })
})
