/* SONDE OPEN FOOD FACTS — écran temporaire de l'étape 0 de la Phase 2.

   Pourquoi un écran de l'app et pas une page à part : une page séparée dépend
   du service worker, du cache et du mode d'ouverture (onglet ou PWA installée).
   Ici, on est dans le document que l'utilisateur ouvre déjà — s'il voit APEX,
   il voit la sonde.

   Elle ne lit ni n'écrit aucune donnée APEX. Elle sera retirée dès le relevé
   fait, avec la route qui la sert. */

import { esc, header, toast } from '../ui.js'

const BASE = 'https://world.openfoodfacts.org'
const FIELDS = [
  'code',
  'product_name',
  'product_name_fr',
  'brands',
  'quantity',
  'serving_size',
  'nutrition_data_per',
  'nutriments'
].join(',')
const IDENT = 'app_name=APEX&app_version=phase2-probe&app_uuid=probe-anon'

const BARCODES = [
  ['3033710065967', 'LU Petit Déjeuner'],
  ['3017620422003', 'Nutella'],
  ['5449000000996', 'Coca-Cola'],
  ['3229820129488', 'Bjorg'],
  ['20724696', 'Code court (EAN-8)'],
  ['3175680011480', 'Gerblé'],
  ['0000000000000', 'Code inexistant']
]

async function timedFetch(url, limit = 8000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), limit)
  const t0 = performance.now()
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    const elapsed = Math.round(performance.now() - t0)
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch (e) {
      /* réponse non JSON : on garde le début du corps pour le rapport */
    }
    return {
      ok: res.ok,
      status: res.status,
      ms: elapsed,
      cors: res.headers.get('access-control-allow-origin'),
      bytes: text.length,
      json,
      bodyStart: json ? null : text.slice(0, 160)
    }
  } catch (e) {
    return { error: String(e?.message || e), ms: Math.round(performance.now() - t0) }
  } finally {
    clearTimeout(timer)
  }
}

/** Ce que la fiche contient réellement, champ par champ. */
function inspect(product) {
  if (!product) return { present: false }
  const n = product.nutriments || {}
  const has = (k) => Object.prototype.hasOwnProperty.call(n, k) && n[k] !== '' && n[k] !== null
  const value = (k) => (has(k) ? n[k] : null)
  return {
    present: true,
    name: product.product_name || product.product_name_fr || null,
    brands: product.brands || null,
    quantity: product.quantity || null,
    serving_size: product.serving_size || null,
    nutrition_data_per: product.nutrition_data_per || null,
    nutrimentKeys: Object.keys(n).length,
    kcal_100g: value('energy-kcal_100g'),
    kj_100g: value('energy_100g'),
    energy_unit: n.energy_unit || null,
    proteins_100g: value('proteins_100g'),
    carbohydrates_100g: value('carbohydrates_100g'),
    fat_100g: value('fat_100g'),
    fiber_100g: value('fiber_100g'),
    kcal_serving: value('energy-kcal_serving'),
    // Utilisable par APEX = une énergie (kcal ou kJ) ET les trois macros.
    usableForApex:
      (has('energy-kcal_100g') || has('energy_100g')) &&
      has('proteins_100g') &&
      has('carbohydrates_100g') &&
      has('fat_100g')
  }
}

async function deviceCapabilities() {
  const caps = {
    userAgent: navigator.userAgent,
    origin: location.origin,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    secureContext: window.isSecureContext,
    online: navigator.onLine,
    barcodeDetector: 'BarcodeDetector' in window,
    barcodeFormats: null,
    camera: !!navigator.mediaDevices?.getUserMedia,
    indexedDB: 'indexedDB' in window,
    storage: null,
    persisted: null
  }
  if (caps.barcodeDetector) {
    try {
      caps.barcodeFormats = await window.BarcodeDetector.getSupportedFormats()
    } catch (e) {
      caps.barcodeFormats = `erreur : ${e?.message || e}`
    }
  }
  try {
    const est = await navigator.storage.estimate()
    caps.storage = {
      quotaMB: Math.round(est.quota / 1048576),
      usageMB: Math.round((est.usage / 1048576) * 100) / 100
    }
    caps.persisted = await navigator.storage.persisted()
  } catch (e) {
    caps.storage = 'indisponible'
  }
  return caps
}

