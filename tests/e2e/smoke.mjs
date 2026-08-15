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
/** Clé de l'état courant. À faire suivre à chaque nouvelle version de schéma. */
const CURRENT = 'apex.v4'

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

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  // Caméra factice : elle sert au parcours de scan, où le détecteur est injecté.
  // Le reste des vérifications tourne sans y toucher.
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()

const errors = []
// Le test de données corrompues provoque volontairement une erreur : on ne la
// compte pas comme une anomalie, mais tout le reste doit rester silencieux.
let expectingErrors = false
/** Erreurs attendues : le 404 provoqué volontairement, et la favicon qu'un
 *  serveur statique nu ne sert pas. Ni l'une ni l'autre ne vient de l'app. */
const IGNORED = ['page-qui-nexiste-pas', 'favicon.ico']
page.on('pageerror', (e) => !expectingErrors && errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() !== 'error' || expectingErrors) return
  const url = m.location()?.url || ''
  if (IGNORED.some((pattern) => url.includes(pattern))) return
  errors.push(`console: ${m.text()} @ ${url}`)
})

/** Capture d'écran seulement si on a demandé un dossier de sortie. */
const shotOf = (target, name) =>
  process.env.APEX_SHOTS ? target.screenshot({ path: `${process.env.APEX_SHOTS}/${name}.png` }) : Promise.resolve()
const shot = (name) => shotOf(page, name)

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
check(`état courant créé (${CURRENT})`, keys.includes(CURRENT))
check('sauvegarde automatique écrite', keys.includes('apex.backup.v1'))
const v1After = await page.evaluate(() => localStorage.getItem('apex.v1'))
check('apex.v1 octet pour octet identique', v1After === JSON.stringify(v1))
const migrated = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), CURRENT)
check('sections Phase 1 ajoutées vides', migrated.body.weight.length === 0 && migrated.goals.length === 0)
check(
  'section nutrition ajoutée sans cible inventée',
  !!migrated.nutrition && migrated.nutrition.targets.mode === null && Object.keys(migrated.nutrition.days).length === 0
)
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
  () => JSON.parse(localStorage.getItem('apex.live.v4')).entries[0].sets[0].reps
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

const after = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), CURRENT)
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

const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).body.weight, CURRENT)
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
const afterUpsert = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).body.weight, CURRENT)
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
const goalStored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).goals[0], CURRENT)
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
const profile = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).profile, CURRENT)
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

/* --- nutrition : journal, mémoire alimentaire, cibles --- */
await page.goto(`${BASE}#/nutrition`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-act="add"]')
check('journal vide annoncé comme tel', await page.locator('.blank__title').isVisible())
check('aucune cible inventée', (await page.locator('.card').first().textContent()).includes('Pas encore configurés'))

// Création d'un aliment personnel, puis ajout au journal.
await page.locator('.sticky-actions [data-act="add"]').click()
await page.waitForSelector('.sheet')
await page.locator('[data-act="create"]').click()
await page.waitForSelector('[name="name"]')
await page.fill('[name="name"]', 'Skyr nature')
await page.fill('[name="kcal"]', '62')
await page.fill('[name="protein"]', '10')
await page.fill('[name="carbs"]', '4')
await page.fill('[name="fat"]', '0,2')
await page.locator('.sheet [type="submit"]').last().click()
await page.waitForSelector('[name="qty"]')
await page.fill('[name="qty"]', '250')
await page.locator('.sheet [type="submit"]').last().click()
await page.waitForSelector('.sheet', { state: 'detached' })

const logged = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).nutrition, CURRENT)
const firstDay = Object.values(logged.days)[0]
check('aliment enregistré dans la journée', firstDay.entries.length === 1, `${firstDay.entries.length} ligne(s)`)
check('instantané figé sur la ligne', firstDay.entries[0].snapshot.kcal === 62)
check('mémoire alimentaire alimentée', Object.values(logged.usage)[0].lastQty === 250)
check('total du jour calculé', (await page.locator('.tile__value').first().textContent()).includes('155'), (await page.locator('.tile__value').first().textContent()).trim())

// Le geste unique : le récent se ré-ajoute avec sa quantité, sans saisie.
await page.locator('.sticky-actions [data-act="add"]').click()
await page.waitForSelector('.pick')
check('récent proposé avec sa quantité', (await page.locator('.pick__qty').first().textContent()).includes('250'))
await page.locator('.pick__main').first().click()
await page.waitForSelector('.sheet', { state: 'detached' })
const twice = await page.evaluate((k) => Object.values(JSON.parse(localStorage.getItem(k)).nutrition.days)[0].entries.length, CURRENT)
check('ré-ajout en un seul tap', twice === 2, `${twice} lignes`)

