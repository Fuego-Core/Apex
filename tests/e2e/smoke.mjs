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
await page.waitForSelector('.today', { timeout: 5000 })

/* --- migration --- */
const keys = await page.evaluate(() => Object.keys(localStorage).sort())
check('apex.v1 conservé', keys.includes('apex.v1'))
check('état courant créé (apex.v3)', keys.includes('apex.v3'))
check('sauvegarde automatique écrite', keys.includes('apex.backup.v1'))
const v1After = await page.evaluate(() => localStorage.getItem('apex.v1'))
check('apex.v1 octet pour octet identique', v1After === JSON.stringify(v1))
const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.v3')))
check('sections Phase 1 ajoutées vides', migrated.body.weight.length === 0 && migrated.goals.length === 0)
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

/* --- tableau de bord --- */
check('carte du jour affichée', await page.locator('.today__name').isVisible())
check(
  'la séance jamais faite passe en premier',
  (await page.locator('.today__name').textContent()).trim().toUpperCase() === 'UPPER',
  (await page.locator('.today__name').textContent()).trim()
)
check('bouton de démarrage présent', await page.locator('.today .btn--gold').isVisible())
check('état vide du corps proposé', await page.locator('[data-act="add-weight"]').isVisible())
check('état vide des objectifs proposé', await page.locator('[data-act="add-goal"]').isVisible())

/* --- séance : le correctif B2 --- */
await page.goto(`${BASE}#/seances`, { waitUntil: 'networkidle' })
await page.waitForSelector('.session-card')
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
  () => JSON.parse(localStorage.getItem('apex.live.v3')).entries[0].sets[0].reps
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
await page.waitForSelector('.today')

const after = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.v3')))
check('séance archivée', after.history.length === 2)
check('archive rattachée au mouvement', after.history[0].entries.every((e) => !!e.exerciseId && !e.exerciseId.startsWith('push-')))

/* --- corps : saisie, validation, moyenne, tendance --- */
await page.goto(`${BASE}#/corps`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-act="add"]')
check('état vide du suivi corporel', await page.locator('.blank__title').isVisible())

await page.locator('.sticky-actions [data-act="add"]').click()
await page.waitForSelector('.sheet')
await page.fill('[name="value"]', '900')
await page.locator('.sheet [type="submit"]').click()
const fieldError = await page.locator('[data-error-for="value"]').textContent()
check('saisie absurde refusée avec un message clair', /faute de frappe/.test(fieldError), fieldError.trim())

const days = ['2026-08-06', '2026-08-09', '2026-08-12', '2026-08-15']
const weights = ['80,4', '80', '79,6', '79,2']
await page.fill('[name="value"]', weights[0])
await page.fill('[name="date"]', days[0])
await page.locator('.sheet [type="submit"]').click()
await page.waitForSelector('.sheet', { state: 'detached' })

// Une seule pesée : APEX doit refuser de parler de tendance.
const soloText = (await page.locator('.note').allTextContents()).join(' ')
check('aucune tendance annoncée sur une seule pesée', /Pas encore de tendance/.test(soloText), soloText.trim().slice(0, 70))

for (let i = 1; i < days.length; i++) {
  await page.locator('.sticky-actions [data-act="add"]').click()
  await page.waitForSelector('.sheet')
  await page.fill('[name="value"]', weights[i])
  await page.fill('[name="date"]', days[i])
  await page.locator('.sheet [type="submit"]').click()
  await page.waitForSelector('.sheet', { state: 'detached' })
}

const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.v3')).body.weight)
check('4 pesées enregistrées, une par jour', stored.length === 4, `${stored.length} entrées`)
// Moyenne 7 jours au 15/08 : les pesées des 09, 12 et 15 -> (80 + 79,6 + 79,2) / 3.
const avgShown = (await page.locator('.tile__value').first().textContent()).trim()
check('moyenne 7 jours affichée', avgShown.startsWith('79,6'), avgShown)
check('courbe tracée', (await page.locator('.plot').count()) === 1)
const trendText = await page.locator('.note').first().textContent()
check('tendance annoncée sur la fenêtre réelle', /en baisse/.test(trendText), trendText.trim().slice(0, 80))

// Une pesée du même jour remplace la précédente au lieu de s'empiler.
await page.locator('.sticky-actions [data-act="add"]').click()
await page.waitForSelector('.sheet')
await page.fill('[name="value"]', '79')
await page.fill('[name="date"]', '2026-08-15')
await page.locator('.sheet [type="submit"]').click()
await page.waitForSelector('.sheet', { state: 'detached' })
const afterUpsert = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.v3')).body.weight)
check('une seule mesure par jour', afterUpsert.length === 4 && afterUpsert.at(-1).value === 79)

