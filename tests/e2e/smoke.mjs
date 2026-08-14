/* PARCOURS RÉEL DANS CHROMIUM, sur le build de production.
   Ce que les tests unitaires ne peuvent pas prouver : la migration vue depuis
   un vrai localStorage, un tap qui suit une saisie, le hors-ligne, l'écran
   d'erreur, les polices auto-hébergées.

   Lancer :  npm run build && npm i --no-save playwright-core && node tests/e2e/smoke.mjs

   Volontairement hors de `npm test` : ce script a besoin d'un navigateur, la
   CI n'en a pas. Il reste la vérification manuelle de référence avant de
   publier une phase. */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('../../dist', import.meta.url).pathname
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json'
}

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0])
    if (p === '/') p = '/index.html'
    const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''))
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
})
await new Promise((r) => server.listen(4173, r))
const BASE = 'http://localhost:4173/'

const v1 = {
  version: 1,
  createdAt: '2026-06-01T08:00:00.000Z',
  program: [
    {
      id: 'push',
      name: 'Push',
      subtitle: 'Pectoraux · Épaules · Triceps',
      lastDoneAt: '2026-08-10T18:30:00.000Z',
      exercises: [
        { id: 'push-01-supine-press-machine', name: 'Supine Press machine', mode: 'reps', sets: 2, repMin: 6, repMax: 8, weight: 55, increment: 2.5, rest: 0, note: 'coudes serrés', assisted: false, pending: null },
        { id: 'push-04-elevations-laterales', name: 'Élévations latérales', mode: 'reps', sets: 1, repMin: 12, repMax: 15, weight: 10, increment: 2.5, rest: 0, note: '', assisted: false, pending: null }
      ]
    },
    {
      id: 'upper',
      name: 'Upper',
      subtitle: 'Haut du corps complet',
      lastDoneAt: null,
      exercises: [
        { id: 'upper-02-elevations-laterales', name: 'Élévations latérales', mode: 'reps', sets: 1, repMin: 12, repMax: 15, weight: 9, increment: 2.5, rest: 0, note: '', assisted: false, pending: null }
      ]
    }
  ],
  history: [
    {
      id: 'h_1', sessionId: 'upper', sessionName: 'Upper',
      startedAt: '2026-08-12T18:00:00.000Z', endedAt: '2026-08-12T19:00:00.000Z',
      durationSec: 3600, tonnage: 500,
      entries: [{
        exerciseId: 'upper-02-elevations-laterales', name: 'Élévations latérales', mode: 'reps',
        assisted: false, repMin: 12, repMax: 15, status: 'construire', weightUsed: 9, suggested: 9, record: false,
        sets: [{ warmup: false, done: true, reps: 13, weight: 9, seconds: null }]
      }]
    }
  ],
  settings: { sound: false, vibration: true }
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()

const errors = []
// Le test de données corrompues provoque volontairement une erreur : on ne la
// compte pas comme une anomalie, mais tout le reste doit rester silencieux.
let expectingErrors = false
page.on('pageerror', (e) => !expectingErrors && errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && !expectingErrors && errors.push(`console: ${m.text()}`))

/** Capture d'écran seulement si on a demandé un dossier de sortie. */
const shot = (name) =>
  process.env.APEX_SHOTS ? page.screenshot({ path: `${process.env.APEX_SHOTS}/${name}.png` }) : Promise.resolve()

const checks = []
const check = (name, ok, extra = '') => {
  checks.push({ name, ok, extra })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${extra ? ` — ${extra}` : ''}`)
}

// État v1 déposé avant tout chargement de l'app.
await page.addInitScript((state) => {
  if (!localStorage.getItem('apex.v1')) localStorage.setItem('apex.v1', JSON.stringify(state))
}, v1)

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.session-card', { timeout: 5000 })

/* --- migration --- */
const keys = await page.evaluate(() => Object.keys(localStorage).sort())
check('apex.v1 conservé', keys.includes('apex.v1'))
check('apex.v2 créé', keys.includes('apex.v2'))
check('sauvegarde automatique écrite', keys.includes('apex.backup.v1'))
const v1After = await page.evaluate(() => localStorage.getItem('apex.v1'))
check('apex.v1 octet pour octet identique', v1After === JSON.stringify(v1))
const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.v2')))
check('poids utilisateur conservé (55 kg)', migrated.program[0].exercises[0].weight === 55)
check('note utilisateur conservée', migrated.program[0].exercises[0].note === 'coudes serrés')
check('historique conservé', migrated.history.length === 1)
check(
  'même mouvement dans Push et Upper',
  migrated.program[0].exercises[1].exerciseId === 'lateral-raise' &&
    migrated.program[1].exercises[0].exerciseId === 'lateral-raise',
  migrated.program[0].exercises[1].exerciseId
)

/* --- polices auto-hébergées --- */
const fonts = await page.evaluate(async () => {
  await document.fonts.ready
  return {
    grotesk: document.fonts.check('700 30px "Space Grotesk"'),
    inter: document.fonts.check('400 16px Inter'),
    external: performance.getEntriesByType('resource').filter((r) => !r.name.startsWith(location.origin)).map((r) => r.name)
  }
})
check('Space Grotesk chargée localement', fonts.grotesk)
check('Inter chargée localement', fonts.inter)
check('aucune requête externe', fonts.external.length === 0, fonts.external.join(', '))

/* --- séance : le correctif B2 --- */
await page.click('.session-card:has-text("Push")')
await page.waitForSelector('[data-act="start"]')
await page.click('[data-act="start"]')
await page.waitForSelector('.exo')

const firstReps = page.locator('.set').first().locator('[data-input="reps"]')
await firstReps.fill('7')
// Sans blur intermédiaire : on tape directement sur ✓, comme en pleine série.
await page.locator('.set').first().locator('.set__ok').click()
const validated = await page.locator('.set').first().evaluate((el) => el.classList.contains('is-done'))
check('B2 — le tap suivant une saisie valide bien la série', validated)
const repsStored = await page.evaluate(
  () => JSON.parse(localStorage.getItem('apex.live.v2')).entries[0].sets[0].reps
)
check('reps saisies enregistrées', repsStored === 7, `reps=${repsStored}`)

/* --- B4 : les échauffements hors compteur --- */
const labelBefore = await page.locator('[data-progress-label]').textContent()
await page.locator('.exo').first().locator('[data-act="add-warmup"]').click()
const labelAfter = await page.locator('[data-progress-label]').textContent()
check('B4 — un échauffement ne gonfle pas le compteur', labelBefore === labelAfter, `${labelBefore} -> ${labelAfter}`)

/* --- fin de séance --- */
// Chaque validation reconstruit la carte : on revalide toujours la première
// série restante plutôt que de garder des locators périmés.
for (let guard = 0; guard < 30; guard++) {
  const remaining = page.locator('.set:not(.is-done)')
  if ((await remaining.count()) === 0) break
  await remaining.first().locator('.set__ok').click()
  await page.waitForTimeout(50)
}
await page.click('[data-act="finish"]')
await page.waitForSelector('[data-act="archive"]')
check('résumé affiché', (await page.locator('.result').count()) > 0)
await page.click('[data-act="archive"]')
await page.waitForSelector('.session-card')

const after = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.v2')))
check('séance archivée', after.history.length === 2)
check('archive rattachée au mouvement', after.history[0].entries.every((e) => !!e.exerciseId && !e.exerciseId.startsWith('push-')))

/* --- pense-bête laissé par le moteur --- */
await page.goto(`${BASE}#/seance/push`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-act="start"]')
const hasPrep = (await page.locator('.suggest').count()) > 0 || (await page.locator('.soft').count()) > 0
check('pense-bête alimenté par le moteur', hasPrep)

/* --- historique partagé entre séances --- */
await page.goto(`${BASE}#/historique`, { waitUntil: 'networkidle' })
await page.waitForSelector('.xrow')
const rows = await page.locator('.xrow__name').allTextContents()
const lateral = rows.filter((t) => t.includes('Élévations latérales'))
check('un seul exercice « Élévations latérales » pour Push + Upper', lateral.length === 1, rows.join(' | '))
await page.locator('.xrow', { hasText: 'Élévations latérales' }).click()
await page.waitForSelector('.hlist')
const timeline = await page.locator('.hrow').count()
check('timeline commune aux deux séances', timeline >= 2, `${timeline} entrées`)

/* --- hors ligne --- */
// Le service worker doit avoir pris la main avant de couper le réseau,
// sinon on testerait juste le cache HTTP du navigateur.
await page.evaluate(() => navigator.serviceWorker.ready)
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
check('service worker aux commandes', controlled)
await ctx.setOffline(true)
await page.goto(BASE, { waitUntil: 'load' })
await page.waitForSelector('.session-card', { timeout: 8000 })
const offlineCards = await page.locator('.session-card').count()
check('démarrage hors ligne', offlineCards === v1.program.length, `${offlineCards} séances`)
await ctx.setOffline(false)

/* --- écran d'erreur si les données sont corrompues --- */
expectingErrors = true
await page.evaluate(() => localStorage.setItem('apex.v2', '{cassé'))
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.fatal', { timeout: 5000 })
check('écran d’erreur clair sur données corrompues', await page.locator('.fatal__title').isVisible())
check('sortie de secours proposée', await page.locator('[data-act="export"]').isVisible())

await shot('fatal')
await page.evaluate(() => localStorage.removeItem('apex.v2'))
expectingErrors = false
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.session-card')
await shot('home')
await page.goto(`${BASE}#/seance/push/workout`, { waitUntil: 'networkidle' }).catch(() => {})
await shot('second')

console.log(`\nerreurs console : ${errors.length}`)
errors.slice(0, 8).forEach((e) => console.log('  ' + e))
const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} vérifications passées`)

await browser.close()
server.close()
process.exit(failed.length || errors.length ? 1 : 0)