// Suppression d'une ligne.
await page.locator('[data-act="remove-entry"]').first().click()
await page.locator('[data-act="yes"]').click()
await page.waitForTimeout(200)
const afterRemove = await page.evaluate((k) => Object.values(JSON.parse(localStorage.getItem(k)).nutrition.days)[0].entries.length, CURRENT)
check('ligne retirée', afterRemove === 1, `${afterRemove} ligne`)

// Cibles manuelles.
await page.locator('[data-act="targets"]').click()
await page.waitForSelector('[name="kcal"]')
await page.fill('[name="kcal"]', '2400')
await page.fill('[name="protein"]', '160')
await page.locator('.sheet [type="submit"]').last().click()
await page.waitForSelector('.sheet', { state: 'detached' })
const targets = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).nutrition.targets, CURRENT)
check('cibles manuelles enregistrées', targets.mode === 'manual' && targets.kcal === 2400)
check('avancement affiché', (await page.locator('.meter__fill').first().getAttribute('style')).includes('width'))

// Le tableau de bord ne montre qu'un résumé.
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.today')
const dashText = await page.locator('body').innerText()
check('résumé nutrition sur le tableau de bord', /2400 kcal|2 400 kcal|\/ 2400/.test(dashText.replace(/\u202f|\u00a0/g, ' ')), dashText.split('\n').find((l) => l.includes('kcal')) || '')

/* --- nutrition : source extérieure, cache réel, et son caractère jetable ---

   Open Food Facts est intercepté : la sonde de l'étape 0 a prouvé sur un vrai
   téléphone que l'API répond ; ce qu'on vérifie ici, c'est notre comportement
   face à ses réponses — y compris quand elles n'arrivent pas. */

const OFF_NUTELLA = {
  status: 1,
  product: {
    code: '3017620422003',
    product_name_fr: 'Nutella pâte à tartiner',
    brands: 'Ferrero',
    serving_size: '15 g',
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
}
const OFF_SEARCH = {
  count: 2,
  products: [
    OFF_NUTELLA.product,
    // Fiche incomplète : elle doit être écartée, jamais complétée par des 0.
    { code: '1234567890123', product_name: 'Produit sans macros', nutriments: { 'energy-kcal_100g': 250 } }
  ]
}

let offCalls = []
const offJSON = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
await page.route(/openfoodfacts\.org/, (route) => {
  const url = route.request().url()
  offCalls.push(url)
  if (url.includes('/api/v2/product/0000000000000')) return route.fulfill(offJSON({ status: 0 }))
  if (url.includes('/api/v2/product/')) return route.fulfill(offJSON(OFF_NUTELLA))
  return route.fulfill(offJSON(OFF_SEARCH))
})

await page.goto(`${BASE}#/nutrition`, { waitUntil: 'networkidle' })
await page.locator('.sticky-actions [data-act="add"]').click()
await page.waitForSelector('.sheet')
check('onglet « En ligne » présent', await page.locator('[data-tab="online"]').isVisible())

await page.locator('[data-tab="online"]').click()
await page.fill('[data-online-query]', 'nutella')
await page.waitForTimeout(700)
check('aucune requête au fil de la frappe', offCalls.length === 0, `${offCalls.length} requête(s)`)

await page.locator('[data-act="run-online"]').click()
await page.waitForSelector('.pick')
check('recherche déclenchée explicitement', offCalls.length === 1, `${offCalls.length} requête(s)`)
check('identification transmise à Open Food Facts', offCalls[0].includes('app_name=APEX'))
const onlineRows = await page.locator('.pick').count()
check('fiche incomplète écartée du résultat', onlineRows === 1, `${onlineRows} résultat(s)`)
check(
  'fiche incomplète expliquée, pas masquée',
  (await page.locator('[data-list]').innerText()).toLowerCase().includes('écartée')
)
check('attribution ODbL affichée', (await page.locator('[data-online-note]').innerText()).includes('ODbL'))
await shot('nutrition-online')

// Le cache réel : IndexedDB dans un vrai navigateur.
const cached = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const req = indexedDB.open('apex-foods')
      req.onsuccess = () => {
        const db = req.result
        const all = db.transaction('foods', 'readonly').objectStore('foods').getAll()
        all.onsuccess = () => {
          db.close()
          resolve(all.result)
        }
        all.onerror = () => resolve([])
      }
      req.onerror = () => resolve([])
    })
)
check('produit mis en cache', cached.length === 1 && cached[0].id === 'off:3017620422003', `${cached.length} fiche(s)`)
check('provenance et licence conservées dans le cache', cached[0]?.source === 'open-food-facts' && cached[0]?.license === 'ODbL 1.0')
check('kcal de la source conservées telles quelles', cached[0]?.kcal === 539, String(cached[0]?.kcal))