/* --- objectifs --- */
await page.goto(`${BASE}#/objectifs`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-act="add"]')
await page.locator('.sticky-actions [data-act="add"]').click()
await page.waitForSelector('.sheet')
await page.fill('[name="title"]', 'Descendre à 75 kg')
await page.fill('[name="target"]', '75')
await page.locator('.sheet [type="submit"]').click()
await page.waitForSelector('.sheet', { state: 'detached' })
check('objectif créé', (await page.locator('.goal-card').count()) === 1)
const goalStored = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.v3')).goals[0])
check('point de départ capturé depuis les données réelles', goalStored.start !== null, `start=${goalStored.start}`)
check('avancement calculé', (await page.locator('.meter__fill').first().getAttribute('style')).includes('width'))

/* --- profil --- */
await page.goto(`${BASE}#/profil`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-act="edit"]')
await page.locator('.sticky-actions [data-act="edit"]').click()
await page.waitForSelector('.sheet')
await page.fill('[name="height"]', '300')
await page.locator('.sheet [type="submit"]').click()
check('taille aberrante refusée', await page.locator('[data-error-for="height"]').isVisible())
await page.fill('[name="height"]', '178')
await page.selectOption('[name="goal"]', 'seche')
await page.locator('.sheet [type="submit"]').click()
await page.waitForSelector('.sheet', { state: 'detached' })
const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.v3')).profile)
check('profil enregistré', profile.height === 178 && profile.goal === 'seche')

/* --- le tableau de bord reflète les nouvelles données --- */
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.today')
check('poids remonté au tableau de bord', (await page.locator('.tile__value').first().textContent()).includes('79'))
check('objectif remonté au tableau de bord', (await page.locator('.goal').count()) >= 1)
check('sparkline affichée', (await page.locator('.spark').count()) === 1)

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

/* --- export / import --- */
await page.goto(`${BASE}#/reglages`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-act="export"]')

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('[data-act="export"]').click()
])
const exported = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'))
check('export : fichier téléchargé et lisible', exported.version === 3, `version ${exported.version}`)
check(
  'export : contient programme, historique, mesures et objectifs',
  Array.isArray(exported.program) && Array.isArray(exported.history) && !!exported.body && Array.isArray(exported.goals)
)
check('export : sauvegarde v1 conservée et proposée', await page.locator('[data-act="export-v1"]').isVisible())

// Réimport d'un état modifié : le poids passe à 70 kg, l'app doit le refléter.
const patched = JSON.stringify({ ...exported, body: { ...exported.body, weight: [{ date: '2026-08-15', value: 70 }] } })
await page.locator('.details summary').click()
await page.fill('[data-paste]', patched)
await page.locator('[data-act="import-paste"]').click()
await page.waitForSelector('.today', { timeout: 5000 })
const reimported = await page.evaluate(() => JSON.parse(localStorage.getItem('apex.v3')).body.weight)
check('import : les données remplacent bien l’état courant', reimported.length === 1 && reimported[0].value === 70)
check('import : le tableau de bord affiche la donnée importée', (await page.locator('.tile__value').first().textContent()).includes('70'))

await page.goto(`${BASE}#/reglages`, { waitUntil: 'networkidle' })
await page.locator('.details summary').click()
await page.fill('[data-paste]', '{"version":3,"program":"pas un tableau"}')
await page.locator('[data-act="import-paste"]').click()
await page.waitForSelector('.toast')
const importError = await page.locator('.toast').last().textContent()
check('import : un fichier invalide est refusé avec un motif', /Import impossible/.test(importError), importError.trim().slice(0, 60))

/* --- hors ligne --- */
// Le service worker doit avoir pris la main avant de couper le réseau,
// sinon on testerait juste le cache HTTP du navigateur.
await page.evaluate(() => navigator.serviceWorker.ready)
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller)
check('service worker aux commandes', controlled)
await ctx.setOffline(true)
await page.goto(BASE, { waitUntil: 'load' })
await page.waitForSelector('.today', { timeout: 8000 })
check('démarrage hors ligne', await page.locator('.today__name').isVisible())
await ctx.setOffline(false)

/* --- écran d'erreur si les données sont corrompues --- */
expectingErrors = true
await page.evaluate(() => localStorage.setItem('apex.v3', '{cassé'))
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.fatal', { timeout: 5000 })
check('écran d’erreur clair sur données corrompues', await page.locator('.fatal__title').isVisible())
check('sortie de secours proposée', await page.locator('[data-act="export"]').isVisible())

await shot('fatal')
await page.evaluate(() => localStorage.removeItem('apex.v3'))
expectingErrors = false
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.today')
await shot('home')
await page.goto(`${BASE}#/corps`, { waitUntil: 'networkidle' }).catch(() => {})
await shot('corps')
await page.goto(`${BASE}#/objectifs`, { waitUntil: 'networkidle' }).catch(() => {})
await shot('objectifs')

console.log(`\nerreurs console : ${errors.length}`)
errors.slice(0, 8).forEach((e) => console.log('  ' + e))
const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} vérifications passées`)

await browser.close()
server.close()
process.exit(failed.length || errors.length ? 1 : 0)
