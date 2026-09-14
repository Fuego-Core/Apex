import { openScanner as legacyOpenScanner } from './nutrition-scanner.js'
import './nutrition-scanner-v2.css'

let controls = null
let active = false
let fallbackObserver = null

const commonFoods = {
  eggs: { name: 'Œufs entiers', kcal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  chicken: { name: 'Blanc de poulet', kcal: 120, protein: 23, carbs: 0, fat: 2.6 },
  rice: { name: 'Riz cuit', kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  pasta: { name: 'Pâtes cuites', kcal: 157, protein: 5.8, carbs: 30.9, fat: 0.9 },
  skyr: { name: 'Skyr nature', kcal: 63, protein: 10.8, carbs: 4, fat: 0.2 }
}

function stop() {
  active = false
  try { controls?.stop?.() } catch {}
  controls = null
  document.querySelector('.apex-scan-v2')?.remove()
}

async function sendToApex(code) {
  stop()
  await legacyOpenScanner()
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const input = document.querySelector('#manualBarcode')
  const button = document.querySelector('#manualSearch')
  if (!input || !button) return
  input.value = String(code || '').replace(/\D/g, '')
  button.click()
}

function attachFallbackEnhancer() {
  fallbackObserver?.disconnect?.()
  fallbackObserver = new MutationObserver(() => {
    const panel = document.querySelector('.scanner-panel')
    const title = panel?.querySelector('.scanner-head h2')?.textContent?.trim()
    if (!panel || title !== 'Produit non trouvé' || panel.querySelector('.quick-food-fallback')) return

    const error = panel.querySelector('.scanner-error')
    error?.insertAdjacentHTML('afterend', `
      <div class="quick-food-fallback">
        <strong>Aliment courant ?</strong>
        <p>Si le produit n'existe pas encore dans la base, pars d'une valeur moyenne puis corrige l'étiquette si besoin.</p>
        <div>
          <button data-common-food="eggs">Œufs</button>
          <button data-common-food="chicken">Poulet</button>
          <button data-common-food="rice">Riz</button>
          <button data-common-food="pasta">Pâtes</button>
          <button data-common-food="skyr">Skyr</button>
        </div>
      </div>`)

    panel.querySelectorAll('[data-common-food]').forEach((button) => {
      button.onclick = async () => {
        const food = commonFoods[button.dataset.commonFood]
        panel.querySelector('#manualCreate')?.click()
        await new Promise((resolve) => requestAnimationFrame(resolve))
        const values = { mName: food.name, mKcal: food.kcal, mProtein: food.protein, mCarbs: food.carbs, mFat: food.fat }
        Object.entries(values).forEach(([id, value]) => {
          const field = document.getElementById(id)
          if (field) field.value = value
        })
      }
    })
  })
  fallbackObserver.observe(document.body, { childList: true, subtree: true })
}

async function startZXing(video, status) {
  const module = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm')
  const reader = new module.BrowserMultiFormatReader()
  active = true
  controls = await reader.decodeFromConstraints({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30 }
    }
  }, video, async (result) => {
    if (!active || !result) return
    const value = result.getText?.() || ''
    if (!/^\d{8,14}$/.test(value)) return
    active = false
    try { navigator.vibrate?.(60) } catch {}
    if (status) status.textContent = `Code détecté : ${value}`
    await sendToApex(value)
  })
}

async function openBetterScanner() {
  stop()
  document.body.insertAdjacentHTML('beforeend', `
    <div class="apex-scan-v2">
      <section class="apex-scan-v2__panel">
        <header><div><span>APEX SCAN</span><h2>Scanner un produit</h2></div><button id="scanV2Close" aria-label="Fermer">×</button></header>
        <div class="apex-scan-v2__camera">
          <video id="scanV2Video" playsinline muted></video>
          <div class="apex-scan-v2__shade"></div>
          <div class="apex-scan-v2__frame"><i></i></div>
        </div>
        <p class="apex-scan-v2__status" id="scanV2Status">Cadre le code-barres. Garde le téléphone stable à 15–25 cm.</p>
        <div class="apex-scan-v2__manual">
          <label for="scanV2Manual">Code-barres</label>
          <div><input id="scanV2Manual" inputmode="numeric" autocomplete="off" placeholder="Ex. 3017620422003"><button id="scanV2Search">Rechercher</button></div>
        </div>
        <p class="apex-scan-v2__hint">Si un code est lu mais absent de la base, APEX te proposera une saisie rapide au lieu de te bloquer.</p>
      </section>
    </div>`)

  const root = document.querySelector('.apex-scan-v2')
  const video = document.querySelector('#scanV2Video')
  const status = document.querySelector('#scanV2Status')
  document.querySelector('#scanV2Close').onclick = stop
  root.addEventListener('click', (event) => { if (event.target === root) stop() })
  document.querySelector('#scanV2Search').onclick = () => {
    const code = document.querySelector('#scanV2Manual').value.trim()
    if (code.length >= 8) sendToApex(code)
    else status.textContent = 'Entre au moins 8 chiffres.'
  }

  try {
    status.textContent = 'Activation de la caméra arrière…'
    await startZXing(video, status)
    status.textContent = 'Scanner prêt — place le code-barres dans le cadre.'
  } catch {
    status.textContent = 'Caméra indisponible. Tu peux saisir le code juste en dessous.'
  }
}

function install() {
  attachFallbackEnhancer()
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('#openScanner')
    if (!button) return
    event.preventDefault()
    event.stopImmediatePropagation()
    openBetterScanner()
  }, true)
}

install()