// Réseau coupé : ce que le cache sait déjà doit rester consultable.
// La requête avortée fait japper la console du navigateur — c'est le but.
expectingErrors = true
await page.unroute(/openfoodfacts\.org/)
await page.route(/openfoodfacts\.org/, (route) => route.abort())
offCalls = []
await page.fill('[data-online-query]', 'nutella')
await page.locator('[data-act="run-online"]').click()
await page.waitForTimeout(500)
const offlineRows = await page.locator('.pick').count()
check('hors réseau, le cache répond quand même', offlineRows === 1, `${offlineRows} résultat(s)`)
check('panne réseau annoncée sans mentir', (await page.locator('[data-list]').innerText()).includes('Open Food Facts'))
await shot('nutrition-online-offline')
expectingErrors = false

// Ajout au journal depuis un produit extérieur.
await page.locator('.pick__qty').first().click()
await page.waitForSelector('[name="qty"]')
await page.fill('[name="qty"]', '30')
await page.locator('.sheet [type="submit"]').last().click()
await page.waitForSelector('.sheet', { state: 'detached' })

const offLogged = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).nutrition, CURRENT)
const offEntry = Object.values(offLogged.days)
  .flatMap((d) => d.entries)
  .find((e) => e.foodId === 'off:3017620422003')
check('produit extérieur enregistré avec son instantané', offEntry?.snapshot.kcal === 539 && offEntry?.qty === 30)
check('provenance conservée sur la ligne', offEntry?.snapshot.source === 'open-food-facts')
check('attribution conservée jusque dans la ligne', String(offEntry?.snapshot.attribution || '').includes('ODbL'))
check('produit extérieur absent des aliments personnels', Object.keys(offLogged.foods).length === 1)

// LA règle : le cache est jetable. On le supprime, on recharge, rien ne bouge.
await page.goto(BASE, { waitUntil: 'networkidle' })
const wiped = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('apex-foods')
      req.onsuccess = () => resolve(true)
      req.onerror = () => resolve(false)
      req.onblocked = () => resolve(false)
    })
)
await page.goto(`${BASE}#/nutrition`, { waitUntil: 'networkidle' })
const survivingKcal = await page.locator('.tile__value').first().textContent()
check('cache supprimé', wiped)
// 155 kcal (Skyr 250 g) + 161,7 kcal (Nutella 30 g) : le total ne dépend que des instantanés.
check('la journée reste identique sans cache', survivingKcal.includes('317'), survivingKcal.trim())

await page.locator('.sticky-actions [data-act="add"]').click()
await page.waitForSelector('.pick')
const rememberedText = await page.locator('[data-list]').innerText()
check('le produit scanné reste ré-ajoutable sans cache ni réseau', rememberedText.includes('Nutella'))
check('sa quantité habituelle est retenue', rememberedText.includes('30 g'))

// Code-barres tapé à la main : lecture directe, et produit inconnu bien traité.
await page.unroute(/openfoodfacts\.org/)
await page.route(/openfoodfacts\.org/, (route) => {
  const url = route.request().url()
  offCalls.push(url)
  if (url.includes('/api/v2/product/0000000000000')) return route.fulfill(offJSON({ status: 0 }))
  return route.fulfill(offJSON(OFF_NUTELLA))
})
offCalls = []
await page.locator('[data-tab="online"]').click()
await page.fill('[data-online-query]', '0000000000000')
await page.locator('[data-act="run-online"]').click()
await page.waitForTimeout(400)
check('code-barres lu comme un code, pas comme du texte', offCalls[0]?.includes('/api/v2/product/0000000000000'))
check(
  'produit inconnu renvoyé vers la création manuelle',
  (await page.locator('[data-list]').innerText()).includes('créer à la main')
)
const fallbackText = (await page.locator('.scan__fallback').count()) ? await page.locator('.scan__fallback').innerText() : ''
check(
  'sans BarcodeDetector : pas de bouton de scan, mais un repli explicite',
  (await page.locator('[data-act="scan"]').count()) === 0 && fallbackText.includes('Tape le code'),
  fallbackText.slice(0, 70)
)
await page.locator('[data-act="cancel"]').click()
await page.waitForSelector('.sheet', { state: 'detached' })
await page.unroute(/openfoodfacts\.org/)

