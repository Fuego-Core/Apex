/* CAPTURES D'ÉCRAN — outil de travail de la refonte, pas un test.
   Sert le build de production et photographie chaque écran, mobile et desktop.

   Lancer :  npm run build && node tests/e2e/shots.mjs [dossier]
   Avec des données : APEX_SEED=1 pré-remplit un état réaliste. */

import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { mkdirSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const OUT = process.argv[2] || 'shots'
mkdirSync(OUT, { recursive: true })

const ROOT = new URL('../../dist', import.meta.url).pathname
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
}
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0])
    if (p === '/') p = '/index.html'
    const body = await readFile(join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, '')))
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('nf')
  }
})
await new Promise((r) => server.listen(4181, r))
const BASE = 'http://localhost:4181/'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })

async function seed(page) {
  if (!process.env.APEX_SEED) return
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    const key = 'apex.v4'
    const state = JSON.parse(localStorage.getItem(key))
    const day = (offset) => {
      const d = new Date()
      d.setDate(d.getDate() - offset)
      return d.toISOString().slice(0, 10)
    }
    // Poids sur 3 semaines, en légère baisse.
    state.body.weight = Array.from({ length: 21 }, (_, i) => ({ date: day(20 - i), value: Math.round((81.6 - i * 0.06 + Math.sin(i) * 0.25) * 10) / 10 }))
    state.body.waist = [ { date: day(14), value: 84 }, { date: day(0), value: 83.2 } ]
    state.profile = { ...state.profile, sex: 'homme', birthYear: 1994, height: 178, goal: 'seche', activity: 'modere', trainingDays: 4, updatedAt: new Date().toISOString() }
    state.goals = [
      { id: 'g1', kind: 'weight', title: 'Descendre à 78 kg', metric: 'weight', direction: 'down', target: 78, unit: 'kg', createdAt: new Date().toISOString() }
    ]
    state.nutrition.targets = { ...state.nutrition.targets, mode: 'manual', kcal: 2400, protein: 160, updatedAt: new Date().toISOString() }
    const snap = { name: 'Skyr nature', brand: 'Danone', source: 'user-created', barcode: null, per: 100, unit: 'g', servingSize: null, kcal: 62, protein: 10, carbs: 4, fat: 0.2, fiber: 0, ingredients: null }
    const snap2 = { name: 'Poulet rôti', brand: null, source: 'user-created', barcode: null, per: 100, unit: 'g', servingSize: null, kcal: 165, protein: 28, carbs: 0, fat: 5.5, fiber: null, ingredients: null }
    const entry = (id, meal, s, qty, at) => ({ id, meal, foodId: 'user:' + s.name.toLowerCase().replace(/[^a-z]+/g, '-'), qty, unit: 'g', at, snapshot: s })
    state.nutrition.days[day(0)] = { date: day(0), entries: [
      entry('n1', 'petit-dejeuner', snap, 250, new Date().toISOString()),
      entry('n2', 'dejeuner', snap2, 180, new Date().toISOString()),
      entry('n3', 'dejeuner', snap, 150, new Date().toISOString())
    ], note: '' }
    state.nutrition.days[day(1)] = { date: day(1), entries: [entry('n4', 'diner', snap2, 200, new Date(Date.now() - 86400000).toISOString())], note: '' }
    state.nutrition.usage['user:skyr-nature'] = { count: 9, lastAt: new Date().toISOString(), lastQty: 250, unit: 'g', favorite: true, snapshot: snap }
    state.nutrition.usage['user:poulet-r-ti'] = { count: 5, lastAt: new Date().toISOString(), lastQty: 180, unit: 'g', favorite: false, snapshot: snap2 }
    // Une séance d'historique pour la force.
    state.history = [{
      id: 'h1', sessionId: 'push', sessionName: 'Push',
      startedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      endedAt: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString(),
      durationSec: 3600, tonnage: 4120,
      entries: [{ exerciseId: 'supine-press-machine', name: 'Supine Press machine', mode: 'reps', assisted: false, repMin: 6, repMax: 8, status: 'garder', weightUsed: 55, suggested: 55, record: true, sets: [{ warmup: false, done: true, reps: 8, weight: 55, seconds: null }] }]
    }]
    state.program[0].lastDoneAt = new Date(Date.now() - 2 * 86400000).toISOString()
    localStorage.setItem(key, JSON.stringify(state))
  })
  // L'état vit en mémoire : seul un vrai rechargement relit le stockage.
  await page.reload({ waitUntil: 'networkidle' })
}

const routes = [
  ['accueil', '#/'],
  ['entrainement', '#/seances'],
  ['nutrition', '#/nutrition'],
  ['progression', '#/progression'],
  ['profil', '#/profil'],
  ['corps', '#/corps'],
  ['objectifs', '#/objectifs'],
  ['historique', '#/historique'],
  ['recettes', '#/recettes'],
  ['nutrition-historique', '#/nutrition/historique'],
  ['reglages', '#/reglages']
]

for (const [device, viewport, suffix] of [
  ['mobile', { width: 390, height: 844 }, ''],
  ['desktop', { width: 1440, height: 900 }, '-desktop']
]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: device === 'mobile' ? 2 : 1, isMobile: device === 'mobile', hasTouch: device === 'mobile' })
  const page = await ctx.newPage()
  await seed(page)
  for (const [name, hash] of routes) {
    await page.goto(BASE + hash, { waitUntil: 'networkidle' })
    await page.waitForTimeout(450)
    await page.screenshot({ path: `${OUT}/${name}${suffix}.png` })
  }
  // Le flux de séance (sans navigation) : préparation, effort, repos.
  await page.goto(BASE + '#/seance/push', { waitUntil: 'networkidle' })
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${OUT}/seance-prep${suffix}.png` })
  await page.click('[data-act="start"]')
  await page.waitForSelector('.exo')
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${OUT}/seance-workout${suffix}.png` })
  await page.locator('.set').first().locator('[data-input="reps"]').fill('7')
  await page.locator('.set').first().locator('.set__ok').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/seance-timer${suffix}.png` })
  await page.locator('.timer button:has-text("Passer")').click().catch(() => {})
  // La feuille d'ajout d'aliment, verre compris.
  await page.goto(BASE + '#/nutrition', { waitUntil: 'networkidle' })
  await page.locator('.sticky-actions [data-act="add"]').click()
  await page.waitForSelector('.sheet')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/picker${suffix}.png` })
  await ctx.close()
}

await browser.close()
server.close()
console.log('captures →', OUT)