export default function probeView(root) {
  root.innerHTML = `
    <div class="page">
      ${header({ back: '#/', title: 'Sonde', sub: 'Open Food Facts · étape 0' })}

      <div class="card">
        <p class="note" style="margin-top:0">
          Écran temporaire. Il interroge Open Food Facts depuis cette origine et relève ce que
          l'appareil sait faire. Il ne lit ni n'écrit aucune donnée APEX.
        </p>
        <button class="btn btn--gold btn--block btn--lg" data-act="run" style="margin-top:var(--sp-4)">
          Lancer la sonde
        </button>
      </div>

      <div class="stack" data-live style="margin-top:var(--sp-4)"></div>

      <div class="card" data-result hidden style="margin-top:var(--sp-4)">
        <p class="note" style="margin-top:0">Résultat à copier :</p>
        <textarea class="textarea" rows="10" readonly data-out></textarea>
        <button class="btn btn--ghost btn--block" data-act="copy" style="margin-top:var(--sp-3)">
          Copier le résultat
        </button>
      </div>

    </div>`

  const live = root.querySelector('[data-live]')
  const runBtn = root.querySelector('[data-act="run"]')

  const line = (label, value, tone = '') => {
    const el = document.createElement('div')
    el.className = 'row'
    el.innerHTML = `
      <div class="row__main"><p class="row__title">${esc(label)}</p></div>
      <span class="row__meta ${tone ? `tile__hint--${tone}` : ''}">${esc(value)}</span>`
    live.appendChild(el)
  }

  async function run() {
    runBtn.disabled = true
    runBtn.textContent = 'Sonde en cours…'
    live.innerHTML = ''
    root.querySelector('[data-result]').hidden = true

    const report = {
      ranAt: new Date().toISOString(),
      device: null,
      cors: null,
      products: {},
      identification: null,
      search: null,
      burst: null
    }

    report.device = await deviceCapabilities()
    line('BarcodeDetector', report.device.barcodeDetector ? 'disponible' : 'absent', report.device.barcodeDetector ? 'down' : 'up')
    if (report.device.barcodeFormats) line('Formats lus', String(report.device.barcodeFormats).slice(0, 60))
    line('Caméra', report.device.camera ? 'disponible' : 'absente', report.device.camera ? 'down' : 'up')
    line('IndexedDB', report.device.indexedDB ? 'disponible' : 'absent', report.device.indexedDB ? 'down' : 'up')
    line('Quota stockage', report.device.storage?.quotaMB ? `${report.device.storage.quotaMB} Mo` : String(report.device.storage))

    for (const [code, label] of BARCODES) {
      const res = await timedFetch(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}&${IDENT}`)
      const product = res.json?.product
      const fields = inspect(product)
      report.products[code] = {
        label,
        httpStatus: res.status ?? null,
        ms: res.ms,
        bytes: res.bytes ?? null,
        cors: res.cors ?? null,
        error: res.error ?? null,
        apiStatus: res.json?.status ?? null,
        statusVerbose: res.json?.status_verbose ?? null,
        fields
      }
      if (report.cors === null && res.cors) report.cors = res.cors

      line(
        label,
        res.error
          ? `échec : ${res.error}`
          : fields.present
            ? `${fields.usableForApex ? 'complet' : 'incomplet'} · ${res.ms} ms`
            : `introuvable · ${res.ms} ms`,
        res.error ? 'up' : fields.usableForApex ? 'down' : ''
      )
    }

    const ident = await timedFetch(`${BASE}/api/v2/product/3017620422003.json?fields=code,product_name&${IDENT}`)
    report.identification = {
      accepted: !!ident.json?.product,
      httpStatus: ident.status ?? null,
      ms: ident.ms,
      error: ident.error ?? null
    }
    line('Paramètres app_name/app_uuid', report.identification.accepted ? 'acceptés' : 'refusés', report.identification.accepted ? 'down' : 'up')

    const search = await timedFetch(
      `${BASE}/cgi/search.pl?search_terms=skyr&search_simple=1&action=process&json=1&page_size=5&fields=code,product_name,brands&${IDENT}`,
      12000
    )
    report.search = {
      httpStatus: search.status ?? null,
      ms: search.ms,
      bytes: search.bytes ?? null,
      error: search.error ?? null,
      count: search.json?.count ?? null,
      returned: Array.isArray(search.json?.products) ? search.json.products.length : null,
      firstNames: Array.isArray(search.json?.products)
        ? search.json.products.slice(0, 5).map((p) => p.product_name || '(sans nom)')
        : null
    }
    line(
      'Recherche « skyr »',
      search.error ? `échec : ${search.error}` : `${report.search.returned} résultats · ${search.ms} ms · ${Math.round((search.bytes || 0) / 1024)} ko`,
      search.error ? 'up' : 'down'
    )

    // Trois lectures d'affilée : voir si le débit est bridé en usage normal.
    const burst = []
    for (let i = 0; i < 3; i++) {
      const r = await timedFetch(`${BASE}/api/v2/product/${BARCODES[i][0]}.json?fields=code&${IDENT}`, 8000)
      burst.push({ status: r.status ?? null, ms: r.ms, error: r.error ?? null })
    }
    report.burst = burst
    const failed = burst.filter((b) => b.error).length
    const refused = burst.filter((b) => b.status && b.status !== 200).length
    line(
      '3 requêtes d’affilée',
      failed
        ? `${failed} en échec réseau`
        : refused
          ? `${refused} refusée(s)`
          : 'toutes acceptées',
      failed || refused ? 'up' : 'down'
    )

    root.querySelector('[data-out]').value = JSON.stringify(report, null, 2)
    root.querySelector('[data-result]').hidden = false
    runBtn.disabled = false
    runBtn.textContent = 'Relancer la sonde'
    root.querySelector('[data-result]').scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function onClick(e) {
    const act = e.target.closest('[data-act]')?.dataset.act
    if (act === 'run') {
      await run().catch((error) => {
        // Même en cas d'imprévu, l'écran doit dire quelque chose.
        line('Erreur inattendue', String(error?.message || error), 'up')
        runBtn.disabled = false
        runBtn.textContent = 'Relancer la sonde'
      })
    } else if (act === 'copy') {
      const out = root.querySelector('[data-out]')
      try {
        await navigator.clipboard.writeText(out.value)
        toast('Résultat copié', 'gold')
      } catch (err) {
        out.select()
        toast('Sélectionne et copie le texte', 'warn')
      }
    }
  }

  root.addEventListener('click', onClick)
  return () => root.removeEventListener('click', onClick)
}