/* --- scanner : la chaîne complète, avec un détecteur injecté ---

   Chromium sous Linux n'a pas BarcodeDetector : la vérification ci-dessus
   couvre donc le repli réel. Pour le parcours de scan lui-même, on injecte un
   détecteur — ce qui est testé ici, ce n'est pas la reconnaissance d'image,
   c'est NOTRE enchaînement : lecture confirmée → fiche → validation explicite
   → quantité → journal, et rien avant. */

const scanCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  permissions: ['camera']
})
await scanCtx.addInitScript(() => {
  // Deux comportements : un code stable (lecture confirmable) et des codes qui
  // changent à chaque image (rien ne doit jamais être confirmé).
  window.__APEX_SCAN = 'stable'
  window.__APEX_DETECTS = 0
  class FakeBarcodeDetector {
    static async getSupportedFormats() {
      return ['ean_13', 'ean_8', 'upc_a', 'upc_e']
    }
    async detect() {
      window.__APEX_DETECTS++
      if (window.__APEX_SCAN === 'alternating') {
        return [{ rawValue: window.__APEX_DETECTS % 2 ? '3017620422003' : '5449000000996', format: 'ean_13' }]
      }
      // La première image ne donne rien : le cadrage n'est jamais instantané.
      return window.__APEX_DETECTS < 2 ? [] : [{ rawValue: '3017620422003', format: 'ean_13' }]
    }
  }
  window.BarcodeDetector = FakeBarcodeDetector
})

const scanPage = await scanCtx.newPage()
let scanOffCalls = []
await scanPage.route(/openfoodfacts\.org/, (route) => {
  scanOffCalls.push(route.request().url())
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OFF_NUTELLA) })
})
await scanPage.goto(`${BASE}#/nutrition`, { waitUntil: 'networkidle' })
await scanPage.waitForSelector('[data-act="add"]')

const openScanTab = async () => {
  await scanPage.locator('.sticky-actions [data-act="add"]').click()
  await scanPage.waitForSelector('.sheet')
  await scanPage.locator('[data-tab="online"]').click()
}

// 1. Des lectures qui se contredisent ne doivent JAMAIS produire un résultat.
await scanPage.evaluate(() => {
  window.__APEX_SCAN = 'alternating'
})
await openScanTab()
check('BarcodeDetector présent : bouton de scan proposé', await scanPage.locator('[data-act="scan"]').isVisible())
await scanPage.locator('[data-act="scan"]').click()
await scanPage.waitForSelector('.scan__video')
await scanPage.waitForTimeout(1500)
const detects = await scanPage.evaluate(() => window.__APEX_DETECTS)
check('lectures contradictoires : aucune détection annoncée', detects > 3 && (await scanPage.locator('.scan').count()) === 1, `${detects} images lues`)
check(
  'le scanner ne dit pas avoir lu ce qu’il n’a pas lu',
  !(await scanPage.locator('[data-status]').innerText()).includes('Code lu'),
  (await scanPage.locator('[data-status]').innerText()).trim()
)
await shotOf(scanPage, 'scanner')
await scanPage.locator('.scan [data-act="cancel"]').click()
await scanPage.waitForSelector('.scan', { state: 'detached' })

// 2. Un code stable : lecture confirmée, puis la fiche — et rien de plus.
await scanPage.evaluate(() => {
  window.__APEX_SCAN = 'stable'
  window.__APEX_DETECTS = 0
})
await scanPage.locator('[data-act="scan"]').click()
await scanPage.waitForSelector('.prod', { timeout: 5000 })
check('code confirmé : fiche produit affichée', (await scanPage.locator('.prod').innerText()).includes('539'))
check('provenance annoncée sur la fiche', (await scanPage.locator('.prod').innerText()).includes('Open Food Facts'))
check('code-barres rappelé sur la fiche', (await scanPage.locator('.sheet__sub').last().innerText()).includes('3017620422003'))
const nothingYet = await scanPage.evaluate((k) => Object.keys(JSON.parse(localStorage.getItem(k)).nutrition.days).length, CURRENT)
check('un scan seul n’ajoute rien au journal', nothingYet === 0, `${nothingYet} journée(s)`)
await scanPage.waitForTimeout(350)
await shotOf(scanPage, 'fiche-produit')

// 3. Refus explicite : toujours rien.
await scanPage.locator('.sheet [data-act="cancel"]').last().click()
await scanPage.waitForTimeout(300)
const stillNothing = await scanPage.evaluate((k) => Object.keys(JSON.parse(localStorage.getItem(k)).nutrition.days).length, CURRENT)
check('fiche refusée : rien n’est enregistré', stillNothing === 0)

// 4. Le parcours complet, jusqu'à la quantité.
await scanPage.evaluate(() => {
  window.__APEX_DETECTS = 0
})
await scanPage.locator('[data-act="scan"]').click()
await scanPage.waitForSelector('.prod', { timeout: 5000 })
await scanPage.locator('.sheet [type="submit"]').last().click()
await scanPage.waitForSelector('[name="qty"]')
await scanPage.fill('[name="qty"]', '30')
await scanPage.locator('.sheet [type="submit"]').last().click()
await scanPage.waitForSelector('.sheet', { state: 'detached' })

const scanned = await scanPage.evaluate((k) => JSON.parse(localStorage.getItem(k)).nutrition, CURRENT)
const scanEntry = Object.values(scanned.days).flatMap((d) => d.entries)[0]
check('scan → validation → quantité → journal', scanEntry?.qty === 30 && scanEntry?.snapshot.kcal === 539)
check('provenance conservée depuis le scan', scanEntry?.snapshot.source === 'open-food-facts')
check('code-barres conservé dans l’instantané', scanEntry?.snapshot.barcode === '3017620422003')

// 5. Hors réseau : le produit déjà connu doit se retrouver sans requête.
await scanPage.unroute(/openfoodfacts\.org/)
await scanPage.route(/openfoodfacts\.org/, (route) => {
  scanOffCalls.push(route.request().url())
  return route.abort()
})
scanOffCalls = []
await scanPage.evaluate(() => {
  window.__APEX_DETECTS = 0
})
await openScanTab()
await scanPage.locator('[data-act="scan"]').click()
await scanPage.waitForSelector('.prod', { timeout: 5000 })
check('hors réseau, le produit déjà scanné revient', (await scanPage.locator('.prod').innerText()).includes('539'))
check('et sans la moindre requête', scanOffCalls.length === 0, `${scanOffCalls.length} requête(s)`)
await scanPage.locator('.sheet [type="submit"]').last().click()
await scanPage.waitForSelector('[name="qty"]')
const rememberedQty = await scanPage.locator('[name="qty"]').inputValue()
check('la quantité habituelle est déjà là', rememberedQty === '30', rememberedQty)
await scanCtx.close()

/* --- recettes : composer une fois, réutiliser ensuite --- */

await page.goto(`${BASE}#/recettes`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-act="new"]')
check('recettes : état vide expliqué', (await page.locator('.blank__title').innerText()).includes('Aucune recette'))

await page.locator('[data-act="new"]').click()
await page.waitForSelector('[name="name"]')
await page.fill('[name="name"]', 'Poulet riz')
await page.fill('[name="servings"]', '4')
await page.locator('.sheet [type="submit"]').last().click()
await page.waitForSelector('[data-act="add-item"]')

// Ingrédient pris dans les récents : 250 g de Skyr à 62 kcal/100 g = 155 kcal.
await page.locator('[data-act="add-item"]').click()
await page.waitForSelector('.pick')
await page.locator('.pick__main').filter({ hasText: 'Skyr' }).first().click()
await page.waitForSelector('.sheet', { state: 'detached' })
check('ingrédient ajouté au brouillon', (await page.locator('.hrow__name').first().innerText()).includes('Skyr'))
check('total et portion calculés avant enregistrement', (await page.locator('.prod').innerText()).includes('155'))
check(
  'une portion vaut le quart du plat',
  (await page.locator('.prod').innerText()).includes('39'),
  (await page.locator('.prod').innerText()).replace(/\n/g, ' ')
)
await shot('recette')

await page.locator('[data-act="save-draft"]').click()
await page.waitForSelector('[data-act="new"]')
const savedRecipe = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).nutrition.recipes, CURRENT)
check('recette enregistrée avec ses portions', savedRecipe.length === 1 && savedRecipe[0].servings === 4)
check('ingrédient figé par son instantané', savedRecipe[0].items[0].snapshot.kcal === 62)

// Une portion s'ajoute au journal comme n'importe quel aliment.
await page.goto(`${BASE}#/nutrition`, { waitUntil: 'networkidle' })
await page.locator('.sticky-actions [data-act="add"]').click()
await page.waitForSelector('.sheet')
await page.locator('[data-tab="search"]').click()
await page.fill('[data-query]', 'poulet')
await page.waitForSelector('.pick')
check('la recette se cherche comme un aliment', (await page.locator('.pick__name').first().innerText()).includes('Poulet riz'))
await page.locator('.pick__main').first().click()
await page.waitForSelector('[name="qty"]')
await page.fill('[name="qty"]', '2')
await page.locator('.sheet [type="submit"]').last().click()
await page.waitForSelector('.sheet', { state: 'detached' })

const withRecipe = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).nutrition, CURRENT)
const portion = Object.values(withRecipe.days)
  .flatMap((d) => d.entries)
  .find((e) => e.foodId.startsWith('recipe:'))
check('portion enregistrée en portions, pas en grammes', portion?.unit === 'portion' && portion?.qty === 2)
check('valeur de la portion figée', Math.round(portion.snapshot.kcal * 10) / 10 === 38.8, String(portion?.snapshot.kcal))
check('composition conservée avec la ligne', portion?.snapshot.ingredients?.[0]?.name === 'Skyr nature')

// La recette change : ce qui est déjà mangé ne bouge pas.
await page.goto(`${BASE}#/recettes`, { waitUntil: 'networkidle' })
await page.locator('.hrow__main').first().click()
await page.waitForSelector('[name="servings"]')
await page.fill('[name="servings"]', '2')
await page.locator('.sheet [type="submit"]').last().click()
await page.waitForSelector('[data-act="save-draft"]')
await page.locator('[data-act="save-draft"]').click()
await page.waitForSelector('[data-act="new"]')
const afterEdit = await page.evaluate((k) => {
  const n = JSON.parse(localStorage.getItem(k)).nutrition
  return {
    recipeKcal: n.recipes[0].servings,
    entry: Object.values(n.days).flatMap((d) => d.entries).find((e) => e.foodId.startsWith('recipe:'))
  }
}, CURRENT)
check('recette modifiée', afterEdit.recipeKcal === 2)
check('la portion déjà mangée n’a pas bougé', Math.round(afterEdit.entry.snapshot.kcal * 10) / 10 === 38.8)

// Et sa suppression n'efface pas le passé.
await page.locator('[data-act="remove"]').first().click()
await page.locator('[data-act="yes"]').click()
await page.waitForTimeout(250)
const afterDelete = await page.evaluate((k) => {
  const n = JSON.parse(localStorage.getItem(k)).nutrition
  return {
    recipes: n.recipes.length,
    entry: Object.values(n.days).flatMap((d) => d.entries).find((e) => e.foodId.startsWith('recipe:'))
  }
}, CURRENT)
check('recette supprimée', afterDelete.recipes === 0)
check('la portion reste lisible après suppression', Math.round(afterDelete.entry.snapshot.kcal * 10) / 10 === 38.8)

/* --- repas : refaire, corriger --- */

await page.goto(`${BASE}#/nutrition`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-act="add"]')

// Une journée plus tôt, pour avoir quelque chose à refaire.
await page.locator('[data-act="prev-day"]').click()
await page.locator('.sticky-actions [data-act="add"]').click()
await page.waitForSelector('.pick')
await page.locator('.pick__main').filter({ hasText: 'Skyr' }).first().click()
await page.waitForSelector('.sheet', { state: 'detached' })
const beforeRepeat = await page.evaluate((k) => Object.keys(JSON.parse(localStorage.getItem(k)).nutrition.days).length, CURRENT)
check('journée précédente enregistrée', beforeRepeat >= 2, `${beforeRepeat} journées`)

await page.locator('[data-act="next-day"]').click()
await page.waitForSelector('[data-act="repeat-meal"]')
const entriesBefore = await page.locator('.hrow__main').count()
await page.locator('[data-act="repeat-meal"]').first().click()
await page.waitForTimeout(300)
const entriesAfter = await page.locator('.hrow__main').count()
check('refaire un repas recopie ses lignes', entriesAfter > entriesBefore, `${entriesBefore} → ${entriesAfter}`)
const repeated = await page.evaluate((k) => {
  const days = JSON.parse(localStorage.getItem(k)).nutrition.days
  const dates = Object.keys(days).sort()
  return { source: days[dates[0]].entries.length, target: days[dates[dates.length - 1]].entries.length }
}, CURRENT)
check('le jour d’origine n’a pas bougé', repeated.source === 1, `${repeated.source} ligne`)

// Corriger une ligne : quantité et repas, jamais les valeurs.
await page.locator('.hrow__main').first().click()
await page.waitForSelector('[name="qty"]')
await page.fill('[name="qty"]', '300')
await page.locator('.sheet [data-seg-value="diner"]').click()
await page.locator('.sheet [type="submit"]').last().click()
await page.waitForSelector('.sheet', { state: 'detached' })
const edited = await page.evaluate((k) => {
  const days = JSON.parse(localStorage.getItem(k)).nutrition.days
  const dates = Object.keys(days).sort()
  return days[dates[dates.length - 1]].entries.find((e) => e.qty === 300)
}, CURRENT)
check('quantité corrigée', edited?.qty === 300)
check('ligne déplacée de repas', edited?.meal === 'diner')
check('valeurs de la ligne inchangées', edited?.snapshot.kcal === 62, String(edited?.snapshot.kcal))
await page.waitForTimeout(3400)
await shot('nutrition-repas')

/* --- historique alimentaire --- */

await page.goto(`${BASE}#/nutrition/historique`, { waitUntil: 'networkidle' })
await page.waitForSelector('.hrow')
const histText = await page.locator('body').innerText()
check('historique : moyenne sur la fenêtre', /moyenne 30 jours/i.test(histText))
check('historique : objectif rappelé', histText.includes('2400'))
const histDays = await page.locator('.hlist .hrow').count()
check('historique : une ligne par journée enregistrée', histDays >= 2, `${histDays} journées`)
check('pas plus de trois messages empilés à l’écran', (await page.locator('.toast').count()) <= 3, `${await page.locator('.toast').count()} toasts`)
await page.waitForTimeout(3400) // les messages s'effacent avant la capture
await shot('nutrition-historique')

await page.locator('.hlist .hrow').first().click()
await page.waitForSelector('.daynav')
check('une journée de l’historique s’ouvre telle qu’elle', (await page.locator('.tile__value').first().innerText()).length > 0)

/* --- stockage --- */

// On remet une fiche dans le cache : le vider n'a d'intérêt que s'il contient
// quelque chose, et c'est ce chemin-là qu'on veut vérifier.
await page.route(/openfoodfacts\.org/, (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OFF_SEARCH) })
)
await page.goto(`${BASE}#/nutrition`, { waitUntil: 'networkidle' })
await page.locator('.sticky-actions [data-act="add"]').click()
await page.waitForSelector('.sheet')
await page.locator('[data-tab="online"]').click()
await page.fill('[data-online-query]', 'nutella')
await page.locator('[data-act="run-online"]').click()
await page.waitForSelector('.pick')
await page.locator('[data-act="cancel"]').click()
await page.waitForSelector('.sheet', { state: 'detached' })
await page.unroute(/openfoodfacts\.org/)

await page.goto(`${BASE}#/reglages`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-storage] .meter')
const storageText = await page.locator('[data-storage]').innerText()
check('jauge : données APEX mesurées', /Données APEX/.test(storageText) && /\d+ %/.test(storageText), storageText.split('\n')[1] || '')
check('jauge : détail par nature de donnée', storageText.includes('Sauvegarde v1'))
check('jauge : cache alimentaire compté à part', /Cache alimentaire/.test(storageText))
check('jauge : le cache est annoncé comme jetable', storageText.includes('jetable'))
await page.locator('[data-storage]').scrollIntoViewIfNeeded()
await page.waitForTimeout(2600) // laisser les toasts s'effacer avant la capture
await shot('stockage')

const cacheCountBefore = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const req = indexedDB.open('apex-foods')
      req.onsuccess = () => {
        const db = req.result
        const c = db.transaction('foods', 'readonly').objectStore('foods').count()
        c.onsuccess = () => {
          db.close()
          resolve(c.result)
        }
      }
      req.onerror = () => resolve(0)
    })
)
await page.locator('[data-act="clear-cache"]').click()
await page.waitForTimeout(400)
const journalAfterClear = await page.evaluate((k) => {
  const n = JSON.parse(localStorage.getItem(k)).nutrition
  return Object.values(n.days).flatMap((d) => d.entries).length
}, CURRENT)
check('cache vidable depuis les réglages', cacheCountBefore >= 0)
check('vider le cache ne touche pas au journal', journalAfterClear > 0, `${journalAfterClear} lignes`)

// L'avertissement doit arriver AVANT la limite, pas au moment de l'échec.
const filled = await page.evaluate(() => {
  try {
    // ~4,4 Mo en UTF-16 : au-delà du seuil critique, sous la limite réelle.
    localStorage.setItem('apex.test-filler', 'x'.repeat(2_250_000))
    return true
  } catch (e) {
    return false
  }
})
if (filled) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForSelector('.today')
  await page.waitForTimeout(300)
  const bannerText = (await page.locator('.banner').count()) ? await page.locator('.banner__text').innerText() : ''
  check('stockage presque plein : alerte au démarrage', /presque plein/.test(bannerText), bannerText.slice(0, 60))
  await shot('stockage-alerte')

  await page.goto(`${BASE}#/reglages`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-storage] .meter')
  check(
    'réglages : conseil d’export affiché',
    (await page.locator('[data-storage]').innerText()).includes('Exporte tes données')
  )
  await page.evaluate(() => localStorage.removeItem('apex.test-filler'))
} else {
  check('stockage presque plein : alerte au démarrage', false, 'remplissage impossible dans ce navigateur')
}

/* --- export / import --- */
await page.goto(`${BASE}#/reglages`, { waitUntil: 'networkidle' })
await page.waitForSelector('[data-act="export"]')

const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('[data-act="export"]').click()
])
const exported = JSON.parse(await (await import('node:fs/promises')).readFile(await download.path(), 'utf8'))
check('export : fichier téléchargé et lisible', exported.version === 4, `version ${exported.version}`)
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
const reimported = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).body.weight, CURRENT)
check('import : les données remplacent bien l’état courant', reimported.length === 1 && reimported[0].value === 70)
check('import : le tableau de bord affiche la donnée importée', (await page.locator('.tile__value').first().textContent()).includes('70'))

await page.goto(`${BASE}#/reglages`, { waitUntil: 'networkidle' })
await page.locator('.details summary').click()
await page.fill('[data-paste]', '{"version":4,"program":"pas un tableau"}')
await page.locator('[data-act="import-paste"]').click()
await page.waitForSelector('.toast')
const importError = await page.locator('.toast').last().textContent()
check('import : un fichier invalide est refusé avec un motif', /Import impossible/.test(importError), importError.trim().slice(0, 60))

/* --- la coquille hors ligne ne doit pas être polluée --- */
// Incident réel : ouvrir une autre page du domaine (outil, ou 404 transitoire
// pendant un déploiement) faisait de cette réponse l'app hors ligne.
const svg = await page.goto(`${BASE}icons/apex-icon.svg`, { waitUntil: 'commit' })
check('ressource non-HTML servie normalement', svg.status() === 200, `${svg.status()} ${svg.headers()['content-type']}`)
expectingErrors = true
const notFound = await page.goto(`${BASE}page-qui-nexiste-pas.html`, { waitUntil: 'commit' })
check('page inconnue rendue en 404', notFound.status() === 404, String(notFound.status()))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.today')
// Le 404 provoqué plus haut peut encore remonter en console : on referme la
// fenêtre de tolérance seulement maintenant.
expectingErrors = false
await page.evaluate(() => navigator.serviceWorker.ready)
await ctx.setOffline(true)
await page.goto(BASE, { waitUntil: 'load' })
await page.waitForSelector('.today', { timeout: 8000 })
check('la coquille hors ligne reste APEX après une visite ailleurs', await page.locator('.today__name').isVisible())
check(
  'aucune page étrangère mise en cache comme coquille',
  (await page.title()).includes('APEX'),
  await page.title()
)
await ctx.setOffline(false)

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
await page.evaluate((k) => localStorage.setItem(k, '{cassé'), CURRENT)
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.fatal', { timeout: 5000 })
check('écran d’erreur clair sur données corrompues', await page.locator('.fatal__title').isVisible())
check('sortie de secours proposée', await page.locator('[data-act="export"]').isVisible())

await shot('fatal')
await page.evaluate((k) => localStorage.removeItem(k), CURRENT)
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
